'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePWA } from '@/components/pwa/PWAProvider';
import { startSpeechRecognition, speakText, stopSpeaking } from '@/lib/voice';
import { AssistantAction } from '@/types';
import Link from 'next/link';
import {
  Mic,
  MicOff,
  Send,
  Image as ImageIcon,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  ShoppingCart,
  Calendar as CalendarIcon,
  UtensilsCrossed,
  CheckCircle2,
  ListTodo,
  BookOpen,
  ArrowRight,
  RefreshCw,
  Sparkle
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  image?: string;
  actions?: AssistantAction[];
  timestamp: Date;
}

export default function AssistantPage() {
  const { activeMember, apiKey } = usePWA();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hey ${activeMember?.name || 'there'}! I'm your Gemini Family Assistant. Talk, text, or drop a photo of a recipe card, receipt, or fridge shelf.\n\nTry saying: "Add whole milk and honeycrisp apples to the grocery list and schedule Leo's soccer practice on Thursday at 4:30 PM."`,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ base64: string; preview: string; mimeType: string } | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // Voice Recording Toggle
  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsRecording(false);
    } else {
      stopSpeaking();
      setIsSpeaking(false);
      setIsRecording(true);

      recognitionRef.current = startSpeechRecognition({
        onResult: (transcript, isFinal) => {
          setInputText(transcript);
          if (isFinal) {
            setIsRecording(false);
            if (recognitionRef.current) {
              recognitionRef.current.stop();
              recognitionRef.current = null;
            }
            handleSubmit(transcript);
          }
        },
        onError: (err) => {
          console.warn('Voice error:', err);
          setIsRecording(false);
        },
        onEnd: () => {
          setIsRecording(false);
        },
      });
    }
  };

  // Image Upload handler
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedImage({
        base64,
        preview: base64,
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.readAsDataURL(file);
  };

  // Submit Prompt to Gemini
  const handleSubmit = async (overrideText?: string) => {
    const textToSend = (overrideText || inputText).trim();
    if (!textToSend && !selectedImage) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      image: selectedImage?.preview,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    const currentImage = selectedImage;
    setSelectedImage(null);
    setIsProcessing(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          imageBase64: currentImage?.base64,
          imageMimeType: currentImage?.mimeType,
          customApiKey: apiKey,
          activeMemberId: activeMember?.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: data.message || 'Done! I have taken care of that for your family.',
        actions: data.actions || [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data.message) {
        setIsSpeaking(true);
        speakText(data.message, () => setIsSpeaking(false));
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: `⚠️ ${err.message || 'Error processing request'}. If using a personal key, please check Settings.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const samplePrompts = [
    { icon: '🛒', label: 'Add milk, bread & spinach', prompt: 'Add 1 gallon organic whole milk, sourdough bread, and baby spinach to the grocery list.' },
    { icon: '🍲', label: 'Dinner with chicken & lemon', prompt: 'What easy recipe can I cook with chicken breasts, lemon, and asparagus? Schedule it for tomorrow dinner.' },
    { icon: '📅', label: 'Leo soccer practice', prompt: 'Schedule Leo Soccer Practice for Thursday at 4:30 PM at Community Park.' },
    { icon: '⛺', label: 'Camping gear checklist', prompt: 'Create a camping packing list with 4 sleeping bags, tent, flashlight, bug spray, and camp stove.' },
  ];

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col min-h-[calc(100vh-4.5rem)]">
      {/* Hero Assistant Banner */}
      <div className="anylist-card p-4 sm:p-5 rounded-3xl mb-4 flex items-center justify-between gap-4 border border-emerald-500/20 shadow-xl relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 z-10">
          {/* Animated AI Orb */}
          <div className="relative">
            <div className={`w-12 h-12 rounded-2xl ai-orb flex items-center justify-center text-white text-2xl shadow-lg transition-transform duration-300 ${isRecording || isSpeaking ? 'scale-110' : ''}`}>
              {activeMember?.avatar || '✨'}
            </div>
            {(isRecording || isSpeaking) && (
              <div className="absolute inset-0 -m-1 ai-pulse-ring pointer-events-none" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                Family Assistant
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Synced with <strong className="text-slate-200">{activeMember?.name || 'Joshua'}</strong>'s family board
            </p>
          </div>
        </div>

        {/* TTS Toggle */}
        <button
          onClick={() => {
            if (isSpeaking) {
              stopSpeaking();
              setIsSpeaking(false);
            } else {
              const lastAssistant = [...messages].reverse().find((m) => m.sender === 'assistant');
              if (lastAssistant) {
                setIsSpeaking(true);
                speakText(lastAssistant.text, () => setIsSpeaking(false));
              }
            }
          }}
          className={`p-2.5 rounded-2xl border transition-all z-10 ${
            isSpeaking
              ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/30 animate-pulse'
              : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title={isSpeaking ? 'Mute voice' : 'Read aloud'}
        >
          {isSpeaking ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 min-h-[320px]">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}
            >
              <div
                className={`max-w-[88%] sm:max-w-[78%] rounded-3xl p-4 shadow-md ${
                  isUser
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-600 text-white rounded-br-sm shadow-emerald-950/40'
                    : 'anylist-card text-slate-200 rounded-bl-sm border border-slate-700/70'
                }`}
              >
                {/* Photo attached */}
                {msg.image && (
                  <div className="mb-3 overflow-hidden rounded-2xl border border-white/10 max-h-64 shadow-inner">
                    <img src={msg.image} alt="Uploaded attachment" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="text-sm whitespace-pre-wrap leading-relaxed font-normal">
                  {msg.text}
                </div>

                {/* Rich Action Result Cards */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3.5 space-y-2 border-t border-white/10 pt-3">
                    {msg.actions.map((act, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs shadow-inner"
                      >
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="font-semibold text-slate-200">{act.summary}</span>
                        </div>

                        {act.type === 'grocery_added' && (
                          <Link
                            href="/grocery"
                            className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all shrink-0"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>View Grocery</span>
                          </Link>
                        )}
                        {act.type === 'calendar_event_added' && (
                          <Link
                            href="/calendar"
                            className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-bold px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 transition-all shrink-0"
                          >
                            <CalendarIcon className="w-3.5 h-3.5" />
                            <span>Calendar</span>
                          </Link>
                        )}
                        {act.type === 'meal_planned' && (
                          <Link
                            href="/meal-planner"
                            className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-bold px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition-all shrink-0"
                          >
                            <UtensilsCrossed className="w-3.5 h-3.5" />
                            <span>Meal Plan</span>
                          </Link>
                        )}
                        {act.type === 'recipe_imported' && (
                          <Link
                            href="/recipes"
                            className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 font-bold px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 transition-all shrink-0"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>View Recipe</span>
                          </Link>
                        )}
                        {act.type === 'list_created' && (
                          <Link
                            href="/grocery"
                            className="flex items-center gap-1.5 text-teal-400 hover:text-teal-300 font-bold px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 transition-all shrink-0"
                          >
                            <ListTodo className="w-3.5 h-3.5" />
                            <span>View List</span>
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 px-2 font-mono">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {isProcessing && (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl anylist-card text-xs text-emerald-400 w-fit animate-pulse border border-emerald-500/30 shadow-lg">
            <Sparkles className="w-4 h-4 animate-spin text-emerald-400" />
            <span className="font-medium">Gemini is parsing intent and coordinating with family boards...</span>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
        {samplePrompts.map((p, i) => (
          <button
            key={i}
            onClick={() => handleSubmit(p.prompt)}
            className="shrink-0 px-3.5 py-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-xs font-medium text-slate-300 hover:text-white transition-all hover:scale-102 flex items-center gap-2 shadow-sm"
          >
            <span>{p.icon}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {/* Selected Image Preview (before sending) */}
      {selectedImage && (
        <div className="relative mb-3 inline-block">
          <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 w-28 h-28 shadow-xl">
            <img src={selectedImage.preview} alt="Selected attachment" className="w-full h-full object-cover" />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-950/90 text-white hover:bg-rose-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-[10px] text-emerald-400 mt-1 block font-semibold">Photo ready to parse</span>
        </div>
      )}

      {/* Input Control Center */}
      <div className="glass-dock p-2.5 sm:p-3 rounded-3xl border border-slate-700/80 shadow-2xl relative">
        {/* Voice Wave Animation when Recording */}
        {isRecording && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center gap-2 shadow-xl animate-bounce">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            Listening... Speak now
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Photo Attachment Button */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors shrink-0"
            title="Upload photo of recipe, fridge, flyer, or handwritten note"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Voice Microphone Button */}
          <button
            type="button"
            onClick={toggleRecording}
            className={`p-3 rounded-2xl transition-all shrink-0 ${
              isRecording
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40 animate-pulse scale-105'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-emerald-400'
            }`}
            title={isRecording ? 'Stop recording' : 'Voice command'}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Textarea Input */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Talk, text, or drop a recipe link..."
            rows={1}
            className="flex-1 bg-slate-950/80 text-slate-100 placeholder-slate-500 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 border border-slate-800 resize-none min-h-[46px] max-h-24"
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={(!inputText.trim() && !selectedImage) || isProcessing}
            className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-40 text-white shadow-lg shadow-emerald-600/30 transition-all shrink-0 hover:scale-105"
            title="Send command"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
