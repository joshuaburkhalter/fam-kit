import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { api, onServerUpdatingChange } from '../lib/api';

export const AppUpdatingOverlay: React.FC = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const pollIntervalRef = useRef<any>(null);

  // Listen to API deploy / 502 / 503 triggers
  useEffect(() => {
    const unsubscribe = onServerUpdatingChange((updating) => {
      if (updating) {
        setIsUpdating(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // When updating is active, poll /api/health every 2.5 seconds
  useEffect(() => {
    if (!isUpdating || isRestored) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const checkServer = async () => {
      try {
        const isHealthy = await api.checkHealth();
        if (!isHealthy) return;

        // Verify root page returns 200 (not 502 from Cloudflare during container swap)
        const rootCheck = await fetch('/', { method: 'HEAD', cache: 'no-store' }).catch(() => null);
        if (!rootCheck || rootCheck.status !== 200) {
          return;
        }

        setIsRestored(true);
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

        // Tell service worker to check for new build immediately
        if ('serviceWorker' in navigator) {
          try {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
              await reg.update();
            }
          } catch {}
        }

        // Short pause to display success checkmark, then reload
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } catch {}
    };

    // First check after 2 seconds
    pollIntervalRef.current = setInterval(checkServer, 2500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isUpdating, isRestored]);

  if (!isUpdating) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/92 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 select-none">
      <div className="max-w-md w-full glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden flex flex-col items-center">
        {/* Ambient background glow */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Animated Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-400/20 border border-emerald-500/30 flex items-center justify-center mb-6 relative">
          {isRestored ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-in zoom-in-50 duration-300" />
          ) : (
            <>
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" style={{ animationDuration: '3s' }} />
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-slate-950" />
              </div>
            </>
          )}
        </div>

        {/* Status Text */}
        <h2 className="text-xl font-bold text-white tracking-tight mb-2">
          {isRestored ? 'Update Ready!' : 'Updating Homebase'}
        </h2>

        <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-6">
          {isRestored
            ? 'Update ready! Refreshing your app now...'
            : 'A new update is currently being applied. As soon as it finishes, this page will automatically reload with the latest improvements.'}
        </p>

        {/* Status indicator bar */}
        <div className="w-full bg-slate-900/80 rounded-2xl border border-white/5 py-3 px-4 flex items-center justify-center gap-2.5 text-xs text-slate-300 font-medium mb-6">
          {isRestored ? (
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Ready to go!
            </span>
          ) : (
            <span className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              Applying the latest updates...
            </span>
          )}
        </div>

        {/* Action button */}
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
          >
            Refresh Now
          </button>
          <button
            type="button"
            onClick={() => setIsUpdating(false)}
            className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-medium border border-white/5 transition-all cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
