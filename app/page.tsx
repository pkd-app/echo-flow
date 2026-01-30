"use client";

import { Mic, Square, Settings, Keyboard, Loader2, Sparkles, X, Check, FileText, Lightbulb, GraduationCap, Wand2, ChevronDown, Clock, Download, Trash2, Copy, Send, Minus } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { register, unregister, isRegistered } from "@tauri-apps/plugin-global-shortcut";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { transcribeAudio, enrichWithHistory, ChatMessage } from "@/lib/groq";
import { jsPDF } from "jspdf";

type Status = "idle" | "recording" | "transcribing" | "enriching" | "done" | "error";
type ModeId = "clean" | "meeting" | "idea" | "ask" | "custom";

interface HistoryItem {
  id: string;
  timestamp: number;
  mode: ModeId;
  messages: ChatMessage[];
  text?: string;
}

const MODES: Record<ModeId, { label: string, icon: any, prompt: string, color: string }> = {
  clean: {
    label: "Clean Up",
    icon: Wand2,
    color: "text-blue-400",
    prompt: "You are a copy editor. Clean up the transcript, remove filler words, and format as Markdown. Return ONLY the cleaned text."
  },
  meeting: {
    label: "Meeting Notes",
    icon: FileText,
    color: "text-orange-400",
    prompt: "You are a meeting secretary. Summarize the input. Extract Main Topics, Decisions, and Action Items. Format in Markdown."
  },
  idea: {
    label: "Spark Idea",
    icon: Lightbulb,
    color: "text-yellow-400",
    prompt: "You are a creative partner. Structure the user's thoughts into a concept. Suggest improvements and next steps."
  },
  ask: {
    label: "Ask AI",
    icon: GraduationCap,
    color: "text-purple-400",
    prompt: "You are a knowledgeable assistant. Answer the question comprehensively and provide context in Markdown."
  },
  custom: {
    label: "Custom",
    icon: Settings,
    color: "text-pink-400",
    prompt: "CUSTOM_PLACEHOLDER"
  }
};

