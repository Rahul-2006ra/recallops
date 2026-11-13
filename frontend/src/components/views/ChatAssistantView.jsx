import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Mic,
  MicOff,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Database,
  Wrench,
  AlertTriangle,
  RotateCcw,
  Check,
  Tag,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Activity,
  Flame,
  Laptop,
} from "lucide-react";
import { sendChatMessage, recordOutcome, getConversation } from "../../services/api";
import FormattedMessage from "../FormattedMessage";

const EXAMPLE_PROMPTS = [
  {
    title: "Industrial Slurry Pump",
    desc: "Vibrating and overheating under load",
    prompt: "My industrial pump is vibrating and overheating.",
    icon: Wrench,
  },
  {
    title: "Electric Induction Motor",
    desc: "Making an unusual humming noise",
    prompt: "My electric motor is making an unusual noise.",
    icon: Activity,
  },
  {
    title: "Commercial Convection Oven",
    desc: "Keeps switching off mid-cycle",
    prompt: "My oven keeps switching off.",
    icon: Flame,
  },
  {
    title: "Workstation Laptop",
    desc: "Cooling fan is unusually loud and spinning fast",
    prompt: "My laptop fan is unusually loud.",
    icon: Laptop,
  },
];

export default function ChatAssistantView({
  activeConversationId,
  setActiveConversationId,
  mockMemoryMode,
  showToast,
}) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [savingOutcomeId, setSavingOutcomeId] = useState(null);
  const [savedOutcomes, setSavedOutcomes] = useState({});
  const [expandedPrecedents, setExpandedPrecedents] = useState({});

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const toggleExpandPrecedent = (cardKey) => {
    setExpandedPrecedents((prev) => ({ ...prev, [cardKey]: !prev[cardKey] }));
  };

  // Initialize Speech-to-Text if supported by browser
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        setIsRecording(false);
        if (event.error === "not-allowed") {
          showToast?.("Microphone access denied. Please check browser permissions.", "error");
        } else if (event.error !== "no-speech") {
          showToast?.(`Voice input note: ${event.error}`, "info");
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, [showToast]);

  // Load conversation details when activeConversationId changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    getConversation(activeConversationId)
      .then((conv) => {
        if (!isMounted || !conv || !conv.messages) return;
        const formatted = conv.messages.map((m) => {
          let parsedMeta = {};
          if (m.metadata) {
            try {
              parsedMeta = typeof m.metadata === "string" ? JSON.parse(m.metadata) : m.metadata;
            } catch (_) {}
          }
          return {
            id: m.id,
            role: m.role,
            content: m.content,
            metadata: parsedMeta,
            created_at: m.created_at,
          };
        });
        setMessages(formatted);
      })
      .catch((err) => {
        console.warn("Failed to load conversation details:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [activeConversationId]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const toggleRecording = () => {
    if (!speechSupported) {
      showToast?.("Voice speech recognition is not supported in this browser.", "warning");
      return;
    }

    if (isRecording) {
      try {
        recognitionRef.current?.stop();
      } catch (_) {}
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.warn("Failed to start speech recognition:", err);
        setIsRecording(false);
      }
    }
  };

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    if (isRecording) {
      try {
        recognitionRef.current?.stop();
      } catch (_) {}
      setIsRecording(false);
    }

    // Add user message to UI immediately
    const tempUserMsg = {
      id: `temp-usr-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await sendChatMessage({
        message: text,
        conversation_id: activeConversationId || undefined,
        mock_memory: mockMemoryMode,
      });

      if (!activeConversationId && response.conversation_id) {
        setActiveConversationId(response.conversation_id);
      }

      const assistantMsg = {
        id: response.message_id,
        role: "assistant",
        content: response.reply,
        metadata: {
          intent: response.intent,
          equipment_detected: response.equipment_detected,
          hazard_warning: response.hazard_warning,
          retrieved_precedents: response.retrieved_precedents,
          outcome_to_record: response.outcome_to_record,
          suggested_followups: response.suggested_followups,
        },
        created_at: response.created_at,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Chat message error:", err);
      const errorMsg = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content:
          "RecallOps experienced a temporary connectivity issue while processing your message. Your previous diagnosis remains saved in local storage. Please try again or rephrase your problem.",
        metadata: {},
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      showToast?.("Failed to send message. Please retry.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleConfirmSaveOutcome = async (msgId, outcomeData) => {
    if (!outcomeData || savingOutcomeId) return;

    setSavingOutcomeId(msgId);
    try {
      const payload = {
        equipment_type: outcomeData.equipment_type,
        symptoms: outcomeData.symptoms,
        action_taken: outcomeData.action_taken,
        outcome_status: outcomeData.outcome_status,
        verification_status: outcomeData.verification_status,
        verification_source: outcomeData.verification_source,
        machine_id: outcomeData.machine_id,
        technician_notes: outcomeData.technician_notes,
        conversation_id: activeConversationId || undefined,
        message_id: msgId,
        mock_memory: mockMemoryMode,
      };

      const result = await recordOutcome(payload);

      let statusMsg = "Saved to Local Memory (SQLite)";
      if (result.sync_status === "synced") {
        statusMsg = "Saved & Synced to Hindsight Cloud";
      } else if (result.sync_status === "sync_failed") {
        statusMsg = "Saved to Local (Cloud Sync Pending)";
      } else if (result.is_duplicate) {
        statusMsg = "Saved to Local Memory (Cached Record)";
      }

      setSavedOutcomes((prev) => ({
        ...prev,
        [msgId]: statusMsg,
      }));

      showToast?.(
        result.is_duplicate
          ? "Outcome already saved in memory. Record updated."
          : `Repair outcome stored successfully! (${statusMsg})`,
        "success"
      );
    } catch (err) {
      console.error("Failed to record outcome:", err);
      showToast?.("Failed to record outcome to memory.", "error");
    } finally {
      setSavingOutcomeId(null);
    }
  };

  const resetToNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
    setSavedOutcomes({});
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 relative">
      {/* Active Conversation Sticky Header */}
      {messages.length > 0 && (
        <div className="px-4 md:px-8 py-3 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md flex items-center justify-between text-xs text-slate-400 z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="font-medium text-slate-200">
              Active Troubleshooting Session
            </span>
            {mockMemoryMode ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                Local Sandbox
              </span>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                Hindsight Cloud Live
              </span>
            )}
          </div>

          <button
            onClick={resetToNewChat}
            aria-label="Start new chat"
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 transition shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
            title="Start New Chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>
      )}

      {/* Main Conversation Feed or Centered Landing */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
        {messages.length === 0 ? (
          /* ========================================================================= */
          /* PREMIUM CENTERED HOMEPAGE LANDING EXPERIENCE                              */
          /* ========================================================================= */
          <div className="max-w-2xl mx-auto min-h-[75vh] flex flex-col justify-center items-center text-center space-y-7 py-6">
            {/* Elegant Icon Badge */}
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-950/30">
              <Sparkles className="w-6 h-6" />
            </div>

            {/* Headline and Subtitle */}
            <div className="space-y-2.5 max-w-xl">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-100">
                What can I help you understand today?
              </h1>
              <p className="text-sm md:text-base text-slate-400 max-w-md mx-auto leading-relaxed">
                Describe a problem. Understand possible causes. Learn from past repairs.
              </p>
            </div>

            {/* Prominent Center Chat Composer */}
            <div className="w-full relative shadow-2xl shadow-emerald-950/20">
              {isRecording && (
                <div className="mb-2 px-3 py-1.5 rounded-xl bg-red-950/80 border border-red-800/80 text-red-300 text-xs flex items-center justify-between animate-pulse">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                    Listening via microphone... Speak your equipment problem clearly.
                  </span>
                  <button
                    onClick={toggleRecording}
                    aria-label="Stop recording"
                    className="underline text-[11px] text-red-200 hover:text-white"
                  >
                    Stop
                  </button>
                </div>
              )}

              <div className="relative flex items-center bg-slate-900/80 rounded-2xl border border-slate-800 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all duration-150 p-1.5">
                <textarea
                  ref={inputRef}
                  rows={2}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about an equipment anomaly, vibration, noise, or repair outcome..."
                  className="w-full px-4 py-2.5 pr-24 bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none resize-none leading-relaxed"
                />

                <div className="absolute right-3.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    aria-label={isRecording ? "Stop voice input" : "Speak equipment issue"}
                    className={`p-2 rounded-xl transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none ${
                      isRecording
                        ? "bg-red-600 text-white animate-pulse"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                    title={isRecording ? "Stop voice input" : "Speak equipment issue"}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!inputValue.trim() || isLoading}
                    aria-label="Send message"
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors duration-150 disabled:opacity-40 disabled:hover:bg-emerald-600 shadow-md shadow-emerald-950/40 focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Four Subtle Interactive Example Prompts */}
            <div className="w-full pt-1">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-3 text-left">
                Suggested Scenarios
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {EXAMPLE_PROMPTS.map((ex, idx) => {
                  const Icon = ex.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(ex.prompt)}
                      aria-label={`Ask about ${ex.title}`}
                      className="p-3.5 rounded-xl bg-slate-900/40 hover:bg-slate-850/70 border border-slate-800/80 hover:border-slate-700 transition-all duration-150 group flex flex-col justify-between focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-medium text-xs text-slate-200 group-hover:text-emerald-300 transition-colors flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                          {ex.title}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <p className="text-[11.5px] text-slate-400 line-clamp-2">
                        {ex.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* ACTIVE CONVERSATION FEED                                                  */
          /* ========================================================================= */
          <div className="max-w-3xl mx-auto space-y-6 pb-28">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              const meta = msg.metadata || {};
              const precedents = meta.retrieved_precedents || [];
              const hazard = meta.hazard_warning;
              const outcomeToRecord = meta.outcome_to_record;
              const followups = meta.suggested_followups || [];
              const isOutcomeSaved = !!savedOutcomes[msg.id];

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isUser ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`rounded-2xl px-5 py-4 max-w-[95%] md:max-w-[88%] text-[13.5px] leading-relaxed shadow-sm transition-all ${
                      isUser
                        ? "bg-emerald-600 text-white rounded-br-sm shadow-emerald-950/30"
                        : "bg-slate-900/80 text-slate-200 border border-slate-800/80 rounded-bl-sm"
                    }`}
                  >
                    {/* User / Assistant Header */}
                    <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-white/10 text-xs text-slate-400">
                      {isUser ? (
                        <span className="font-medium text-emerald-100">You (Field Operator)</span>
                      ) : (
                        <span className="font-medium text-emerald-400 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          RecallOps Agent
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono">
                        {msg.created_at
                          ? new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>

                    {/* Safety Hazard Warning */}
                    {hazard && !isUser && (
                      <div className="mb-3.5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-semibold uppercase tracking-wider text-[11px] text-rose-300">
                            Critical Safety Protocol
                          </strong>
                          <span className="leading-relaxed">{hazard}</span>
                        </div>
                      </div>
                    )}

                    {/* Message Body with Safe Markdown & Structured Typography */}
                    {isUser ? (
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </div>
                    ) : (
                      <FormattedMessage content={msg.content} />
                    )}

                    {/* Historical Precedents Embedded Cards */}
                    {precedents.length > 0 && !isUser && (
                      <div className="mt-4 pt-3.5 border-t border-slate-800/80">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-teal-400" />
                            Historical Precedents ({precedents.length})
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                            {mockMemoryMode ? "Sample Memory / Demo Mode" : "Live Hindsight Cloud Memory"}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {precedents.map((p, idx) => {
                            const isSuccess = p.outcome_status === "SUCCESSFUL";
                            const cardKey = `${msg.id}-${idx}`;
                            const isExpanded = !!expandedPrecedents[cardKey];
                            const displaySourceLabel =
                              p.source_label ||
                              (mockMemoryMode
                                ? "Sample Memory (Demo Mode)"
                                : "Hindsight Cloud Live");

                            return (
                              <div
                                key={idx}
                                className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/70 text-xs transition-colors duration-150"
                              >
                                {/* 1. Equipment & Reported Outcome Header */}
                                <div className="flex items-start justify-between gap-2 mb-2 pb-1.5 border-b border-slate-900">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-400 font-medium">Equipment:</span>
                                    <span className="font-semibold text-slate-200">
                                      {p.equipment_type}
                                    </span>
                                    <span className="font-mono text-[10.5px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                                      {p.machine_id}
                                    </span>
                                  </div>

                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                                      isSuccess
                                        ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
                                        : "bg-amber-950/60 text-amber-300 border border-amber-800/60"
                                    }`}
                                  >
                                    {isSuccess ? (
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <XCircle className="w-3 h-3 text-amber-400" />
                                    )}
                                    {isSuccess ? "VERIFIED SUCCESS" : "FAILED ATTEMPT"}
                                  </span>
                                </div>

                                {/* 2. Relevant Historical Symptoms */}
                                <div className="text-[11.5px] text-slate-300 mb-1.5 flex items-start gap-1">
                                  <span className="text-slate-400 font-medium flex-shrink-0">Relevant Symptoms:</span>
                                  <span className="text-slate-300">
                                    {p.symptoms || p.relevance_reason || "Reported anomalous condition"}
                                  </span>
                                </div>

                                {/* 3. Repair Attempted */}
                                <div className="text-[11.5px] text-slate-300 mb-2 flex items-start gap-1">
                                  <span className="text-slate-400 font-medium flex-shrink-0">
                                    {isSuccess ? "Resolution Action:" : "Attempted Action:"}
                                  </span>
                                  <span className="font-medium text-slate-200">
                                    {p.action_taken}
                                  </span>
                                </div>

                                {/* 4 & 5. Source, Verification Level & Progressive Disclosure */}
                                <div className="pt-1.5 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                  <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1">
                                      <Tag className="w-3 h-3 text-slate-600" />
                                      <span>
                                        {p.verification_status?.replace(/_/g, " ") || "Operator Field Report"}
                                      </span>
                                    </span>
                                    <span>•</span>
                                    <span>{displaySourceLabel}</span>
                                  </div>

                                  <button
                                    onClick={() => toggleExpandPrecedent(cardKey)}
                                    aria-label="Toggle full record details"
                                    className="flex items-center gap-0.5 text-slate-400 hover:text-emerald-400 transition-colors focus-visible:outline-none"
                                  >
                                    <span>{isExpanded ? "Less" : "Details"}</span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3 h-3" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>

                                {/* Progressive Disclosure Expanded Panel */}
                                {isExpanded && (
                                  <div className="mt-2.5 pt-2 border-t border-slate-900/90 space-y-1.5 text-[11px] text-slate-400">
                                    {p.relevance_reason && (
                                      <div className="flex items-start gap-1 text-teal-300">
                                        <Sparkles className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                        <span>Relevance: {p.relevance_reason}</span>
                                      </div>
                                    )}
                                    {p.verified_at && (
                                      <div>Recorded in plant history: {p.verified_at}</div>
                                    )}
                                    <div className="text-[10px] text-slate-500">
                                      Storage: {mockMemoryMode ? "Local SQLite (Development Mode)" : "Hindsight Cloud Memory Bank (recallops-demo)"}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Five-Field Repair Outcome Confirmation Card */}
                    {outcomeToRecord && !isUser && (
                      <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-emerald-800/60 text-xs shadow-md">
                        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-emerald-900/40">
                          <span className="font-semibold text-emerald-300 flex items-center gap-2 text-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            Confirmed Field Repair Outcome Detected
                          </span>
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                              outcomeToRecord.outcome_status === "SUCCESSFUL"
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-800/80"
                                : "bg-amber-950 text-amber-300 border border-amber-800/80"
                            }`}
                          >
                            {outcomeToRecord.outcome_status}
                          </span>
                        </div>

                        {/* Five Formatted Fields */}
                        <div className="mb-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-[11.5px] text-slate-300">
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 py-0.5 border-b border-slate-800/60">
                            <span className="text-slate-400 font-medium">Equipment:</span>
                            <span className="font-semibold text-slate-200">
                              {outcomeToRecord.equipment_type}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 py-0.5 border-b border-slate-800/60">
                            <span className="text-slate-400 font-medium">Original Problem:</span>
                            <span className="text-slate-200">
                              {outcomeToRecord.symptoms || "Reported equipment issue from session"}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 py-0.5 border-b border-slate-800/60">
                            <span className="text-slate-400 font-medium">Repair Performed:</span>
                            <span className="text-slate-200 font-medium">
                              {outcomeToRecord.action_taken}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 py-0.5 border-b border-slate-800/60">
                            <span className="text-slate-400 font-medium">Outcome:</span>
                            <span
                              className={`font-semibold ${
                                outcomeToRecord.outcome_status === "SUCCESSFUL"
                                  ? "text-emerald-400"
                                  : "text-amber-400"
                              }`}
                            >
                              {outcomeToRecord.outcome_status}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 py-0.5">
                            <span className="text-slate-400 font-medium">Verification Source:</span>
                            <span className="text-slate-200 font-mono text-[10.5px]">
                              {outcomeToRecord.verification_source ||
                                (outcomeToRecord.verification_status
                                  ? outcomeToRecord.verification_status.replace(/_/g, " ")
                                  : "Technician Field Report")}
                            </span>
                          </div>
                        </div>

                        <p className="text-slate-400 mb-3 text-[11px] leading-relaxed">
                          Would you like to store this verified resolution in RecallOps permanent memory for future fleet diagnostics?
                        </p>

                        {isOutcomeSaved ? (
                          <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium py-1.5 px-3 rounded-lg bg-emerald-950/60 border border-emerald-800/60">
                            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <span>{savedOutcomes[msg.id]}</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleConfirmSaveOutcome(msg.id, outcomeToRecord)}
                            disabled={savingOutcomeId === msg.id}
                            aria-label="Confirm & Store in Permanent Memory"
                            className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-md shadow-emerald-950/40 focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
                          >
                            {savingOutcomeId === msg.id ? (
                              <>
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Storing verified outcome...
                              </>
                            ) : (
                              <>
                                <Database className="w-3.5 h-3.5" />
                                Confirm & Store in Permanent Memory
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Suggested follow-up prompt chips */}
                  {followups.length > 0 && !isUser && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5 max-w-[88%]">
                      {followups.map((f, i) => (
                        <button
                          key={i}
                          onClick={() => handleSendMessage(f)}
                          aria-label={`Ask follow-up: ${f}`}
                          className="text-[11.5px] px-3 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/40 transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex flex-col items-start">
                <div className="rounded-2xl px-4 py-3 bg-slate-900/90 border border-slate-800 text-slate-300 text-xs flex items-center gap-3 shadow-sm">
                  <span className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></span>
                  <div className="space-y-0.5">
                    <span className="font-medium text-slate-200">
                      Querying Hindsight Memory & Groq AI...
                    </span>
                    <p className="text-[10px] text-slate-500">
                      Cross-referencing equipment failure modes and safety warnings
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Sticky Bottom Input Bar (Rendered during active conversation) */}
      {messages.length > 0 && (
        <div className="sticky bottom-0 z-20 p-4 md:p-6 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
          <div className="max-w-3xl mx-auto">
            {isRecording && (
              <div className="mb-2 px-3 py-1.5 rounded-xl bg-red-950/80 border border-red-800/80 text-red-300 text-xs flex items-center justify-between animate-pulse">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                  Listening via microphone... Speak your equipment problem clearly.
                </span>
                <button
                  onClick={toggleRecording}
                  aria-label="Stop recording"
                  className="underline text-[11px] text-red-200 hover:text-white"
                >
                  Stop
                </button>
              </div>
            )}

            <div className="relative flex items-center bg-slate-900/90 rounded-2xl border border-slate-800 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all shadow-inner p-1">
              <textarea
                ref={inputRef}
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isRecording
                    ? "Listening to speech..."
                    : "Ask about an equipment anomaly, vibration, noise, or repair outcome..."
                }
                className="w-full px-4 py-3 pr-24 bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none resize-none max-h-32 leading-relaxed"
              />

              <div className="absolute right-2.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleRecording}
                  aria-label={isRecording ? "Stop voice input" : "Speak equipment issue"}
                  className={`p-2 rounded-xl transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none ${
                    isRecording
                      ? "bg-red-600 text-white animate-pulse"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                  title={isRecording ? "Stop voice input" : "Speak equipment issue"}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim() || isLoading}
                  aria-label="Send message"
                  className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors duration-150 disabled:opacity-40 disabled:hover:bg-emerald-600 shadow-md shadow-emerald-950/40 focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
