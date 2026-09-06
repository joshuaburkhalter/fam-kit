'use client';

import React, { useState } from 'react';
import { usePWA } from '@/components/pwa/PWAProvider';
import {
  Settings,
  Key,
  Download,
  Bell,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Sparkles,
  ShieldCheck,
  Send
} from 'lucide-react';

export default function SettingsPage() {
  const {
    isInstallable,
    installApp,
    isPushSupported,
    isPushSubscribed,
    subscribeToPush,
    apiKey,
    setApiKey,
    household
  } = usePWA();

  const [inputApiKey, setInputApiKey] = useState(apiKey);
  const [keySaved, setKeySaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testPushStatus, setTestPushStatus] = useState<string | null>(null);

  // Save API key
  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    setApiKey(inputApiKey.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2500);
  };

  // Test Gemini API key
  const handleTestApiKey = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Say hello in 5 words to test connectivity.',
          customApiKey: inputApiKey.trim() || apiKey,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestResult(`✓ Connected! Assistant replied: "${data.message}"`);
      } else {
        setTestResult(`✗ Error: ${data.error || data.message || 'Check your API key'}`);
      }
    } catch (err: any) {
      setTestResult(`✗ Network Error: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  // Test Push Notification
  const handleSendTestPush = async () => {
    try {
      setTestPushStatus('Sending push notification...');
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_notification',
          title: '✨ fam-kit Push Notification',
          message: 'Weekly meal reminder: Tuscan Garlic Chicken tonight at 6:30 PM!',
        }),
      });

      if (res.ok) {
        setTestPushStatus('✓ Notification sent! Check your notification center.');
      } else {
        setTestPushStatus('✗ Failed to send push notification.');
      }
    } catch (err: any) {
      setTestPushStatus(`✗ Error: ${err.message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-emerald-400" />
          Settings & App Configuration
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure Gemini AI keys, PWA installation, and Web Push notifications.
        </p>
      </div>

      {/* Gemini AI Key Section */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Gemini API Key</h2>
            <p className="text-xs text-slate-400">
              Used for multimodal vision, voice commands, and smart grocery / calendar actions.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveApiKey} className="space-y-3">
          <div>
            <input
              type="password"
              value={inputApiKey}
              onChange={(e) => setInputApiKey(e.target.value)}
              placeholder="AIzaSy... (leave blank if set via server environment)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-mono focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all"
              >
                {keySaved ? '✓ Saved!' : 'Save Key'}
              </button>

              <button
                type="button"
                onClick={handleTestApiKey}
                disabled={isTesting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                {isTesting ? 'Testing...' : 'Test Connection'}
              </button>
            </div>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-emerald-400 hover:underline"
            >
              Get a free Gemini API Key →
            </a>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs ${
                testResult.startsWith('✓')
                  ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/40 border border-rose-800 text-rose-300'
              }`}
            >
              {testResult}
            </div>
          )}
        </form>
      </div>

      {/* PWA App Install Section */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">PWA App Installation</h2>
              <p className="text-xs text-slate-400">
                Install fam-kit on your phone or desktop for full-screen and offline grocery shopping.
              </p>
            </div>
          </div>

          {isInstallable ? (
            <button
              onClick={installApp}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all hover:scale-105"
            >
              <Download className="w-4 h-4" />
              <span>Install to Home Screen</span>
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Installed / Browser Ready
            </span>
          )}
        </div>

        {/* Installation Instructions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
            <h3 className="text-xs font-bold text-slate-200">📱 iPhone / iPad (iOS Safari)</h3>
            <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Open this site in <strong>Safari</strong></li>
              <li>Tap the <strong>Share</strong> button (box with upward arrow)</li>
              <li>Scroll down and select <strong>"Add to Home Screen"</strong></li>
            </ol>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
            <h3 className="text-xs font-bold text-slate-200">🤖 Android / Desktop (Chrome / Edge)</h3>
            <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Tap the <strong>"Install App"</strong> button above or browser menu (⋮)</li>
              <li>Select <strong>"Install fam-kit"</strong></li>
              <li>Enjoy standalone app icon & fast offline access</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Push Notifications Section */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Push Notifications</h2>
              <p className="text-xs text-slate-400">
                Receive family grocery updates, daily meal alerts, and calendar reminders.
              </p>
            </div>
          </div>

          {isPushSubscribed ? (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Notifications Active
              </span>
              <button
                onClick={handleSendTestPush}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-emerald-400" /> Test Notification
              </button>
            </div>
          ) : (
            <button
              onClick={subscribeToPush}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/30 transition-all"
            >
              Enable Push Notifications
            </button>
          )}
        </div>

        {testPushStatus && (
          <div
            className={`p-3 rounded-xl text-xs ${
              testPushStatus.startsWith('✓')
                ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
                : 'bg-slate-900 border border-slate-800 text-slate-300'
            }`}
          >
            {testPushStatus}
          </div>
        )}
      </div>
    </div>
  );
}
