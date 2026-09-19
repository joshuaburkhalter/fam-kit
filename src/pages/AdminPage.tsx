import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  Users,
  Ticket,
  Sparkles,
  Bug,
  Home,
  BarChart3,
  Calendar,
  UtensilsCrossed,
  ShoppingCart,
  Search,
  Plus,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Trash2,
  Edit3,
  MessageSquare,
  Send,
  UserCheck,
  User,
  ChevronDown,
  Lock,
  HeartHandshake,
  Flame,
} from 'lucide-react';
import { usePWA } from '../context/PWAContext';
import { isUserAdmin } from '../types';
import type {
  AdminOverviewData,
  AdminUser,
  AdminHousehold,
  PromoCode,
  FeedbackRequest,
} from '../types';
import { api } from '../lib/api';
import { Toast } from '../components/ui/Toast';

interface AdminPageProps {
  onBack?: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onBack }) => {
  const { currentUser } = usePWA();
  const isAdmin = isUserAdmin(currentUser);

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'codes' | 'feedback' | 'households'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Data states
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [codesList, setCodesList] = useState<PromoCode[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackRequest[]>([]);
  const [householdsList, setHouseholdsList] = useState<AdminHousehold[]>([]);

  // Search & Filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');

  const [codeSearch, setCodeSearch] = useState('');
  const [codeStatusFilter, setCodeStatusFilter] = useState('all');

  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [feedbackTypeFilter, setFeedbackTypeFilter] = useState<'all' | 'bug' | 'feature'>('all');
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState('active');

  const [householdSearch, setHouseholdSearch] = useState('');

  // Code Generator Form State
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [codeDuration, setCodeDuration] = useState<3 | 6 | 12 | null>(3);
  const [codeAssignedTo, setCodeAssignedTo] = useState('');
  const [codeCustomName, setCodeCustomName] = useState('');
  const [codeMaxUses, setCodeMaxUses] = useState(1);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Edit Assigned Recipient Inline
  const [editingCodeString, setEditingCodeString] = useState<string | null>(null);
  const [editingAssignedTo, setEditingAssignedTo] = useState('');

  // Feedback Response State
  const [respondingFeedbackId, setRespondingFeedbackId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responseStatus, setResponseStatus] = useState<string>('in_progress');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);

  // User Deletion State
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Household Deletion State
  const [householdToDelete, setHouseholdToDelete] = useState<AdminHousehold | null>(null);
  const [isDeletingHousehold, setIsDeletingHousehold] = useState(false);

  const deleteModalPushedRef = useRef(false);

  const handleCloseDeleteModals = () => {
    if (deleteModalPushedRef.current) {
      deleteModalPushedRef.current = false;
      window.history.back();
    }
    setUserToDelete(null);
    setHouseholdToDelete(null);
  };

  useEffect(() => {
    const isModalOpen = Boolean(userToDelete || householdToDelete);
    if (isModalOpen) {
      if (!deleteModalPushedRef.current) {
        deleteModalPushedRef.current = true;
        window.history.pushState({ type: 'admin_modal', timestamp: Date.now() }, '', window.location.href);
      }

      const handlePopState = () => {
        if (deleteModalPushedRef.current) {
          deleteModalPushedRef.current = false;
          setUserToDelete(null);
          setHouseholdToDelete(null);
        }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [userToDelete, householdToDelete]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string, label: string = 'Copied') => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    showToast(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const loadAllData = async (silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [ovData, uData, cData, fData, hData] = await Promise.all([
        api.getAdminOverview().catch((e) => { console.error(e); return null; }),
        api.getAdminUsers().catch((e) => { console.error(e); return []; }),
        api.getPromoCodes().catch((e) => { console.error(e); return []; }),
        api.getFeedbackRequests().catch((e) => { console.error(e); return []; }),
        api.getAdminHouseholds().catch((e) => { console.error(e); return []; }),
      ]);

      if (ovData) setOverview(ovData);
      if (uData) setUsersList(uData);
      if (cData) setCodesList(cData);
      if (fData) setFeedbackList(fData);
      if (hData) setHouseholdsList(hData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      showToast('Error refreshing admin data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAllData();
    }
  }, [isAdmin]);

  // Role Update Handler
  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      const updated = await api.updateAdminUserRole(userId, newRole);
      setUsersList((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)));
      showToast(`Updated user role to ${newRole}`);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to update user role');
    }
  };

  // Delete User Handler
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      await api.deleteAdminUser(userToDelete.id);
      setUsersList((prev) => prev.filter((u) => u.id !== userToDelete.id));
      showToast(`User "${userToDelete.name}" deleted successfully.`);
      handleCloseDeleteModals();
      // Refresh overview and households in background
      api.getAdminOverview().then((ov) => { if (ov) setOverview(ov); }).catch(() => {});
      api.getAdminHouseholds().then((h) => { if (h) setHouseholdsList(h); }).catch(() => {});
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      showToast(err.message || 'Failed to delete user');
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Delete Household Handler
  const handleDeleteHousehold = async () => {
    if (!householdToDelete) return;
    setIsDeletingHousehold(true);
    try {
      await api.deleteAdminHousehold(householdToDelete.id);
      setHouseholdsList((prev) => prev.filter((h) => h.id !== householdToDelete.id));
      setUsersList((prev) => prev.filter((u) => u.householdId !== householdToDelete.id));
      showToast(`Household "${householdToDelete.name}" and all members deleted.`);
      handleCloseDeleteModals();
      // Refresh overview in background
      api.getAdminOverview().then((ov) => { if (ov) setOverview(ov); }).catch(() => {});
    } catch (err: any) {
      console.error('Failed to delete household:', err);
      showToast(err.message || 'Failed to delete household');
    } finally {
      setIsDeletingHousehold(false);
    }
  };

  // Generate Code Handler
  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingCode(true);
    try {
      const res = await api.generatePromoCode({
        durationMonths: codeDuration,
        customCode: codeCustomName.trim() || undefined,
        assignedTo: codeAssignedTo.trim() || undefined,
        maxUses: codeMaxUses || 1,
      });

      if (res && res.code) {
        showToast(`Code created: ${res.code}`);
        setCodeAssignedTo('');
        setCodeCustomName('');
        setCodeMaxUses(1);
        // Reload codes
        const updatedCodes = await api.getPromoCodes();
        setCodesList(updatedCodes);
      }
    } catch (err: any) {
      console.error('Failed to generate code:', err);
      showToast(err.message || 'Failed to generate code');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // Toggle Code Status
  const handleToggleCodeActive = async (code: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    // Optimistic UI update
    setCodesList((prev) => prev.map((c) => (c.code === code ? { ...c, isActive: nextStatus } : c)));
    try {
      const updated = await api.updatePromoCode(code, { isActive: nextStatus });
      const activeBool = updated.isActive === true || updated.isActive === 1;
      setCodesList((prev) => prev.map((c) => (c.code === code ? { ...c, isActive: activeBool } : c)));
      showToast(`Code ${code} is now ${nextStatus ? 'Active' : 'Disabled'}`);
    } catch (err: any) {
      // Revert on error
      setCodesList((prev) => prev.map((c) => (c.code === code ? { ...c, isActive: currentStatus } : c)));
      console.error(err);
      showToast('Failed to update code');
    }
  };

  // Save Inline Assigned Recipient
  const handleSaveAssignedTo = async (code: string) => {
    try {
      const updated = await api.updatePromoCode(code, { assignedTo: editingAssignedTo.trim() });
      setCodesList((prev) => prev.map((c) => (c.code === code ? { ...c, assignedTo: updated.assignedTo } : c)));
      setEditingCodeString(null);
      showToast('Recipient assignment saved!');
    } catch (err: any) {
      console.error(err);
      showToast('Failed to save recipient');
    }
  };

  // Delete Code
  const handleDeleteCode = async (code: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete code ${code}?`)) return;
    try {
      await api.deletePromoCode(code);
      setCodesList((prev) => prev.filter((c) => c.code !== code));
      showToast(`Deleted code ${code}`);
    } catch (err: any) {
      console.error(err);
      showToast('Failed to delete code');
    }
  };

  // Update Feedback Status / Response
  const handleSubmitFeedbackResponse = async (id: string) => {
    if (!responseText.trim()) return;
    setIsSubmittingResponse(true);
    try {
      const updated = await api.updateFeedbackRequest(id, {
        status: responseStatus as any,
        adminResponse: responseText.trim(),
        adminRespondedBy: currentUser?.name || 'Joshua (Admin)',
      });
      setFeedbackList((prev) => prev.map((f) => (f.id === id ? { ...f, ...updated } : f)));
      setRespondingFeedbackId(null);
      setResponseText('');
      const wasPushed = (updated as any)?.pushedToUser;
      const recipient = (updated as any)?.submittedByUserName;
      if (wasPushed) {
        showToast(`Developer note published & push notification sent to ${recipient || 'user'}!`);
      } else {
        showToast('Developer note published! (User has not enabled push notifications)');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Failed to update request');
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  // Quick Change Status
  const handleQuickChangeFeedbackStatus = async (id: string, newStatus: string) => {
    try {
      const updated = await api.updateFeedbackRequest(id, { status: newStatus as any });
      setFeedbackList((prev) => prev.map((f) => (f.id === id ? { ...f, status: updated.status } : f)));
      const wasPushed = (updated as any)?.pushedToUser;
      if (wasPushed) {
        showToast(`Status changed to ${newStatus.replace('_', ' ')} & user notified!`);
      } else {
        showToast(`Status changed to ${newStatus.replace('_', ' ')}`);
      }
    } catch (err: any) {
      console.error(err);
      showToast('Failed to change status');
    }
  };

  // Delete Feedback
  const handleDeleteFeedback = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this feedback item?')) return;
    try {
      await api.deleteFeedbackRequest(id);
      setFeedbackList((prev) => prev.filter((f) => f.id !== id));
      showToast('Feedback item removed');
    } catch (err: any) {
      console.error(err);
      showToast('Failed to delete item');
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const term = userSearch.toLowerCase().trim();
      const matchesSearch =
        !term ||
        u.name?.toLowerCase().includes(term) ||
        u.username?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.householdName?.toLowerCase().includes(term);

      const matchesRole =
        userRoleFilter === 'all' || u.role?.toLowerCase() === userRoleFilter.toLowerCase();

      const status = (u.subscriptionStatus || 'unpaid').toLowerCase();
      const matchesStatus =
        userStatusFilter === 'all' ||
        (userStatusFilter === 'active' && (status === 'active' || status === 'lifetime_founder')) ||
        (userStatusFilter === 'expired' && status === 'expired') ||
        (userStatusFilter === 'unpaid' && (status === 'unpaid' || !status));

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [usersList, userSearch, userRoleFilter, userStatusFilter]);

  // Filtered Codes
  const filteredCodes = useMemo(() => {
    return codesList.filter((c) => {
      const term = codeSearch.toLowerCase().trim();
      const matchesSearch =
        !term ||
        c.code?.toLowerCase().includes(term) ||
        c.assignedTo?.toLowerCase().includes(term) ||
        c.claimedByUserName?.toLowerCase().includes(term) ||
        c.claimedByHouseholdName?.toLowerCase().includes(term) ||
        c.claimedByUserEmail?.toLowerCase().includes(term);

      const isClaimed = (c.timesUsed || 0) > 0 || !!c.claimedByUserName;
      const isCodeActive = c.isActive === true || c.isActive === 1;
      const matchesStatus =
        codeStatusFilter === 'all' ||
        (codeStatusFilter === 'claimed' && isClaimed) ||
        (codeStatusFilter === 'unclaimed' && !isClaimed) ||
        (codeStatusFilter === 'active' && isCodeActive) ||
        (codeStatusFilter === 'disabled' && !isCodeActive);

      return matchesSearch && matchesStatus;
    });
  }, [codesList, codeSearch, codeStatusFilter]);

  // Filtered Feedback
  const filteredFeedback = useMemo(() => {
    return feedbackList.filter((f) => {
      const term = feedbackSearch.toLowerCase().trim();
      const matchesSearch =
        !term ||
        f.title?.toLowerCase().includes(term) ||
        f.description?.toLowerCase().includes(term) ||
        f.submittedByUserName?.toLowerCase().includes(term) ||
        f.householdName?.toLowerCase().includes(term);

      const matchesType = feedbackTypeFilter === 'all' || f.type === feedbackTypeFilter;
      const matchesStatus =
        feedbackStatusFilter === 'all'
          ? true
          : feedbackStatusFilter === 'active'
          ? f.status !== 'resolved' && f.status !== 'closed'
          : f.status === feedbackStatusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [feedbackList, feedbackSearch, feedbackTypeFilter, feedbackStatusFilter]);

  // Filtered Households
  const filteredHouseholds = useMemo(() => {
    return householdsList.filter((h) => {
      const term = householdSearch.toLowerCase().trim();
      return (
        !term ||
        h.name?.toLowerCase().includes(term) ||
        h.inviteCode?.toLowerCase().includes(term) ||
        h.memberNames?.toLowerCase().includes(term)
      );
    });
  }, [householdsList, householdSearch]);

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-8 backdrop-blur-md">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Restricted Access</h2>
          <p className="text-sm text-slate-300 mb-6">
            The Admin Portal is reserved exclusively for platform administrators.
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to App
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 space-y-6">
      {/* Toast Alert */}
      <Toast
        message={toastMessage}
        onClose={() => setToastMessage(null)}
        icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
      />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-white/10 rounded-3xl p-5 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3.5">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/5 transition-colors cursor-pointer"
              title="Return to App"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">Admin Command Center</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Superadmin
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center">
          <button
            onClick={() => loadAllData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-white/10">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'users'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Users</span>
          {usersList.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'users' ? 'bg-slate-950/20 text-slate-950' : 'bg-white/10 text-slate-300'
            }`}>
              {usersList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('codes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'codes'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Ticket className="w-4 h-4" />
          <span>Access Codes</span>
          {codesList.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'codes' ? 'bg-slate-950/20 text-slate-950' : 'bg-white/10 text-slate-300'
            }`}>
              {codesList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('feedback')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'feedback'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Feature Backlog</span>
          {overview?.stats?.openFeedbackRequests ? (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'feedback' ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              {overview.stats.openFeedbackRequests}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab('households')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'households'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Households</span>
          {householdsList.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'households' ? 'bg-slate-950/20 text-slate-950' : 'bg-white/10 text-slate-300'
            }`}>
              {householdsList.length}
            </span>
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-emerald-400">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <span className="text-xs text-slate-400 font-medium">Loading command center metrics...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW & ANALYTICS */}
          {activeTab === 'overview' && overview && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Primary KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Total Users */}
                <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-medium uppercase tracking-wider">Total Users</span>
                    <Users className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-white">{overview.stats.totalUsers}</span>
                    <span className="text-[11px] text-emerald-400 font-medium">registered</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/5 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>{usersList.filter((u) => u.role?.toLowerCase() === 'admin').length} Admins</span>
                    <span>{usersList.filter((u) => u.role?.toLowerCase() === 'parent').length} Parents</span>
                  </div>
                </div>

                {/* Total Households */}
                <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-medium uppercase tracking-wider">Households</span>
                    <Home className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-white">{overview.stats.totalHouseholds}</span>
                    <span className="text-[11px] text-emerald-400 font-medium">
                      {overview.stats.activeHouseholds} Active VIP
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/5 text-[11px] text-slate-400">
                    {Math.round((overview.stats.activeHouseholds / (overview.stats.totalHouseholds || 1)) * 100)}% active subscription rate
                  </div>
                </div>

                {/* Recipes Created */}
                <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-medium uppercase tracking-wider">Recipes Saved</span>
                    <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-white">{overview.stats.totalRecipes}</span>
                    <span className="text-[11px] text-purple-400 font-medium">{overview.stats.aiRecipes} AI</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/5 text-[11px] text-slate-400">
                    {overview.stats.totalMealPlans} meals scheduled
                  </div>
                </div>

                {/* Groceries Logged */}
                <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-medium uppercase tracking-wider">Grocery Items</span>
                    <ShoppingCart className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-white">{overview.stats.totalGroceryItems}</span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {overview.stats.checkedGroceryItems} checked
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/5 text-[11px] text-slate-400">
                    {overview.stats.totalCalendarEvents} calendar events
                  </div>
                </div>

                {/* Promo Codes & Redemptions */}
                <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-medium uppercase tracking-wider">Voucher Passes</span>
                    <Ticket className="w-4 h-4 text-pink-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-white">{overview.stats.totalPromoCodes}</span>
                    <span className="text-[11px] text-emerald-400 font-medium">{overview.stats.claimedPromoCodes} claimed</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/5 text-[11px] text-slate-400">
                    {overview.stats.totalPromoCodes - overview.stats.claimedPromoCodes} codes remaining
                  </div>
                </div>

                {/* Feature Requests & Backlog */}
                <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-medium uppercase tracking-wider">Feedback & Bugs</span>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-white">{overview.stats.totalFeedbackRequests}</span>
                    <span className="text-[11px] text-amber-400 font-medium">
                      {overview.stats.openFeedbackRequests} open
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/5 text-[11px] text-slate-400">
                    {overview.stats.totalFeedbackRequests - overview.stats.openFeedbackRequests} resolved
                  </div>
                </div>
              </div>

              {/* Two-Column Activity Feeds */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent User Signups */}
                <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <h2 className="text-sm font-bold text-white">Recent Member Signups</h2>
                    </div>
                    <button
                      onClick={() => setActiveTab('users')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                    >
                      View all →
                    </button>
                  </div>

                  <div className="divide-y divide-white/5 space-y-2">
                    {overview.recentUsers.map((u) => (
                      <div key={u.id} className="pt-2 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          {u.avatar && (u.avatar.startsWith('data:') || u.avatar.startsWith('http')) ? (
                            <img src={u.avatar} alt="" className="w-8 h-8 rounded-xl object-cover" />
                          ) : (
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0"
                              style={{ backgroundColor: u.color || '#10b981' }}
                            >
                              {u.name?.charAt(0)}
                            </div>
                          )}
                          <div className="truncate">
                            <p className="font-bold text-white truncate">{u.name}</p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {u.householdName ? `Family: ${u.householdName}` : u.email || 'Member'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="inline-block text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/5 text-slate-300">
                            {u.role}
                          </span>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Joined'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Code Redemptions */}
                <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-cyan-400" />
                      <h2 className="text-sm font-bold text-white">Recent Voucher Redemptions</h2>
                    </div>
                    <button
                      onClick={() => setActiveTab('codes')}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                    >
                      Manage codes →
                    </button>
                  </div>

                  {overview.recentRedemptions.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">No recent voucher redemptions recorded.</p>
                  ) : (
                    <div className="divide-y divide-white/5 space-y-2">
                      {overview.recentRedemptions.map((r, idx) => (
                        <div key={idx} className="pt-2 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-emerald-400">{r.promoCode}</span>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                                Claimed
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 truncate mt-0.5">
                              👤 {r.userName || 'Member'} {r.householdName ? `("${r.householdName}")` : ''}
                            </p>
                            {r.userEmail && <p className="text-[10px] text-slate-400 truncate">{r.userEmail}</p>}
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {r.redeemedAt ? new Date(r.redeemedAt).toLocaleDateString() : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CURRENT USERS */}
          {activeTab === 'users' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Search & Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/80 border border-white/10 rounded-2xl p-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search users by name, @username, email, or household..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-emerald-400 cursor-pointer"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admins</option>
                    <option value="parent">Parents</option>
                    <option value="member">Members</option>
                    <option value="kid">Kids</option>
                  </select>

                  <select
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-emerald-400 cursor-pointer"
                  >
                    <option value="all">All Subscriptions</option>
                    <option value="active">Active VIP</option>
                    <option value="unpaid">Unpaid / Free</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              {/* Users Count Summary */}
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Showing {filteredUsers.length} of {usersList.length} users</span>
              </div>

              {/* Users Cards / Table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 shadow-md flex flex-col justify-between gap-3 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {u.avatar && (u.avatar.startsWith('data:') || u.avatar.startsWith('http')) ? (
                          <img src={u.avatar} alt="" className="w-11 h-11 rounded-2xl object-cover shrink-0 ring-1 ring-white/10" />
                        ) : (
                          <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white text-sm shrink-0 shadow"
                            style={{ backgroundColor: u.color || '#10b981' }}
                          >
                            {u.name?.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-white text-sm truncate">{u.name}</p>
                            {u.role?.toLowerCase() === 'admin' && (
                              <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-bold">
                                Admin
                              </span>
                            )}
                          </div>
                          {u.username && (
                            <p className="text-[11px] font-mono text-emerald-400">@{u.username}</p>
                          )}
                          {u.email && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-400">
                              <span className="truncate">{u.email}</span>
                              <button
                                onClick={() => copyToClipboard(u.email!, 'Email')}
                                className="hover:text-white cursor-pointer"
                                title="Copy email"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Role Selector & Delete */}
                      <div className="shrink-0 flex items-center gap-2">
                        <div className="text-right">
                          <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                            Role
                          </label>
                          <select
                            value={u.role || 'Member'}
                            onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                            className="bg-slate-800 border border-white/15 text-xs text-emerald-400 font-semibold rounded-xl px-2.5 py-1 focus:outline-none focus:border-emerald-400 cursor-pointer"
                          >
                            <option value="Admin">Admin</option>
                            <option value="Parent">Parent</option>
                            <option value="Member">Member</option>
                            <option value="Kid">Kid</option>
                          </select>
                        </div>

                        <div className="pt-3.5">
                          <button
                            onClick={() => setUserToDelete(u)}
                            disabled={
                              currentUser?.id === u.id ||
                              (Boolean(currentUser?.email) && Boolean(u.email) && currentUser!.email!.toLowerCase() === u.email!.toLowerCase()) ||
                              (Boolean(currentUser?.username) && Boolean(u.username) && currentUser!.username!.toLowerCase() === u.username!.toLowerCase())
                            }
                            title={
                              currentUser?.id === u.id ||
                              (Boolean(currentUser?.email) && Boolean(u.email) && currentUser!.email!.toLowerCase() === u.email!.toLowerCase()) ||
                              (Boolean(currentUser?.username) && Boolean(u.username) && currentUser!.username!.toLowerCase() === u.username!.toLowerCase())
                                ? 'Cannot delete your active administrator account'
                                : `Delete user ${u.name}`
                            }
                            className={`p-2 rounded-xl transition-all cursor-pointer ${
                              currentUser?.id === u.id ||
                              (Boolean(currentUser?.email) && Boolean(u.email) && currentUser!.email!.toLowerCase() === u.email!.toLowerCase()) ||
                              (Boolean(currentUser?.username) && Boolean(u.username) && currentUser!.username!.toLowerCase() === u.username!.toLowerCase())
                                ? 'opacity-20 cursor-not-allowed text-slate-600'
                                : 'text-slate-400 hover:text-red-400 hover:bg-red-500/15 border border-white/5 hover:border-red-500/30'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Household & Usage Stats Bar */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="truncate">
                        <span className="text-slate-500">Family: </span>
                        <span className="text-slate-200 font-medium truncate">{u.householdName || 'Default Family'}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${
                          u.subscriptionStatus === 'active' || u.subscriptionStatus === 'lifetime_founder'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : u.subscriptionStatus === 'expired'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {u.subscriptionStatus === 'lifetime_founder' ? 'VIP Lifetime' : u.subscriptionStatus || 'Unpaid'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CODES & VOUCHERS */}
          {activeTab === 'codes' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Generator Card */}
              <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <Ticket className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-sm sm:text-base font-bold text-white">Generate VIP Access Pass</h2>
                </div>

                <form onSubmit={handleGenerateCode} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Duration */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1.5 uppercase tracking-wider">
                        Pass Duration
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCodeDuration(3)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                            codeDuration === 3
                              ? 'bg-emerald-500 text-slate-950 shadow'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          3 Months
                        </button>
                        <button
                          type="button"
                          onClick={() => setCodeDuration(6)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                            codeDuration === 6
                              ? 'bg-emerald-500 text-slate-950 shadow'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          6 Months
                        </button>
                        <button
                          type="button"
                          onClick={() => setCodeDuration(12)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                            codeDuration === 12
                              ? 'bg-emerald-500 text-slate-950 shadow'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          1 Year
                        </button>
                        <button
                          type="button"
                          onClick={() => setCodeDuration(null)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                            codeDuration === null
                              ? 'bg-emerald-500 text-slate-950 shadow'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          Lifetime VIP
                        </button>
                      </div>
                    </div>

                    {/* Assigned Recipient */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1.5 uppercase tracking-wider">
                        Assign To Recipient / Household
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sarah Miller or The Johnsons"
                        value={codeAssignedTo}
                        onChange={(e) => setCodeAssignedTo(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    {/* Custom Code */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1.5 uppercase tracking-wider">
                        Custom Code Name (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. MILLER2026 (or auto-generate)"
                        value={codeCustomName}
                        onChange={(e) => setCodeCustomName(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 uppercase font-mono"
                      />
                    </div>

                    {/* Max Uses & Submit */}
                    <div className="flex items-end gap-2">
                      <div className="w-24">
                        <label className="text-[11px] font-bold text-slate-300 block mb-1.5 uppercase tracking-wider">
                          Max Uses
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="5000"
                          value={codeMaxUses}
                          onChange={(e) => setCodeMaxUses(parseInt(e.target.value) || 1)}
                          className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isGeneratingCode}
                        className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{isGeneratingCode ? 'Creating...' : 'Create Pass'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Codes Search & Filter */}
              <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/80 border border-white/10 rounded-2xl p-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search codes by code string, recipient, claimant name, or email..."
                    value={codeSearch}
                    onChange={(e) => setCodeSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <select
                  value={codeStatusFilter}
                  onChange={(e) => setCodeStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-emerald-400 cursor-pointer"
                >
                  <option value="all">All Vouchers</option>
                  <option value="claimed">Claimed</option>
                  <option value="unclaimed">Unclaimed</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              {/* Codes List */}
              <div className="space-y-3">
                {filteredCodes.map((c) => {
                  const isClaimed = (c.timesUsed || 0) > 0 || !!c.claimedByUserName;
                  const isEditingThis = editingCodeString === c.code;
                  const isCodeActive = c.isActive === true || c.isActive === 1;

                  return (
                    <div
                      key={c.code}
                      className={`border rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                        isCodeActive
                          ? 'bg-slate-900/90 border-white/10 hover:border-white/20'
                          : 'bg-slate-950/60 border-rose-500/20 opacity-75'
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono text-sm sm:text-base font-black text-emerald-400 tracking-wider">
                            {c.code}
                          </span>
                          <button
                            onClick={() => copyToClipboard(c.code, 'Voucher code')}
                            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Copy code"
                          >
                            {copiedCode === c.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-slate-300">
                            {c.durationMonths ? `${c.durationMonths} Months` : 'Lifetime VIP'}
                          </span>
                          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border ${
                            isCodeActive
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}>
                            {isCodeActive ? 'Active' : 'Disabled'}
                          </span>
                        </div>

                        {/* Assigned Recipient */}
                        {isEditingThis ? (
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={editingAssignedTo}
                              onChange={(e) => setEditingAssignedTo(e.target.value)}
                              placeholder="Assign to person or household..."
                              className="px-2.5 py-1 rounded-lg bg-slate-800 border border-white/20 text-xs text-white"
                            />
                            <button
                              onClick={() => handleSaveAssignedTo(c.code)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingCodeString(null)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-slate-300">
                            <span className="text-slate-400">Assigned To:</span>
                            <span className="font-semibold text-white">
                              {c.assignedTo || 'Unassigned (Open Pass)'}
                            </span>
                            <button
                              onClick={() => {
                                setEditingCodeString(c.code);
                                setEditingAssignedTo(c.assignedTo || '');
                              }}
                              className="p-1 text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer"
                              title="Edit recipient"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Claimant info */}
                        {isClaimed ? (
                          <div className="text-xs text-emerald-400 flex items-center gap-1.5 flex-wrap">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Claimed by <strong>{c.claimedByUserName || 'Member'}</strong>
                              {c.claimedByUserEmail ? ` (${c.claimedByUserEmail})` : ''}
                              {c.claimedByHouseholdName || c.redeemedBy
                                ? ` • Family: "${c.claimedByHouseholdName || c.redeemedBy}"`
                                : ''}
                            </span>
                            {c.claimedAt && (
                              <span className="text-slate-500 text-[10px]">
                                on {new Date(c.claimedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-amber-400/90 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>Unclaimed (0/{c.maxUses || 1} used)</span>
                          </div>
                        )}
                      </div>

                      {/* Code Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => handleToggleCodeActive(c.code, isCodeActive)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            isCodeActive
                              ? 'bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border-white/10 hover:border-amber-500/30'
                              : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {isCodeActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDeleteCode(c.code)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/10 transition-colors cursor-pointer"
                          title="Delete code"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: FEATURE REQUESTS & BUGS */}
          {activeTab === 'feedback' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Search & Type Filters */}
              <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/80 border border-white/10 rounded-2xl p-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search feedback backlog by title, description, or submitter..."
                    value={feedbackSearch}
                    onChange={(e) => setFeedbackSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={feedbackTypeFilter}
                    onChange={(e) => setFeedbackTypeFilter(e.target.value as any)}
                    className="px-3 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-emerald-400 cursor-pointer"
                  >
                    <option value="all">All Types</option>
                    <option value="feature">Features Only</option>
                    <option value="bug">Bugs Only</option>
                  </select>

                  <select
                    value={feedbackStatusFilter}
                    onChange={(e) => setFeedbackStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-emerald-400 cursor-pointer"
                  >
                    <option value="active">Active (Hide Closed & Resolved)</option>
                    <option value="all">All Statuses ({feedbackList.length})</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="planned">Planned</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              {/* Feedback List */}
              <div className="space-y-3">
                {filteredFeedback.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-10">No items match your filter.</p>
                ) : (
                  filteredFeedback.map((f) => {
                    const isResponding = respondingFeedbackId === f.id;

                    return (
                      <div
                        key={f.id}
                        className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-md space-y-3 hover:border-white/20 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                f.type === 'bug'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              }`}>
                                {f.type === 'bug' ? <Bug className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                                <span>{f.type === 'bug' ? 'Bug Report' : 'Feature Request'}</span>
                              </span>

                              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-slate-300 font-bold">
                                Priority: {f.priority}
                              </span>

                              {typeof f.upvotes === 'number' && f.upvotes > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                  <Flame className="w-3 h-3" />
                                  <span>{f.upvotes} votes</span>
                                </span>
                              )}
                            </div>

                            <h3 className="text-sm sm:text-base font-bold text-white pt-1">{f.title}</h3>
                            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{f.description}</p>

                            <p className="text-[11px] text-slate-400 pt-1">
                              Submitted by <strong>{f.submittedByUserName || f.submitted_by_user_name || 'Member'}</strong>
                              {f.submittedByUserEmail || f.submitted_by_user_email ? ` (${f.submittedByUserEmail || f.submitted_by_user_email})` : ''}
                              {f.householdName ? ` • Family: "${f.householdName}"` : ''} • {f.created_at ? new Date(f.created_at).toLocaleDateString() : ''}
                            </p>
                          </div>

                          {/* Quick Status Selector */}
                          <div className="shrink-0 flex items-center gap-2">
                            <select
                              value={f.status}
                              onChange={(e) => handleQuickChangeFeedbackStatus(f.id, e.target.value)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border focus:outline-none cursor-pointer ${
                                f.status === 'resolved'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : f.status === 'in_progress'
                                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                                  : f.status === 'planned'
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                  : f.status === 'closed'
                                  ? 'bg-slate-800 text-slate-400 border-white/10'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              <option value="open">Open</option>
                              <option value="in_progress">In Progress</option>
                              <option value="planned">Planned</option>
                              <option value="resolved">Resolved</option>
                              <option value="closed">Closed</option>
                            </select>

                            <button
                              onClick={() => handleDeleteFeedback(f.id)}
                              className="p-1.5 rounded-xl hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Delete request"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Existing Admin Response */}
                        {(f.adminResponse || f.admin_response) && !isResponding && (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Developer Note from {f.adminRespondedBy || f.admin_responded_by || 'Admin'}</span>
                              </span>
                              <button
                                onClick={() => {
                                  setRespondingFeedbackId(f.id);
                                  setResponseText(f.adminResponse || f.admin_response || '');
                                  setResponseStatus(f.status);
                                }}
                                className="text-[11px] text-emerald-300 hover:underline cursor-pointer"
                              >
                                Edit note
                              </button>
                            </div>
                            <p className="text-slate-200">{f.adminResponse || f.admin_response}</p>
                          </div>
                        )}

                        {/* Response Composer */}
                        {isResponding ? (
                          <div className="bg-slate-800/80 border border-white/10 rounded-xl p-3 space-y-2.5">
                            <textarea
                              rows={3}
                              placeholder="Write a public developer note or resolution explanation for the community..."
                              value={responseText}
                              onChange={(e) => setResponseText(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                            />
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-400 font-bold">Set Status:</span>
                                <select
                                  value={responseStatus}
                                  onChange={(e) => setResponseStatus(e.target.value)}
                                  className="px-2 py-1 rounded-lg bg-slate-900 border border-white/10 text-xs text-slate-200"
                                >
                                  <option value="open">Open</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="planned">Planned</option>
                                  <option value="resolved">Resolved</option>
                                  <option value="closed">Closed</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setRespondingFeedbackId(null)}
                                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSubmitFeedbackResponse(f.id)}
                                  disabled={isSubmittingResponse || !responseText.trim()}
                                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>{isSubmittingResponse ? 'Publishing...' : 'Publish Note'}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : !f.adminResponse && !f.admin_response ? (
                          <button
                            onClick={() => {
                              setRespondingFeedbackId(f.id);
                              setResponseText('');
                              setResponseStatus(f.status);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 font-medium transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Add developer response...</span>
                          </button>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 5: HOUSEHOLDS DIRECTORY */}
          {activeTab === 'households' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Search Bar */}
              <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search households by family name, invite code, or members..."
                    value={householdSearch}
                    onChange={(e) => setHouseholdSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Households Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredHouseholds.map((h) => (
                  <div
                    key={h.id}
                    className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 shadow-md space-y-3 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-white text-sm">{h.name}</h3>
                        <p className="text-[11px] text-slate-400">
                          Created {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${
                          h.subscriptionStatus === 'active' || h.subscriptionStatus === 'lifetime_founder'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {h.subscriptionStatus === 'lifetime_founder' ? 'VIP Lifetime' : h.subscriptionStatus}
                        </span>

                        <button
                          onClick={() => setHouseholdToDelete(h)}
                          disabled={currentUser?.household_id === h.id || (currentUser as any)?.householdId === h.id}
                          title={
                            currentUser?.household_id === h.id || (currentUser as any)?.householdId === h.id
                              ? 'Cannot delete your active household'
                              : `Delete household ${h.name}`
                          }
                          className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                            currentUser?.household_id === h.id || (currentUser as any)?.householdId === h.id
                              ? 'opacity-20 cursor-not-allowed text-slate-600'
                              : 'text-slate-400 hover:text-red-400 hover:bg-red-500/15 border border-white/5 hover:border-red-500/30'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">Invite Code:</span>
                      <span className="font-mono font-bold text-emerald-400">{h.inviteCode}</span>
                      <button
                        onClick={() => copyToClipboard(h.inviteCode, 'Invite code')}
                        className="p-1 hover:text-white text-slate-400 cursor-pointer"
                        title="Copy invite code"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>

                    {h.memberNames && (
                      <div className="text-xs text-slate-300">
                        <span className="text-slate-400">Members ({h.memberCount}): </span>
                        <span>{h.memberNames}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{h.recipeCount || 0} recipes</span>
                      <span>{h.groceryCount || 0} grocery items</span>
                      <span>{h.eventCount || 0} events</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete User Account</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <div className="bg-slate-800/80 border border-white/10 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
              <p>
                Are you sure you want to permanently delete <strong className="text-white">{userToDelete.name}</strong>?
              </p>
              <div className="text-[11px] text-slate-400 font-mono space-y-0.5 pt-1">
                {userToDelete.username && <p>Username: @{userToDelete.username}</p>}
                {userToDelete.email && <p>Email: {userToDelete.email}</p>}
                {userToDelete.householdName && <p>Household: {userToDelete.householdName}</p>}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={handleCloseDeleteModals}
                disabled={isDeletingUser}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={isDeletingUser}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeletingUser ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete User</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Household Confirmation Modal */}
      {householdToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Household</h3>
                <p className="text-xs text-slate-400">This action permanently deletes all household data.</p>
              </div>
            </div>

            <div className="bg-slate-800/80 border border-white/10 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
              <p>
                Are you sure you want to permanently delete <strong className="text-white">{householdToDelete.name}</strong> and all associated data?
              </p>
              <div className="text-[11px] text-slate-400 space-y-0.5 pt-1">
                <p>Invite Code: <span className="font-mono text-emerald-400 font-bold">{householdToDelete.inviteCode}</span></p>
                {householdToDelete.memberNames && <p>Members: {householdToDelete.memberNames}</p>}
                <p className="text-rose-400 pt-1 font-semibold">
                  ⚠️ This will delete all user accounts, meal plans, recipes, calendar events, and grocery items in this household!
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={handleCloseDeleteModals}
                disabled={isDeletingHousehold}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteHousehold}
                disabled={isDeletingHousehold}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeletingHousehold ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Household</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminPage;
