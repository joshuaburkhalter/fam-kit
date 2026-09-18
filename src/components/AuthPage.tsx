import React, { useState } from 'react';
import {
  Sparkles,
  Users,
  KeyRound,
  Lock,
  Mail,
  User,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Home,
  ArrowLeft,
  Gift,
} from 'lucide-react';
import { usePWA } from '../context/PWAContext';
import { HomebaseLogo } from './HomebaseLogo';

const AVATAR_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ef4444', // Red
];

interface AuthPageProps {
  initialTab?: 'login' | 'register';
  onBackToLanding?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialTab = 'login',
  onBackToLanding,
}) => {
  const { login, register } = usePWA();
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);

  // Sign in state
  const [savedProfiles] = useState<Array<{
    id: string;
    name: string;
    username?: string;
    avatar?: string;
    avatar_color: string;
    role: string;
    householdName?: string;
  }>>(() => {
    try {
      const stored = localStorage.getItem('famkit_device_profiles');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [loginIdentifier, setLoginIdentifier] = useState(() => {
    return localStorage.getItem('famkit_last_username') || '';
  });

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(() => {
    const lastUser = localStorage.getItem('famkit_last_username');
    if (!lastUser) return null;
    try {
      const stored = localStorage.getItem('famkit_device_profiles');
      const list = stored ? JSON.parse(stored) : [];
      const match = list.find((p: any) => p.username === lastUser || p.name === lastUser || p.id === lastUser);
      return match ? match.id : (list[0]?.id || null);
    } catch {
      return null;
    }
  });

  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register state
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerDisplayName, setRegisterDisplayName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [registerRole, setRegisterRole] = useState('Parent');
  const [registerColor, setRegisterColor] = useState(AVATAR_COLORS[0]);
  const [householdAction, setHouseholdAction] = useState<'create_household' | 'join_household'>('create_household');
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [promoCode, setPromoCode] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword) return;

    setIsLoading(true);
    setErrorMessage(null);
    try {
      await login(loginIdentifier.trim(), loginPassword);
    } catch (err: any) {
      setErrorMessage(err.message || 'Incorrect username or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = registerUsername.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanUser) {
      setErrorMessage('Please choose a valid username.');
      return;
    }

    if (householdAction === 'create_household' && !newHouseholdName.trim()) {
      setErrorMessage('Please enter a name for your new household.');
      return;
    }

    if (householdAction === 'join_household' && !joinInviteCode.trim()) {
      setErrorMessage('Please enter a 6-character family invite code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      await register({
        username: cleanUser,
        name: registerDisplayName.trim() || cleanUser,
        email: registerEmail.trim() || undefined,
        password: registerPassword || 'password123',
        avatarColor: registerColor,
        role: registerRole,
        action: householdAction,
        householdName: newHouseholdName.trim() || undefined,
        inviteCode: joinInviteCode.trim().toUpperCase() || undefined,
        promoCode: promoCode.trim() ? promoCode.trim().toUpperCase() : undefined,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Background ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {onBackToLanding && (
          <div>
            <button
              type="button"
              onClick={onBackToLanding}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Overview</span>
            </button>
          </div>
        )}

        {/* App Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center mb-1">
            <HomebaseLogo size={68} />
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Homebase
            </h1>
          </div>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            The shared family organizer: smart groceries, weekly meal planning, and family calendars.
          </p>
        </div>

        {/* Auth Glass Card */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6">
          {/* Tab Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-900/80 rounded-2xl border border-white/5">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setErrorMessage(null);
              }}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                tab === 'login'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setErrorMessage(null);
              }}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                tab === 'register'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-800/80 flex items-start gap-2.5 text-rose-300 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SIGN IN FORM */}
          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Profile Choices on This Device */}
              {savedProfiles.length > 0 && (
                <div className="space-y-2 pb-1 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Choose Profile on This Device</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {savedProfiles.length} saved
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {savedProfiles.map((p) => {
                      const isSelected = selectedProfileId === p.id || loginIdentifier.toLowerCase() === (p.username || '').toLowerCase() || loginIdentifier.toLowerCase() === p.name.toLowerCase();
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedProfileId(p.id);
                            setLoginIdentifier(p.username || p.name);
                            setErrorMessage(null);
                          }}
                          className={`p-2.5 rounded-2xl border flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/15 border-emerald-500/50 ring-1 ring-emerald-500/30 shadow-md shadow-emerald-500/10'
                              : 'bg-slate-900/60 border-white/5 hover:border-white/20 hover:bg-slate-900/90'
                          }`}
                        >
                          {p.avatar && (p.avatar.startsWith('data:image') || p.avatar.startsWith('http')) ? (
                            <img
                              src={p.avatar}
                              alt={p.name}
                              className="w-8 h-8 rounded-xl object-cover shrink-0 ring-1 ring-white/10"
                            />
                          ) : (
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 shadow"
                              style={{ backgroundColor: p.avatar_color || '#10b981' }}
                            >
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{p.name}</div>
                            {p.username ? (
                              <div className="text-[10px] font-mono text-emerald-400 truncate">
                                @{p.username}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 truncate capitalize">
                                {p.role || 'Member'}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. alex or alex@family.com"
                    className="w-full bg-slate-900/90 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900/90 border border-white/10 rounded-2xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <>
                    <span>Sign In to Family</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

            </form>
          ) : (
            /* CREATE ACCOUNT FORM */
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Username
                  </label>
                  <span className="text-[10px] text-slate-500">Used to sign in (no spaces)</span>
                </div>
                <div className="relative">
                  <span className="text-sm font-bold text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 select-none">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="e.g. alex_miller"
                    className="w-full bg-slate-900/90 border border-white/10 rounded-2xl pl-8 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Display Name
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={registerDisplayName}
                      onChange={(e) => setRegisterDisplayName(e.target.value)}
                      placeholder="e.g. Maya or Dad"
                      className="w-full bg-slate-900/90 border border-white/10 rounded-2xl pl-8 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Email <span className="text-[10px] text-slate-500">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      placeholder="maya@miller.com"
                      className="w-full bg-slate-900/90 border border-white/10 rounded-2xl pl-8 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Role in Family
                </label>
                <select
                  value={registerRole}
                  onChange={(e) => setRegisterRole(e.target.value)}
                  className="w-full bg-slate-900/90 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="Parent">Parent</option>
                  <option value="Child">Child</option>
                  <option value="Member">Member</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    required
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="Create a password"
                    className="w-full bg-slate-900/90 border border-white/10 rounded-2xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Avatar Color Picker */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Profile Accent Color
                </label>
                <div className="flex items-center gap-2">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setRegisterColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-full transition-all ${
                        registerColor === c
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Household Choice */}
              <div className="pt-2 border-t border-white/10 space-y-3">
                <label className="text-xs font-bold text-slate-200 block">
                  Family Household Setup
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHouseholdAction('create_household')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      householdAction === 'create_household'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Home className="w-4 h-4 text-emerald-400 mb-1" />
                    <div className="text-xs font-bold">New Family</div>
                    <div className="text-[10px] opacity-80">Start fresh household</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHouseholdAction('join_household')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      householdAction === 'join_household'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <KeyRound className="w-4 h-4 text-emerald-400 mb-1" />
                    <div className="text-xs font-bold">Join Family</div>
                    <div className="text-[10px] opacity-80">Use 6-digit invite code</div>
                  </button>
                </div>

                {householdAction === 'create_household' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Household Name
                      </label>
                      <input
                        type="text"
                        required
                        value={newHouseholdName}
                        onChange={(e) => setNewHouseholdName(e.target.value)}
                        placeholder="e.g. The Garcia Family"
                        className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>

                    {/* Beta Invite Code */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Beta Invite Code <span className="text-[10px] text-slate-500 font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <Gift className="w-3.5 h-3.5 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          placeholder="e.g. BETA2026 or HB-XXXX-XXXX"
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-8 pr-3.5 py-2 text-xs font-mono uppercase text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Homebase is in closed beta. Enter your invite code now or redeem it after signing in.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      6-Character Family Invite Code
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={8}
                      value={joinInviteCode}
                      onChange={(e) => setJoinInviteCode(e.target.value.toUpperCase())}
                      placeholder="e.g. H5XWAE"
                      className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono tracking-widest uppercase text-emerald-400 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <>
                    <span>Create Account & Join</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer legal links */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 pt-1">
          <a href="/privacy" className="hover:text-emerald-400 transition-colors">
            Privacy Policy
          </a>
          <span>•</span>
          <a href="/terms" className="hover:text-emerald-400 transition-colors">
            Terms of Service
          </a>
        </div>
      </div>
    </div>
  );
};
