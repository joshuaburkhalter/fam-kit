import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Camera,
  Volume2,
  VolumeX,
  Sparkles,
  MessageCircle,
  X,
  Trash2,
  ChevronDown,
  CheckCircle2,
} from 'lucide-react';
import type { AssistantMessage } from '../types';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { voiceService } from '../lib/voice';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { useFabAutoClose } from '../hooks/useFabAutoClose';

const CHAT_STORAGE_PREFIX = 'famkit_assistant_chat_';

const GEMINI_SUGGESTIONS = [
  {
    icon: '🛒',
    title: 'Update Groceries',
    prompt: "I'd like to update our groceries",
    subtitle: 'What groceries would you like to add?',
  },
  {
    icon: '📅',
    title: 'Check Schedule',
    prompt: "What's on our family calendar this week?",
    subtitle: 'Review upcoming family activities',
  },
  {
    icon: '✨',
    title: 'Recipe Ideas',
    prompt: 'Suggest a quick and delicious dinner recipe for tonight',
    subtitle: 'Get ideas before deciding to save',
  },
  {
    icon: '🍽️',
    title: 'Plan Dinners',
    prompt: 'Help me plan dinner ideas for the family this week',
    subtitle: 'Brainstorm meals without auto-saving',
  },
];

export const FloatingAssistant: React.FC = () => {
  const { household, currentUser, apiKey, autoAudioResponses, setAutoAudioResponses } = usePWA();

  const [messages, setMessages] = useState<AssistantMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedKey = household ? `${CHAT_STORAGE_PREFIX}${household.id}` : `${CHAT_STORAGE_PREFIX}default`;
        const saved = localStorage.getItem(storedKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.error('Failed to load chat history:', e);
      }
    }
    return [];
  });

  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGhostClosing, setIsGhostClosing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smooth close with animated out transition
  const handleSmoothClose = () => {
    if (isGhostClosing) return;
    if (isListening) {
      voiceService.stopListening();
      setIsListening(false);
    }
    if (isSpeaking) {
      voiceService.stopSpeaking();
      setIsSpeaking(false);
    }
    setIsGhostClosing(true);
    closeTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
      setIsGhostClosing(false);
    }, 200);
  };

  const handleOpen = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsGhostClosing(false);
    setIsExpanded(true);
  };

  const dockContainerRef = useFabAutoClose<HTMLDivElement>({
    isOpen: isExpanded,
    onClose: handleSmoothClose,
  });

  // Persist chat history to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedKey = household ? `${CHAT_STORAGE_PREFIX}${household.id}` : `${CHAT_STORAGE_PREFIX}default`;
      const toSave = messages.slice(-80);
      localStorage.setItem(storedKey, JSON.stringify(toSave));
    } catch (e) {
      console.error('Failed to save chat history:', e);
    }
  }, [messages, household?.id]);

  // Reload history when household switches
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedKey = household ? `${CHAT_STORAGE_PREFIX}${household.id}` : `${CHAT_STORAGE_PREFIX}default`;
      const saved = localStorage.getItem(storedKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
          return;
        }
      }
      setMessages([]);
    } catch (e) {
      console.error('Failed to reload chat for household:', e);
    }
  }, [household?.id]);

  const handleClearChat = () => {
    if (window.confirm('Clear your conversation history?')) {
      setMessages([]);
      if (typeof window !== 'undefined') {
        const storedKey = household ? `${CHAT_STORAGE_PREFIX}${household.id}` : `${CHAT_STORAGE_PREFIX}default`;
        localStorage.removeItem(storedKey);
      }
    }
  };

  // Scroll to bottom when new messages arrive or loading
  useEffect(() => {
    if (!isExpanded || !chatContainerRef.current) return;
    const container = chatContainerRef.current;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isLoading, isExpanded]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || input;
    if ((!messageText.trim() && !selectedImage) || !household || isLoading) return;

    if (!isExpanded) {
      handleOpen();
    }

    const userMessage: AssistantMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      imageUrl: selectedImage?.preview,
    };

    const recentHistory = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const now = new Date();
    const clientDate = format(now, 'yyyy-MM-dd');
    const clientDay = format(now, 'EEEE');
    const clientTime = format(now, 'h:mm a');
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    const curImg = selectedImage;
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const response = await api.askGemini({
        message: messageText,
        householdId: household.id,
        userId: currentUser?.id,
        imageBase64: curImg?.base64,
        imageMimeType: curImg?.mimeType,
        apiKey: apiKey || undefined,
        history: recentHistory,
        clientDate,
        clientDay,
        clientTime,
        timezone,
      });

      const assistantMessage: AssistantMessage = {
        id: 'msg-ai-' + Date.now(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionsExecuted: response.actionsExecuted,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (autoAudioResponses && voiceService.isTTSSupported()) {
        setIsSpeaking(true);
        voiceService.speak(response.response, () => setIsSpeaking(false));
      }
    } catch (err: any) {
      console.error('Assistant error:', err);
      const isKeyMissing =
        !apiKey && (err.message?.includes('API key') || err.message?.includes('configured') || err.message?.includes('Gemini'));
      const friendlyMessage = isKeyMissing
        ? '⚠️ Assistant is not connected yet! Please check Settings or verify server configuration.'
        : `⚠️ Sorry, I ran into an error: ${err.message || 'Please verify your connection.'}`;

      setMessages((prev) => [
        ...prev,
        {
          id: 'msg-err-' + Date.now(),
          role: 'assistant',
          content: friendlyMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSpeakMessage = (text: string) => {
    if (isSpeaking) {
      voiceService.stopSpeaking();
      setIsSpeaking(false);
      return;
    }
    if (voiceService.isTTSSupported()) {
      setIsSpeaking(true);
      voiceService.speak(text, () => setIsSpeaking(false));
    }
  };

  const toggleVoiceInput = () => {
    if (!isExpanded) handleOpen();
    if (isListening) {
      voiceService.stopListening();
      setIsListening(false);
    } else {
      setIsListening(true);
      voiceService.startListening(
        (transcript, isFinal) => {
          setInput(transcript);
          if (isFinal) {
            setIsListening(false);
            handleSendMessage(transcript);
          }
        },
        (error) => {
          console.error('STT error:', error);
          setIsListening(false);
        },
        () => {
          setIsListening(false);
        }
      );
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!isExpanded) handleOpen();
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        setSelectedImage({
          base64,
          mimeType: file.type,
          preview: result,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div
      ref={dockContainerRef}
      className="fixed bottom-[calc(76px+0.85rem+env(safe-area-inset-bottom,0px))] md:bottom-8 left-0 right-0 z-40 px-3 sm:px-6 pointer-events-none"
    >
      <div className="max-w-2xl mx-auto pointer-events-none flex flex-col items-end">
        {/* Ghosted Chat History Overlay floating directly above the FAB dock */}
        {(isExpanded || isGhostClosing) && (
          <div
            className={`w-full max-h-[58vh] sm:max-h-[460px] rounded-3xl bg-slate-950/85 backdrop-blur-2xl border border-white/15 shadow-2xl shadow-black/90 flex flex-col overflow-hidden mb-2.5 pointer-events-auto transition-all ${
              isGhostClosing ? 'ghost-chat-out' : 'ghost-chat-in'
            }`}
          >
            {/* Minimal Header */}
            <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between gap-2 bg-gradient-to-r from-slate-900/90 via-slate-950/90 to-slate-900/90 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-emerald-500/20 shrink-0">
                  <Sparkles className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5 truncate">
                    Homebase Assistant
                    {isSpeaking && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-pink-500/20 text-pink-400 text-[10px] font-semibold animate-pulse border border-pink-500/30">
                        Speaking
                      </span>
                    )}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Auto audio speech toggle */}
                <button
                  type="button"
                  onClick={() => setAutoAudioResponses(!autoAudioResponses)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all border cursor-pointer ${
                    autoAudioResponses
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                      : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/10'
                  }`}
                  title={autoAudioResponses ? 'Voice playback ON (tap to mute)' : 'Voice playback MUTED (tap to unmute)'}
                >
                  {autoAudioResponses ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>

                {/* Clear / New Chat */}
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearChat}
                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/10 transition-colors cursor-pointer"
                    title="Clear conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Minimize / Collapse */}
                <button
                  type="button"
                  onClick={handleSmoothClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                  title="Minimize assistant"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Message Thread or Suggestions */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5 text-xs">
              {messages.length === 0 ? (
                <div className="py-5 px-2 text-center flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 flex items-center justify-center text-slate-950 shadow-xl shadow-emerald-500/25 mb-2.5">
                    <Sparkles className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    Hi {currentUser?.name ? currentUser.name.split(' ')[0] : 'there'}!
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                    Ask questions, add groceries, plan dinners, or check schedules.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 w-full max-w-md">
                    {GEMINI_SUGGESTIONS.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(item.prompt)}
                        className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 text-left transition-all cursor-pointer group"
                      >
                        <span className="text-base shrink-0">{item.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold text-white group-hover:text-emerald-400 truncate">
                            {item.title}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {item.subtitle}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isAi = msg.role === 'assistant';
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${isAi ? 'justify-start' : 'justify-end'}`}
                    >
                      {isAi && (
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shrink-0 mt-0.5 shadow-sm shadow-emerald-500/20">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] rounded-2xl p-3 shadow-md ${
                          isAi
                            ? 'bg-slate-900/90 text-slate-100 rounded-tl-sm border border-white/10'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-medium rounded-tr-sm'
                        }`}
                      >
                        {msg.imageUrl && (
                          <img
                            src={msg.imageUrl}
                            alt="Uploaded"
                            className="w-full max-h-48 object-cover rounded-xl mb-2 border border-black/20"
                          />
                        )}

                        <div className="text-[12px] leading-relaxed selectable-text">
                          {isAi ? (
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                                em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
                                ul: ({ children }) => <ul className="list-disc pl-4 my-1.5 space-y-1 text-slate-200">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-4 my-1.5 space-y-1 text-slate-200">{children}</ol>,
                                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                code: ({ children }) => (
                                  <code className="bg-slate-950/80 text-emerald-400 px-1 py-0.5 rounded text-[11px] font-mono border border-white/10">
                                    {children}
                                  </code>
                                ),
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>

                        {/* Executed Action Chips */}
                        {isAi && msg.actionsExecuted && msg.actionsExecuted.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                            {msg.actionsExecuted.map((act, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20"
                              >
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>{typeof act === 'string' ? act : act.summary || act.tool}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="text-[10px] mt-2 flex items-center justify-between gap-2 border-t border-white/5 pt-1">
                          {isAi ? (
                            <button
                              type="button"
                              onClick={() => handleToggleSpeakMessage(msg.content)}
                              className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                              title={isSpeaking ? 'Stop audio' : 'Read aloud'}
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>Listen</span>
                            </button>
                          ) : (
                            <div />
                          )}
                          <span className={isAi ? 'text-slate-500' : 'text-slate-800'}>
                            {msg.timestamp}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {isLoading && (
                <div className="flex gap-2 justify-start items-center">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shrink-0 shadow-sm">
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <div className="bg-slate-900/90 px-3 py-2 rounded-2xl rounded-tl-sm border border-white/10 flex items-center gap-1 shadow-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-ios-dot" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-ios-dot" style={{ animationDelay: '200ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-ios-dot" style={{ animationDelay: '400ms' }} />
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>
          </div>
        )}

        {/* Attached image preview above dock */}
        {selectedImage && isExpanded && (
          <div
            data-fab-keep-open
            className="w-full mb-2 pointer-events-auto flex items-center justify-between p-2 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/15 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={selectedImage.preview}
                alt="Selected"
                className="w-9 h-9 object-cover rounded-xl border border-white/10 shrink-0"
              />
              <span className="text-[11px] text-slate-300 font-medium truncate">
                Photo attached (fridge/receipt)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* The Animated Expanding Dock & FAB */}
        <div
          className={`fab-dock-transition pointer-events-auto h-[50px] border shadow-2xl flex items-center overflow-hidden ${
            isExpanded
              ? 'w-full rounded-3xl border-white/25 bg-slate-900/95 backdrop-blur-xl shadow-emerald-500/10 px-2.5'
              : 'w-[50px] rounded-full border-emerald-400/40 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 cursor-pointer shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 justify-center'
          }`}
        >
          {!isExpanded ? (
            <button
              type="button"
              onClick={handleOpen}
              className="w-full h-full flex items-center justify-center text-slate-950 cursor-pointer"
              title="Ask Assistant"
            >
              <MessageCircle className="w-6 h-6 stroke-[2.2]" />
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="w-full flex items-center gap-2 animate-in fade-in duration-200"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={handleSmoothClose}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                capture="environment"
                className="hidden"
              />

              {/* Camera Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Snap photo with camera"
                className="h-8 px-2 sm:px-2.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
              </button>

              {/* Voice STT Button */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                title={isListening ? 'Stop Listening' : 'Voice Input (STT)'}
                className={`h-8 px-2 sm:px-2.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 border text-xs font-bold cursor-pointer ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30 border-red-400/40'
                    : 'bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border-white/10 hover:border-emerald-500/30'
                }`}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isListening
                    ? 'Listening to your voice...'
                    : 'Ask Assistant (e.g. "Add milk", "Plan dinners", "Soccer at 5")...'
                }
                className="flex-1 min-w-0 bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none py-1.5 px-1"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={(!input.trim() && !selectedImage) || isLoading}
                className="h-8 px-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 shrink-0 active:scale-95 cursor-pointer"
                title="Send message"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
