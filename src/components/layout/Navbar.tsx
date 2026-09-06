'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePWA } from '@/components/pwa/PWAProvider';
import {
  Sparkles,
  ShoppingCart,
  UtensilsCrossed,
  BookOpen,
  Calendar,
  Users,
  Settings,
  Download,
  Bell,
  Check,
  ChevronDown
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { isInstallable, installApp, activeMember, setActiveMember, household } = usePWA();
  const [memberMenuOpen, setMemberMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Assistant', icon: Sparkles },
    { href: '/grocery', label: 'Grocery', icon: ShoppingCart },
    { href: '/meal-planner', label: 'Meal Plan', icon: UtensilsCrossed },
    { href: '/recipes', label: 'Recipes', icon: BookOpen },
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/family', label: 'Family', icon: Users },
  ];

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-white via-emerald-100 to-teal-300 bg-clip-text text-transparent">
                fam-kit
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                Gemini 2.0 AI
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions: Member Switcher, Install PWA, Settings */}
        <div className="flex items-center gap-3">
          {/* PWA Install Button (shows if installable) */}
          {isInstallable && (
            <button
              onClick={installApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all hover:scale-105 animate-pulse"
              title="Install fam-kit App"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          {/* Active Family Member Switcher */}
          {household && household.members && household.members.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setMemberMenuOpen(!memberMenuOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-slate-900 border border-slate-700/80 hover:border-slate-600 transition-colors"
              >
                <span className="text-base leading-none">{activeMember?.avatar || '👤'}</span>
                <span className="text-xs font-medium text-slate-200 hidden sm:inline">
                  {activeMember?.name || 'Switch Profile'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {memberMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95"
                  onClick={() => setMemberMenuOpen(false)}
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Family Member
                  </div>
                  {household.members.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => setActiveMember(member)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeMember?.id === member.id
                          ? 'bg-emerald-500/15 text-emerald-400 font-medium'
                          : 'text-slate-300 hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{member.avatar}</span>
                        <span>{member.name}</span>
                      </div>
                      {activeMember?.id === member.id && <Check className="w-4 h-4 text-emerald-400" />}
                    </button>
                  ))}
                  <div className="border-t border-slate-800 my-1"></div>
                  <Link
                    href="/family"
                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 rounded-lg"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Manage Family & Codes
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Settings link */}
          <Link
            href="/settings"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
            title="Settings & Gemini API Key"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
