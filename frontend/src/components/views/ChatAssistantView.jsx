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
  Bookmark,
  Tag,
  Info,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { sendChatMessage, recordOutcome, getConversation } from "../../services/api";
import FormattedMessage from "../FormattedMessage";

const EXAMPLE_PROMPTS = [
  {
    title: "Industrial Slurry Pump",
    desc: "Vibrating and overheating under load",
    prompt: "My industrial pump is vibrating and overheating.",
  },
  {
    title: "Electric Induction Motor",
    desc: "Making an unusual humming noise",
    prompt: "My electric motor is making an unusual noise.",
  },
  {
    title: "Commercial Convection Oven",
    desc: "Keeps switching off mid-cycle",
    prompt: "My oven keeps switching off.",
  },
  {
    title: "Workstation Laptop",
    desc: "Cooling fan is unusually loud and spinning fast",
    prompt: "My laptop fan is unusually loud.",
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

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

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
        console.warn("Failed to load conversation history:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [activeConversationId]);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, isLoading]);

  const toggleRecording = () => {
    if (!speechSupported) {
      showToast?.("Speech-to-text is not supported in this browser. Please type your message.", "info");
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
      console.error("Failed to send message:", err);
      showToast?.(err.message || "Troubleshooting assistant is temporarily unavailable.", "error");

      const errorMsg = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content:
          "I encountered an error connecting to the reasoning service. Please check your connection or try asking your question again in simpler terms.",
        metadata: { isError: true },
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleConfirmSaveOutcome = async (msgId, outcomeData) => {
    setSavingOutcomeId(msgId);
    try {
      const result = await recordOutcome({
        equipment_type: outcomeData.equipment_type || "Industrial Equipment",
        symptoms: outcomeData.symptoms || "Reported equipment issue from session",
        action_taken: outcomeData.action_taken || "Field repair verified",
        outcome_status: outcomeData.outcome_status || "SUCCESSFUL",
        machine_id: "EQ-FIELD",
        conversation_id: activeConversationId || undefined,
        live_retain: !mockMemoryMode, // Guarded: only live if mock mode is turned off
        idempotency_key: outcomeData.idempotency_key || `IDEMP-${msgId}`,
      });

      let statusMsg = "Saved to Local Plant Memory";
      if (result.sync_status === "synced") {
        statusMsg = "Saved locally & synced to Hindsight Cloud";
      } else if (result.sync_status === "sync_failed") {
        statusMsg = "Saved locally (Cloud sync failed)";
      } else {
        statusMsg = "Saved to Local Episodic Memory (Demo Mode)";
      }

      setSavedOutcomes((prev) => ({
        ...prev,
        [msgId]: `${statusMsg} (${result.document_id || "RECORDED"})`,
      }));

      showToast?.(
        result.is_duplicate
          ? "Repair outcome previously confirmed (idempotent)."
          : "Repair experience recorded successfully!",
        "success"
      );
    } catch (err) {
      console.error("Failed to save outcome:", err);
      showToast?.(err.message || "Failed to record repair outcome.", "error");
    } finally {
      setSavingOutcomeId(null);
    }
  };

  const resetToNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInputValue("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 relative">
      {/* Top Header Bar (Shown when in active conversation) */}
      {messages.length > 0 && (
        <div className="px-4 md:px-8 py-3.5 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md flex items-center justify-between z-10 transition-all">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h1 className="font-semibold text-xs md:text-sm text-slate-100 flex items-center gap-1.5">
                <span>RecallOps Troubleshooting Assistant</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Conversational diagnostic intelligence grounded in verified past repairs
              </p>
            </div>
          </div>

          <button
            onClick={resetToNewChat}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition shadow-sm"
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
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-emerald-400/10 to-transparent border border-emerald-500/30 text-emerald-400 shadow-xl shadow-emerald-950/40">
              <Sparkles className="w-7 h-7" />
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
            <div className="w-full relative shadow-2xl shadow-emerald-950/30">
              {isRecording && (
                <div className="mb-2 px-3 py-1.5 rounded-xl bg-red-950/80 border border-red-800/80 text-red-300 text-xs flex items-center justify-between animate-pulse">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                    Listening via microphone... Speak your equipment problem clearly.
                  </span>
                  <button
                    onClick={toggleRecording}
                    className="underline text-[11px] text-red-200 hover:text-white"
                  >
                    Stop
                  </button>
                </div>
              )}

              <div className="relative flex items-center bg-slate-900/90 rounded-2xl border border-slate-800 focus-within:border-emerald-500/80 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-all p-1.5">
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
                    className={`p-2 rounded-xl transition ${
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
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40 disabled:hover:bg-emerald-600 shadow-md shadow-emerald-950/40"
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
                {EXAMPLE_PROMPTS.map((ex, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(ex.prompt)}
                    className="p-3.5 rounded-xl bg-slate-900/50 hover:bg-slate-850/80 border border-slate-800/80 hover:border-emerald-500/40 transition group flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-medium text-xs text-slate-200 group-hover:text-emerald-300 transition">
                        {ex.title}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
                    </div>
                    <p className="text-[11.5px] text-slate-400 line-clamp-2">
                      {ex.desc}
                    </p>
                  </button>
                ))}
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
                    className={`rounded-2xl px-5 py-4 max-w-[95%] md:max-w-[88%] text-[14px] leading-relaxed shadow-sm transition-all ${
                      isUser
                        ? "bg-emerald-600 text-white rounded-br-sm shadow-emerald-950/30"
                        : "bg-slate-900/85 text-slate-200 border border-slate-800/90 rounded-bl-sm"
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
                      <span className="text-[10px] text-slate-400 ml-auto font-mono">
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>

                    {/* Hazard Warning Alert Banner */}
                    {hazard && !isUser && (
                      <div className="mb-3.5 p-3 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-semibold uppercase tracking-wider text-[11px] text-rose-300">
                            Critical Safety Protocol
                          </strong>
                          <span className="leading-normal">{hazard}</span>
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
                            const displaySourceLabel =
                              p.source_label ||
                              (mockMemoryMode
                                ? "Sample Memory (Demo Mode)"
                                : "Hindsight Cloud (Live Verified)");

                            return (
                              <div
                                key={idx}
                                className={`p-3.5 rounded-xl border text-xs transition ${
                                  isSuccess
                                    ? "bg-slate-950/80 border-slate-800/90 hover:border-emerald-500/40"
                                    : "bg-slate-950/80 border-slate-800/90 hover:border-amber-500/40"
                                }`}
                              >
                                {/* Precedent Card Top Bar */}
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-slate-100">
                                      {p.machine_id}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                                      {p.equipment_type}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {p.verification_status && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                                        {p.verification_status.replace(/_/g, " ")}
                                      </span>
                                    )}
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                                        isSuccess
                                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/80"
                                          : "bg-amber-950 text-amber-300 border border-amber-800/80"
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
                                </div>

                                {/* Relevance explanation */}
                                {p.relevance_reason && (
                                  <p className="text-[11px] text-teal-300 font-medium mb-1.5 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-teal-400 flex-shrink-0" />
                                    <span>{p.relevance_reason}</span>
                                  </p>
                                )}

                                {/* Action details */}
                                <div className="text-slate-300 text-[12px] leading-relaxed">
                                  <strong className="text-slate-200">
                                    {isSuccess ? "Resolution Action:" : "Attempted Action (Avoid Repeating):"}
                                  </strong>{" "}
                                  {p.action_taken}
                                </div>

                                {/* Card Footer Source Tag */}
                                <div className="mt-2 pt-1.5 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                  <span className="flex items-center gap-1">
                                    <Tag className="w-3 h-3 text-slate-600" />
                                    <span>{displaySourceLabel}</span>
                                  </span>
                                  {p.verified_at && (
                                    <span>Recorded {p.verified_at}</span>
                                  )}
                                </div>
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
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            outcomeToRecord.outcome_status === "SUCCESSFUL"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800/80"
                              : "bg-amber-950 text-amber-300 border border-amber-800/80"
                          }`}>
                            {outcomeToRecord.outcome_status}
                          </span>
                        </div>

                        {/* Five Formatted Fields */}
                        <div className="mb-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-[11.5px] text-slate-300">
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 py-0.5 border-b border-slate-800/60">
                            <span className="text-slate-400 font-medium">Equipment:</span>
                            <span className="font-semibold text-slate-200">{outcomeToRecord.equipment_type}</span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 py-0.5 border-b border-slate-800/60">
                            <span className="text-slate-400 font-medium">Original Problem:</span>
                            <span className="text-slate-200">{outcomeToRecord.symptoms || "Reported equipment issue from session"}</span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 py-0.5 border-b border-slate-800/60">
                            <span className="text-slate-400 font-medium">Repair Performed:</span>
                            <span className="text-slate-200 font-medium">{outcomeToRecord.action_taken}</span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 py-0.5 border-b border-slate-800/60">
                            <span className="text-slate-400 font-medium">Outcome:</span>
                            <span className={`font-semibold ${
                              outcomeToRecord.outcome_status === "SUCCESSFUL" ? "text-emerald-400" : "text-amber-400"
                            }`}>
                              {outcomeToRecord.outcome_status}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 py-0.5">
                            <span className="text-slate-400 font-medium">Verification Source:</span>
                            <span className="text-slate-200 font-mono text-[10.5px]">
                              {outcomeToRecord.verification_source || (outcomeToRecord.verification_status ? outcomeToRecord.verification_status.replace(/_/g, " ") : "Technician Field Report")}
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
                            className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-md shadow-emerald-950/40"
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
                          className="text-[11.5px] px-3 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/40 transition shadow-sm"
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
                  className="underline text-[11px] text-red-200 hover:text-white"
                >
                  Stop
                </button>
              </div>
            )}

            <div className="relative flex items-center bg-slate-900/90 rounded-2xl border border-slate-800 focus-within:border-emerald-500/80 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-all shadow-inner p-1">
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
                  className={`p-2 rounded-xl transition ${
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
                  className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40 disabled:hover:bg-emerald-600 shadow-md shadow-emerald-950/40"
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
