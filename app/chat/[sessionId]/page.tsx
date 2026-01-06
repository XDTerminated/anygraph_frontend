"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  Plus,
  Trash2,
  Loader2,
  Upload,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Code,
  X,
  CheckCircle2,
} from "lucide-react";
import { chatAPI, datasetAPI, queryAPI } from "@/lib/api";
import { useUploadThing } from "@/lib/uploadthing";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  message_id: string;
  sender: "user" | "assistant" | "system";
  message_txt: string;
  created_at: string;
  generated_code?: string | null;
}

interface Dataset {
  dataset_url: string;
  name: string;
  file_type: string;
}

interface DatasetObservation {
  [key: string]: any;
}

interface ObservationsData {
  observations: DatasetObservation[];
  columns: { name: string; dtype: string }[];
  total_count: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

interface UploadedFile {
  url?: string;
  ufsUrl?: string;
  appUrl?: string;
  name: string;
}

interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
  };
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const sessionId = params.sessionId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [uploadingDataset, setUploadingDataset] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [streamingCode, setStreamingCode] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [expandedCodeIds, setExpandedCodeIds] = useState<Set<string>>(new Set());
  const [showObservationsModal, setShowObservationsModal] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [observationsData, setObservationsData] = useState<ObservationsData | null>(null);
  const [loadingObservations, setLoadingObservations] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChatData = useCallback(async () => {
    if (!user?.primaryEmailAddress?.emailAddress) return;

    try {
      setInitialLoading(true);
      const sessionResponse = await chatAPI.getSessionFull(
        sessionId,
        user.primaryEmailAddress.emailAddress
      );
      setMessages(sessionResponse.data.messages || []);
      const datasetsResponse = await datasetAPI.getSessionDatasets(sessionId);
      setDatasets(datasetsResponse.data.datasets || []);
    } catch (error) {
      const apiError = error as ApiError & { response?: { status?: number } };
      if (apiError.response?.status === 403) {
        toast.error("You don't have access to this session");
        router.push("/dashboard");
        return;
      }
      if (apiError.response?.status === 404) {
        toast.error("Session not found");
        router.push("/dashboard");
        return;
      }
      toast.error("Failed to load chat");
    } finally {
      setInitialLoading(false);
    }
  }, [sessionId, user?.primaryEmailAddress?.emailAddress, router]);

  useEffect(() => {
    if (isLoaded && user) {
      loadChatData();
    }
  }, [isLoaded, user, sessionId, loadChatData]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || !user?.primaryEmailAddress?.emailAddress) return;
    if (datasets.length === 0) {
      toast.error("Please upload a dataset first");
      return;
    }

    const userMessage = input.trim();
    const tempUserMsgId = Date.now().toString();
    const tempAssistantMsgId = tempUserMsgId + "_assistant";
    setInput("");
    setLoading(true);
    setStreamingCode("");
    setIsExecuting(false);

    const tempUserMsg: Message = {
      message_id: tempUserMsgId,
      sender: "user",
      message_txt: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    const tempAssistantMsg: Message = {
      message_id: tempAssistantMsgId,
      sender: "assistant",
      message_txt: "",
      created_at: new Date().toISOString(),
      generated_code: null,
    };
    setMessages((prev) => [...prev, tempAssistantMsg]);

    setExpandedCodeIds((prev) => new Set([...prev, tempAssistantMsgId]));

    await queryAPI.executeStream(
      userMessage,
      datasets[0].dataset_url,
      sessionId,
      {
        onCodeChunk: (chunk) => {
          setStreamingCode((prev) => prev + chunk);
        },
        onCodeComplete: (code) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.message_id === tempAssistantMsgId
                ? { ...msg, generated_code: code }
                : msg
            )
          );
        },
        onExecuting: () => {
          setIsExecuting(true);
        },
        onResultChunk: (chunk) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.message_id === tempAssistantMsgId
                ? { ...msg, message_txt: msg.message_txt + chunk }
                : msg
            )
          );
          setIsExecuting(false);
        },
        onChunk: (chunk) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.message_id === tempAssistantMsgId
                ? { ...msg, message_txt: msg.message_txt + chunk }
                : msg
            )
          );
        },
        onDone: (fullResponse, generatedCode) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.message_id === tempAssistantMsgId
                ? { ...msg, message_txt: fullResponse, generated_code: generatedCode || null }
                : msg
            )
          );
          setLoading(false);
          setStreamingCode("");
          setIsExecuting(false);
          setExpandedCodeIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(tempAssistantMsgId);
            return newSet;
          });
        },
        onError: (error) => {
          toast.error(error);
          setMessages((prev) =>
            prev.filter(
              (msg) =>
                msg.message_id !== tempUserMsgId &&
                msg.message_id !== tempAssistantMsgId
            )
          );
          setLoading(false);
          setStreamingCode("");
          setIsExecuting(false);
        },
      }
    );
  };

  const handleUploadComplete = async (res: UploadedFile[]) => {
    if (!user?.primaryEmailAddress?.emailAddress) return;

    try {
      const file = res[0];
      const fileUrl = file.url || file.ufsUrl || file.appUrl;
      const fileName = file.name || "Dataset";
      const fileType = file.name.endsWith(".csv")
        ? "csv"
        : file.name.endsWith(".xlsx") || file.name.endsWith(".xls")
        ? "excel"
        : "csv";

      const response = await datasetAPI.analyze(
        fileUrl!,
        user.primaryEmailAddress.emailAddress,
        sessionId,
        fileName,
        fileType
      );

      toast.success(
        `Dataset analyzed! ${response.data.column_count} columns, ${response.data.row_count} rows`
      );

      const datasetsResponse = await datasetAPI.getSessionDatasets(sessionId);
      setDatasets(datasetsResponse.data.datasets || []);
      setShowUploadModal(false);
      setSelectedFile(null);
    } catch (error) {
      const apiError = error as ApiError;
      toast.error(
        apiError.response?.data?.detail || "Failed to analyze dataset"
      );
    } finally {
      setUploadingDataset(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['.csv', '.xlsx', '.xls'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!validTypes.includes(fileExtension)) {
        toast.error('Please select a CSV or Excel file');
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        toast.error('File size must be less than 4MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const { startUpload, isUploading } = useUploadThing("datasetUploader", {
    onClientUploadComplete: handleUploadComplete,
    onUploadError: (error: Error) => {
      toast.error(`Upload failed: ${error.message}`);
      setUploadingDataset(false);
    },
    onUploadBegin: () => {
      setUploadingDataset(true);
    },
  });

  const handleManualUpload = async () => {
    if (!selectedFile) return;
    try {
      await startUpload([selectedFile]);
    } catch (error) {
      toast.error('Upload failed');
      setUploadingDataset(false);
    }
  };

  const handleDeleteDataset = async (datasetUrl: string) => {
    try {
      await datasetAPI.deleteDataset(datasetUrl);
      toast.success("Dataset deleted");
      const datasetsResponse = await datasetAPI.getSessionDatasets(sessionId);
      setDatasets(datasetsResponse.data.datasets || []);
    } catch {
      toast.error("Failed to delete dataset");
    }
  };

  const handleViewObservations = async (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setShowObservationsModal(true);
    setLoadingObservations(true);
    
    try {
      const response = await datasetAPI.getObservations(dataset.dataset_url, 100, 0);
      setObservationsData(response.data);
    } catch (error) {
      console.error("Failed to load observations:", error);
      const apiError = error as ApiError;
      toast.error(
        apiError.response?.data?.detail || "Failed to load dataset observations"
      );
      setShowObservationsModal(false);
    } finally {
      setLoadingObservations(false);
    }
  };

  if (!isLoaded || initialLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-[#666] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          {datasets.map((dataset) => (
            <div
              key={dataset.dataset_url}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] rounded-lg text-sm"
            >
              <button
                onClick={() => handleViewObservations(dataset)}
                className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              >
                <FileSpreadsheet className="h-4 w-4 text-[#666]" />
                <span className="text-[#999] max-w-[150px] truncate">
                  {dataset.name}
                </span>
              </button>
              <button
                onClick={() => handleDeleteDataset(dataset.dataset_url)}
                className="text-[#666] hover:text-red-400 transition-colors ml-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222] rounded-lg text-[#999] text-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 pb-4">
          {messages.length === 0 && datasets.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <Upload className="h-10 w-10 text-[#333] mb-6" />
              <p className="text-[#666] text-lg mb-2">No dataset uploaded</p>
              <p className="text-[#444] text-sm mb-8">
                Upload a CSV or Excel file to start analyzing
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-5 py-2.5 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                Upload dataset
              </button>
            </div>
          )}

          {messages.length === 0 && datasets.length > 0 && (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <p className="text-[#666] text-lg">
                Ask a question about your data
              </p>
            </div>
          )}

          <div className="space-y-10">
            {messages.map((message, index) => {
              const isLastMessage = index === messages.length - 1;
              const isStreamingThisMessage = loading && isLastMessage && message.sender === "assistant";
              const hasCode = message.generated_code || (isStreamingThisMessage && streamingCode);
              const isExpanded = expandedCodeIds.has(message.message_id);
              const codeToShow = message.generated_code || (isStreamingThisMessage ? streamingCode : "");

              return (
                <div key={message.message_id}>
                  {message.sender === "user" ? (
                    <div className="flex justify-end">
                      <div className="px-5 py-3 bg-[#1a1a1a] rounded-3xl text-white text-[15px]">
                        {message.message_txt}
                      </div>
                    </div>
                  ) : (
                    <div>
                      {hasCode && (
                        <div className="mb-3">
                          <button
                            onClick={() => {
                              setExpandedCodeIds((prev) => {
                                const newSet = new Set(prev);
                                if (newSet.has(message.message_id)) {
                                  newSet.delete(message.message_id);
                                } else {
                                  newSet.add(message.message_id);
                                }
                                return newSet;
                              });
                            }}
                            className="flex items-center gap-2 text-[#888] hover:text-white text-sm transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <Code className="h-4 w-4" />
                            <span>
                              {isStreamingThisMessage && !message.generated_code
                                ? "Generating code..."
                                : isExecuting && isStreamingThisMessage
                                ? "Executing code..."
                                : "View generated code"}
                            </span>
                          </button>
                          {isExpanded && codeToShow && (
                            <div className="mt-2 bg-[#111] border border-[#222] rounded-lg overflow-hidden">
                              <div className="px-3 py-2 bg-[#0a0a0a] border-b border-[#222] flex items-center gap-2">
                                <Code className="h-3.5 w-3.5 text-[#666]" />
                                <span className="text-xs text-[#666]">Python</span>
                              </div>
                              <pre className="p-4 text-[13px] text-[#e5e5e5] overflow-x-auto font-mono leading-relaxed">
                                {codeToShow}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="text-[#e5e5e5] text-[15px] leading-7">
                        {/* Manually render images with data URIs since ReactMarkdown has issues with long data URIs */}
                        {message.message_txt.includes('data:image') && (() => {
                          const imageRegex = /!\[([^\]]*)\]\((data:image[^)]+)\)/g;
                          const matches = [...message.message_txt.matchAll(imageRegex)];
                          
                          if (matches.length > 0) {
                            return (
                              <div>
                                {matches.map((match, idx) => {
                                  const [fullMatch, alt, src] = match;
                                  return (
                                    <div key={idx} className="my-4 rounded-lg overflow-hidden border border-[#333] bg-[#1a1a1a] p-2">
                                      <img 
                                        src={src} 
                                        alt={alt || "Generated visualization"} 
                                        className="w-full h-auto"
                                        onError={() => console.error('Image failed to load')}
                                        onLoad={() => console.log('✅ Image loaded successfully!')}
                                      />
                                    </div>
                                  );
                                })}
                                {/* Render the rest of the message without the image markdown */}
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    img: () => null, // Hide ReactMarkdown's broken image rendering
                                  }}
                                >
                                  {message.message_txt.replace(/!\[([^\]]*)\]\(data:image[^)]+\)/g, '')}
                                </ReactMarkdown>
                              </div>
                            );
                          }
                        })()}
                        
                        {/* Normal ReactMarkdown rendering if no data URIs */}
                        {!message.message_txt.includes('data:image') && (
                          <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            img: ({ node, src, alt, ...props }) => {
                              // In newer react-markdown, src might be in node.properties
                              const actualSrc = src || node?.properties?.src;
                              console.log('Image component called');
                              console.log('src prop:', src);
                              console.log('node.properties:', node?.properties);
                              console.log('actualSrc:', actualSrc);
                              
                              if (!actualSrc) {
                                console.log('❌ No src found in props or node.properties');
                                return <div className="my-4 p-4 border-2 border-red-500 text-red-400 text-xs">Image element found but no src</div>;
                              }
                              
                              console.log('✅ Found image src, length:', actualSrc.length, 'starts with:', actualSrc.substring(0, 50));
                              return (
                                <div className="my-4 rounded-lg overflow-hidden border-2 border-green-500 bg-[#1a1a1a] p-2">
                                  <div className="text-xs text-green-400 mb-2">Image rendering (src length: {actualSrc.length})</div>
                                  <img 
                                    src={actualSrc} 
                                    alt={alt || "Generated visualization"} 
                                    className="w-full h-auto max-w-full"
                                    onError={(e) => {
                                      console.error('❌ Image failed to load');
                                      console.error('Src starts with:', actualSrc.substring(0, 100));
                                    }}
                                    onLoad={() => {
                                      console.log('✅ Image loaded successfully!');
                                    }}
                                  />
                                </div>
                              );
                            },
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-4">
                                <table className="min-w-full border-collapse border border-[#333]">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-[#1a1a1a]">{children}</thead>
                            ),
                            th: ({ children }) => (
                              <th className="px-4 py-2 text-left text-sm font-medium text-[#e5e5e5] border border-[#333]">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="px-4 py-2 text-sm text-[#ccc] border border-[#333]">
                                {children}
                              </td>
                            ),
                            tr: ({ children }) => (
                              <tr className="hover:bg-[#1a1a1a]/50">{children}</tr>
                            ),
                            p: ({ children }) => (
                              <p className="mb-2 last:mb-0">{children}</p>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-base font-medium text-white mt-3 mb-2">{children}</h3>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-semibold text-white">{children}</strong>
                            ),
                            em: ({ children }) => (
                              <em className="italic text-[#aaa]">{children}</em>
                            ),
                            code: ({ children }) => (
                              <code className="px-1.5 py-0.5 bg-[#1a1a1a] rounded text-[13px] font-mono text-[#f0f0f0]">
                                {children}
                              </code>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>
                            ),
                          }}
                        >
                          {message.message_txt}
                        </ReactMarkdown>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-3 text-[#666]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  {isExecuting ? "Executing code..." : streamingCode ? "Generating code..." : "Analyzing..."}
                </span>
              </div>
            )}
          </div>

          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      <div className="flex-shrink-0 bg-[#0a0a0a] px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-[#141414]/90 backdrop-blur-lg rounded-t-[20px] p-2 pb-0">
            <div className="bg-[#0f0f0f] rounded-t-xl border border-b-0 border-[#333]/50 px-3 pt-3 pb-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type your message here..."
                rows={1}
                className="w-full bg-transparent text-white text-[15px] placeholder-[#666] focus:outline-none resize-none leading-6"
                disabled={loading || datasets.length === 0}
                style={{ height: "48px" }}
              />
              <div className="flex items-center justify-end mt-2">
                <button
                  onClick={handleSendMessage}
                  disabled={loading || !input.trim() || datasets.length === 0}
                  className="h-9 w-9 flex items-center justify-center bg-[rgb(162,59,103)] text-pink-50 rounded-lg hover:bg-[#d56698] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ArrowUp className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f0f0f] rounded-2xl p-6 w-full max-w-md border border-[#222]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-white">Upload dataset</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                }}
                className="text-[#666] hover:text-white transition-colors text-xl"
              >
                ×
              </button>
            </div>

            {uploadingDataset ? (
              <div className="py-16 text-center">
                <Loader2 className="h-8 w-8 text-white animate-spin mx-auto mb-4" />
                <p className="text-[#666]">Uploading and analyzing dataset...</p>
                <p className="text-[#555] text-xs mt-2">This may take a moment</p>
              </div>
            ) : (
              <div className="space-y-4">
                {!selectedFile ? (
                  <div>
                    <label
                      htmlFor="file-upload"
                      className="border-2 border-dashed border-[#333] rounded-xl bg-[#0a0a0a] hover:border-[#444] transition-colors py-12 flex flex-col items-center justify-center cursor-pointer group"
                    >
                      <Upload className="h-10 w-10 text-[#444] group-hover:text-[#555] mb-3 transition-colors" />
                      <p className="text-white text-sm mb-2 font-medium">Choose a file to upload</p>
                      <p className="text-[#555] text-xs">CSV or Excel files up to 4MB</p>
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-[#333] rounded-xl p-5 shadow-lg">
                      <div className="flex items-start gap-4">
                        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 p-3 rounded-lg border border-blue-500/30">
                          <FileSpreadsheet className="h-7 w-7 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-semibold truncate mb-1">
                                {selectedFile.name}
                              </p>
                              <p className="text-[#888] text-xs">
                                {formatFileSize(selectedFile.size)}
                              </p>
                            </div>
                            <button
                              onClick={handleClearFile}
                              className="text-[#666] hover:text-red-400 transition-colors flex-shrink-0 p-1 hover:bg-[#2a2a2a] rounded"
                              title="Remove file"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-md px-2.5 py-1">
                              <p className="text-[#999] text-xs font-medium">
                                {selectedFile.name.endsWith('.csv') ? 'CSV File' : 'Excel File'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 text-green-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <p className="text-xs font-medium">Ready</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <button
                        onClick={handleManualUpload}
                        disabled={isUploading || !selectedFile}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-lg transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 flex items-center justify-center gap-2"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-5 w-5" />
                            📤 Upload Dataset
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleClearFile}
                        className="w-full bg-[#1a1a1a] hover:bg-[#222] text-[#999] hover:text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm border border-[#2a2a2a]"
                      >
                        Choose Different File
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showObservationsModal && selectedDataset && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f0f0f] rounded-2xl w-full max-w-6xl max-h-[90vh] border border-[#222] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-[#222]">
              <div>
                <h2 className="text-lg font-medium text-white">{selectedDataset.name}</h2>
                {observationsData && (
                  <p className="text-sm text-[#666] mt-1">
                    {observationsData.total_count.toLocaleString()} rows × {observationsData.columns.length} columns
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowObservationsModal(false);
                  setSelectedDataset(null);
                  setObservationsData(null);
                }}
                className="text-[#666] hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {loadingObservations ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
              ) : observationsData ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-[#1a1a1a] border-b border-[#333]">
                        {observationsData.columns.map((col) => (
                          <th
                            key={col.name}
                            className="px-4 py-3 text-left text-xs font-medium text-[#999] uppercase tracking-wider whitespace-nowrap"
                          >
                            <div>
                              <div>{col.name}</div>
                              <div className="text-[#666] text-[10px] normal-case mt-0.5">
                                {col.dtype}
                              </div>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222]">
                      {observationsData.observations.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#1a1a1a]/30">
                          {observationsData.columns.map((col) => (
                            <td
                              key={col.name}
                              className="px-4 py-3 text-sm text-[#ccc] whitespace-nowrap"
                            >
                              {row[col.name] !== null && row[col.name] !== undefined
                                ? String(row[col.name])
                                : <span className="text-[#555] italic">null</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-16 text-[#666]">
                  Failed to load data
                </div>
              )}
            </div>

            {observationsData && (
              <div className="border-t border-[#222] px-6 py-4">
                <p className="text-sm text-[#666]">
                  Showing {observationsData.observations.length} of {observationsData.total_count.toLocaleString()} rows
                  {observationsData.has_more && " (first 100 rows)"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
