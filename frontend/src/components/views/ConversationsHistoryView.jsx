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

    try {
      await deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      showToast?.("Conversation deleted.", "success");
    } catch (err) {
      console.error("Failed to delete conversation:", err);
      showToast?.("Failed to delete conversation.", "error");
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
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-100">
                Troubleshooting History
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Resume past diagnostic sessions and review advice generated with episodic memory.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onNewChat}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Session</span>
            </button>
            <button
              onClick={fetchConversations}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh History"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/20">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations by title or problem..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
        </div>
      </div>

      {/* List */}
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
                <p className="text-xs text-slate-400 mt-1">
                  Ask a question in the AI Assistant to start your first conversational troubleshooting session.
                </p>
              </div>
              <button
                onClick={onNewChat}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition inline-flex items-center gap-1.5"
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
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 transition cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-1.5 pr-4 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-200 group-hover:text-emerald-300 transition">
                        {conv.title}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {conv.message_count} msg{conv.message_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    {conv.last_message_preview && (
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {conv.last_message_preview}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                      <span>ID: {conv.id}</span>
                      <span>•</span>
                      <span>
                        Updated {new Date(conv.updated_at).toLocaleDateString()} {new Date(conv.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => handleDelete(e, conv.id)}
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition"
                      title="Delete Conversation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-emerald-600 group-hover:text-white transition">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
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
