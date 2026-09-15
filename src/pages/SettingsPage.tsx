import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Bell,
  Download,
  Check,
  Smartphone,
  Send,
  Loader2,
  Volume2,
  VolumeX,
  MoveVertical,
  Users,
  KeyRound,
  Copy,
  Plus,
  Trash2,
  LogIn,
  UserCheck,
  Edit3,
} from 'lucide-react';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { AisleManagerModal } from '../components/AisleManagerModal';
import { EditProfileModal } from '../components/EditProfileModal';
import type { User } from '../types';

const AVATAR_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ef4444', // Red
];

export const SettingsPage: React.FC = () => {
  const {
    household,
    users,
    currentUser,
    switchUser,
    canInstallPWA,
    isPWAInstalled,
    installPWA,
    isPushSupported,
    isPushSubscribed,
    subscribeToPush,
    autoAudioResponses,
    setAutoAudioResponses,
    aisles,
    refreshAisles,
    refreshHouseholdsAndUsers,
  } = usePWA();

  // Modals & Panels
  const [isAisleModalOpen, setIsAisleModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<User | null>(null);

  // Status & Actions
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDeletingMember, setIsDeletingMember] = useState(false);

  // Form states for Add Member
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'parent' | 'child' | 'member'>('member');
  const [newMemberColor, setNewMemberColor] = useState(AVATAR_COLORS[0]);
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Form states for Join Household
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const inviteCode = household?.invite_code || (household as any)?.inviteCode || '';

  const handleCopyInvite = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  };

  const handlePushToggle = async (enable: boolean) => {
    if (!enable) return;
    setIsSubscribingPush(true);
    try {
      const success = await subscribeToPush();
      if (success) {
        setStatusMessage('Push notifications enabled for this device!');
        setTimeout(() => setStatusMessage(null), 3500);
      }
    } catch (err: any) {
      console.error('Push error:', err);
    } finally {
      setIsSubscribingPush(false);
    }
  };

  const handleSendTestPush = async () => {
    if (!household) return;
    setIsSendingTestPush(true);
    try {
      await api.sendTestPush(
        household.id,
        'Homebase Alert 🛒',
        'Push notifications are working smoothly on your device!'
      );
      setStatusMessage('Test notification sent!');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error('Test push error:', err);
    } finally {
      setIsSendingTestPush(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !newMemberName.trim()) return;

    try {
      setIsAddingMember(true);
      await api.createUser(
        household.id,
        newMemberName.trim(),
        newMemberColor,
        newMemberRole,
        newMemberUsername.trim() || undefined
      );
      setNewMemberName('');
      setNewMemberUsername('');
      setShowAddMemberModal(false);
      await refreshHouseholdsAndUsers();
      setStatusMessage('New family member added!');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to add member:', err);
      alert(err.message || 'Failed to add member');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleJoinHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || !joinName.trim()) return;

    try {
      setIsJoining(true);
      const res = await api.joinHouseholdByCode(joinCode.trim().toUpperCase(), joinName.trim());
      setShowJoinModal(false);
      setJoinCode('');
      setJoinName('');
      await refreshHouseholdsAndUsers();
      setStatusMessage(`Joined household: ${res.household.name}!`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      console.error('Failed to join:', err);
      alert(err.message || 'Invalid invite code or join failed');
    } finally {
      setIsJoining(false);
    }
  };

  const handleConfirmDeleteMember = async () => {
    if (!memberToDelete) return;
    try {
      setIsDeletingMember(true);
      await api.deleteUser(memberToDelete.id);
      await refreshHouseholdsAndUsers();
      setStatusMessage(`Removed ${memberToDelete.name} from household.`);
      setMemberToDelete(null);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error('Delete error:', err);
      alert(err.message || 'Failed to remove member');
    } finally {
      setIsDeletingMember(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 pt-3 pb-36 md:pb-28 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20 shrink-0">
            <SettingsIcon className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Settings</h1>
            <p className="text-xs text-slate-400">Household, voice & aisle setup</p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-xs font-bold text-white block">{household?.name || 'Household'}</span>
          <span className="text-[11px] text-emerald-400 font-mono">
            {users.length} {users.length === 1 ? 'member' : 'members'}
          </span>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-xs font-semibold animate-in fade-in">
          <Check className="w-4 h-4" />
          {statusMessage}
        </div>
      )}

      {/* 1. Household Invite Code */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Household Invite Code</h3>
              <p className="text-[11px] text-slate-400">
                Share this 6-character code with family members to connect their devices
              </p>
            </div>
          </div>

          <button
            onClick={handleCopyInvite}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer shrink-0"
          >
            {copiedInvite ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="font-mono tracking-wider">{inviteCode || '••••••'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Family Members */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                Family Members
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                  {users.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Profiles connected to this household</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowJoinModal(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Join Household</span>
            </button>
            <button
              onClick={() => setShowAddMemberModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Member</span>
            </button>
          </div>
        </div>

        {/* Member Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {users.map((u) => {
            const isCurrent = currentUser?.id === u.id;
            const handle = u.username || u.name.toLowerCase().replace(/\s+/g, '');
            return (
              <div
                key={u.id}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 transition-all ${
                  isCurrent
                    ? 'bg-emerald-500/10 border-emerald-500/35 ring-1 ring-emerald-500/20'
                    : 'bg-slate-900/60 border-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {u.avatar && (u.avatar.startsWith('data:image') || u.avatar.startsWith('http')) ? (
                    <img
                      src={u.avatar}
                      alt={u.name}
                      className="w-8 h-8 rounded-xl object-cover shadow shrink-0 ring-1 ring-white/10"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow shrink-0"
                      style={{ backgroundColor: u.avatar_color }}
                    >
                      {u.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-xs font-bold text-white truncate">{u.name}</span>
                      {isCurrent && (
                        <span className="text-[9px] bg-emerald-500/25 text-emerald-300 px-1.5 py-0.2 rounded-full font-semibold shrink-0">
                          You
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] truncate">
                      <span className="font-mono text-emerald-400 font-medium truncate">@{handle}</span>
                      <span className="text-slate-600 text-[10px]">•</span>
                      <span className="text-slate-400 text-[10px] capitalize">{u.role || 'Member'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isCurrent ? (
                    <button
                      onClick={() => setIsEditProfileOpen(true)}
                      title="Edit Your Profile"
                      className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          switchUser(u);
                          setStatusMessage(`Switched active profile to ${u.name}`);
                          setTimeout(() => setStatusMessage(null), 3000);
                        }}
                        title={`Switch to ${u.name}`}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-300 hover:text-emerald-400 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <UserCheck className="w-3 h-3 text-emerald-400" />
                        <span>Switch</span>
                      </button>
                      {users.length > 1 && (
                        <button
                          onClick={() => setMemberToDelete(u)}
                          title={`Remove ${u.name}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Assistant Voice Responses (Radio Buttons) */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Gemini Voice Playback</h3>
            <p className="text-[11px] text-slate-400">
              Choose how the AI assistant responds to your messages
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {/* Radio 1: Silent */}
          <label
            onClick={() => setAutoAudioResponses(false)}
            className={`p-3.5 rounded-2xl border cursor-pointer flex items-start gap-3 transition-all ${
              !autoAudioResponses
                ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/25'
                : 'bg-slate-900/60 border-white/5 hover:border-white/10'
            }`}
          >
            <input
              type="radio"
              name="autoAudioOption"
              checked={!autoAudioResponses}
              onChange={() => setAutoAudioResponses(false)}
              className="mt-0.5 h-4 w-4 text-emerald-500 accent-emerald-500 cursor-pointer"
            />
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                Text Only (Silent)
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Responds silently in chat. Tap speaker on any message to listen.
              </div>
            </div>
          </label>

          {/* Radio 2: Auto-Read */}
          <label
            onClick={() => setAutoAudioResponses(true)}
            className={`p-3.5 rounded-2xl border cursor-pointer flex items-start gap-3 transition-all ${
              autoAudioResponses
                ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/25'
                : 'bg-slate-900/60 border-white/5 hover:border-white/10'
            }`}
          >
            <input
              type="radio"
              name="autoAudioOption"
              checked={autoAudioResponses}
              onChange={() => setAutoAudioResponses(true)}
              className="mt-0.5 h-4 w-4 text-emerald-500 accent-emerald-500 cursor-pointer"
            />
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                Auto-Read Aloud
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Automatically speaks Gemini answers using voice speech synthesis.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* 4. Family Push Alerts (Radio Buttons) */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Family Push Notifications</h3>
            <p className="text-[11px] text-slate-400">
              Receive alerts on this device when family updates groceries or events
            </p>
          </div>
        </div>

        {!isPushSupported ? (
          <p className="text-xs text-amber-400 bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
            Push notifications are not supported by this browser environment.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* Radio 1: Enabled */}
            <label
              onClick={() => handlePushToggle(true)}
              className={`p-3.5 rounded-2xl border cursor-pointer flex items-start gap-3 transition-all ${
                isPushSubscribed
                  ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/25'
                  : 'bg-slate-900/60 border-white/5 hover:border-white/10'
              }`}
            >
              <input
                type="radio"
                name="pushAlertsOption"
                checked={isPushSubscribed}
                onChange={() => handlePushToggle(true)}
                className="mt-0.5 h-4 w-4 text-emerald-500 accent-emerald-500 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white flex items-center justify-between gap-1">
                  <span>Enabled</span>
                  {isPushSubscribed && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSendTestPush();
                      }}
                      disabled={isSendingTestPush}
                      className="text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer"
                    >
                      {isSendingTestPush ? 'Sending...' : 'Test Alert'}
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {isSubscribingPush
                    ? 'Subscribing device...'
                    : 'Active on this device for instant list and calendar changes.'}
                </div>
              </div>
            </label>

            {/* Radio 2: Disabled */}
            <label
              className={`p-3.5 rounded-2xl border cursor-pointer flex items-start gap-3 transition-all ${
                !isPushSubscribed
                  ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/25'
                  : 'bg-slate-900/60 border-white/5 hover:border-white/10'
              }`}
            >
              <input
                type="radio"
                name="pushAlertsOption"
                checked={!isPushSubscribed}
                onChange={() => {}}
                className="mt-0.5 h-4 w-4 text-emerald-500 accent-emerald-500 cursor-pointer"
              />
              <div>
                <div className="text-xs font-bold text-white">Disabled</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Push notifications are muted on this device.
                </div>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* 5. Grocery Store Aisles */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <MoveVertical className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Grocery Store Aisles</h3>
              <p className="text-[11px] text-slate-400">
                Arrange aisle ordering and names to match your local supermarket
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAisleModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <MoveVertical className="w-3.5 h-3.5 text-emerald-400" />
            <span>Configure Aisles</span>
          </button>
        </div>
      </div>

      {/* 6. App Installation & PWA */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Mobile App & Offline Mode</h3>
              <p className="text-[11px] text-slate-400">
                {isPWAInstalled
                  ? 'Homebase is installed and ready for offline use'
                  : 'Install on your home screen for quick launch and offline access'}
              </p>
            </div>
          </div>

          {isPWAInstalled ? (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              Installed
            </span>
          ) : canInstallPWA ? (
            <button
              onClick={installPWA}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Install App
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-white/5 shrink-0">
              Web Mode
            </span>
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-panel w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Add Family Member
              </h3>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Username <span className="text-[10px] text-slate-500">(Optional)</span>
                </label>
                <div className="relative">
                  <span className="text-xs font-bold text-emerald-400 absolute left-2.5 top-1/2 -translate-y-1/2 select-none">
                    @
                  </span>
                  <input
                    type="text"
                    placeholder={newMemberName ? newMemberName.toLowerCase().replace(/\s+/g, '') : 'username'}
                    value={newMemberUsername}
                    onChange={(e) => setNewMemberUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl pl-6 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Role</label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as any)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="parent">Parent</option>
                    <option value="child">Child</option>
                    <option value="member">Member</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Color</label>
                  <div className="flex items-center gap-1.5 pt-1.5">
                    {AVATAR_COLORS.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setNewMemberColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                          newMemberColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-70'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newMemberName.trim() || isAddingMember}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold disabled:opacity-50"
                >
                  {isAddingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Household Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-panel w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <LogIn className="w-4 h-4 text-indigo-400" />
                Join Existing Household
              </h3>
              <button
                onClick={() => setShowJoinModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleJoinHousehold} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  6-Character Invite Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  placeholder="e.g. H5XWAE"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono tracking-widest uppercase text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  placeholder="Your first name"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!joinCode.trim() || !joinName.trim() || isJoining}
                  className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold disabled:opacity-50"
                >
                  {isJoining ? 'Joining...' : 'Join Household'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Member Confirmation Modal */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-panel w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border border-white/10 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-400" />
              Remove Family Member
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-3 rounded-2xl border border-white/5">
              Are you sure you want to remove <span className="text-white font-bold">{memberToDelete.name}</span> from {household?.name || 'this household'}?
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                disabled={isDeletingMember}
                className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMember}
                disabled={isDeletingMember}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeletingMember ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aisle Reordering Modal */}
      {household && (
        <AisleManagerModal
          isOpen={isAisleModalOpen}
          onClose={() => setIsAisleModalOpen(false)}
          householdId={household.id}
          initialAisles={aisles}
          onAislesUpdated={refreshAisles}
        />
      )}

      {/* User's Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />
    </div>
  );
};
