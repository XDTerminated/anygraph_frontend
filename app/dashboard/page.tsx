"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Plus, Search, MoreVertical, BarChart3, Pencil, Trash2, X } from "lucide-react";
import { userAPI, chatAPI } from "@/lib/api";
import toast from "react-hot-toast";

interface ChatSession {
  chat_session_id: string;
  chat_session_title: string;
  created_at: string;
  dataset_count: number;
}

interface UserStats {
  total_datasets: number;
  total_queries: number;
  sessions_this_month: number;
}

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renameModal, setRenameModal] = useState<{ sessionId: string; currentTitle: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  const loadUserData = useCallback(async () => {
    if (!user?.primaryEmailAddress?.emailAddress) return;

    try {
      setLoading(true);

      await userAPI.login(
        user.primaryEmailAddress.emailAddress,
        user.fullName || undefined
      );

      const [userDataResponse, statsResponse] = await Promise.all([
        userAPI.getUserData(user.primaryEmailAddress.emailAddress),
        userAPI.getStats(user.primaryEmailAddress.emailAddress),
      ]);

      setChatSessions(userDataResponse.data.chat_sessions || []);
      setStats(statsResponse.data.stats || null);
    } catch {
      toast.error("Failed to load your data");
    } finally {
      setLoading(false);
    }
  }, [user?.primaryEmailAddress?.emailAddress, user?.fullName]);

  useEffect(() => {
    if (isLoaded && user) {
      loadUserData();
    }
  }, [isLoaded, user, loadUserData]);

  const createNewSession = async () => {
    if (!user?.primaryEmailAddress?.emailAddress) return;

    try {
      const response = await chatAPI.createSession(
        user.primaryEmailAddress.emailAddress,
        "New Analysis"
      );
      const sessionId = response.data.session.chat_session_id;
      toast.success("Session created!");
      router.push(`/chat/${sessionId}`);
    } catch {
      toast.error("Failed to create session");
    }
  };

  const handleRename = async () => {
    if (!renameModal || !renameValue.trim()) return;

    try {
      await chatAPI.updateSession(renameModal.sessionId, renameValue.trim());
      setChatSessions((prev) =>
        prev.map((s) =>
          s.chat_session_id === renameModal.sessionId
            ? { ...s, chat_session_title: renameValue.trim() }
            : s
        )
      );
      toast.success("Project renamed");
      setRenameModal(null);
      setRenameValue("");
    } catch {
      toast.error("Failed to rename project");
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return;
    }

    try {
      await chatAPI.deleteSession(sessionId);
      setChatSessions((prev) => prev.filter((s) => s.chat_session_id !== sessionId));

      if (user?.primaryEmailAddress?.emailAddress) {
        const statsResponse = await userAPI.getStats(user.primaryEmailAddress.emailAddress);
        setStats(statsResponse.data.stats || null);
      }

      toast.success("Project deleted");
      setOpenMenuId(null);
    } catch {
      toast.error("Failed to delete project");
    }
  };

  const openRenameModal = (session: ChatSession) => {
    setRenameModal({ sessionId: session.chat_session_id, currentTitle: session.chat_session_title });
    setRenameValue(session.chat_session_title);
    setOpenMenuId(null);
  };

  const filteredSessions = chatSessions.filter((session) =>
    session.chat_session_title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-medium text-white">
            {user?.primaryEmailAddress?.emailAddress}&apos;s projects
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={createNewSession}
              className="px-4 py-2 bg-transparent border border-[#333] rounded-lg text-white font-medium hover:bg-[#1a1a1a] transition-colors"
            >
              New project
            </button>
            <button
              onClick={() => signOut({ redirectUrl: "/" })}
              className="px-4 py-2 bg-transparent border border-[#333] rounded-lg text-white font-medium hover:bg-[#1a1a1a] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8 p-4 border border-[#222] rounded-xl bg-[#0f0f0f]">
          <StatCard label="Sessions" value={chatSessions.length.toString()} />
          <StatCard label="Datasets" value={(stats?.total_datasets ?? 0).toString()} />
          <StatCard label="Queries" value={(stats?.total_queries ?? 0).toString()} />
          <StatCard label="This month" value={(stats?.sessions_this_month ?? 0).toString()} />
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666]" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-[#0f0f0f] border border-[#222] rounded-xl text-white placeholder-[#666] focus:outline-none focus:border-[#444] transition-colors"
            />
          </div>
        </div>

        <div className="border border-[#222] rounded-xl">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#222] text-[#888] text-sm">
                <th className="text-left py-4 px-6 font-medium">Name</th>
                <th className="text-left py-4 px-6 font-medium">Created at</th>
                <th className="text-left py-4 px-6 font-medium">Status</th>
                <th className="text-left py-4 px-6 font-medium">Datasets</th>
                <th className="py-4 px-6"></th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#666]">
                    {searchQuery
                      ? "No sessions match your search"
                      : "No sessions yet. Create your first project to get started."}
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr
                    key={session.chat_session_id}
                    onClick={() => router.push(`/chat/${session.chat_session_id}`)}
                    className="border-b border-[#222] last:border-b-0 hover:bg-[#111] cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="h-4 w-4 text-[#666]" />
                        <span className="text-white font-medium">
                          {session.chat_session_title}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-[#888]">
                      {new Date(session.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-sm">
                        Active
                      </span>
                    </td>
                    <td className="py-4 px-6 text-[#888]">{session.dataset_count ?? 0}</td>
                    <td className="py-4 px-6">
                      <div className="relative" ref={openMenuId === session.chat_session_id ? menuRef : null}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === session.chat_session_id ? null : session.chat_session_id);
                          }}
                          className="p-1 hover:bg-[#222] rounded transition-colors"
                        >
                          <MoreVertical className="h-4 w-4 text-[#666]" />
                        </button>
                        {openMenuId === session.chat_session_id && (
                          <div className="absolute right-0 top-8 w-40 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl z-10">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openRenameModal(session);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-[#222] transition-colors rounded-t-lg"
                            >
                              <Pencil className="h-4 w-4" />
                              Rename
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(session.chat_session_id);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-[#222] transition-colors rounded-b-lg"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredSessions.length === 0 && !searchQuery && (
          <div className="mt-6 text-center">
            <button
              onClick={createNewSession}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create your first project
            </button>
          </div>
        )}
      </div>

      {renameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white">Rename project</h2>
              <button
                onClick={() => {
                  setRenameModal(null);
                  setRenameValue("");
                }}
                className="p-1 hover:bg-[#222] rounded transition-colors"
              >
                <X className="h-5 w-5 text-[#666]" />
              </button>
            </div>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") {
                  setRenameModal(null);
                  setRenameValue("");
                }
              }}
              placeholder="Project name"
              autoFocus
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#333] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-[#444] transition-colors mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setRenameModal(null);
                  setRenameValue("");
                }}
                className="px-4 py-2 text-[#888] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={!renameValue.trim()}
                className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[#666] text-sm mb-1">{label}</p>
      <p className="text-white text-xl font-medium">{value}</p>
    </div>
  );
}
