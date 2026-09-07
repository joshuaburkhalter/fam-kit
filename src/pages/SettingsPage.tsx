import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Bell,
  Sparkles,
  Download,
  Check,
  ShieldCheck,
  Smartphone,
  HardDrive,
  Send,
  Loader2,
} from 'lucide-react';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';

export const SettingsPage: React.FC = () => {
  const {
    household,
    canInstallPWA,
    isPWAInstalled,
    installPWA,
    isPushSupported,
    isPushSubscribed,
    subscribeToPush,
  } = usePWA();

  const [isSubscribingPush, setIsSubscribingPush] = useState(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);

  const handlePushToggle = async () => {
    setIsSubscribingPush(true);
    setPushStatusMessage(null);
    try {
      const success = await subscribeToPush();
      if (success) {
        setPushStatusMessage('Push notifications successfully enabled!');
      } else {
        setPushStatusMessage('Failed to subscribe or permission denied.');
      }
    } catch (err: any) {
      setPushStatusMessage(`Error: ${err.message || 'Push subscription failed'}`);
    } finally {
      setIsSubscribingPush(false);
    }
  };

  const handleSendTestPush = async () => {
    if (!household) return;
    setIsSendingTestPush(true);
    try {
      await api.sendTestPush(
        household.id,
        'fam-kit Grocery Alert 🛒',
        'Someone just added organic strawberries to the grocery list!'
      );
      setPushStatusMessage('Test push notification sent to all household devices!');
      setTimeout(() => setPushStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Test push error:', err);
      setPushStatusMessage(`Failed to send test push: ${err.message}`);
    } finally {
      setIsSendingTestPush(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-4 pb-24 md:pb-12 space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl glass-panel border border-white/10">
        <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
          <SettingsIcon className="w-6 h-6 text-emerald-400" />
          Settings & Preferences
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure PWA installation, Web Push notifications, and AI Assistant settings
        </p>
      </div>

      {pushStatusMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-xs font-semibold animate-in fade-in">
          <Check className="w-4 h-4" />
          {pushStatusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PWA & Mobile Installation */}
        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Install as Mobile App</h3>
              <p className="text-xs text-slate-400">
                Works offline, provides instant grocery sync and home screen launch
              </p>
            </div>
          </div>

          <div className="pt-2">
            {isPWAInstalled ? (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-400 font-semibold">
                <Check className="w-4 h-4" />
                fam-kit is running as an installed PWA!
              </div>
            ) : canInstallPWA ? (
              <button
                onClick={installPWA}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
              >
                <Download className="w-4 h-4" />
                Install fam-kit on this Device
              </button>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/60 p-3 rounded-2xl border border-white/5">
                💡 To install on iOS/Android: Tap <span className="text-white font-semibold">Share</span> (iOS Safari) or the <span className="text-white font-semibold">Three Dots</span> (Android Chrome) and tap <span className="text-emerald-400 font-semibold">Add to Home Screen</span>.
              </p>
            )}
          </div>
        </div>

        {/* Web Push Notifications */}
        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Family Push Alerts</h3>
              <p className="text-xs text-slate-400">
                Get notified when someone adds groceries or assigns calendar events
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {!isPushSupported ? (
              <p className="text-xs text-amber-400 bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
                Push notifications are not supported in this browser environment.
              </p>
            ) : isPushSubscribed ? (
              <div className="space-y-2">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                  <Check className="w-4 h-4" />
                  Push alerts enabled on this device
                </div>
                <button
                  onClick={handleSendTestPush}
                  disabled={isSendingTestPush}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  {isSendingTestPush ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  Send Test Notification
                </button>
              </div>
            ) : (
              <button
                onClick={handlePushToggle}
                disabled={isSubscribingPush}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20"
              >
                {isSubscribingPush ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
                Enable Web Push Alerts
              </button>
            )}
          </div>
        </div>

        {/* Gemini AI Engine Status */}
        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Gemini 3.6 Flash Engine</h3>
              <p className="text-xs text-slate-400">Multimodal voice & function calling active</p>
            </div>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-white/5 space-y-1.5 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Model:</span>
              <span className="font-mono text-emerald-400 font-semibold">gemini-3.6-flash</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Capabilities:</span>
              <span>STT, TTS, Vision, Autonomous DB Tools</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">API Status:</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Connected
              </span>
            </div>
          </div>
        </div>

        {/* Database & Architecture */}
        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">WASM SQLite Storage</h3>
              <p className="text-xs text-slate-400">Ultra-fast pure WASM database engine</p>
            </div>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-white/5 space-y-1.5 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Engine:</span>
              <span className="font-mono text-cyan-400 font-semibold">sql.js (pure WASM)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">File Persistence:</span>
              <span className="font-mono text-slate-300">famkit.db</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Cloud Compatibility:</span>
              <span>Render.com, Linux, Windows, macOS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
