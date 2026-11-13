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
  onViewMemoryDetails,
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
        if (isMounted && conv && conv.messages) {
          setMessages(conv.messages);
        }
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
    scrollToBottom();
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
      });

      setSavedOutcomes((prev) => ({
        ...prev,
        [msgId]: result.document_id || "OUTCOME-RECORDED",
      }));

      showToast?.("Repair experience saved to permanent episodic memory bank!", "success");
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
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 relative">
      {/* Top Banner / Session Header */}
      <div className="px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-semibold text-sm text-slate-100">
              RecallOps Troubleshooting Assistant
            </h1>
            <p className="text-xs text-slate-400">
              Conversational diagnostic intelligence grounded in verified past repairs
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={resetToNewChat}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
            title="Start New Chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        )}
      </div>

      {/* Main Conversation Feed */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
        {messages.length === 0 ? (
          /* Empty / Welcome State */
          <div className="max-w-2xl mx-auto my-auto pt-8 md:pt-16 text-center space-y-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600/20 via-emerald-500/10 to-transparent border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-950/50">
              <Sparkles className="w-7 h-7" />
            </div>

            <div className="space-y-2.5">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-100">
                What can I help you understand today?
              </h2>
              <p className="text-sm text-slate-400 max-w-lg mx-auto">
                Describe a problem. Understand possible causes. Learn from past repairs.
              </p>
            </div>

            {/* Example Prompt Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 text-left">
              {EXAMPLE_PROMPTS.map((ex, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(ex.prompt)}
                  className="p-3.5 rounded-xl bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/40 transition group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-medium text-xs text-slate-200 group-hover:text-emerald-300 transition">
                      {ex.title}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {ex.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message List */
          <div className="max-w-3xl mx-auto space-y-6">
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
                    className={`rounded-2xl px-5 py-4 max-w-[92%] md:max-w-[85%] text-sm leading-relaxed shadow-sm ${
                      isUser
                        ? "bg-emerald-600 text-white rounded-br-none"
                        : "bg-slate-900/90 text-slate-200 border border-slate-800/90 rounded-bl-none"
                    }`}
                  >
                    {/* User / Assistant Header */}
                    <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-white/10 text-xs text-slate-400">
                      {isUser ? (
                        <span className="font-medium text-emerald-100">You (Field Operator)</span>
                      ) : (
                        <span className="font-medium text-emerald-400 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          RecallOps Agent
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 ml-auto font-mono">
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>

                    {/* Hazard Warning Alert Banner */}
                    {hazard && !isUser && (
                      <div className="mb-3 p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-semibold uppercase tracking-wider text-[11px] text-rose-300">
                            Critical Safety Protocol
                          </strong>
                          <span>{hazard}</span>
                        </div>
                      </div>
                    )}

                    {/* Message Body with Safe Markdown & Structured Typography */}
                    {isUser ? (
                      <div className="whitespace-pre-wrap leading-relaxed text-[13.5px]">
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
                            <Database className="w-3.5 h-3.5 text-blue-400" />
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
                                ? "Sample Plant Record (Demo Mode)"
                                : "Hindsight Cloud (Live Verified)");

                            return (
                              <div
                                key={idx}
                                className={`p-3 rounded-xl border text-xs transition ${
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

                                {/* Relevance explanation */}
                                {p.relevance_reason && (
                                  <p className="text-[11px] text-blue-300/90 font-medium mb-1.5 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                    <span>{p.relevance_reason}</span>
                                  </p>
                                )}

                                {/* Action details */}
                                <div className="text-slate-300 text-[11.5px] leading-relaxed">
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

                    {/* Outcome Recording Prompt Card */}
                    {outcomeToRecord && !isUser && (
                      <div className="mt-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            Confirmed Field Repair Outcome Detected
                          </span>
                          <span className="text-[10px] uppercase font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-900/80">
                            {outcomeToRecord.outcome_status}
                          </span>
                        </div>
                        <p className="text-slate-300 mb-2.5 text-[11px]">
                          Would you like to store this verified resolution in RecallOps permanent memory for future fleet diagnostics?
                        </p>
                        {isOutcomeSaved ? (
                          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium py-1">
                            <Check className="w-4 h-4" />
                            <span>Saved to Episodic Memory Bank ({savedOutcomes[msg.id]})</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleConfirmSaveOutcome(msg.id, outcomeToRecord)}
                            disabled={savingOutcomeId === msg.id}
                            className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                          >
                            {savingOutcomeId === msg.id ? (
                              <>
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Retaining into Hindsight Memory...
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

                  {/* Quick-action suggested follow-up chips */}
                  {followups.length > 0 && !isUser && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-w-[85%]">
                      {followups.map((f, i) => (
                        <button
                          key={i}
                          onClick={() => handleSendMessage(f)}
                          className="text-[11px] px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/40 transition"
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
                <div className="rounded-2xl px-4 py-3 bg-slate-900 border border-slate-800 text-slate-300 text-xs flex items-center gap-3">
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

      {/* Sticky Bottom Input Bar */}
      <div className="p-4 md:p-6 border-t border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto">
          {/* Recording indicator */}
          {isRecording && (
            <div className="mb-2 px-3 py-1.5 rounded-lg bg-red-950/80 border border-red-800/80 text-red-300 text-xs flex items-center justify-between animate-pulse">
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

          <div className="relative flex items-center bg-slate-950 rounded-2xl border border-slate-800 focus-within:border-emerald-500/80 transition-all shadow-inner">
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
              className="w-full px-4 py-3.5 pr-24 bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none resize-none max-h-32"
            />

            <div className="absolute right-2 flex items-center gap-1.5">
              {/* Voice / Mic Button */}
              <button
                type="button"
                onClick={toggleRecording}
                disabled={isLoading}
                title={
                  !speechSupported
                    ? "Speech recognition not supported in this browser"
                    : isRecording
                    ? "Stop Recording"
                    : "Speak your problem (Speech-to-Text)"
                }
                className={`p-2 rounded-xl transition ${
                  isRecording
                    ? "bg-red-600 text-white animate-pulse"
                    : speechSupported
                    ? "text-slate-400 hover:text-white hover:bg-slate-800"
                    : "text-slate-600 cursor-not-allowed"
                }`}
              >
                {isRecording ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:hover:bg-emerald-600 transition shadow-md shadow-emerald-950/40"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
            <span>
              RecallOps learns through technician verification. Always follow plant Lockout/Tagout (LOTO).
            </span>
            <span className="hidden md:inline font-mono text-[10px]">
              Groq (openai/gpt-oss-120b) + Hindsight Cloud
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
