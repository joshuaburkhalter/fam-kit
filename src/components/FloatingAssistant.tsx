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
  CheckCircle2,
} from 'lucide-react';
import type { AssistantMessage } from '../types';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { voiceService } from '../lib/voice';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';

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
  const historyPushedRef = useRef(false);
  const closedByPopstateRef = useRef(false);

  // Smooth close with animated out transition
  const handleSmoothClose = (fromPopState: boolean = false) => {
    if (isGhostClosing) return;
    if (isListening) {
      voiceService.stopListening();
      setIsListening(false);
    }
    if (isSpeaking) {
      voiceService.stopSpeaking();
      setIsSpeaking(false);
    }
    if (!fromPopState && historyPushedRef.current) {
      historyPushedRef.current = false;
      closedByPopstateRef.current = true;
      window.history.back();
    }
    setIsGhostClosing(true);
    closeTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
      setIsGhostClosing(false);
      closedByPopstateRef.current = false;
    }, 220);
  };

  const handleOpen = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsGhostClosing(false);
    setIsExpanded(true);
  };

  // Push history state so the phone back button closes the overlay instead of navigating away
  useEffect(() => {
    if (isExpanded) {
      if (!historyPushedRef.current) {
        historyPushedRef.current = true;
        closedByPopstateRef.current = false;
        window.history.pushState({ type: 'assistant_overlay', timestamp: Date.now() }, '', window.location.href);
      }

      const handlePopState = () => {
        if (historyPushedRef.current) {
          historyPushedRef.current = false;
          closedByPopstateRef.current = true;
          handleSmoothClose(true);
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') handleSmoothClose(false);
      };

      window.addEventListener('popstate', handlePopState);
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('keydown', handleKeyDown);
        if (historyPushedRef.current && !closedByPopstateRef.current) {
          historyPushedRef.current = false;
          window.history.back();
        }
      };
    }
  }, [isExpanded]);

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
    <>
      {/* Collapsed State: Sleek Floating Action Button in bottom-right corner */}
      {!isExpanded && !isGhostClosing && (
        <div className="fixed bottom-[calc(76px+0.85rem+env(safe-area-inset-bottom,0px))] md:bottom-8 right-4 sm:right-6 z-40">
          <button
            type="button"
            onClick={handleOpen}
            className="w-[52px] h-[52px] rounded-full border border-emerald-400/40 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 cursor-pointer shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center animate-in fade-in zoom-in-95 duration-200"
            title="Ask Assistant"
          >
            <MessageCircle className="w-6 h-6 stroke-[2.2]" />
          </button>
        </div>
      )}

      {/* Expanded State: Full screen transparent overlay with blurred background */}
      {(isExpanded || isGhostClosing) && (
        <div
          className={`fixed inset-0 z-50 flex flex-col bg-slate-950/65 ${
            isGhostClosing ? 'overlay-blur-out' : 'overlay-blur-in'
          }`}
          onClick={(e) => {
            // Light-dismiss: clicking directly on backdrop closes overlay
            if (e.target === e.currentTarget) {
              handleSmoothClose();
            }
          }}
        >
          {/* Top Header */}
          <div className="w-full max-w-2xl mx-auto px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3 sm:py-4 flex items-center justify-between gap-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-emerald-500/20 shrink-0">
                <Sparkles className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2 truncate">
                  Homebase Assistant
                  {isSpeaking && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-pink-500/20 text-pink-400 text-[10px] font-semibold animate-pulse border border-pink-500/30">
                      Speaking
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-slate-400 truncate">
                  {household?.name || 'Family Assistant'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Auto audio speech toggle */}
              <button
                type="button"
                onClick={() => setAutoAudioResponses(!autoAudioResponses)}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all border cursor-pointer ${
                  autoAudioResponses
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/10'
                }`}
                title={autoAudioResponses ? 'Voice playback ON (tap to mute)' : 'Voice playback MUTED (tap to unmute)'}
              >
                {autoAudioResponses ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Clear / New Chat */}
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/10 transition-colors cursor-pointer"
                  title="Clear conversation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Close button */}
              <button
                type="button"
                onClick={() => handleSmoothClose()}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Message Thread or Centered Greetings taking up the full screen height */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto px-4 py-4 w-full max-w-2xl mx-auto space-y-4 text-xs"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8 my-auto">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 flex items-center justify-center text-slate-950 shadow-2xl shadow-emerald-500/30 mb-4 animate-in zoom-in-95 duration-200">
                  <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.2]" />
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-white">
                  Hello, {currentUser?.name ? currentUser.name.split(' ')[0] : 'there'}!
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-sm">
                  How can I help your family today? Ask questions, coordinate schedules, plan meals, or snap photos.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 w-full max-w-md">
                  {GEMINI_SUGGESTIONS.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(item.prompt)}
                      className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 text-left transition-all cursor-pointer group shadow-lg shadow-black/20"
                    >
                      <span className="text-xl shrink-0 p-1 rounded-lg bg-white/5 group-hover:bg-emerald-500/10">{item.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white group-hover:text-emerald-400 truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
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
                    className={`flex gap-3 ${isAi ? 'justify-start' : 'justify-end'} animate-in fade-in duration-150`}
                  >
                    {isAi && (
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shrink-0 mt-1 shadow-md shadow-emerald-500/20">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-4 shadow-xl ${
                        isAi
                          ? 'bg-slate-900/80 backdrop-blur-md text-slate-100 rounded-tl-sm border border-white/10'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-medium rounded-tr-sm shadow-emerald-500/20'
                      }`}
                    >
                      {msg.imageUrl && (
                        <img
                          src={msg.imageUrl}
                          alt="Uploaded"
                          className="w-full max-h-56 object-cover rounded-2xl mb-3 border border-black/20"
                        />
                      )}

                      <div className="text-xs sm:text-sm leading-relaxed selectable-text">
                        {isAi ? (
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                              strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                              em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
                              ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1.5 text-slate-200">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1.5 text-slate-200">{children}</ol>,
                              li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
                              code: ({ children }) => (
                                <code className="bg-slate-950/80 text-emerald-400 px-1.5 py-0.5 rounded-lg text-[11px] font-mono border border-white/10">
                                  {children}
                                </code>
                              ),
                              a: ({ href, children }) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 font-medium"
                                >
                                  {children}
                                </a>
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
                        <div className="mt-3 pt-2.5 border-t border-white/10 space-y-1.5">
                          {msg.actionsExecuted.map((act, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{typeof act === 'string' ? act : act.summary || act.tool}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="text-[10px] mt-2.5 flex items-center justify-between gap-2 border-t border-white/5 pt-1.5">
                        {isAi ? (
                          <button
                            type="button"
                            onClick={() => handleToggleSpeakMessage(msg.content)}
                            className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer p-0.5 rounded"
                            title={isSpeaking ? 'Stop audio' : 'Read message aloud'}
                          >
                            <Volume2 className="w-3.5 h-3.5" />
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
              <div className="flex gap-3 justify-start items-center">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shrink-0 shadow-md">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="bg-slate-900/80 backdrop-blur-md px-4 py-3 rounded-3xl rounded-tl-sm border border-white/10 flex items-center gap-1.5 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-slate-300 animate-ios-dot" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-slate-300 animate-ios-dot" style={{ animationDelay: '200ms' }} />
                  <span className="w-2 h-2 rounded-full bg-slate-300 animate-ios-dot" style={{ animationDelay: '400ms' }} />
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Bottom Dock Area */}
          <div className="w-full max-w-2xl mx-auto px-3 sm:px-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-2 shrink-0">
            {/* Attached image preview above dock */}
            {selectedImage && (
              <div
                className="w-full mb-2 flex items-center justify-between p-2 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/15 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150"
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

            {/* Input dock */}
            <div className="w-full h-[50px] rounded-3xl border border-white/20 bg-slate-900/95 backdrop-blur-xl shadow-2xl flex items-center px-2.5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="w-full flex items-center gap-2"
              >
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => handleSmoothClose()}
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
            </div>
          </div>
        </div>
      )}
    </>
  );
};
