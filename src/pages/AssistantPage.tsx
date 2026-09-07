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
  Wand2,
} from 'lucide-react';
import type { AssistantMessage } from '../types';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { voiceService } from '../lib/voice';

export const AssistantPage: React.FC = () => {
  const { household, currentUser } = usePWA();
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "👋 Hi! I'm your Gemini 3.6 Flash Family Assistant. You can speak to me, snap a picture of your fridge, receipt, or handwritten recipe, or ask me to add groceries, plan meals, or schedule family events.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

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
      });

      const assistantMessage: AssistantMessage = {
        id: 'msg-ai-' + Date.now(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionsExecuted: response.actionsExecuted,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Auto-speak response if audio is enabled
      if (voiceService.isTTSSupported()) {
        setIsSpeaking(true);
        voiceService.speak(response.response, () => setIsSpeaking(false));
      }
    } catch (err: any) {
      console.error('Assistant error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'msg-err-' + Date.now(),
          role: 'assistant',
          content: `⚠️ Sorry, I ran into an error: ${err.message || 'Please verify your Gemini connection.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVoiceInput = () => {
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

  const samplePrompts = [
    "Add 2 gallons of milk, sourdough bread, and avocados to the grocery list",
    "Plan 3 quick kid-friendly dinners for this week and add ingredients to my cart",
    "Schedule Maya's Soccer practice on Saturday from 9am to 10:30am",
    "Create a packing list for our weekend camping trip",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem-4.5rem)] md:h-[calc(100vh-4rem)] max-w-4xl mx-auto p-2 sm:p-4">
      {/* Top Banner / Pulse Assistant Header */}
      <div className="flex items-center justify-between p-3 rounded-2xl glass-panel mb-3 border border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/25">
              <Bot className="w-6 h-6" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-slate-900 rounded-full" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              Gemini 3.6 Flash Assistant
              <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                Multimodal & Voice
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Autonomous family organizer with direct database actions
            </p>
          </div>
        </div>

        {isSpeaking && (
          <button
            onClick={() => {
              voiceService.stopSpeaking();
              setIsSpeaking(false);
            }}
            className="flex items-center gap-1 bg-pink-500/20 text-pink-400 border border-pink-500/30 px-2.5 py-1 rounded-xl text-xs font-semibold animate-pulse"
          >
            <VolumeX className="w-3.5 h-3.5" />
            Stop Speaking
          </button>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 px-1 py-2">
        {messages.map((msg) => {
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
                <div className="text-sm leading-relaxed whitespace-pre-wrap selectable-text">
                  {msg.content}
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
                  className={`text-[10px] mt-1.5 text-right ${
                    isAi ? 'text-slate-500' : 'text-slate-900/70 font-semibold'
                  }`}
                >
                  {msg.timestamp}
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
        })}

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

      {/* Suggested Quick Prompts */}
      {messages.length < 3 && (
        <div className="py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <Wand2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
          {samplePrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(p)}
              className="text-xs shrink-0 bg-slate-900/60 hover:bg-slate-850 border border-white/5 hover:border-emerald-500/30 text-slate-300 px-3 py-1.5 rounded-full transition-all"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Image Preview Banner */}
      {selectedImage && (
        <div className="p-2 rounded-2xl glass-panel mb-2 flex items-center justify-between border border-white/10">
          <div className="flex items-center gap-2.5">
            <img
              src={selectedImage.preview}
              alt="Selected"
              className="w-12 h-12 object-cover rounded-xl border border-white/10"
            />
            <span className="text-xs text-slate-300 font-medium">
              Image attached (fridge/receipt/recipe)
            </span>
          </div>
          <button
            onClick={() => setSelectedImage(null)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div className="pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2 glass-panel p-2 rounded-3xl border border-white/10 shadow-2xl"
        >
          {/* Hidden image input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />

          {/* Photo attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload photo of fridge, receipt, or recipe"
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Voice Mic Button */}
          <button
            type="button"
            onClick={toggleVoiceInput}
            title={isListening ? 'Stop Listening' : 'Voice Input (STT)'}
            className={`p-2.5 rounded-2xl transition-all ${
              isListening
                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-emerald-400'
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isListening
                ? 'Listening to your voice...'
                : 'Ask Gemini (e.g. "Add milk", "Plan dinners", "Schedule game")...'
            }
            className="flex-1 bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none px-2 py-1"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={(!input.trim() && !selectedImage) || isLoading}
            className="p-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-40 text-slate-950 font-bold transition-all shadow-lg shadow-emerald-500/20"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
