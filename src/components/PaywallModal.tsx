import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  Gift,
  ArrowRight,
  LogOut,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { HomebaseLogo } from './HomebaseLogo';
import { usePWA } from '../context/PWAContext';

interface PaywallModalProps {
  onOpenPricingDetails?: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ onOpenPricingDetails }) => {
  const { household, currentUser, logout, redeemPromoCode, subscribePlan } = usePWA();
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  const isExpired =
    household?.subscription_status === 'expired' ||
    household?.subscriptionStatus === 'expired';

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCodeInput.trim()) return;

    setIsRedeeming(true);
    setRedeemError(null);
    setRedeemSuccess(null);

    try {
      const res = await redeemPromoCode(promoCodeInput.trim().toUpperCase());
      setRedeemSuccess(res.message || 'Free access code activated successfully!');
      setPromoCodeInput('');
    } catch (err: any) {
      setRedeemError(err.message || 'Invalid or expired promo code. Please check and try again.');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleSubscribe = async (plan: 'monthly' | 'annual') => {
    setIsSubscribing(true);
    setSubscribeError(null);

    try {
      await subscribePlan(plan);
    } catch (err: any) {
      setSubscribeError(err.message || 'Failed to activate subscription. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl overflow-y-auto overscroll-contain flex flex-col items-center p-4 sm:p-6 pt-12 pb-20 sm:pt-16 sm:pb-24 selection:bg-emerald-500/30 selection:text-emerald-300">
      <div className="w-full max-w-3xl my-auto py-2">
        {/* Header Branding & Household Info */}
        <div className="text-center space-y-2.5 mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center">
            <HomebaseLogo size={42} showWordmark={true} />
          </div>

          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-semibold shadow-inner mb-2">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>{isExpired ? 'Free Period Concluded' : 'Membership Required'}</span>
            </div>

            <h1 className="text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
              {isExpired ? 'Your Free Access Has Ended' : 'Choose a Plan for Your Household'}
            </h1>
          </div>

          <p className="max-w-xl mx-auto text-xs sm:text-sm text-slate-400 leading-relaxed px-2">
            {isExpired ? (
              <>
                Your trial or voucher period has concluded for{' '}
                <strong className="text-white">{household?.name || 'your family'}</strong>. Keep all your shared grocery lists, meal plans, and Google Calendar sync active with a membership or new code.
              </>
            ) : (
              <>
                Unlock full access for everyone in{' '}
                <strong className="text-white">{household?.name || 'your family'}</strong>. One membership covers all family members across all devices.
              </>
            )}
          </p>
        </div>

        {/* Feedback Messages */}
        {redeemSuccess && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-3 text-emerald-300 text-xs animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="font-semibold">{redeemSuccess}</p>
          </div>
        )}

        {(redeemError || subscribeError) && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-xs animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <p className="font-semibold">{redeemError || subscribeError}</p>
          </div>
        )}

        {/* Plan Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Annual Plan (Highlighted) */}
          <div
            onClick={() => setBillingCycle('annual')}
            className={`rounded-3xl p-6 border transition-all cursor-pointer relative flex flex-col justify-between ${
              billingCycle === 'annual'
                ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xl shadow-emerald-500/15'
                : 'bg-slate-900/50 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="absolute -top-3 right-5 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-[9px] uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow">
              Save 30%
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-white">Annual Membership</h3>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Best Value
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl sm:text-4xl font-black text-white">$7</span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-4">
                Billed annually at $84/yr ($36 annual savings)
              </p>

              <ul className="space-y-2 text-[11px] text-slate-300 border-t border-white/10 pt-3 mb-4">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Entire household included</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Gemini AI Household Assistant</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Two-way Google Calendar sync</span>
                </li>
              </ul>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSubscribe('annual');
              }}
              disabled={isSubscribing}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02]"
            >
              {isSubscribing && billingCycle === 'annual' ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <>
                  <span>Subscribe Annually ($7/mo)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Monthly Plan */}
          <div
            onClick={() => setBillingCycle('monthly')}
            className={`rounded-3xl p-6 border transition-all cursor-pointer flex flex-col justify-between ${
              billingCycle === 'monthly'
                ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xl shadow-emerald-500/15'
                : 'bg-slate-900/50 border-white/10 hover:border-white/20'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-white">Monthly Plan</h3>
                <span className="text-[10px] font-semibold text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                  Flexible
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl sm:text-4xl font-black text-white">$10</span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-4">
                Billed monthly. Cancel anytime with one click.
              </p>

              <ul className="space-y-2 text-[11px] text-slate-300 border-t border-white/10 pt-3 mb-4">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Entire household included</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Real-time grocery lists & meals</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Full mobile PWA experience</span>
                </li>
              </ul>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSubscribe('monthly');
              }}
              disabled={isSubscribing}
              className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/15 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02]"
            >
              {isSubscribing && billingCycle === 'monthly' ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <>
                  <span>Choose Monthly ($10/mo)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Free Access Voucher Code Card */}
        <div className="bg-slate-900/80 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-2 text-emerald-400 mb-1.5">
            <Gift className="w-4 h-4" />
            <h4 className="text-xs sm:text-sm font-bold text-white">
              Have a Free Access Voucher Code?
            </h4>
          </div>
          <p className="text-[11px] text-slate-400 mb-3.5">
            Were you given a 3-month, 6-month, or lifetime pass (e.g. <span className="font-mono text-emerald-400">HB3-XXXX-XXXX</span>)? Enter it below to unlock full access immediately.
          </p>

          <form onSubmit={handleRedeem} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={promoCodeInput}
              onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
              placeholder="Enter voucher code (e.g. HB3-7X9K-2M4P)"
              className="flex-1 bg-slate-950 border border-white/15 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase transition-all"
            />
            <button
              type="submit"
              disabled={isRedeeming || !promoCodeInput.trim()}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              {isRedeeming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
              ) : (
                <span>Redeem Code</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 pt-2 border-t border-white/10">
          <div className="flex items-center gap-2">
            <span>Signed in as <strong>{currentUser?.name}</strong></span>
            {household?.name && (
              <span className="text-slate-500">({household.name})</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {onOpenPricingDetails && (
              <button
                onClick={onOpenPricingDetails}
                className="text-emerald-400 hover:underline cursor-pointer"
              >
                View Full Pricing Details & FAQ
              </button>
            )}
            <button
              onClick={logout}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
