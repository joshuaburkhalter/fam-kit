import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Users,
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
  User,
  Bug,
  ShieldCheck,
} from 'lucide-react';
import { usePWA } from '../context/PWAContext';
import { HomebaseLogo } from './HomebaseLogo';
import { EditProfileModal } from './EditProfileModal';
import { BugFeatureAdminModal } from './BugFeatureAdminModal';
import { isUserAdmin } from '../types';
import { api } from '../lib/api';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenPricing?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const {
    household,
    users,
    currentUser,
    switchUser,
    logout,
    isOnline,
    canInstallPWA,
    installPWA,
  } = usePWA();

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showBugFeatureModal, setShowBugFeatureModal] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.has('feedback') || p.has('openFeedback') || p.get('modal') === 'feedback';
    }
    return false;
  });
  const [openFeedbackCount, setOpenFeedbackCount] = useState(0);

  const isAdmin = isUserAdmin(currentUser);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkFeedbackParam = () => {
      const p = new URLSearchParams(window.location.search);
      if (p.has('feedback') || p.has('openFeedback') || p.get('modal') === 'feedback') {
        setShowBugFeatureModal(true);
      }
    };
    window.addEventListener('popstate', checkFeedbackParam);
    return () => window.removeEventListener('popstate', checkFeedbackParam);
  }, []);

  useEffect(() => {
    if (currentUser) {
      api.getFeedbackRequests()
        .then((items) => {
          const openCount = items.filter((r) => r.status === 'open' || r.status === 'in_progress').length;
          setOpenFeedbackCount(openCount);
        })
        .catch(() => {});
    }
  }, [currentUser]);

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
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">
                    {household.name}
                  </span>
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
              className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 rounded-xl px-2.5 py-1.5 transition-colors cursor-pointer"
            >
              {currentUser?.avatar && (currentUser.avatar.startsWith('data:image') || currentUser.avatar.startsWith('http')) ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-6 h-6 rounded-full object-cover shadow ring-1 ring-white/20"
                />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow"
                  style={{ backgroundColor: currentUser?.avatar_color || '#10b981' }}
                >
                  {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
                </div>
              )}
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
                  {currentUser?.avatar && (currentUser.avatar.startsWith('data:image') || currentUser.avatar.startsWith('http')) ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-9 h-9 rounded-xl object-cover shadow-md shrink-0 ring-1 ring-white/20"
                    />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-md flex-shrink-0"
                      style={{ backgroundColor: currentUser?.avatar_color || '#10b981' }}
                    >
                      {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {currentUser?.name}
                    </p>
                    {currentUser?.username && (
                      <p className="text-[11px] font-mono text-emerald-400 truncate">
                        @{currentUser.username}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 truncate">
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
                    onClick={() => {
                      setShowUserDropdown(false);
                      setShowEditProfileModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <User className="w-4 h-4 text-emerald-400" />
                    Edit Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      setActiveTab('settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-cyan-400" />
                    Settings
                  </button>

                  {/* Feature Requests */}
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      setShowBugFeatureModal(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                      <span>Feature Requests</span>
                    </div>
                    {openFeedbackCount > 0 ? (
                      <span className="bg-emerald-500 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded-full shadow-sm">
                        {openFeedbackCount}
                      </span>
                    ) : (
                      isAdmin && (
                        <span className="text-[10px] text-slate-400 group-hover:text-slate-300 font-mono">
                          Admin
                        </span>
                      )
                    )}
                  </button>

                  {/* Admin Command Center */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        setActiveTab('admin');
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-slate-300 group-hover:text-white group-hover:scale-110 transition-transform" />
                        <span>Admin Dashboard</span>
                      </div>
                      <span className="text-[10px] text-slate-400 group-hover:text-slate-300 font-mono">
                        Admin
                      </span>
                    </button>
                  )}
                </div>

                {/* Quick Profile Switcher for other family members */}
                {users.length > 1 && (
                  <div className="py-1.5 border-b border-white/10">
                    <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-emerald-400" />
                      <span>Switch Active Profile</span>
                    </div>
                    <div className="flex flex-col gap-0.5 mt-0.5 px-1">
                      {users
                        .filter((u) => u.id !== currentUser?.id)
                        .map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              switchUser(m);
                              setShowUserDropdown(false);
                            }}
                            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/10 text-xs transition-colors cursor-pointer text-left group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {m.avatar && (m.avatar.startsWith('data:image') || m.avatar.startsWith('http')) ? (
                                <img src={m.avatar} alt={m.name} className="w-6 h-6 rounded-lg object-cover shrink-0" />
                              ) : (
                                <div
                                  className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                  style={{ backgroundColor: m.avatar_color || '#10b981' }}
                                >
                                  {m.name.charAt(0)}
                                </div>
                              )}
                              <div className="truncate min-w-0">
                                <span className="font-medium text-slate-200 group-hover:text-white truncate block">
                                  {m.name}
                                </span>
                                {m.username && (
                                  <span className="text-[10px] font-mono text-emerald-400/80 block -mt-0.5 truncate">
                                    @{m.username}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-400 group-hover:text-emerald-400 transition-colors shrink-0">
                              Switch
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Logout Action */}
                <div className="pt-1.5">
                  <button
                    onClick={() => logout()}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
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

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
      />

      {/* Bug & Feature Request Modal */}
      <BugFeatureAdminModal
        isOpen={showBugFeatureModal}
        onClose={() => {
          setShowBugFeatureModal(false);
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            if (url.searchParams.has('feedback') || url.searchParams.has('openFeedback') || url.searchParams.get('modal') === 'feedback') {
              url.searchParams.delete('feedback');
              url.searchParams.delete('openFeedback');
              if (url.searchParams.get('modal') === 'feedback') url.searchParams.delete('modal');
              window.history.replaceState(window.history.state || {}, '', url.pathname + (url.search ? url.search : ''));
            }
          }
        }}
        onCountChange={setOpenFeedbackCount}
      />
    </header>
  );
};
