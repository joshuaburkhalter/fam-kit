import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Sparkles,
  Bot,
  User as UserIcon,
  Loader2,
  CheckCircle,
  X,
  Trash2,
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
    prompt: 'Add milk, eggs, and bread to the grocery list',
  },
  {
    icon: '📅',
    title: 'Check Schedule',
    prompt: "What's on our family calendar this week?",
  },
  {
    icon: '🍳',
    title: 'Cook with Ingredients',
    prompt: 'What can I cook with chicken and pasta?',
  },
  {
    icon: '🍽️',
    title: 'Plan Dinners',
    prompt: 'Help me plan quick dinners for the family this week',
  },
];

export const AssistantPage: React.FC = () => {
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
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const dockRef = useFabAutoClose<HTMLDivElement>({
    isOpen: isInputExpanded,
    onClose: () => setIsInputExpanded(false),
  });

  // Persist chat history to localStorage (retain up to 80 messages)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedKey = household ? `${CHAT_STORAGE_PREFIX}${household.id}` : `${CHAT_STORAGE_PREFIX}default`;
      const toSave = messages.slice(-80);
      localStorage.setItem(storedKey, JSON.stringify(toSave));
    } catch (e) {
      console.error('Failed to save chat history:', e);
    }
  }, [messages, household]);

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

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || input;
    if ((!messageText.trim() && !selectedImage) || !household || isLoading) return;

    const userMessage: AssistantMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      imageUrl: selectedImage?.preview,
    };

    // Keep the last 10 messages for multi-turn context
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

      // Auto-speak response if audio setting is enabled
      if (autoAudioResponses && voiceService.isTTSSupported()) {
        setIsSpeaking(true);
        voiceService.speak(response.response, () => setIsSpeaking(false));
      }
    } catch (err: any) {
      console.error('Assistant error:', err);
      const isKeyMissing =
        !apiKey && (err.message?.includes('API key') || err.message?.includes('configured') || err.message?.includes('Gemini'));
      const friendlyMessage = isKeyMissing
        ? '⚠️ Gemini is not connected yet! Please go to Settings (top right gear icon) to enter your Gemini API Key or set GEMINI_API_KEY on the server.'
        : `⚠️ Sorry, I ran into an error: ${err.message || 'Please verify your Gemini connection.'}`;

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

  const toggleVoiceInput = () => {
    setIsInputExpanded(true);
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsInputExpanded(true);
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
    <div className="flex flex-col h-[calc(100dvh-4rem)] md:h-[calc(100dvh-4.5rem)] max-w-4xl mx-auto px-4 pt-4 pb-2">
      {/* Top Header Control Bar: New Chat & Small Icon-only Audio Toggle */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          {/* New Chat Button */}
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-900/80 hover:bg-slate-800 border border-white/10 transition-all cursor-pointer shadow-sm"
              title="Start a new chat conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-[11px]">New Chat</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Active Speaking Indicator with Stop Button */}
          {isSpeaking && (
            <button
              onClick={() => {
                voiceService.stopSpeaking();
                setIsSpeaking(false);
              }}
              className="flex items-center gap-1.5 bg-pink-500/20 text-pink-400 border border-pink-500/30 px-2.5 py-1 rounded-full text-xs font-semibold animate-pulse shadow-lg shadow-pink-500/10"
              title="Stop Speaking"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span className="text-[11px]">Stop</span>
            </button>
          )}

          {/* Small Icon-Only Mute / Audio Toggle */}
          <button
            type="button"
            onClick={() => setAutoAudioResponses(!autoAudioResponses)}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all border cursor-pointer ${
              autoAudioResponses
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-sm hover:bg-emerald-500/25'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-500 hover:text-slate-300 border-white/10'
            }`}
            title={
              autoAudioResponses
                ? 'Voice playback: ON (click to mute)'
                : 'Voice playback: MUTED (click to unmute)'
            }
          >
            {autoAudioResponses ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Chat Messages or Centered Gemini Welcome Screen */}
      <div className="flex-1 overflow-y-auto space-y-4 px-1 py-2 pb-36 md:pb-28 flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8 max-w-lg mx-auto my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Centered Gemini Sparkle Glow Icon */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 flex items-center justify-center text-slate-950 shadow-2xl shadow-emerald-500/30 mb-4">
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.2]" />
            </div>

            {/* Greeting */}
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Hello,{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                {currentUser?.name?.split(' ')[0] || 'there'}
              </span>
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-sm sm:max-w-md">
              How can I help your family today? Ask questions, coordinate schedules, plan meals, or snap photos of recipes and receipts.
            </p>

            {/* Quick Suggestion Prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-6 w-full">
              {GEMINI_SUGGESTIONS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setIsInputExpanded(true);
                    handleSendMessage(item.prompt);
                  }}
                  className="flex items-start gap-3 p-3 rounded-2xl glass-panel border border-white/10 hover:border-emerald-500/40 hover:bg-slate-850 text-left transition-all group hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-black/20 cursor-pointer"
                >
                  <span className="text-xl shrink-0 p-1.5 rounded-xl bg-white/5 group-hover:bg-emerald-500/10 transition-colors">
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.prompt}
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
              className={`flex gap-3 ${isAi ? 'justify-start' : 'justify-end'}`}
            >
              {isAi && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shrink-0 mt-1 shadow-md shadow-emerald-500/20">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-4 shadow-lg ${
                  isAi
                    ? 'glass-panel text-slate-100 rounded-tl-sm border-white/10'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-medium rounded-tr-sm shadow-emerald-500/20'
                }`}
              >
                {/* Uploaded image if any */}
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="Upload"
                    className="w-full max-h-56 object-cover rounded-2xl mb-3 border border-black/20"
                  />
                )}

                {/* Text Content */}
                <div className="text-sm leading-relaxed selectable-text">
                  {isAi ? (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>,
                        strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                        em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
                        ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1.5 text-slate-200">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1.5 text-slate-200">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
                        code: ({ children }) => (
                          <code className="bg-slate-900/90 text-emerald-400 px-1.5 py-0.5 rounded-lg text-xs font-mono border border-white/10">
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
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>

                {/* Actions Executed Summary Cards */}
                {msg.actionsExecuted && msg.actionsExecuted.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                    <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      Actions Taken:
                    </div>
                    {msg.actionsExecuted.map((act, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-900/80 p-2.5 rounded-xl border border-white/5 flex items-start gap-2 text-xs text-slate-300"
                      >
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-white">{act.summary}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  className={`text-[10px] mt-2 flex items-center justify-between gap-2 border-t border-white/5 pt-1.5 ${
                    isAi ? 'text-slate-500' : 'text-slate-900/70 font-semibold'
                  }`}
                >
                  {isAi ? (
                    <button
                      onClick={() => handleToggleSpeakMessage(msg.content)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-400 transition-colors p-1 -ml-1 rounded-lg hover:bg-white/5 cursor-pointer"
                      title={isSpeaking ? 'Stop audio' : 'Read message aloud'}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Listen</span>
                    </button>
                  ) : (
                    <div />
                  )}
                  <span>{msg.timestamp}</span>
                </div>
              </div>

              {!isAi && (
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 mt-1 shadow"
                  style={{
                    backgroundColor: currentUser?.avatar_color || '#10b981',
                  }}
                >
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })
      )}

        {isLoading && (
          <div className="flex gap-3 justify-start items-center">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shrink-0 shadow-md">
              <Bot className="w-4 h-4" />
            </div>
            <div className="glass-panel p-4 rounded-3xl rounded-tl-sm flex items-center gap-2.5 text-xs text-slate-300">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              <span>Thinking and coordinating family data...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Animated Expanding Message Dock & FAB */}
      <div className="fixed bottom-[calc(76px+1rem+env(safe-area-inset-bottom,0px))] md:bottom-8 left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-none flex flex-col items-end">
          {/* Attached Image Preview */}
          {selectedImage && isInputExpanded && (
            <div
              data-fab-keep-open
              className="w-full mb-2 pointer-events-auto flex items-center justify-between p-2 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/15 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150"
            >
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={selectedImage.preview}
                  alt="Selected"
                  className="w-10 h-10 object-cover rounded-xl border border-white/10 shrink-0"
                />
                <span className="text-xs text-slate-300 font-medium truncate">
                  Image attached (fridge/receipt/recipe)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div
            ref={dockRef}
            className={`fab-dock-transition pointer-events-auto h-[52px] border shadow-2xl flex items-center overflow-hidden ${
              isInputExpanded
                ? 'w-full rounded-3xl border-white/25 bg-slate-900/95 backdrop-blur-xl shadow-emerald-500/10 px-2'
                : 'w-[52px] rounded-full border-emerald-400/40 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 cursor-pointer shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 justify-center'
            }`}
          >
            {!isInputExpanded ? (
              <button
                type="button"
                onClick={() => setIsInputExpanded(true)}
                className="w-full h-full flex items-center justify-center text-slate-950"
                title="Message Gemini Assistant"
              >
                <Sparkles className="w-6 h-6 stroke-[2.2]" />
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="w-full flex items-center gap-2"
              >
                {/* Far left: Close button */}
                <button
                  type="button"
                  onClick={() => setIsInputExpanded(false)}
                  className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Hidden image input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />

                {/* Secondary action: Photo attach button (to the right of close button, left of text box) */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload photo of fridge, receipt, or recipe"
                  className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>

                {/* Secondary action: Voice Mic Button */}
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  title={isListening ? 'Stop Listening' : 'Voice Input (STT)'}
                  className={`p-2 rounded-2xl transition-all shrink-0 ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                      : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-emerald-400'
                  }`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Middle: Text Input */}
                <input
                  autoFocus
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    isListening
                      ? 'Listening to your voice...'
                      : 'Ask Gemini (e.g. "Add milk", "Plan dinners", "Schedule game")...'
                  }
                  className="flex-1 min-w-0 bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none py-2 px-1"
                />

                {/* Far right: Main action button (Send) */}
                <button
                  type="submit"
                  disabled={(!input.trim() && !selectedImage) || isLoading}
                  className="p-2 sm:px-3.5 sm:py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 shrink-0"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
