import React, { useState } from 'react';
import {
  Sparkles,
  Users,
  Copy,
  Check,
  Wifi,
  WifiOff,
  Download,
  Settings,
  Bell,
  ShoppingCart,
  ChefHat,
  Calendar,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { usePWA } from '../context/PWAContext';
import { HomebaseLogo } from './HomebaseLogo';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const {
    household,
    currentUser,
    logout,
    isOnline,
    canInstallPWA,
    installPWA,
  } = usePWA();

  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const handleCopyInvite = () => {
    if (household?.invite_code) {
      navigator.clipboard.writeText(household.invite_code);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Left: Brand Logo & Household */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => setActiveTab('assistant')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <HomebaseLogo size={36} />
            <div>
              <div className="flex items-center gap-1">
                <span className="font-black text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                  Homebase
                </span>
              </div>
              {household && (
                <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 -mt-0.5">
                  <span className="truncate max-w-[110px] sm:max-w-[160px]">
                    {household.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyInvite();
                    }}
                    title="Copy Household Invite Code"
                    className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-mono border border-emerald-500/30 transition-colors"
                  >
                    {copiedInvite ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-2.5 h-2.5" />
                    )}
                    {household.invite_code}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Desktop Navigation tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('assistant')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'assistant'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Assistant
          </button>
          <button
            onClick={() => setActiveTab('grocery')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'grocery'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Lists
          </button>
          <button
            onClick={() => setActiveTab('meals')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'meals'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" />
            Meals
          </button>
          <button
            onClick={() => setActiveTab('recipes')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'recipes'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Recipe Box
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'calendar'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Calendar
          </button>
        </nav>

        {/* Right: User Switcher, PWA Install, Status */}
        <div className="flex items-center gap-2">
          {/* Offline / Online indicator */}
          <div
            className="flex items-center"
            title={isOnline ? 'Online (Connected)' : 'Offline (Cached Mode)'}
          >
            {isOnline ? (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : (
              <WifiOff className="w-4 h-4 text-amber-500" />
            )}
          </div>

          {/* PWA Install Button */}
          {canInstallPWA && (
            <button
              onClick={installPWA}
              className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          {/* User Account / Profile & Logout */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 rounded-xl px-2.5 py-1.5 transition-colors"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow"
                style={{ backgroundColor: currentUser?.avatar_color || '#10b981' }}
              >
                {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
              </div>
              <span className="text-xs font-medium text-slate-200 hidden sm:inline max-w-[90px] truncate">
                {currentUser?.name || 'Account'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Dropdown */}
            {showUserDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserDropdown(false)}
                />
                <div
                  className="absolute right-0 mt-2 w-64 bg-[#0d1322] rounded-2xl p-2 shadow-2xl shadow-black/90 z-50 border border-white/15 animate-in fade-in zoom-in-95 duration-100"
                  onClick={() => setShowUserDropdown(false)}
                >
                {/* User Info Header */}
                <div className="px-3 py-2.5 border-b border-white/10 flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-md flex-shrink-0"
                    style={{ backgroundColor: currentUser?.avatar_color || '#10b981' }}
                  >
                    {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {currentUser?.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {currentUser?.email || (household?.name ? `${household.name}` : 'Family Member')}
                    </p>
                    <span className="inline-block mt-0.5 text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      {currentUser?.role || 'Member'}
                    </span>
                  </div>
                </div>

                {/* Quick Nav Links */}
                <div className="py-1.5 border-b border-white/10 flex flex-col gap-0.5">
                  <button
                    onClick={() => setActiveTab('family')}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Users className="w-4 h-4 text-emerald-400" />
                    Family & Household
                  </button>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-cyan-400" />
                    Settings & Audio
                  </button>
                </div>

                {/* Logout Action */}
                <div className="pt-1.5">
                  <button
                    onClick={() => logout()}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </header>
  );
};
