import React, { useState } from 'react';
import {
  Sparkles,
  Lock,
  Check,
  Gift,
  ArrowRight,
  LogOut,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShoppingCart,
  ChefHat,
  Calendar,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { HomebaseLogo } from './HomebaseLogo';
import { usePWA } from '../context/PWAContext';

interface PaywallModalProps {
  onOpenPricingDetails?: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = () => {
  const { household, currentUser, logout, redeemPromoCode } = usePWA();
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  const isExpired =
    household?.subscription_status === 'expired' ||
    household?.subscriptionStatus === 'expired';

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;

    setIsRedeeming(true);
    setRedeemError(null);
    setRedeemSuccess(null);

    try {
      const res = await redeemPromoCode(inviteCodeInput.trim().toUpperCase());
      setRedeemSuccess(res.message || 'Beta invite code activated! Welcome to the Homebase Closed Beta!');
      setInviteCodeInput('');
    } catch (err: any) {
      setRedeemError(err.message || 'Invalid or expired beta invite code. Please check your code and try again.');
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl overflow-y-auto overscroll-contain flex flex-col items-center p-4 sm:p-6 pt-10 pb-16 sm:pt-14 sm:pb-20 selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-[400px] h-[300px] bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-xl my-auto py-2 relative z-10 space-y-6">
        {/* Header Branding & Closed Beta Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center">
            <HomebaseLogo size={46} showWordmark={true} />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold shadow-inner mb-2.5">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Closed Beta • Invite Only</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
              {isExpired ? 'Beta Access Expired' : 'Homebase is in Closed Beta'}
            </h1>
          </div>

          <p className="max-w-md mx-auto text-xs sm:text-sm text-slate-400 leading-relaxed px-2">
            {isExpired ? (
              <>
                The beta access period has concluded for{' '}
                <strong className="text-white">{household?.name || 'your family'}</strong>. Enter a new invite code below to restore full access.
              </>
            ) : (
              <>
                We are currently testing Homebase with a select group of families. Access is granted exclusively through private beta invite codes.
              </>
            )}
          </p>
        </div>

        {/* Feature Preview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5 flex flex-col items-center text-center space-y-1.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white">Shared Groceries</h4>
            <p className="text-[11px] text-slate-400 leading-snug">
              Live aisle-categorized lists synced across all devices
            </p>
          </div>

          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5 flex flex-col items-center text-center space-y-1.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <ChefHat className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white">Meals & Recipes</h4>
            <p className="text-[11px] text-slate-400 leading-snug">
              Web discovery, recipe box, and interactive cook mode
            </p>
          </div>

          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5 flex flex-col items-center text-center space-y-1.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Calendar className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white">Family Calendar</h4>
            <p className="text-[11px] text-slate-400 leading-snug">
              Google Calendar sync and Family Assistant
            </p>
          </div>
        </div>

        {/* Feedback Messages */}
        {redeemSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-3 text-emerald-300 text-xs animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="font-semibold">{redeemSuccess}</p>
          </div>
        )}

        {redeemError && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-xs animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <p className="font-semibold">{redeemError}</p>
          </div>
        )}

        {/* Beta Invite Code Box */}
        <div className="bg-slate-900/80 border border-emerald-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4">
          <div className="flex items-center gap-2.5 text-emerald-400">
            <KeyRound className="w-5 h-5" />
            <h3 className="text-sm sm:text-base font-bold text-white">
              Redeem Beta Invite Code
            </h3>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Enter your private beta invite code below to unlock full access for{' '}
            <strong className="text-white">{household?.name || 'your family'}</strong>. One code activates all devices and family members.
          </p>

          <form onSubmit={handleRedeem} className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                placeholder="Enter invite code (e.g. BETA2026)"
                className="w-full bg-slate-950 border border-white/15 focus:border-emerald-500 rounded-2xl px-4 py-3 text-xs sm:text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase tracking-wider transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isRedeeming || !inviteCodeInput.trim()}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed active:scale-[0.99]"
            >
              {isRedeeming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Verifying Invite Code...</span>
                </>
              ) : (
                <>
                  <span>Unlock Beta Access</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Complimentary during closed beta for invited families</span>
          </div>
        </div>

        {/* Footer: User Identity & Sign Out */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 pt-2 border-t border-white/10 px-1">
          <div className="flex items-center gap-2">
            <span>Signed in as <strong>{currentUser?.name || currentUser?.username}</strong></span>
            {household?.name && (
              <span className="text-slate-500">({household.name})</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ClosedBetaModal = PaywallModal;
