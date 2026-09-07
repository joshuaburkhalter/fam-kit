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
  ChefHat,
  ShoppingCart,
} from 'lucide-react';
import { usePWA } from '../context/PWAContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const {
    household,
    users,
    currentUser,
    setCurrentUser,
    isOnline,
    canInstallPWA,
    installPWA,
    isPushSubscribed,
    subscribeToPush,
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
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <span className="font-black text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                fam-kit
              </span>
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
            Meal Planner
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

          {/* User Profile Switcher */}
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
              <span className="text-xs font-medium text-slate-200 hidden sm:inline max-w-[80px] truncate">
                {currentUser?.name || 'Switch User'}
              </span>
            </button>

            {/* Dropdown */}
            {showUserDropdown && (
              <div
                className="absolute right-0 mt-2 w-56 glass-panel rounded-2xl p-2 shadow-2xl z-50 border border-white/10 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setShowUserDropdown(false)}
              >
                <div className="px-3 py-2 border-b border-white/10 text-xs font-medium text-slate-400">
                  Switch Active Family Member
                </div>
                <div className="py-1 space-y-1">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setCurrentUser(u)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        currentUser?.id === u.id
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: u.avatar_color }}
                        >
                          {u.name.charAt(0)}
                        </div>
                        <span>{u.name}</span>
                      </div>
                      {currentUser?.id === u.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
                <div className="pt-2 border-t border-white/10 flex flex-col gap-1">
                  <button
                    onClick={() => setActiveTab('family')}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/5"
                  >
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    Manage Family Members
                  </button>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/5"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    Settings & Push Alerts
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
