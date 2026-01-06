import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const userAPI = {
  login: (email: string, fullName?: string) =>
    api.post("/users/login", { email, full_name: fullName }),

  getUserData: (email: string) => api.get(`/users/${email}/data`),

  getUser: (email: string) => api.get(`/users/${email}`),

  getStats: (email: string) => api.get(`/users/${email}/stats`),
};

export const chatAPI = {
  createSession: (email: string, title: string = "New Chat") =>
    api.post("/chat-sessions", { email, title }),

  getSession: (sessionId: string) => api.get(`/chat-sessions/${sessionId}`),

  getSessionFull: (sessionId: string, email?: string) =>
    api.get(`/chat-sessions/${sessionId}/full`, { params: email ? { email } : {} }),

  updateSession: (sessionId: string, title: string) =>
    api.put(`/chat-sessions/${sessionId}`, { title }),

  deleteSession: (sessionId: string) =>
    api.delete(`/chat-sessions/${sessionId}`),

  getMessages: (sessionId: string) =>
    api.get(`/chat-sessions/${sessionId}/messages`),
};

export const messageAPI = {
  addMessage: (chatSessionId: string, sender: string, messageText: string) =>
    api.post("/messages", {
      chat_session_id: chatSessionId,
      sender,
      message_txt: messageText,
    }),
};

export const datasetAPI = {
  analyze: (
    datasetUrl: string,
    email: string,
    chatSessionId: string,
    name: string,
    fileType?: string
  ) =>
    api.post("/datasets/analyze", {
      dataset_url: datasetUrl,
      email,
      chat_session_id: chatSessionId,
      name,
      file_type: fileType,
    }),

  getDataset: (datasetUrl: string) =>
    api.get(`/datasets`, { params: { dataset_url: datasetUrl } }),

  getSessionDatasets: (sessionId: string) =>
    api.get(`/chat-sessions/${sessionId}/datasets`),

  getColumns: (datasetUrl: string) =>
    api.get(`/datasets/columns`, { params: { dataset_url: datasetUrl } }),

  getObservations: (datasetUrl: string, limit: number = 100, offset: number = 0) =>
    api.get(`/datasets/observations`, { 
      params: { dataset_url: datasetUrl, limit, offset } 
    }),

  deleteDataset: (datasetUrl: string) =>
    api.delete(`/datasets`, { params: { dataset_url: datasetUrl } }),
};

export const queryAPI = {
  execute: (query: string, datasetUrl: string, chatSessionId: string) =>
    api.post("/query/execute", {
      query,
      dataset_url: datasetUrl,
      chat_session_id: chatSessionId,
    }),

  executeStream: async (
    query: string,
    datasetUrl: string,
    chatSessionId: string,
    callbacks: {
      onCodeChunk?: (chunk: string) => void;
      onCodeComplete?: (code: string) => void;
      onExecuting?: () => void;
      onResultChunk?: (chunk: string) => void;
      onChunk?: (chunk: string) => void;
      onDone: (fullResponse: string, generatedCode?: string) => void;
      onError: (error: string) => void;
    }
  ) => {
    try {
      const response = await fetch(`${API_URL}/query/execute/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          dataset_url: datasetUrl,
          chat_session_id: chatSessionId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        callbacks.onError(error.detail || "Failed to execute query");
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              switch (data.type) {
                case "code_chunk":
                  callbacks.onCodeChunk?.(data.content);
                  break;
                case "code_complete":
                  callbacks.onCodeComplete?.(data.code);
                  break;
                case "executing":
                  callbacks.onExecuting?.();
                  break;
                case "result":
                  callbacks.onResultChunk?.(data.content);
                  break;
                case "chunk":
                  callbacks.onChunk?.(data.content);
                  break;
                case "done":
                  callbacks.onDone(data.full_response, data.generated_code);
                  break;
                case "error":
                  callbacks.onError(data.content);
                  break;
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      callbacks.onError(error instanceof Error ? error.message : "Stream error");
    }
  },

  chat: (message: string) => api.post("/chat", { message }),
};

export const healthAPI = {
  check: () => api.get("/health"),
  root: () => api.get("/"),
};
