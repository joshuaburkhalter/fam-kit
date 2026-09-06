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
  ChevronDown,
  Check
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { isInstallable, installApp, activeMember, setActiveMember, household } = usePWA();
  const [memberMenuOpen, setMemberMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Assistant', icon: Sparkles, color: 'text-emerald-400' },
    { href: '/grocery', label: 'Grocery List', icon: ShoppingCart, color: 'text-teal-400' },
    { href: '/meal-planner', label: 'Meal Plan', icon: UtensilsCrossed, color: 'text-amber-400' },
    { href: '/recipes', label: 'Recipes', icon: BookOpen, color: 'text-rose-400' },
    { href: '/calendar', label: 'Calendar', icon: Calendar, color: 'text-indigo-400' },
    { href: '/family', label: 'Family', icon: Users, color: 'text-purple-400' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full glass-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Desktop Links */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 group-hover:scale-105 group-hover:shadow-emerald-500/40 transition-all duration-300">
              <Sparkles className="w-5 h-5 fill-white/20" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                  fam<span className="text-emerald-400 font-light">kit</span>
                </span>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Gemini 3.6
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-2xl border border-white/5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-3">
          {/* PWA Install Button */}
          {isInstallable && (
            <button
              onClick={installApp}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all hover:scale-105"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          {/* Family Member Switcher Pill */}
          {household && household.members && household.members.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setMemberMenuOpen(!memberMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700/80 hover:border-slate-600 shadow-sm transition-all hover:bg-slate-800/80"
              >
                <span className="text-base leading-none">{activeMember?.avatar || '👤'}</span>
                <span className="text-xs font-bold text-slate-200 hidden sm:inline">
                  {activeMember?.name || 'Profile'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {memberMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95"
                  onClick={() => setMemberMenuOpen(false)}
                >
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Select Member
                  </div>
                  {household.members.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => setActiveMember(member)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        activeMember?.id === member.id
                          ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{member.avatar}</span>
                        <span>{member.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({member.role})</span>
                      </div>
                      {activeMember?.id === member.id && <Check className="w-4 h-4 text-emerald-400" />}
                    </button>
                  ))}
                  <div className="border-t border-slate-800 my-1.5"></div>
                  <Link
                    href="/family"
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
                  >
                    <Users className="w-4 h-4" />
                    Manage Family Group
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Settings */}
          <Link
            href="/settings"
            className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 hover:bg-slate-800 transition-all"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
