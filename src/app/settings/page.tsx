'use client';

import React, { useState } from 'react';
import { usePWA } from '@/components/pwa/PWAProvider';
import {
  Settings,
  Key,
  Download,
  Bell,
  CheckCircle2,
  Smartphone,
  Sparkles,
  Send
} from 'lucide-react';

export default function SettingsPage() {
  const {
    isInstallable,
    installApp,
    isPushSubscribed,
    subscribeToPush,
    apiKey,
    setApiKey,
  } = usePWA();

  const [inputApiKey, setInputApiKey] = useState(apiKey);
  const [keySaved, setKeySaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testPushStatus, setTestPushStatus] = useState<string | null>(null);

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    setApiKey(inputApiKey.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2500);
  };

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
        setTestResult(`✓ Connected to Gemini! Assistant replied: "${data.message}"`);
      } else {
        setTestResult(`✗ Error: ${data.error || data.message || 'Check your API key'}`);
      }
    } catch (err: any) {
      setTestResult(`✗ Network Error: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

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
        setTestPushStatus('✓ Notification sent! Check your device notification center.');
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-800 flex items-center justify-center text-white shadow-md">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Settings & Configuration
            </h1>
            <p className="text-xs text-slate-400">
              Configure Gemini API keys, PWA installation, and Web Push notifications.
            </p>
          </div>
        </div>
      </div>

      {/* Gemini AI Key Section */}
      <div className="anylist-card p-6 sm:p-7 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">Gemini API Key</h2>
            <p className="text-xs text-slate-400">
              Powers voice interaction, recipe link extraction, and smart grocery / calendar actions.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveApiKey} className="space-y-3.5">
          <div>
            <input
              type="password"
              value={inputApiKey}
              onChange={(e) => setInputApiKey(e.target.value)}
              placeholder="AQ... or AIzaSy... (configured in .env)"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white font-mono focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all"
              >
                {keySaved ? '✓ Saved!' : 'Save Key'}
              </button>

              <button
                type="button"
                onClick={handleTestApiKey}
                disabled={isTesting}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                {isTesting ? 'Testing...' : 'Test Connection'}
              </button>
            </div>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-emerald-400 hover:underline font-medium"
            >
              Get a Gemini API Key →
            </a>
          </div>

          {testResult && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-medium ${
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
      <div className="anylist-card p-6 sm:p-7 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/15 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">PWA App Installation</h2>
              <p className="text-xs text-slate-400">
                Install fam-kit on iOS or Android for full-screen and offline shopping.
              </p>
            </div>
          </div>

          {isInstallable ? (
            <button
              onClick={installApp}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition-all hover:scale-105"
            >
              <Download className="w-4 h-4" />
              <span>Install to Home Screen</span>
            </button>
          ) : (
            <span className="px-3.5 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Installed / Browser Ready
            </span>
          )}
        </div>

        {/* Instructions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
            <h3 className="text-xs font-bold text-slate-200">📱 iPhone / iPad (iOS Safari)</h3>
            <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Open in <strong>Safari</strong></li>
              <li>Tap the <strong>Share</strong> button</li>
              <li>Select <strong>"Add to Home Screen"</strong></li>
            </ol>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
            <h3 className="text-xs font-bold text-slate-200">🤖 Android / Desktop (Chrome)</h3>
            <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Tap <strong>"Install App"</strong> above or browser menu (⋮)</li>
              <li>Select <strong>"Install fam-kit"</strong></li>
              <li>Launch from your Home Screen anytime</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Push Notifications Section */}
      <div className="anylist-card p-6 sm:p-7 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Push Notifications</h2>
              <p className="text-xs text-slate-400">
                Receive family grocery updates, daily meal alerts, and calendar reminders.
              </p>
            </div>
          </div>

          {isPushSubscribed ? (
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Active
              </span>
              <button
                onClick={handleSendTestPush}
                className="px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-emerald-400" /> Test Alert
              </button>
            </div>
          ) : (
            <button
              onClick={subscribeToPush}
              className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold shadow-md shadow-amber-600/30 transition-all"
            >
              Enable Push Notifications
            </button>
          )}
        </div>

        {testPushStatus && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-medium ${
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
