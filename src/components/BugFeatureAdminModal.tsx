import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Bug,
  Sparkles,
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  Send,
  Trash2,
  Search,
  MessageSquare,
  AlertTriangle,
  Flame,
  Check,
  Filter,
  ChevronUp,
  ArrowUpDown,
} from 'lucide-react';
import type { FeedbackRequest } from '../types';
import { isUserAdmin } from '../types';
import { api } from '../lib/api';
import { usePWA } from '../context/PWAContext';

interface BugFeatureAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCountChange?: (openCount: number) => void;
}

export const BugFeatureAdminModal: React.FC<BugFeatureAdminModalProps> = ({
  isOpen,
  onClose,
  onCountChange,
}) => {
  const { currentUser } = usePWA();
  const [requests, setRequests] = useState<FeedbackRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [typeFilter, setTypeFilter] = useState<'all' | 'bug' | 'feature'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'votes' | 'newest'>('votes');
  const [searchQuery, setSearchQuery] = useState('');
  const [votingId, setVotingId] = useState<string | null>(null);

  const isAdmin = isUserAdmin(currentUser);

  // Active Response Editor
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<'open' | 'in_progress' | 'planned' | 'resolved' | 'closed'>('in_progress');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // New Request Form State
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newType, setNewType] = useState<'bug' | 'feature'>('bug');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadRequests = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getFeedbackRequests();
      setRequests(data);
      const openCount = data.filter((r) => r.status === 'open' || r.status === 'in_progress').length;
      onCountChange?.(openCount);
    } catch (err: any) {
      console.error('Failed to load feedback requests:', err);
      setError(err?.message || 'Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  };

  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 320);
  };

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      loadRequests();
      setIsCreatingNew(false);
      setEditingId(null);
      document.body.style.overflow = 'hidden';

      // Smooth double-RAF to ensure DOM is painted before slide-in transform starts
      const animTimer = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') handleClose();
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        cancelAnimationFrame(animTimer);
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
        document.body.style.overflow = '';
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isRendered) return null;

  const handleStartReply = (req: FeedbackRequest) => {
    setEditingId(req.id);
    setReplyText(req.admin_response || '');
    setReplyStatus(req.status);
  };

  const handleSaveReply = async (id: string) => {
    if (!replyText.trim()) {
      alert('Please enter a response message.');
      return;
    }
    setIsSubmittingReply(true);
    try {
      const updated = await api.updateFeedbackRequest(id, {
        adminResponse: replyText.trim(),
        status: replyStatus,
      });

      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setEditingId(null);
      showToast('Response saved & status updated!');
      const openCount = requests
        .map((r) => (r.id === id ? updated : r))
        .filter((r) => r.status === 'open' || r.status === 'in_progress').length;
      onCountChange?.(openCount);
    } catch (err: any) {
      console.error('Failed to save response:', err);
      alert(err.message || 'Failed to save response.');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleDeleteRequest = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await api.deleteFeedbackRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      showToast('Request deleted.');
      const openCount = requests.filter((r) => r.id !== id && (r.status === 'open' || r.status === 'in_progress')).length;
      onCountChange?.(openCount);
    } catch (err: any) {
      console.error('Failed to delete request:', err);
      alert(err.message || 'Failed to delete request.');
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;

    setIsSubmittingNew(true);
    try {
      const created = await api.createFeedbackRequest({
        type: newType,
        title: newTitle.trim(),
        description: newDescription.trim(),
        priority: newPriority,
      });

      setRequests((prev) => [created, ...prev]);
      setIsCreatingNew(false);
      setNewTitle('');
      setNewDescription('');
      setNewPriority('medium');
      showToast('Request logged successfully!');
      const openCount = [created, ...requests].filter((r) => r.status === 'open' || r.status === 'in_progress').length;
      onCountChange?.(openCount);
    } catch (err: any) {
      console.error('Failed to create request:', err);
      alert(err.message || 'Failed to create request.');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleVote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (votingId) return;
    setVotingId(id);

    // Optimistic UI update
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const currentVoted = Boolean(r.hasUpvoted || r.has_upvoted);
        const currentVotes = typeof r.upvotes === 'number' ? r.upvotes : 0;
        return {
          ...r,
          hasUpvoted: !currentVoted,
          has_upvoted: !currentVoted,
          upvotes: currentVoted ? Math.max(0, currentVotes - 1) : currentVotes + 1,
        };
      })
    );

    try {
      const updated = await api.upvoteFeedbackRequest(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err: any) {
      console.error('Failed to vote:', err);
      loadRequests();
    } finally {
      setVotingId(null);
    }
  };

  // Filter & Search Logic
  const filteredRequests = requests
    .filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = r.title.toLowerCase().includes(q);
        const matchesDesc = r.description.toLowerCase().includes(q);
        const matchesUser = (r.submitted_by_user_name || '').toLowerCase().includes(q);
        const matchesHousehold = (r.household_name || '').toLowerCase().includes(q);
        return matchesTitle || matchesDesc || matchesUser || matchesHousehold;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'votes') {
        const diff = (b.upvotes || 0) - (a.upvotes || 0);
        if (diff !== 0) return diff;
        return new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime();
      }
      return new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime();
    });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <Flame className="w-2.5 h-2.5 text-rose-400" />
            Critical
          </span>
        );
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
            High
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/25">
            Medium
          </span>
        );
      case 'low':
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-700/50 text-slate-300 border border-white/10">
            Low
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            In Progress
          </span>
        );
      case 'planned':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            Planned
          </span>
        );
      case 'resolved':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <Check className="w-2.5 h-2.5 text-emerald-400" />
            Resolved
          </span>
        );
      case 'closed':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-400 border border-white/10">
            Closed
          </span>
        );
      case 'open':
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            Open
          </span>
        );
    }
  };

  const openBugsCount = requests.filter((r) => r.type === 'bug' && (r.status === 'open' || r.status === 'in_progress')).length;
  const openFeaturesCount = requests.filter((r) => r.type === 'feature' && (r.status === 'open' || r.status === 'in_progress')).length;

  const drawerContent = (
    <div className="fixed inset-0 z-[9999] flex justify-end">
      {/* Semi-transparent backdrop with smooth fade transition */}
      <div
        className={`fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity duration-300 ease-out cursor-pointer ${
          isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleClose}
      />

      {/* Slide-out Drawer Panel with fluid cubic-bezier spring slide */}
      <div
        className={`relative z-10 w-full max-w-full sm:max-w-xl md:max-w-2xl h-full bg-[#0a0f1d] border-l border-white/10 shadow-2xl shadow-black flex flex-col overflow-hidden transition-transform duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-[#0a0f1d] to-slate-900 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 shrink-0">
              <Bug className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                  Bug & Feature Tracker
                </h2>
                {isAdmin ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider shrink-0">
                    Admin
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider shrink-0">
                    Community
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {isAdmin
                  ? 'Manage community feedback, update statuses, and post official replies'
                  : 'Upvote family requests, track progress, and submit new ideas'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsCreatingNew(!isCreatingNew)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">{isCreatingNew ? 'View List' : 'New Request'}</span>
              <span className="sm:hidden">{isCreatingNew ? 'List' : 'New'}</span>
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/30 text-emerald-300 text-xs font-semibold px-4 py-2 text-center animate-in fade-in">
            ✓ {toastMessage}
          </div>
        )}

        {/* Body Content */}
        {isCreatingNew ? (
          /* New Request Form */
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                Submit a Bug Report or Feature Request
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Log a new item directly to the tracker for investigation or future development.
              </p>
            </div>

            <form onSubmit={handleCreateNew} className="space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Category
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewType('bug')}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                      newType === 'bug'
                        ? 'bg-rose-500/20 border-rose-500/50 text-white shadow-md shadow-rose-500/10'
                        : 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${newType === 'bug' ? 'bg-rose-500 text-slate-950' : 'bg-white/5 text-rose-400'}`}>
                      <Bug className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block">Bug Report</span>
                      <span className="text-[11px] opacity-75">Something is broken or behaving unexpectedly</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewType('feature')}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                      newType === 'feature'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-white shadow-md shadow-emerald-500/10'
                        : 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${newType === 'feature' ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 text-emerald-400'}`}>
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block">Feature Request</span>
                      <span className="text-[11px] opacity-75">An idea or improvement for the app</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Title / Short Summary
                </label>
                <input
                  type="text"
                  required
                  placeholder={newType === 'bug' ? 'e.g. Google Calendar event shows 1 hour off on iOS' : 'e.g. Add ability to scan receipt photos'}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Details & Steps
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder={newType === 'bug' ? 'Describe what happened, what device you were using, and how to reproduce it...' : 'Describe why this feature would be helpful and how you envision it working...'}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Priority
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPriority(p)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer border ${
                        newPriority === p
                          ? p === 'critical'
                            ? 'bg-rose-500 text-slate-950 border-rose-400 shadow-md'
                            : p === 'high'
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                            : p === 'medium'
                            ? 'bg-blue-500 text-slate-950 border-blue-400 shadow-md'
                            : 'bg-slate-700 text-white border-white/20'
                          : 'bg-slate-900/80 text-slate-400 border-white/5 hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew || !newTitle.trim() || !newDescription.trim()}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Save Request</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* List & Management View */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Filter Bar */}
            <div className="p-3 sm:p-4 border-b border-white/10 bg-slate-950/40 space-y-3">
              {/* Category Tabs */}
              <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setTypeFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      typeFilter === 'all'
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-white/5'
                    }`}
                  >
                    All ({requests.length})
                  </button>
                  <button
                    onClick={() => setTypeFilter('bug')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      typeFilter === 'bug'
                        ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-white/5'
                    }`}
                  >
                    <Bug className="w-3.5 h-3.5 text-rose-400" />
                    <span>Bugs ({requests.filter((r) => r.type === 'bug').length})</span>
                    {openBugsCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                    )}
                  </button>
                  <button
                    onClick={() => setTypeFilter('feature')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      typeFilter === 'feature'
                        ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-white/5'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>Features ({requests.filter((r) => r.type === 'feature').length})</span>
                    {openFeaturesCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {/* Status Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="all">All Statuses</option>
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="planned">Planned</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  {/* Sort Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="votes">Most Upvoted</option>
                      <option value="newest">Newest First</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by title, description, or submitter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Cards List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoading ? (
                <div className="py-16 text-center space-y-3 text-xs text-slate-400">
                  <Loader2 className="w-7 h-7 animate-spin text-emerald-400 mx-auto" />
                  <p>Loading bug reports and feature requests...</p>
                </div>
              ) : error ? (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {error}
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="py-16 text-center glass-panel rounded-3xl p-8 border border-white/5 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">No requests found</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                      ? 'Try clearing your filters or search query.'
                      : 'All caught up! No bug reports or feature requests logged yet.'}
                  </p>
                  <button
                    onClick={() => setIsCreatingNew(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Log First Request</span>
                  </button>
                </div>
              ) : (
                filteredRequests.map((req) => {
                  const isEditing = editingId === req.id;
                  const isBug = req.type === 'bug';
                  return (
                    <div
                      key={req.id}
                      className="glass-panel rounded-2xl border border-white/10 p-4 space-y-3 hover:border-white/20 transition-all shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        {/* Upvote Pill Button (Only once per person per request) */}
                        <button
                          type="button"
                          onClick={(e) => handleVote(req.id, e)}
                          disabled={votingId === req.id}
                          title={req.hasUpvoted || req.has_upvoted ? 'You upvoted this (click to undo)' : 'Upvote this request'}
                          className={`flex flex-col items-center justify-center py-2 px-2.5 rounded-2xl border transition-all cursor-pointer shrink-0 min-w-[48px] active:scale-95 ${
                            req.hasUpvoted || req.has_upvoted
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/20'
                              : 'bg-slate-900/80 hover:bg-slate-800 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                          }`}
                        >
                          <ChevronUp
                            className={`w-5 h-5 transition-transform ${
                              req.hasUpvoted || req.has_upvoted
                                ? 'stroke-[3] text-amber-400 -translate-y-0.5'
                                : 'stroke-[2]'
                            }`}
                          />
                          <span
                            className={`text-xs font-black font-mono mt-0.5 ${
                              req.hasUpvoted || req.has_upvoted ? 'text-amber-300' : 'text-slate-300'
                            }`}
                          >
                            {typeof req.upvotes === 'number' ? req.upvotes : 0}
                          </span>
                        </button>

                        <div className="flex-1 min-w-0 space-y-2.5">
                          {/* Top Meta Line */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                  isBug
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                }`}
                              >
                                {isBug ? <Bug className="w-3 h-3 text-rose-400" /> : <Sparkles className="w-3 h-3 text-purple-400" />}
                                {isBug ? 'Bug' : 'Feature'}
                              </span>
                              {getStatusBadge(req.status)}
                              {getPriorityBadge(req.priority)}
                            </div>

                            {/* Only admin can delete */}
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteRequest(req.id, req.title)}
                                title="Delete Request (Admin Only)"
                                className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Title & Description */}
                          <div>
                            <h4 className="text-sm font-bold text-white tracking-tight">{req.title}</h4>
                            <p className="text-xs text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap selectable-text">
                              {req.description}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Submitter & Date info */}
                      <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                        <div className="truncate">
                          <span>Submitted by </span>
                          <strong className="text-slate-300">{req.submitted_by_user_name}</strong>
                          {req.household_name && (
                            <span className="text-slate-400"> ({req.household_name})</span>
                          )}
                          {req.submitted_by_user_email && (
                            <span className="text-slate-500 hidden sm:inline"> • {req.submitted_by_user_email}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(req.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>

                      {/* Admin Response Box (if exists and not editing) */}
                      {req.admin_response && !isEditing && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5" />
                              Official Admin Response
                              {req.admin_responded_by && (
                                <span className="font-normal text-emerald-300/80">({req.admin_responded_by})</span>
                              )}
                            </span>
                            {req.admin_responded_at && (
                              <span className="text-[10px] text-emerald-300/60">
                                {new Date(req.admin_responded_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {req.admin_response}
                          </p>
                        </div>
                      )}

                      {/* Action Bar / Inline Reply Editor - ADMIN ONLY */}
                      {isAdmin && (
                        isEditing ? (
                          <div className="p-3 rounded-2xl bg-slate-900 border border-white/10 space-y-3 animate-in fade-in duration-100">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                                Admin Response & Status
                              </span>
                              <div className="flex items-center gap-2">
                                <label className="text-[11px] font-semibold text-slate-400">Status:</label>
                                <select
                                  value={replyStatus}
                                  onChange={(e) => setReplyStatus(e.target.value as any)}
                                  className="bg-slate-950 border border-white/15 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                                >
                                  <option value="open">Open</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="planned">Planned</option>
                                  <option value="resolved">Resolved</option>
                                  <option value="closed">Closed</option>
                                </select>
                              </div>
                            </div>

                            <textarea
                              rows={3}
                              placeholder="Type your response to the user or team..."
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                            />

                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={isSubmittingReply || !replyText.trim()}
                                onClick={() => handleSaveReply(req.id)}
                                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 px-4 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
                              >
                                {isSubmittingReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3 h-3" />}
                                <span>Save & Publish</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end pt-1">
                            <button
                              onClick={() => handleStartReply(req)}
                              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/5 hover:border-white/15 cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{req.admin_response ? 'Edit Response / Status' : 'Respond / Update Status'}</span>
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Drawer Footer */}
        <div className="p-3.5 sm:p-4 border-t border-white/10 bg-slate-950/80 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 text-[11px] truncate max-w-[240px] sm:max-w-none">
            Logged in as: <strong className="text-slate-300">{currentUser?.name}</strong> ({currentUser?.email || currentUser?.username})
          </span>
          <button
            onClick={handleClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors cursor-pointer"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(drawerContent, document.body);
  }
  return drawerContent;
};