export default function Home() {
  // Audio Hook
  const { isRecording, startRecording, stopRecording, audioBlob, error: micError } = useAudioRecorder();

  // App State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [isVisible, setIsVisible] = useState(true);

  // Settings & History State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [apiKey, setApiKey] = useState("");

  // Mode State
  const [mode, setMode] = useState<ModeId>("clean");
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);

  // Hotkey State
  const [appHotkey, setAppHotkey] = useState("Alt+Shift+S");
  const [recHotkey, setRecHotkey] = useState("Alt+Shift+R");
  const [recordingTarget, setRecordingTarget] = useState<"APP" | "REC" | null>(null);

  // Settings State 2
  const [magicPaste, setMagicPaste] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("You are a helpful assistant.");

  // Refs
  const isRecordingRef = useRef(false);
  const startRecordingRef = useRef(startRecording);
  const stopRecordingRef = useRef(stopRecording);
  const apiKeyRef = useRef(apiKey);
  const modeRef = useRef(mode);
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  // Sync refs
  useEffect(() => {
    isRecordingRef.current = isRecording;
    startRecordingRef.current = startRecording;
    stopRecordingRef.current = stopRecording;
    apiKeyRef.current = apiKey;
    modeRef.current = mode;
  }, [isRecording, startRecording, stopRecording, apiKey, mode]);

  // Scroll to bottom
  useEffect(() => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  // Load Settings & History
  useEffect(() => {
    const savedKey = localStorage.getItem("echo-flow-apikey");
    const savedMode = localStorage.getItem("echo-flow-mode") as ModeId;
    const savedApp = localStorage.getItem("echo-flow-hotkey-app");
    const savedRec = localStorage.getItem("echo-flow-hotkey-rec");
    const savedHistory = localStorage.getItem("echo-flow-history");
    const savedMagic = localStorage.getItem("echo-flow-magicpaste");
    const savedCustomPrompt = localStorage.getItem("echo-flow-customprompt");

    if (savedKey) setApiKey(savedKey);
    if (savedMode && MODES[savedMode]) setMode(savedMode);
    if (savedApp) setAppHotkey(savedApp);
    if (savedRec) setRecHotkey(savedRec);
    if (savedMagic === "true") setMagicPaste(true);
    if (savedCustomPrompt) setCustomPrompt(savedCustomPrompt);
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch { }
    }
  }, []);

  // Save History Helper
  const addToHistory = (msgs: ChatMessage[]) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      mode: modeRef.current,
      messages: msgs
    };
    const newHistory = [newItem, ...history].slice(0, 20);
    setHistory(newHistory);
    localStorage.setItem("echo-flow-history", JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.setItem("echo-flow-history", "[]");
  };

  const exportMarkdown = () => {
    const text = messages.map(m => `**${m.role.toUpperCase()}**: ${m.content}`).join("\n\n");
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `echoflow-export-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);
    let y = margin;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`EchoFlow Export - ${new Date().toLocaleString()}`, margin, y);
    y += 10;

    messages.forEach((msg) => {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);

      const role = msg.role.toUpperCase();
      doc.text(role, margin, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(50);

      const lines = doc.splitTextToSize(msg.content, maxWidth);

      lines.forEach((line: string) => {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 5;
      });

      y += 5; // Spacing between messages
    });

    doc.save(`echoflow-export-${Date.now()}.pdf`);
  };

  const clearChat = () => {
    setMessages([]);
    setStatus("idle");
  };

  // --- Processing Logic ---
  useEffect(() => {
    async function process() {
      if (!isRecording && audioBlob && status === "recording") {
        try {
          setStatus("transcribing");

          const text = await transcribeAudio(audioBlob, apiKeyRef.current);

          // Add User Message
          const newMessages = [...messages, { role: "user", content: text } as ChatMessage];
          setMessages(newMessages);

          setStatus("enriching");

          // Get AI Response with full history
          const currentMode = modeRef.current;
          let systemPrompt = MODES[currentMode].prompt;
          if (currentMode === "custom") {
            systemPrompt = customPrompt;
          }
          const enriched = await enrichWithHistory(newMessages, apiKeyRef.current, systemPrompt);

          // Add Assistant Message
          const finalMessages = [...newMessages, { role: "assistant", content: enriched } as ChatMessage];
          setMessages(finalMessages);
          setStatus("done");

          // Save & Copy
          addToHistory(finalMessages);
          try {
            if (magicPaste) {
              const win = getCurrentWindow();
              await win.hide();
              setIsVisible(false);
              // Wait for OS focus to switch back to the previous window
              await new Promise(resolve => setTimeout(resolve, 500));
              await invoke("type_text", { text: enriched });

              // Restore window after typing
              await win.show();
              await win.setFocus();
              setIsVisible(true);
            } else {
              await writeText(enriched);
            }
          } catch (e) {
            console.error("Clipboard/MagicPaste error", e);
            // Fallback to navigator if plugin fails (optional, but good for safety)
            try { await navigator.clipboard.writeText(enriched); } catch { }
          }

        } catch (err: any) {
          console.error(err);
          setStatus("error");
          // Optional: Add error message to chat?
        }
      } else if (isRecording) {
        setStatus("recording");
      }
    }
    process();
  }, [isRecording, audioBlob]);

  // --- Hotkey Recording Logic ---
  useEffect(() => {
    if (!recordingTarget) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();

      // Ignore modifier-only presses
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;

      const parts = [];
      if (e.altKey) parts.push("Alt");
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Command");

      // Key cleanup (e.g. " " -> "Space")
      let key = e.key.toUpperCase();
      if (key === " ") key = "Space";

      parts.push(key);
      const hotkeyString = parts.join("+");

      if (recordingTarget === "APP") {
        setAppHotkey(hotkeyString);
        localStorage.setItem("echo-flow-hotkey-app", hotkeyString);
      } else {
        setRecHotkey(hotkeyString);
        localStorage.setItem("echo-flow-hotkey-rec", hotkeyString);
      }
      setRecordingTarget(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [recordingTarget]);

  // --- Hotkey Logic ---
  // App Toggle
  useEffect(() => {
    let currentKey = appHotkey;
    async function reg() {
      const win = getCurrentWindow();
      try { await unregister(currentKey); } catch { }
      try {
        await register(currentKey, async (e) => {
          if (e.state === "Pressed") {
            const viz = await win.isVisible();
            viz ? await win.hide() : (await win.show(), await win.setFocus());
            setIsVisible(!viz);
          }
        });
      } catch (e) { console.error(e); }
    }
    reg();
    return () => { unregister(currentKey).catch(() => { }); };
  }, [appHotkey]);

  // Recording Toggle
  useEffect(() => {
    let currentKey = recHotkey;
    async function reg() {
      const win = getCurrentWindow();
      try { await unregister(currentKey); } catch { }
      try {
        await register(currentKey, async (e) => {
          if (e.state === "Pressed") {
            if (!isRecordingRef.current) {
              await win.show();
              await win.setFocus();
              setIsVisible(true);
              startRecordingRef.current();
            } else {
              stopRecordingRef.current();
            }
          }
        });
      } catch (e) { console.error(e); }
    }
    reg();
    return () => { unregister(currentKey).catch(() => { }); };
  }, [recHotkey]);

  const handleModeChange = (newMode: ModeId) => {
    if (messages.length > 0) {
      addToHistory(messages); // Auto-save previous session
      setMessages([]);
      setStatus("idle");
    }
    setMode(newMode);
    localStorage.setItem("echo-flow-mode", newMode);
    setIsModeMenuOpen(false);
  };

  const handleHistorySelect = (item: HistoryItem) => {
    const msgs = item.messages || (item.text ? [{ role: "assistant", content: item.text } as ChatMessage] : []);
    setMessages(msgs);
    setMode(item.mode);
    setIsHistoryOpen(false);
    setStatus("done");
  };

  const toggleRecording = () => isRecording ? stopRecording() : startRecording();

  const CurrentIcon = MODES[mode].icon;

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center p-4 bg-transparent font-sans">
      <AnimatePresence>
        {!isSettingsOpen && !isHistoryOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-[#111111]/90 backdrop-blur-md shadow-2xl flex flex-col relative h-[500px]"
          >
            {/* Header */}
            <div
              onPointerDown={(e) => {
                // Allow dragging unless clicking a button or interactive element
                if (!(e.target as HTMLElement).closest('button')) {
                  getCurrentWindow().startDragging();
                }
              }}
              className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/5 shrink-0 cursor-move"
            >
              <div className={clsx("p-2 rounded-lg transition-all duration-300",
                status === "recording" ? "bg-red-500/20 text-red-500 animate-pulse" :
                  status === "transcribing" || status === "enriching" ? "bg-blue-500/20 text-blue-500 animate-spin" :
                    status === "done" ? "bg-green-500/20 text-green-500" :
                      "bg-white/10 text-zinc-400"
              )}>
                {status === "recording" ? <Mic className="w-5 h-5" /> :
                  status === "transcribing" ? <Loader2 className="w-5 h-5" /> :
                    status === "enriching" ? <Sparkles className="w-5 h-5" /> :
                      status === "done" ? <Check className="w-5 h-5" /> :
                        <CurrentIcon className="w-5 h-5" />}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="relative">
                  <button
                    onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                    className="flex items-center gap-2 text-sm font-medium text-white hover:bg-white/5 px-2 py-1 rounded-md -ml-2 transition-colors"
                  >
                    <span className={MODES[mode].color}>{MODES[mode].label}</span>
                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                  </button>

                  {/* Mode Dropdown */}
                  <AnimatePresence>
                    {isModeMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute top-full left-0 mt-1 w-48 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden z-20 py-1"
                      >
                        {(Object.entries(MODES) as [ModeId, typeof MODES[ModeId]][]).map(([key, val]) => {
                          const Icon = val.icon;
                          return (
                            <button
                              key={key}
                              onClick={() => handleModeChange(key)}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-white text-left"
                            >
                              <Icon className={clsx("w-4 h-4", val.color)} />
                              {val.label}
                              {mode === key && <Check className="w-3 h-3 ml-auto text-blue-500" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button onClick={() => setIsHistoryOpen(true)} className="p-2 hover:bg-white/10 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors" title="History">
                  <Clock className="w-4 h-4" />
                </button>
                <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-white/10 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors" title="Settings">
                  <Settings className="w-4 h-4" />
                </button>

                <div className="w-px h-4 bg-white/10 mx-1" />

                {/* Hide / Minimize */}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const win = getCurrentWindow();
                    await win.hide();
                    setIsVisible(false);
                    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Minimize / Hide"
                >
                  <Minus className="w-4 h-4" />
                </button>

                {/* Quit */}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await invoke("quit_app");
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-1"
                  title="Quit App"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-700" ref={messagesScrollRef}>
              {messages.length === 0 && status !== "recording" ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
                  <CurrentIcon className={clsx("w-12 h-12 opacity-20", MODES[mode].color)} />
                  <p className="text-sm">Start recording to chat with AI</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <div key={i} className={clsx("flex flex-col gap-1", msg.role === "assistant" ? "items-start" : "items-end")}>
                      <div className={clsx(
                        "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                        msg.role === "assistant"
                          ? "bg-white/5 text-zinc-200 border border-white/5 rounded-tl-sm"
                          : "bg-blue-600 text-white rounded-tr-sm"
                      )}>
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-zinc-600 px-1 capitalize">{msg.role}</span>
                    </div>
                  ))}
                </>
              )}

              {/* Status Indicator inside Chat */}
              {(status === "transcribing" || status === "enriching" || status === "recording") && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 animate-pulse px-2">
                  {status === "recording" && <span className="text-red-500"> Listening...</span>}
                  {status === "transcribing" && <span>Transcribing...</span>}
                  {status === "enriching" && <span>AI is thinking...</span>}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-t border-white/5 shrink-0">
              <div className="flex gap-2">
                <button onClick={clearChat} className="text-[10px] px-2 py-1 rounded border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-900/30 flex items-center gap-1 transition-colors" title="Clear Chat">
                  <Trash2 className="w-3 h-3" />
                </button>

                {/* Export Buttons */}
                {messages.length > 0 && (
                  <>
                    <button onClick={exportPDF} className="text-[10px] px-2 py-1 rounded border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 flex items-center gap-1 ml-2 transition-colors">
                      <FileText className="w-3 h-3" /> PDF
                    </button>
                    <button onClick={exportMarkdown} className="text-[10px] px-2 py-1 rounded border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 flex items-center gap-1 ml-2 transition-colors">
                      <Download className="w-3 h-3" /> .md
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={toggleRecording}
                className={clsx(
                  "flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold transition-all shadow-lg",
                  isRecording
                    ? "bg-red-500 text-white hover:bg-red-600 shadow-red-500/20"
                    : "bg-white text-black hover:bg-zinc-200"
                )}
              >
                {isRecording ? <><Square className="w-3 h-3 fill-current" /> Stop</> : <><Mic className="w-3 h-3" /> Record</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4"
          >
            <div className="w-full max-w-lg bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" /> History
                </h2>
                <div className="flex gap-2">
                  <button onClick={clearHistory} className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-900/10"><Trash2 className="w-3 h-3" /> Clear</button>
                  <button onClick={() => setIsHistoryOpen(false)}><X className="w-5 h-5 text-zinc-500 hover:text-white" /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {history.length === 0 ? (
                  <div className="p-8 text-center text-zinc-600 text-sm">No history yet.</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {history.map(item => {
                      const ModeIcon = MODES[item.mode].icon;
                      const msgs = item.messages || (item.text ? [{ role: "assistant", content: item.text } as ChatMessage] : []);
                      const preview = msgs.length > 0 ? msgs[msgs.length - 1].content : "Empty";
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleHistorySelect(item)}
                          className="w-full text-left p-4 hover:bg-white/5 transition-colors group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                              <ModeIcon className={clsx("w-3 h-3", MODES[item.mode].color)} />
                              {new Date(item.timestamp).toLocaleString()}
                            </div>
                            <div className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                              {msgs.length} msgs
                            </div>
                          </div>
                          <div className="text-sm text-zinc-300 line-clamp-2 font-mono">
                            {preview}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4"
          >
            <div className="w-full max-w-lg bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                <h2 className="text-lg font-semibold text-white">Settings</h2>
                <button onClick={() => setIsSettingsOpen(false)}><X className="w-5 h-5 text-zinc-500 hover:text-white" /></button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">General</h3>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-300">Groq API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium text-white block">Magic Paste</label>
                      <p className="text-xs text-zinc-500">Automatically type result instead of copy</p>
                    </div>
                    <button
                      onClick={() => setMagicPaste(!magicPaste)}
                      className={clsx("w-10 h-6 rounded-full p-1 transition-colors relative", magicPaste ? "bg-blue-600" : "bg-zinc-700")}
                    >
                      <motion.div
                        layout
                        className="w-4 h-4 bg-white rounded-full shadow-sm"
                        animate={{ x: magicPaste ? 16 : 0 }}
                      />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Hotkeys</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-300">Toggle App</label>
                      <button
                        onClick={() => setRecordingTarget("APP")}
                        className={clsx("w-full px-3 py-2 rounded-lg border text-sm font-mono text-left transition-colors", recordingTarget === "APP" ? "border-blue-500 text-blue-400 bg-blue-500/10" : "border-white/10 text-zinc-300 bg-black/40 hover:border-white/20")}
                      >
                        {recordingTarget === "APP" ? "Press keys..." : appHotkey}
                      </button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-300">Toggle Recording</label>
                      <button
                        onClick={() => setRecordingTarget("REC")}
                        className={clsx("w-full px-3 py-2 rounded-lg border text-sm font-mono text-left transition-colors", recordingTarget === "REC" ? "border-red-500 text-red-400 bg-red-500/10" : "border-white/10 text-zinc-300 bg-black/40 hover:border-white/20")}
                      >
                        {recordingTarget === "REC" ? "Press keys..." : recHotkey}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Custom Mode</h3>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-300">System Prompt</label>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      rows={3}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-500/50 transition-colors resize-none font-mono"
                      placeholder="Enter your custom system prompt here..."
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-white/5 bg-white/5 flex justify-end">
                <button
                  onClick={() => {
                    localStorage.setItem("echo-flow-apikey", apiKey);
                    localStorage.setItem("echo-flow-magicpaste", String(magicPaste));
                    localStorage.setItem("echo-flow-customprompt", customPrompt);
                    setIsSettingsOpen(false);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
