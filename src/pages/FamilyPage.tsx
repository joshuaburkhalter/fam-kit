import React, { useState } from 'react';
import {
  Users,
  Copy,
  Check,
  UserPlus,
  Shield,
  Heart,
  KeyRound,
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
  const { household, users, currentUser, setCurrentUser, refreshHouseholdsAndUsers } =
    usePWA();
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'parent' | 'child' | 'member'>('member');
  const [newMemberColor, setNewMemberColor] = useState(AVATAR_COLORS[0]);
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [joinUserName, setJoinUserName] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleCopyCode = () => {
    if (household?.invite_code) {
      navigator.clipboard.writeText(household.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
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
      {/* Top Banner */}
      <div className="p-6 rounded-3xl glass-panel border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white">{household?.name || 'Household'}</h1>
            <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-medium">
              Active Family
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Share this invite code with family members to connect their phones & tablets
          </p>
        </div>

        {/* 6-Character Invite Code Badge */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-emerald-500/30 p-2.5 rounded-2xl">
          <KeyRound className="w-4 h-4 text-emerald-400" />
          <div className="text-left">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Family Invite Code
            </div>
            <div className="text-base font-black font-mono tracking-widest text-emerald-400">
              {household?.invite_code || 'FAMKIT'}
            </div>
          </div>
          <button
            onClick={handleCopyCode}
            className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 ml-2 transition-colors"
          >
            {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
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
                onClick={() => setCurrentUser(u)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  isCurrent
                    ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20'
                    : 'bg-slate-900/60 border-white/5 hover:border-white/15'
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
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-normal">
                          Active (You)
                        </span>
                      )}
                    </h4>
                    <span className="text-[11px] text-slate-400 capitalize">
                      {u.role || 'Member'}
                    </span>
                  </div>
                </div>

                {isCurrent && <Check className="w-4 h-4 text-emerald-400 font-bold" />}
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
                6-Digit Invite Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="e.g. FAMKIT"
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
    </div>
  );
};
