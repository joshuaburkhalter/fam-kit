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
  RefreshCw
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
      text: `Hello ${activeMember?.name || 'there'}! I'm your Gemini Family Assistant. You can speak to me, text, or upload pictures of recipes or grocery notes.\n\nTry asking: "Add whole milk and honeycrisp apples to the grocery list and schedule soccer practice for Leo on Thursday at 4:30 PM."`,
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
            // Automatically submit speech
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
        text: data.message || 'I processed your request!',
        actions: data.actions || [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Speak response aloud if TTS enabled or voice input
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
          text: `⚠️ ${err.message || 'Error processing request'}. If using a personal Gemini API Key, make sure it is configured in Settings.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const samplePrompts = [
    { label: '🛒 Add milk, eggs, & bread', prompt: 'Add 1 gallon whole milk, 1 dozen eggs, and sourdough bread to the grocery list.' },
    { label: '🍲 Dinner ideas with chicken', prompt: 'What delicious dinner recipe can I make with chicken breasts and spinach? Plan it for tomorrow dinner.' },
    { label: '📅 Leo soccer on Thursday', prompt: 'Schedule Leo Soccer Practice on Thursday at 4:30 PM at Community Park.' },
    { label: '⛺ Camping packing list', prompt: 'Create a camping packing checklist with tent, sleeping bags, flashlights, and bug spray.' },
  ];

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Top Welcome Card */}
      <div className="flex items-center justify-between p-4 rounded-2xl glass-card border border-emerald-500/20 mb-4 shadow-lg shadow-emerald-950/20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white text-2xl shadow-md shadow-emerald-500/30">
            {activeMember?.avatar || '✨'}
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              Family Assistant
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Online
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Active Member: <strong className="text-slate-200">{activeMember?.name || 'Joshua'}</strong>
            </p>
          </div>
        </div>

        {/* TTS Mute / Speak Toggle */}
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
          className={`p-2.5 rounded-xl transition-colors ${
            isSpeaking
              ? 'bg-emerald-500 text-white animate-pulse'
              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
          }`}
          title={isSpeaking ? 'Mute speech' : 'Read aloud'}
        >
          {isSpeaking ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
      </div>

      {/* Chat Transcript Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 min-h-[350px]">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-md ${
                  isUser
                    ? 'bg-emerald-600 text-white rounded-br-xs'
                    : 'glass-panel border border-slate-800 text-slate-200 rounded-bl-xs'
                }`}
              >
                {/* Image attached */}
                {msg.image && (
                  <div className="mb-3 overflow-hidden rounded-xl border border-white/10 max-h-60">
                    <img src={msg.image} alt="Uploaded attachment" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</div>

                {/* Assistant Action Cards */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3.5 space-y-2 border-t border-slate-700/60 pt-3">
                    {msg.actions.map((act, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="font-medium text-slate-200">{act.summary}</span>
                        </div>

                        {act.type === 'grocery_added' && (
                          <Link
                            href="/grocery"
                            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" /> View List
                          </Link>
                        )}
                        {act.type === 'calendar_event_added' && (
                          <Link
                            href="/calendar"
                            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-1 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors"
                          >
                            <CalendarIcon className="w-3.5 h-3.5" /> Calendar
                          </Link>
                        )}
                        {act.type === 'meal_planned' && (
                          <Link
                            href="/meal-planner"
                            className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold px-2 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                          >
                            <UtensilsCrossed className="w-3.5 h-3.5" /> Meals
                          </Link>
                        )}
                        {act.type === 'recipe_imported' && (
                          <Link
                            href="/recipes"
                            className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
                          >
                            <BookOpen className="w-3.5 h-3.5" /> Recipe
                          </Link>
                        )}
                        {act.type === 'list_created' && (
                          <Link
                            href="/grocery"
                            className="flex items-center gap-1 text-teal-400 hover:text-teal-300 font-semibold px-2 py-1 rounded-md bg-teal-500/10 hover:bg-teal-500/20 transition-colors"
                          >
                            <ListTodo className="w-3.5 h-3.5" /> View List
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {isProcessing && (
          <div className="flex items-center gap-2 p-3 rounded-2xl glass-card text-xs text-emerald-400 w-fit animate-pulse border border-emerald-500/30">
            <Sparkles className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Gemini is thinking and coordinating with your family board...</span>
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
            className="shrink-0 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-xs text-slate-300 transition-all hover:scale-102 flex items-center gap-1.5"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Selected Image Preview (before sending) */}
      {selectedImage && (
        <div className="relative mb-3 inline-block">
          <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500 w-28 h-28 shadow-lg">
            <img src={selectedImage.preview} alt="Selected" className="w-full h-full object-cover" />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-1 right-1 p-1 rounded-full bg-slate-950/80 text-white hover:bg-rose-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Photo attached</span>
        </div>
      )}

      {/* Input Control Center */}
      <div className="glass-panel p-2 sm:p-3 rounded-2xl border border-slate-800 shadow-2xl relative">
        {/* Voice Wave Animation when Recording */}
        {isRecording && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-rose-600/90 text-white text-xs font-semibold flex items-center gap-2 shadow-lg animate-bounce">
            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
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
            className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors shrink-0"
            title="Upload photo of recipe, fridge, flyer, or handwritten note"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Voice Microphone Button */}
          <button
            type="button"
            onClick={toggleRecording}
            className={`p-3 rounded-xl transition-all shrink-0 ${
              isRecording
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40 animate-pulse scale-105'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-emerald-400'
            }`}
            title={isRecording ? 'Stop recording' : 'Voice command (Speech-to-text)'}
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
            className="flex-1 bg-slate-900/90 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 border border-slate-800 resize-none min-h-[44px] max-h-24"
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={(!inputText.trim() && !selectedImage) || isProcessing}
            className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition-all shrink-0"
            title="Send command"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
