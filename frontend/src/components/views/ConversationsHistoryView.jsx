import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Clock,
  Trash2,
  ArrowRight,
  Plus,
  RefreshCw,
  Search,
  Bot,
} from "lucide-react";
import { listConversations, deleteConversation } from "../../services/api";

export default function ConversationsHistoryView({
  onSelectConversation,
  onNewChat,
  showToast,
}) {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const fetchConversations = async () => {
    setIsLoading(true);
    try {
      const data = await listConversations();
      setConversations(data || []);
    } catch (err) {
      console.error("Failed to load conversations:", err);
      showToast?.("Failed to fetch conversation history.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const handleDelete = async (e, convId) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this conversation?")) return;

    setDeletingId(convId);
    try {
      await deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      showToast?.("Conversation deleted.", "success");
    } catch (err) {
      console.error("Failed to delete conversation:", err);
      showToast?.("Failed to delete conversation.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    (c.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-6 border-b border-slate-800 bg-slate-900/40">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-100">
                Conversation History
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Resume past diagnostic sessions and review advice generated with episodic memory.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onNewChat}
              aria-label="Start new session"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition shadow-sm shadow-emerald-950/40 focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Session</span>
            </button>
            <button
              onClick={fetchConversations}
              disabled={isLoading}
              aria-label="Refresh conversation history"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 transition border border-slate-700/60 focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
              title="Refresh History"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/20">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations by title or equipment problem..."
              aria-label="Search conversation history"
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/70 focus-visible:ring-1 focus-visible:ring-emerald-500/30 transition shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 px-6 py-6">
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-400">Loading conversation history...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="py-20 text-center max-w-sm mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-slate-600 flex items-center justify-center mx-auto">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-slate-200">No Past Conversations</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Ask a question in the AI Assistant to start your first conversational troubleshooting session.
                </p>
              </div>
              <button
                onClick={onNewChat}
                aria-label="Start troubleshooting"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition inline-flex items-center gap-1.5 shadow-sm shadow-emerald-950/40 focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start Troubleshooting</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Resume conversation: ${conv.title || "Untitled"}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectConversation(conv.id);
                    }
                  }}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900 transition cursor-pointer flex items-center justify-between group shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
                >
                  <div className="space-y-1 pr-4 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-200 group-hover:text-emerald-300 transition">
                        {conv.title || "Untitled Troubleshooting Session"}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-slate-500 text-xs font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {conv.created_at
                          ? new Date(conv.created_at).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Recent Session"}
                      </span>
                      <span>•</span>
                      <span>ID: {conv.id ? conv.id.slice(0, 8) : "local"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDelete(e, conv.id)}
                      disabled={deletingId === conv.id}
                      aria-label="Delete conversation"
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-rose-500/70 focus-visible:outline-none"
                      title="Delete conversation"
                    >
                      {deletingId === conv.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
