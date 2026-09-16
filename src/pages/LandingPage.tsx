import React, { useState } from 'react';
import {
  Calendar,
  ShoppingCart,
  ChefHat,
  Sparkles,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Share,
  PlusSquare,
  MoreVertical,
  Download,
  Users,
  Clock,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { HomebaseLogo } from '../components/HomebaseLogo';

interface LandingPageProps {
  onOpenAuth: (mode?: 'login' | 'register') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth }) => {
  const [installTab, setInstallTab] = useState<'ios' | 'android'>('ios');

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* 1. Header / Navigation */}
      <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/10 bg-slate-950/80 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <HomebaseLogo size={36} showWordmark={true} />
          </div>

          {/* Nav links (hidden on small mobile) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <button
              onClick={() => scrollToSection('features')}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('google-calendar')}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Google Sync
            </button>
            <button
              onClick={() => scrollToSection('install')}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Install on Phone
            </button>
            <a
              href="/privacy"
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Terms
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onOpenAuth('login')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => onOpenAuth('register')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative px-4 sm:px-8 pt-16 pb-20 max-w-5xl mx-auto text-center space-y-8">
        {/* Glowing badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold shadow-inner">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI-Powered Family Command Center</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.15]">
          One synchronized homebase for your{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            entire household.
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-400 leading-relaxed">
          Homebase combines shared family calendars with Google Calendar sync, real-time categorized grocery lists, weekly meal planning, and an intelligent household AI assistant.
        </p>

        {/* Hero Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onOpenAuth('register')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <span>Create Household</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => scrollToSection('install')}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>How to Install on Phone</span>
          </button>
        </div>

        {/* Quick Highlights Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-8 max-w-4xl mx-auto text-left">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <Calendar className="w-4 h-4" />
              <span>Google Calendar</span>
            </div>
            <p className="text-[11px] text-slate-400">Zero-click background sync per family member</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
            <div className="flex items-center gap-2 text-teal-400 font-bold text-xs">
              <ShoppingCart className="w-4 h-4" />
              <span>Smart Grocery</span>
            </div>
            <p className="text-[11px] text-slate-400">Auto-sorted by grocery store aisles</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
              <ChefHat className="w-4 h-4" />
              <span>Meal Planner</span>
            </div>
            <p className="text-[11px] text-slate-400">Web recipe parser & weekly dinner calendar</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
              <Sparkles className="w-4 h-4" />
              <span>Gemini Assistant</span>
            </div>
            <p className="text-[11px] text-slate-400">Voice-ready AI family coordinator</p>
          </div>
        </div>
      </section>

      {/* 3. Core Features Section */}
      <section id="features" className="px-4 sm:px-8 py-16 bg-slate-900/40 border-y border-white/5">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Designed for busy families
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              No more scattered group texts or missed appointments. Everything your household needs works seamlessly together in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1: Calendar */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Unified Family Timeline</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  View everybody's schedule at a glance. Connect Google Calendars so mom, dad, and kids' events automatically appear with custom avatars and color tags.
                </p>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1.5 pt-2 border-t border-white/5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Connect multiple Google accounts</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Assign specific calendars to specific people</span>
                </li>
              </ul>
            </div>

            {/* Feature 2: Grocery */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Smart Aisle Grocery Lists</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Stop running back and forth across the store. Items are automatically grouped into supermarket aisles (Produce, Dairy, Pantry) and sync instantly between phones.
                </p>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1.5 pt-2 border-t border-white/5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Real-time cross-device checkoff</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Customizable aisle ordering for your local store</span>
                </li>
              </ul>
            </div>

            {/* Feature 3: Meal Planning */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                  <ChefHat className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Meals & Recipe Parser</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Import recipe links from TikTok, Instagram, or any recipe blog with one tap. Plan dinner for the week and add all required ingredients to your grocery list in a click.
                </p>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1.5 pt-2 border-t border-white/5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>Web share target support from mobile</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>Automatic ingredient checklist extraction</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Google Calendar Integration Section */}
      <section id="google-calendar" className="px-4 sm:px-8 py-16 max-w-5xl mx-auto space-y-8">
        <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-blue-950/40 border border-blue-500/20 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
                <Calendar className="w-3.5 h-3.5" />
                <span>Google Calendar Sync</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                How Google Calendar works with Homebase
              </h3>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 shrink-0">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Homebase connects to Google Calendar via OAuth 2.0 to provide a unified household schedule. Each family member can connect their Google account, select which specific calendars to include, and assign them to their family profile.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1.5">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>Automatic Sync</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Events update in the background every 10 minutes and on every calendar view. No manual sync buttons needed.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1.5">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Granular Assignment</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Choose which personal or work calendars to share, and map them to individual family member avatars.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1.5">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-teal-400" />
                <span>Private & Secure</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Calendar data is strictly used to render your family timeline. Data is never shared, sold, or used for advertising.
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-4 text-xs text-slate-400">
            <span>Read our full details:</span>
            <a href="/privacy" className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold">
              <span>Privacy Policy</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-slate-600">•</span>
            <a href="/terms" className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold">
              <span>Terms of Service</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </section>

      {/* 5. Mobile Installation Guide (iOS & Android) */}
      <section id="install" className="px-4 sm:px-8 py-16 bg-slate-900/50 border-t border-white/5">
        <div className="max-w-4xl mx-auto space-y-8 text-center">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Install to Your Phone</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Add Homebase to your Home Screen
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              Homebase is a Progressive Web App (PWA) with offline capabilities. Install it directly from your mobile browser without going through an app store.
            </p>
          </div>

          {/* OS Toggle Buttons */}
          <div className="inline-flex p-1.5 rounded-2xl bg-slate-900 border border-white/10 gap-1.5">
            <button
              onClick={() => setInstallTab('ios')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                installTab === 'ios'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
               iOS (iPhone / iPad)
            </button>
            <button
              onClick={() => setInstallTab('android')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                installTab === 'android'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Android (Chrome)
            </button>
          </div>

          {/* Step Instructions */}
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-white/10 text-left max-w-2xl mx-auto space-y-5">
            {installTab === 'ios' ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Open in Safari</h4>
                    <p className="text-[11px] text-slate-400">
                      Navigate to <span className="font-mono text-emerald-400">homebase.skyy.studio</span> using the Safari browser on your iPhone or iPad.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Tap the Share Button</span>
                      <Share className="w-3.5 h-3.5 text-blue-400" />
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Tap the Share icon (the square with an arrow pointing upward) located on the bottom navigation bar of Safari.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Select "Add to Home Screen"</span>
                      <PlusSquare className="w-3.5 h-3.5 text-emerald-400" />
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Scroll down through the share sheet options and tap <strong>Add to Home Screen</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Tap "Add"</h4>
                    <p className="text-[11px] text-slate-400">
                      Tap <strong>Add</strong> in the top right corner. Homebase will now appear as a native full-screen app icon on your home screen.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Open in Google Chrome</h4>
                    <p className="text-[11px] text-slate-400">
                      Navigate to <span className="font-mono text-emerald-400">homebase.skyy.studio</span> using Chrome on your Android device.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Tap the Menu or Banner</span>
                      <MoreVertical className="w-3.5 h-3.5 text-slate-300" />
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Look for the prompt <strong>"Add Homebase to Home screen"</strong> at the bottom of the screen, or tap the three dots (⋮) in the top right.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Tap "Install app"</span>
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Select <strong>Install app</strong> or <strong>Add to Home screen</strong> and confirm by clicking <strong>Install</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Launch from Home Screen</h4>
                    <p className="text-[11px] text-slate-400">
                      Homebase is now installed in your app drawer and home screen as a standalone application.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 6. Call to Action */}
      <section className="px-4 sm:px-8 py-16 text-center space-y-6 max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Ready to simplify your family routine?
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Create a household in under 60 seconds and invite family members with a private 6-character code.
        </p>
        <button
          onClick={() => onOpenAuth('register')}
          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 inline-flex items-center gap-2 transition-all hover:scale-[1.02] cursor-pointer"
        >
          <span>Get Started with Homebase</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* 7. Footer with Privacy Policy and Terms */}
      <footer className="mt-auto px-4 sm:px-8 py-10 border-t border-white/10 bg-slate-950 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <HomebaseLogo size={28} showWordmark={true} />
            <span className="text-[11px] text-slate-500">© 2026 Homebase. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium">
            <a href="/privacy" className="hover:text-emerald-400 transition-colors">
              Privacy Policy
            </a>
            <a href="/terms" className="hover:text-emerald-400 transition-colors">
              Terms of Service
            </a>
            <button
              onClick={() => onOpenAuth('login')}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <a href="mailto:joshua@redpointaudio.com" className="hover:text-emerald-400 transition-colors">
              Contact Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
