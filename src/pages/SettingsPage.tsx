import React, { useState, useEffect } from 'react';
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
  Calendar,
  SlidersHorizontal,
  X,
  AlertCircle,
  ShoppingCart,
  Utensils,
  BookOpen,
  Bot,
  Moon,
  Clock,
  CheckCircle2,
  BellOff,
  RefreshCw,
} from 'lucide-react';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { AisleManagerModal } from '../components/AisleManagerModal';
import { EditProfileModal } from '../components/EditProfileModal';
import type { User, GoogleSyncStatus, GoogleCalendarEntry, NotificationPreferences } from '../types';

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
    pushPermission,
    subscribeToPush,
    unsubscribeFromPush,
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeletingMember, setIsDeletingMember] = useState(false);

  // Notification Preferences States
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    userId: currentUser?.id || 'u1',
    householdId: household?.id || '',
    groceryAdded: true,
    groceryCompleted: true,
    calendarEvents: true,
    mealPlans: true,
    recipesAdded: true,
    assistantActions: true,
    notifyOwnActions: false,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  });
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(false);
  const [isSavingPref, setIsSavingPref] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    let isMounted = true;
    setIsLoadingPrefs(true);
    api.getNotificationPreferences(currentUser.id)
      .then((prefs) => {
        if (isMounted && prefs) {
          setNotificationPrefs(prefs);
        }
      })
      .catch((err) => {
        console.error('Failed to load notification preferences:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPrefs(false);
      });
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  const handleTogglePreference = async (key: keyof NotificationPreferences, value: any) => {
    const updated = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(updated);
    setIsSavingPref(true);
    try {
      await api.updateNotificationPreferences({
        ...updated,
        userId: currentUser?.id,
      });
    } catch (err: any) {
      console.error('Failed to save notification preference:', err);
      setNotificationPrefs(notificationPrefs);
    } finally {
      setIsSavingPref(false);
    }
  };

  // Google Calendar Sync States
  const [googleSyncStatuses, setGoogleSyncStatuses] = useState<GoogleSyncStatus[]>([]);
  const [isLoadingGoogleStatus, setIsLoadingGoogleStatus] = useState(false);
  const [connectingUserId, setConnectingUserId] = useState<string | null>(null);
  const [disconnectingUserId, setDisconnectingUserId] = useState<string | null>(null);

  const loadGoogleStatus = async () => {
    try {
      setIsLoadingGoogleStatus(true);
      const statuses = await api.getGoogleSyncStatus();
      setGoogleSyncStatuses(statuses);
    } catch (err) {
      console.error('Failed to load Google sync status:', err);
    } finally {
      setIsLoadingGoogleStatus(false);
    }
  };

  useEffect(() => {
    loadGoogleStatus();
  }, [household?.id, users.length]);

  useEffect(() => {
    // Check URL parameters for OAuth return
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_sync') === 'success') {
      const email = params.get('email');
      setStatusMessage(
        `Google Calendar connected! ${email ? `(${email}) ` : ''}Your events are now syncing in the background.`
      );
      loadGoogleStatus();
      const t1 = setTimeout(() => loadGoogleStatus(), 1500);
      const t2 = setTimeout(() => loadGoogleStatus(), 3500);
      try {
        localStorage.setItem('homebase_last_active_tab', 'settings');
      } catch {}
      window.history.replaceState({}, '', '/?tab=settings');
      const t3 = setTimeout(() => setStatusMessage(null), 6000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else if (params.get('google_sync') === 'error') {
      const msg = params.get('message') || 'Connection failed';
      setErrorMessage(`Google Calendar connection failed: ${decodeURIComponent(msg)}`);
      try {
        localStorage.setItem('homebase_last_active_tab', 'settings');
      } catch {}
      window.history.replaceState({}, '', '/?tab=settings');
    }
  }, []);

  const handleConnectGoogle = async (userId: string) => {
    try {
      setConnectingUserId(userId);
      const { url } = await api.getGoogleAuthUrl(userId, household?.id);
      window.location.href = url;
    } catch (err: any) {
      console.error('Failed to initiate Google OAuth:', err);
      alert(err.message || 'Failed to connect to Google');
      setConnectingUserId(null);
    }
  };

  const handleDisconnectGoogle = async (userId: string) => {
    if (
      !confirm(
        'Disconnect Google Calendar for this member? Synced Google events will be removed from Homebase.'
      )
    )
      return;
    try {
      setDisconnectingUserId(userId);
      await api.disconnectGoogleCalendar(userId);
      await loadGoogleStatus();
      setStatusMessage('Google Calendar disconnected.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to disconnect Google Calendar:', err);
      alert(err.message || 'Failed to disconnect');
    } finally {
      setDisconnectingUserId(null);
    }
  };

  // Choose Calendars Modal State
  const [calendarModalUser, setCalendarModalUser] = useState<User | null>(null);
  const [userCalendars, setUserCalendars] = useState<GoogleCalendarEntry[]>([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [isSavingCalendars, setIsSavingCalendars] = useState(false);

  const handleOpenCalendarSelector = async (u: User) => {
    setCalendarModalUser(u);
    setIsLoadingCalendars(true);
    try {
      const cals = await api.getGoogleCalendars(u.id);
      setUserCalendars(cals);
    } catch (err: any) {
      console.error('Failed to load Google calendars:', err);
      alert(err.message || 'Failed to load Google calendars');
      setCalendarModalUser(null);
    } finally {
      setIsLoadingCalendars(false);
    }
  };

  const handleToggleCalendar = (id: string) => {
    setUserCalendars((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleChangeCalendarMember = (calendarId: string, memberId: string) => {
    setUserCalendars((prev) =>
      prev.map((c) =>
        c.id === calendarId ? { ...c, assignedMemberId: memberId || null } : c
      )
    );
  };

  const handleSaveCalendarSelection = async () => {
    if (!calendarModalUser) return;
    const selections = userCalendars
      .filter((c) => c.selected)
      .map((c) => ({
        calendarId: c.id,
        assignedMemberId: c.assignedMemberId || null,
      }));

    if (selections.length === 0) {
      alert('Please select at least one calendar to sync, or disconnect if you no longer wish to sync.');
      return;
    }

    try {
      setIsSavingCalendars(true);
      await api.updateSelectedGoogleCalendars(calendarModalUser.id, selections);
      await loadGoogleStatus();
      setStatusMessage(`Updated calendar sync preferences for ${calendarModalUser.name}.`);
      setCalendarModalUser(null);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      console.error('Failed to update calendars:', err);
      alert(err.message || 'Failed to update calendar selection');
    } finally {
      setIsSavingCalendars(false);
    }
  };

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
    setIsSubscribingPush(true);
    try {
      if (enable) {
        const success = await subscribeToPush();
        if (success) {
          setStatusMessage('Push notifications enabled for this device!');
          setTimeout(() => setStatusMessage(null), 3500);
        } else {
          setErrorMessage('Notification permission was not granted. Please enable notifications in your browser settings.');
          setTimeout(() => setErrorMessage(null), 4500);
        }
      } else {
        const success = await unsubscribeFromPush();
        if (success) {
          setStatusMessage('Push notifications disabled on this device.');
          setTimeout(() => setStatusMessage(null), 3500);
        }
      }
    } catch (err: any) {
      console.error('Push error:', err);
      setErrorMessage('Failed to update push notification settings.');
      setTimeout(() => setErrorMessage(null), 3500);
    } finally {
      setIsSubscribingPush(false);
    }
  };

  const handleSendTestPush = async () => {
    if (!household) return;
    setIsSendingTestPush(true);
    try {
      // 1. Ensure service worker & push subscription are active and registered in backend
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const swUrl = import.meta.env.DEV ? '/sw-push.js' : '/sw.js';
        const reg = await navigator.serviceWorker.register(swUrl);
        await navigator.serviceWorker.ready;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const success = await subscribeToPush();
          if (!success) {
            setErrorMessage('Please enable notifications on this device first.');
            setTimeout(() => setErrorMessage(null), 4000);
            return;
          }
          sub = await reg.pushManager.getSubscription();
        }

        if (sub) {
          // Re-sync with backend to guarantee database contains this subscription
          await api.subscribePush({
            householdId: household.id,
            userId: currentUser?.id,
            subscription: sub.toJSON(),
          });
        }

        // Direct browser notification verification if permission is granted
        if (Notification.permission === 'granted') {
          reg.showNotification('Homebase Alert 🛒', {
            body: 'Push notifications are working smoothly on your device!',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            data: { url: '/grocery' },
            tag: 'fam-kit-test-' + Date.now(),
          });
        }
      }

      // 2. Dispatch push notification via backend server
      await api.sendTestPush(
        household.id,
        'Homebase Alert 🛒',
        'Push notifications are working smoothly on your device!'
      );

      setStatusMessage('Test notification sent successfully!');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error('Test push error:', err);
      setErrorMessage(err.message || 'Failed to send test push notification.');
      setTimeout(() => setErrorMessage(null), 4000);
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
          <Check className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-between gap-3 text-red-400 text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="break-words">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-slate-400 hover:text-white p-1 cursor-pointer shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
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

      {/* 3. Google Calendar Sync */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Google Calendar Sync</h3>
              <p className="text-[11px] text-slate-400">
                Automatically sync personal or shared Google calendars into the family timeline
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadGoogleStatus()}
            disabled={isLoadingGoogleStatus}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Refresh Google Calendar sync status"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingGoogleStatus ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>

        {/* Member connection list */}
        <div className="space-y-2.5 pt-1">
          {users.map((u) => {
            const syncStatus = googleSyncStatuses.find((s) => s.userId === u.id);
            const isConnected = Boolean(syncStatus?.connected);
            const isConnecting = connectingUserId === u.id;
            const isDisconnecting = disconnectingUserId === u.id;

            return (
              <div
                key={`gcal_${u.id}`}
                className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {u.avatar && (u.avatar.startsWith('data:image') || u.avatar.startsWith('http')) ? (
                    <img
                      src={u.avatar}
                      alt={u.name}
                      className="w-9 h-9 rounded-xl object-cover shadow shrink-0 ring-1 ring-white/10"
                    />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow shrink-0"
                      style={{ backgroundColor: u.avatar_color }}
                    >
                      {u.name.charAt(0)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">{u.name}</span>
                      {isConnected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Connected</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full font-medium">
                          Not connected
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 truncate pt-0.5">
                      {isConnected && syncStatus?.googleEmail ? (
                        <span className="font-mono text-slate-300">{syncStatus.googleEmail}</span>
                      ) : (
                        <span className="text-slate-500">Connect to sync Google events</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 justify-end">
                  {isConnected ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenCalendarSelector(u)}
                        className="px-3 py-1.5 rounded-xl border border-white/10 hover:border-emerald-500/40 bg-white/5 hover:bg-emerald-500/10 text-slate-200 hover:text-emerald-300 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Choose Calendars</span>
                        {syncStatus?.selectedCalendarCount !== undefined && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                            {syncStatus.selectedCalendarCount}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={isDisconnecting}
                        onClick={() => handleDisconnectGoogle(u.id)}
                        className="px-2.5 py-1.5 rounded-xl border border-red-500/20 hover:border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                        title="Disconnect Google Calendar"
                      >
                        {isDisconnecting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">Disconnect</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={isConnecting}
                      onClick={() => handleConnectGoogle(u.id)}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isConnecting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                      ) : (
                        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                      )}
                      <span>Connect Google Calendar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300/90 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-blue-400" />
          <span>
            Once connected, events automatically sync to the family calendar in the background. No manual buttons needed.
          </span>
        </div>
      </div>

      {/* 4. Assistant Voice Responses (Radio Buttons) */}
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

      {/* 4. Family Push Alerts & Notification Preferences */}
      <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-white/10 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Push Notifications & Alerts
            </h3>
            <p className="text-[11px] text-slate-400">
              Instant alerts delivered when family members update lists, calendar, or meals
            </p>
          </div>
        </div>

        {/* Browser Support / Permission Warnings */}
        {!isPushSupported ? (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300 leading-relaxed">
              Push notifications are not supported in this browser environment. For alerts, use Google Chrome, Edge, Safari (iOS 16.4+), or install Homebase to your home screen.
            </div>
          </div>
        ) : pushPermission === 'denied' ? (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-start gap-3">
            <BellOff className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-300 leading-relaxed">
              <strong className="text-red-200">Browser permissions are blocked.</strong>
              <div className="text-[11px] text-red-400/90 mt-1">
                To receive alerts, click the lock icon in your browser URL bar and change Notifications to &quot;Allow&quot;.
              </div>
            </div>
          </div>
        ) : (
          /* Sleek Device Status & Action Card */
          <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-black/20">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className={`p-2.5 rounded-2xl border shrink-0 transition-colors ${
                isPushSubscribed
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800 border-white/10 text-slate-400'
              }`}>
                <Smartphone className="w-5 h-5" />
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-bold text-white">This Device</span>
                  {isPushSubscribed ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-300 bg-emerald-500/20 border border-emerald-500/35 px-2.5 py-0.5 rounded-full shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active & Receiving Alerts
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400 bg-slate-800/80 border border-white/10 px-2.5 py-0.5 rounded-full">
                      <BellOff className="w-3 h-3 text-slate-400" />
                      Alerts Muted
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isPushSubscribed
                    ? 'Delivers native notifications when Homebase is running or in the background.'
                    : 'Push notifications are silenced on this browser.'}
                </p>
              </div>
            </div>

            {/* Actions: Test Button + Enable/Mute Toggle */}
            <div className="flex items-center gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
              {isPushSubscribed && (
                <button
                  type="button"
                  onClick={handleSendTestPush}
                  disabled={isSendingTestPush}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800/90 hover:bg-slate-700/90 border border-white/10 hover:border-white/20 active:scale-[0.98] transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                  title="Send a sample alert to verify delivery"
                >
                  {isSendingTestPush ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{isSendingTestPush ? 'Sending...' : 'Test Alert'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handlePushToggle(!isPushSubscribed)}
                disabled={isSubscribingPush}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                  isPushSubscribed
                    ? 'bg-slate-800 text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 border border-white/10'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 font-extrabold'
                }`}
              >
                {isSubscribingPush ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isPushSubscribed ? (
                  <>
                    <BellOff className="w-3.5 h-3.5" />
                    <span>Mute Alerts</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5" />
                    <span>Enable Alerts</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Category Settings: Which Notifications to Receive */}
        <div className="pt-2 border-t border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-white">Alert Categories</h4>
              <p className="text-[11px] text-slate-400">
                Choose which types of activities send push notifications for {currentUser?.name || 'you'}
              </p>
            </div>
            {isSavingPref && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Category 1: Grocery Added */}
            <label className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-white/10 flex items-start gap-3 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={notificationPrefs.groceryAdded}
                onChange={(e) => handleTogglePreference('groceryAdded', e.target.checked)}
                className="mt-1 h-4 w-4 text-emerald-500 accent-emerald-500 rounded cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                  Grocery: Items Added
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  When items are added to the grocery shopping list by family or AI.
                </div>
              </div>
            </label>

            {/* Category 2: Grocery Completed */}
            <label className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-white/10 flex items-start gap-3 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={notificationPrefs.groceryCompleted}
                onChange={(e) => handleTogglePreference('groceryCompleted', e.target.checked)}
                className="mt-1 h-4 w-4 text-emerald-500 accent-emerald-500 rounded cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Grocery: Items Checked Off
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  When someone checks off groceries while shopping in the store.
                </div>
              </div>
            </label>

            {/* Category 3: Calendar Events */}
            <label className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-white/10 flex items-start gap-3 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={notificationPrefs.calendarEvents}
                onChange={(e) => handleTogglePreference('calendarEvents', e.target.checked)}
                className="mt-1 h-4 w-4 text-emerald-500 accent-emerald-500 rounded cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  Calendar Events
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  When new events are scheduled, rescheduled, or cancelled.
                </div>
              </div>
            </label>

            {/* Category 4: Meal Planner */}
            <label className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-white/10 flex items-start gap-3 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={notificationPrefs.mealPlans}
                onChange={(e) => handleTogglePreference('mealPlans', e.target.checked)}
                className="mt-1 h-4 w-4 text-emerald-500 accent-emerald-500 rounded cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-amber-400" />
                  Meal Planner
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  When weekly dinners and family meal plans are scheduled.
                </div>
              </div>
            </label>

            {/* Category 5: Recipes */}
            <label className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-white/10 flex items-start gap-3 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={notificationPrefs.recipesAdded}
                onChange={(e) => handleTogglePreference('recipesAdded', e.target.checked)}
                className="mt-1 h-4 w-4 text-emerald-500 accent-emerald-500 rounded cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                  New Recipes
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  When new recipes are saved, imported, or created by AI.
                </div>
              </div>
            </label>

            {/* Category 6: AI Assistant */}
            <label className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-white/10 flex items-start gap-3 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={notificationPrefs.assistantActions}
                onChange={(e) => handleTogglePreference('assistantActions', e.target.checked)}
                className="mt-1 h-4 w-4 text-emerald-500 accent-emerald-500 rounded cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-teal-400" />
                  AI Assistant Actions
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  When Gemini takes automated actions or updates family lists.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Delivery & Schedule Preferences */}
        <div className="pt-2 border-t border-white/5 space-y-3">
          <h4 className="text-xs font-bold text-white">Delivery Preferences</h4>

          <div className="space-y-2.5">
            {/* Self-Action Filtering */}
            <label className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-white/10 flex items-center justify-between gap-3 cursor-pointer transition-all">
              <div>
                <div className="text-xs font-bold text-white">Notify Me of My Own Actions</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Receive notifications even when you are the person who added or checked off an item
                </div>
              </div>
              <input
                type="checkbox"
                checked={notificationPrefs.notifyOwnActions}
                onChange={(e) => handleTogglePreference('notifyOwnActions', e.target.checked)}
                className="h-4 w-4 text-emerald-500 accent-emerald-500 rounded cursor-pointer shrink-0"
              />
            </label>

            {/* Quiet Hours */}
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Quiet Hours (Do Not Disturb)</div>
                    <div className="text-[11px] text-slate-400">
                      Silence push notifications during nighttime hours
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationPrefs.quietHoursEnabled}
                  onChange={(e) => handleTogglePreference('quietHoursEnabled', e.target.checked)}
                  className="h-4 w-4 text-emerald-500 accent-emerald-500 rounded cursor-pointer shrink-0"
                />
              </div>

              {notificationPrefs.quietHoursEnabled && (
                <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-300 text-[11px]">Start:</span>
                    <input
                      type="time"
                      value={notificationPrefs.quietHoursStart}
                      onChange={(e) => handleTogglePreference('quietHoursStart', e.target.value)}
                      className="bg-slate-800 text-white text-xs px-2.5 py-1 rounded-lg border border-white/10 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300 text-[11px]">End:</span>
                    <input
                      type="time"
                      value={notificationPrefs.quietHoursEnd}
                      onChange={(e) => handleTogglePreference('quietHoursEnd', e.target.value)}
                      className="bg-slate-800 text-white text-xs px-2.5 py-1 rounded-lg border border-white/10 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
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

      {/* 9. About & Legal Links */}
      <div className="pt-2 pb-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
        <a
          href="/?landing=true"
          className="hover:text-emerald-400 transition-colors font-medium"
        >
          App Overview & Phone Install Guide
        </a>
        <span className="text-slate-600">•</span>
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-emerald-400 transition-colors"
        >
          Privacy Policy
        </a>
        <span className="text-slate-600">•</span>
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-emerald-400 transition-colors"
        >
          Terms of Service
        </a>
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

      {/* Choose Google Calendars Modal */}
      {calendarModalUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 p-0 sm:p-4">
          <div className="w-full max-w-md bg-slate-900 border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[85vh] flex flex-col space-y-4">
            {/* Top Drag Handle (Mobile) */}
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/20">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Choose Calendars</h3>
                  <p className="text-xs text-slate-400">
                    Select which Google calendars sync for {calendarModalUser.name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCalendarModalUser(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Calendar List */}
            <div className="flex-1 overflow-y-auto space-y-2 py-1 pr-1">
              {isLoadingCalendars ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  <span className="text-xs">Loading your Google calendars...</span>
                </div>
              ) : userCalendars.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No calendars found for this Google account.
                </div>
              ) : (
                userCalendars.map((cal) => (
                  <div
                    key={cal.id}
                    className={`p-3 rounded-2xl border transition-all space-y-2.5 ${
                      cal.selected
                        ? 'bg-emerald-500/10 border-emerald-500/35 ring-1 ring-emerald-500/20'
                        : 'bg-slate-950/40 border-white/5 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div
                      onClick={() => handleToggleCalendar(cal.id)}
                      className="flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-white/20"
                          style={{ backgroundColor: cal.backgroundColor || '#10b981' }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-white truncate">{cal.summary}</span>
                            {cal.primary && (
                              <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded-full font-semibold shrink-0">
                                Primary
                              </span>
                            )}
                          </div>
                          {cal.description && (
                            <p className="text-[11px] text-slate-400 truncate">{cal.description}</p>
                          )}
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                          cal.selected
                            ? 'bg-emerald-500 border-emerald-500 text-slate-950 font-black'
                            : 'border-white/20 bg-white/5'
                        }`}
                      >
                        {cal.selected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    {/* Member Assignment Dropdown (shown when calendar is selected) */}
                    {cal.selected && (
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400 font-medium">Assign events to:</span>
                        <select
                          value={cal.assignedMemberId || ''}
                          onChange={(e) => handleChangeCalendarMember(cal.id, e.target.value)}
                          className="bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-emerald-300 font-semibold focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                        >
                          <option value="">Whole Family / Shared</option>
                          {users.map((mem) => (
                            <option key={mem.id} value={mem.id}>
                              {mem.name} {mem.id === calendarModalUser.id ? '(You)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCalendarModalUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingCalendars || isLoadingCalendars}
                onClick={handleSaveCalendarSelection}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSavingCalendars && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save & Sync</span>
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
