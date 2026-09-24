import React, { useState } from 'react';
import {
  Check,
  Sparkles,
  ShieldCheck,
  Gift,
  ArrowRight,
  ArrowLeft,
  Calendar,
  ShoppingCart,
  ChefHat,
  Bot,
  Bell,
  Smartphone,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { HomebaseLogo } from '../components/HomebaseLogo';
import { usePWA } from '../context/PWAContext';

interface PricingPageProps {
  onBack?: () => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onBack, onOpenAuth }) => {
  const { currentUser, household, hasActiveAccess, redeemPromoCode, subscribePlan } = usePWA();
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscribeSuccess, setSubscribeSuccess] = useState<string | null>(null);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [isCanceledNotice, setIsCanceledNotice] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('canceled') === 'true';
    }
    return false;
  });

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCodeInput.trim()) return;

    if (!currentUser) {
      if (onOpenAuth) {
        onOpenAuth('register');
      }
      return;
    }

    setIsRedeeming(true);
    setRedeemError(null);
    setRedeemSuccess(null);

    try {
      const res = await redeemPromoCode(promoCodeInput.trim().toUpperCase());
      setRedeemSuccess(res.message || 'Free access code activated successfully!');
      setPromoCodeInput('');
    } catch (err: any) {
      setRedeemError(err.message || 'Failed to redeem promo code. Please verify and try again.');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleSubscribe = async (plan: 'monthly' | 'annual') => {
    if (!currentUser) {
      if (onOpenAuth) {
        onOpenAuth('register');
      }
      return;
    }

    setIsSubscribing(true);
    setSubscribeError(null);
    setSubscribeSuccess(null);

    try {
      const res = await subscribePlan(plan);
      setSubscribeSuccess(res.message || 'Subscription activated successfully!');
    } catch (err: any) {
      setSubscribeError(err.message || 'Failed to process subscription. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const faqs = [
    {
      q: 'Does one subscription cover my entire family?',
      a: 'Yes, absolutely! A single subscription covers your entire household. Every family member who joins using your household invite code gets full access across all their devices at no extra charge.',
    },
    {
      q: 'How do free access codes work (3-month / 6-month / lifetime)?',
      a: 'If a friend, family member, or creator shared a voucher code with you, simply enter it in the code redemption box. Your whole household gets instant, full access without having to enter credit card details.',
    },
    {
      q: 'What happens when a 3-month or 6-month free access code expires?',
      a: 'When your complimentary period ends, you can choose the $10/month or $7/month annual plan, or enter another valid code. None of your grocery lists, meal plans, or calendar events are ever deleted.',
    },
    {
      q: 'Can I cancel or switch my plan anytime?',
      a: 'Yes, you can easily manage, switch, or cancel your subscription at any time directly in your Settings tab. There are no cancellation fees or hidden commitments.',
    },
    {
      q: 'Is Google Calendar sync included?',
      a: 'Yes, two-way synchronized Google Calendar integration is included in all plans. You can connect your Google account and map individual Google calendars to family members.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* 1. Header */}
      <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/10 bg-slate-950/80 backdrop-blur-md px-4 sm:px-8 pt-[calc(0.875rem+env(safe-area-inset-top,0px))] pb-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Go Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <HomebaseLogo size={34} showWordmark={true} />
          </div>

          <div className="flex items-center gap-2.5">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Logged in as <strong className="text-white">{currentUser.name}</strong>
                </span>
                {onBack && (
                  <button
                    onClick={onBack}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-200 bg-white/10 hover:bg-white/15 transition-all cursor-pointer"
                  >
                    Return to App
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenAuth?.('login')}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onOpenAuth?.('register')}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  Get Started
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="px-4 sm:px-8 pt-12 pb-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold shadow-inner">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Simple, Transparent Family Pricing</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
          One plan for your{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            entire household.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-400">
          No per-user fees. Keep your family synchronized with shared grocery lists, meal planning, 2-way Google Calendar sync, and our Family Assistant.
        </p>

        {/* Billing Cycle Toggle */}
        <div className="pt-4 flex items-center justify-center">
          <div className="inline-flex items-center bg-slate-900 p-1.5 rounded-2xl border border-white/10 shadow-lg">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Monthly ($10/mo)
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                billingCycle === 'annual'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Annual ($7/mo)</span>
              <span className="bg-emerald-400/25 text-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-400/40">
                Save 30%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. Feedback Banners */}
      {(subscribeSuccess || redeemSuccess) && (
        <div className="max-w-md mx-auto px-4 w-full mb-6">
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-start gap-3 text-emerald-300 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-white mb-0.5">Success!</p>
              <p>{subscribeSuccess || redeemSuccess}</p>
            </div>
          </div>
        </div>
      )}

      {(subscribeError || redeemError) && (
        <div className="max-w-md mx-auto px-4 w-full mb-6">
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-3 text-rose-300 animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-white mb-0.5">Error</p>
              <p>{subscribeError || redeemError}</p>
            </div>
          </div>
        </div>
      )}

      {isCanceledNotice && !subscribeSuccess && !subscribeError && (
        <div className="max-w-md mx-auto px-4 w-full mb-6">
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-white/10 flex items-center justify-between gap-3 text-slate-300 animate-in fade-in">
            <span className="text-xs">
              Checkout was canceled. Whenever you're ready, select a plan below.
            </span>
            <button
              onClick={() => setIsCanceledNotice(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 4. Pricing Cards Grid */}
      <section className="px-4 sm:px-8 pb-12 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Monthly Plan Card */}
          <div
            className={`rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all border ${
              billingCycle === 'monthly'
                ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-emerald-500/50 shadow-2xl shadow-emerald-500/10 ring-2 ring-emerald-500/20'
                : 'bg-slate-900/40 border-white/10 opacity-80 hover:opacity-100'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-lg font-bold text-white">Monthly Plan</h3>
                <span className="text-[11px] font-semibold text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                  Pay as you go
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Flexible month-to-month access for your whole family. Cancel anytime.
              </p>

              <div className="flex items-baseline gap-1.5 mb-6">
                <span className="text-4xl sm:text-5xl font-black text-white">$10</span>
                <span className="text-xs text-slate-400 font-medium">/ month</span>
              </div>

              <ul className="space-y-3 text-xs text-slate-300 mb-8 border-t border-white/10 pt-6">
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Unlimited family members & devices</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Real-time grocery lists with smart aisle grouping</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Household AI Assistant with voice control</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Weekly meal planner & recipe box scraper</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Two-way Google Calendar synchronization</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Web Push Notifications & Offline PWA mode</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleSubscribe('monthly')}
              disabled={isSubscribing}
              className="w-full py-3.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all border border-white/10 flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:scale-[1.01]"
            >
              {isSubscribing ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <>
                  <span>Choose Monthly ($10/mo)</span>
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                </>
              )}
            </button>
          </div>

          {/* Annual Plan Card (Recommended) */}
          <div
            className={`rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all border relative ${
              billingCycle === 'annual'
                ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-emerald-500 shadow-2xl shadow-emerald-500/20 ring-2 ring-emerald-500/30'
                : 'bg-slate-900/40 border-white/10 opacity-80 hover:opacity-100'
            }`}
          >
            {/* Best Value Badge */}
            <div className="absolute -top-3.5 right-6 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-[10px] uppercase tracking-wider px-3 py-1 rounded-full shadow-lg shadow-emerald-500/30">
              Best Value • Save 30%
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-lg font-bold text-white">Annual Membership</h3>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/30">
                  Save $36 / year
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Our most popular plan for families. Billed annually at $84/year.
              </p>

              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                  $7
                </span>
                <span className="text-xs text-slate-400 font-medium">/ month</span>
              </div>
              <p className="text-[11px] text-emerald-400 font-medium mb-6">
                $84 billed once per year (equivalent to $7/mo)
              </p>

              <ul className="space-y-3 text-xs text-slate-300 mb-8 border-t border-white/10 pt-6">
                <li className="flex items-center gap-2.5 font-medium text-white">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Everything in Monthly Plan</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Save 30% annually ($36 in savings)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Priority access to new AI household features</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Unlimited Google Calendar synchronizations</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Year-round peace of mind for the whole home</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleSubscribe('annual')}
              disabled={isSubscribing}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02]"
            >
              {isSubscribing ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <>
                  <span>Subscribe Annually ($7/mo)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* 5. Free Access Promo Code Section */}
      <section className="px-4 sm:px-8 pb-16 max-w-3xl mx-auto w-full">
        <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/30 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-2 text-emerald-400">
              <Gift className="w-5 h-5" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                Have a Free Access Voucher Code?
              </h2>
            </div>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              If someone gave you a 3-month, 6-month, or lifetime pass (e.g. <span className="font-mono text-emerald-400">HB3-XXXX-XXXX</span> or <span className="font-mono text-emerald-400">HB6-XXXX-XXXX</span>), redeem it below to give your entire household free access with <strong>no credit card required</strong>.
            </p>

            <form onSubmit={handleRedeem} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. HB3-7X9K-2M4P"
                  className="w-full bg-slate-950/80 border border-white/15 focus:border-emerald-500 rounded-2xl px-4 py-3.5 text-xs font-mono tracking-wider text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all uppercase"
                />
              </div>
              <button
                type="submit"
                disabled={isRedeeming || !promoCodeInput.trim()}
                className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:cursor-not-allowed"
              >
                {isRedeeming ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <span>Redeem Free Pass</span>
                )}
              </button>
            </form>

            {!currentUser && (
              <p className="text-[11px] text-slate-400 mt-2">
                * You'll be prompted to create or join a household first so your free access is applied to your family.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 6. Frequently Asked Questions (FAQ) */}
      <section className="px-4 sm:px-8 pb-20 max-w-3xl mx-auto w-full">
        <div className="text-center space-y-2 mb-8">
          <h2 className="text-2xl font-black text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs text-slate-400">
            Everything you need to know about Homebase membership and free codes.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span className="text-xs sm:text-sm font-bold text-slate-200">
                    {faq.q}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 text-xs text-slate-400 leading-relaxed border-t border-white/5 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="mt-auto px-4 sm:px-8 py-8 border-t border-white/10 bg-slate-950 text-slate-500 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <HomebaseLogo size={24} showWordmark={true} />
            <span className="text-[11px] text-slate-500">© 2026 Homebase. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-5 text-xs text-slate-400">
            <a href="/privacy" className="hover:text-emerald-400 transition-colors">
              Privacy Policy
            </a>
            <a href="/terms" className="hover:text-emerald-400 transition-colors">
              Terms of Service
            </a>
            <a href="mailto:support@famkit.app" className="hover:text-emerald-400 transition-colors">
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
