import React, { useState } from 'react';
import {
  Users,
  Copy,
  Check,
  UserPlus,
  KeyRound,
  Trash2,
  Loader2,
} from 'lucide-react';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';

const AVATAR_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ef4444', // Red
];

export const FamilyPage: React.FC = () => {
  const { household, users, currentUser, refreshHouseholdsAndUsers } =
    usePWA();
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'parent' | 'child' | 'member'>('member');
  const [newMemberColor, setNewMemberColor] = useState(AVATAR_COLORS[0]);
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [joinUserName, setJoinUserName] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCopyCode = () => {
    if (household?.invite_code) {
      navigator.clipboard.writeText(household.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleConfirmDelete = async () => {
    if (!memberToDelete) return;
    try {
      setIsDeleting(true);
      await api.deleteUser(memberToDelete.id);
      await refreshHouseholdsAndUsers();
      setFeedback(`Removed ${memberToDelete.name} from household.`);
      setMemberToDelete(null);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      alert(err.message || 'Failed to remove member');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !newMemberName.trim()) return;

    try {
      setIsSubmitting(true);
      await api.createUser(
        household.id,
        newMemberName.trim(),
        newMemberColor,
        newMemberRole
      );
      setNewMemberName('');
      await refreshHouseholdsAndUsers();
      setFeedback('Family member added successfully!');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error('Failed to add member:', err);
      alert(err.message || 'Failed to add member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInviteCode.trim() || !joinUserName.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await api.joinHouseholdByCode(
        joinInviteCode.trim().toUpperCase(),
        joinUserName.trim()
      );
      await refreshHouseholdsAndUsers();
      setFeedback(`Joined household: ${res.household.name}!`);
      setJoinInviteCode('');
      setJoinUserName('');
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      console.error('Join failed:', err);
      alert(err.message || 'Invalid invite code or join failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-4 pb-24 md:pb-12 space-y-6">
      {/* Top Banner: Household Details */}
      <div className="p-6 rounded-3xl glass-panel border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">{household?.name || 'Household'}</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your family household profiles, shared lists, and devices
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {users.length} {users.length === 1 ? 'Member' : 'Members'}
        </div>
      </div>

      {/* Full-Width Family Invite Code Card */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Family Household Invite Code</h2>
            <p className="text-xs text-slate-400">
              Share this 6-character code with family members to connect their phones & tablets
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/20">
          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider hidden sm:block">
              Invite Code:
            </div>
            <div className="text-3xl font-black font-mono tracking-[0.25em] text-emerald-400 select-all">
              {household?.invite_code || 'HOMEBASE'}
            </div>
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {copiedCode ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Invite Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-xs font-semibold animate-in fade-in">
          <Check className="w-4 h-4" />
          {feedback}
        </div>
      )}

      {/* Household Members List */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" />
          Family Members ({users.length})
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {users.map((u) => {
            const isCurrent = currentUser?.id === u.id;
            return (
              <div
                key={u.id}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                  isCurrent
                    ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20'
                    : 'bg-slate-900/60 border-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black text-white shadow-md"
                    style={{ backgroundColor: u.avatar_color }}
                  >
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      {u.name}
                      {isCurrent && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                          You
                        </span>
                      )}
                    </h4>
                    <span className="text-[11px] text-slate-400 capitalize">
                      {u.role || 'Member'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {isCurrent && (
                    <span title="Currently active profile" className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <Check className="w-3.5 h-3.5 font-bold" />
                    </span>
                  )}
                  {users.length > 1 && (
                    <button
                      type="button"
                      title={`Remove ${u.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMemberToDelete(u);
                      }}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/15 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2-Column: Add Member Form & Join Household Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Add Member Card */}
        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-400" />
            Add Family Profile
          </h3>

          <form onSubmit={handleAddMember} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Maya, Leo, Grandpa Joe..."
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
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
                  <option value="member">Family Member</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Color</label>
                <div className="flex items-center gap-1.5 pt-1">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setNewMemberColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full transition-transform ${
                        newMemberColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-70'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!newMemberName.trim() || isSubmitting}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-colors shadow-lg shadow-emerald-500/20 mt-2"
            >
              Add Family Member
            </button>
          </form>
        </div>

        {/* Join Household with Code Card */}
        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-400" />
            Join Existing Household
          </h3>
          <p className="text-xs text-slate-400">
            Have a 6-character invite code from a family member? Enter it here to join their shared lists.
          </p>

          <form onSubmit={handleJoinHousehold} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Household Invite Code
              </label>
              <input
                type="text"
                required
                maxLength={8}
                placeholder="e.g. HOMEBASE"
                value={joinInviteCode}
                onChange={(e) => setJoinInviteCode(e.target.value.toUpperCase())}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-sm font-mono tracking-widest uppercase text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Your Name
              </label>
              <input
                type="text"
                required
                placeholder="Your first name"
                value={joinUserName}
                onChange={(e) => setJoinUserName(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={!joinInviteCode.trim() || !joinUserName.trim() || isSubmitting}
              className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-lg shadow-indigo-500/20 mt-2"
            >
              Join Household
            </button>
          </form>
        </div>
      </div>

      {/* Confirmation Modal for Removing a Member */}
      {memberToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center border border-red-500/30 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Remove Family Member</h3>
                <p className="text-xs text-slate-400">Confirm removal of this profile</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-3.5 rounded-2xl border border-white/5">
              Are you sure you want to remove <span className="text-white font-bold">{memberToDelete.name}</span> from the household?
              {memberToDelete.id === currentUser?.id && (
                <span className="block mt-2 text-amber-400 font-medium">
                  ⚠️ This is your currently active profile. After removal, your active profile will switch to another household member.
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {isDeleting ? 'Removing...' : 'Remove Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
