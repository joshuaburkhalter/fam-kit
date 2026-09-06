'use client';

import React, { useState } from 'react';
import { usePWA } from '@/components/pwa/PWAProvider';
import {
  Users,
  Copy,
  Check,
  Plus,
  UserPlus,
  Shield,
  Heart,
  Sparkles,
  Trash2,
  X,
  LogIn
} from 'lucide-react';

export default function FamilyPage() {
  const { household, activeMember, setActiveMember, refreshFamily } = usePWA();
  const [copied, setCopied] = useState(false);

  // Modals
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Add Member inputs
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Parent');
  const [newMemberAvatar, setNewMemberAvatar] = useState('👤');
  const [newMemberColor, setNewMemberColor] = useState('#6366f1');

  // Join inputs
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  // Copy invite code to clipboard
  const handleCopyInviteCode = () => {
    if (!household?.inviteCode) return;
    navigator.clipboard.writeText(household.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Add New Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    try {
      const res = await fetch('/api/family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMemberName.trim(),
          avatar: newMemberAvatar || '👤',
          role: newMemberRole || 'Member',
          color: newMemberColor || '#6366f1',
        }),
      });

      if (res.ok) {
        await refreshFamily();
        setShowAddMemberModal(false);
        setNewMemberName('');
      }
    } catch (err) {
      console.error('Failed to add member:', err);
    }
  };

  // Join Family with Invite Code
  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinError(null);

    try {
      const res = await fetch('/api/family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join_with_code',
          inviteCode: joinCode.trim(),
          name: joinName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to join family');
      }

      await refreshFamily();
      setShowJoinModal(false);
      setJoinCode('');
      setJoinName('');
      alert('Joined family household successfully!');
    } catch (err: any) {
      setJoinError(err.message);
    }
  };

  // Delete / Remove Member
  const handleRemoveMember = async (id: string) => {
    if (!confirm('Remove this family member?')) return;

    try {
      await fetch(`/api/family?memberId=${id}`, { method: 'DELETE' });
      await refreshFamily();
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const sampleAvatars = ['👨‍💻', '👩‍🏫', '👦', '👧', '👶', '🐶', '🐱', '👴', '👵', '🧑‍🍳'];
  const sampleColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6'];

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
          <Users className="w-7 h-7 text-emerald-400" />
          Family & Household
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage family members, share invite codes, and synchronize grocery lists, meal plans, and calendars.
        </p>
      </div>

      {/* Household Invite Code Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-center sm:justify-start gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {household?.name || 'Our Family Household'}
          </div>
          <h2 className="text-lg font-bold text-white">Family Invite Code</h2>
          <p className="text-xs text-slate-400 max-w-md">
            Share this 6-character code with your spouse, kids, or roommates to join your shared family board.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-5 py-3 rounded-2xl bg-slate-950 border border-emerald-500/40 font-mono text-2xl font-black text-emerald-300 tracking-widest shadow-inner">
            {household?.inviteCode || 'FAMKIT'}
          </div>

          <button
            onClick={handleCopyInviteCode}
            className={`p-3.5 rounded-2xl transition-all ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Copy Invite Code"
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowAddMemberModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all hover:scale-102"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Family Member</span>
        </button>

        <button
          onClick={() => setShowJoinModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
        >
          <LogIn className="w-4 h-4" />
          <span>Join Existing Family</span>
        </button>
      </div>

      {/* Member Roster */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Family Roster ({household?.members?.length || 0} Members)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {household?.members?.map((member) => {
            const isActive = activeMember?.id === member.id;

            return (
              <div
                key={member.id}
                onClick={() => setActiveMember(member)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  isActive
                    ? 'glass-panel border-emerald-500/60 shadow-lg shadow-emerald-950/40 bg-slate-900/90'
                    : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/10"
                    style={{ backgroundColor: `${member.color}25` }}
                  >
                    {member.avatar}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">{member.name}</span>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30">
                          Active User
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Shield className="w-3 h-3 text-slate-500" />
                      {member.role}
                    </span>
                  </div>
                </div>

                {household.members.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveMember(member.id);
                    }}
                    className="p-2 rounded-xl text-slate-600 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                Add Family Member
              </h3>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Name</label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Leo, Sarah, Dad"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Role</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="Parent">Parent</option>
                  <option value="Kid">Kid</option>
                  <option value="Member">Member</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">Avatar Emoji</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {sampleAvatars.map((av) => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => setNewMemberAvatar(av)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                        newMemberAvatar === av
                          ? 'bg-emerald-600 scale-110 shadow-md shadow-emerald-600/30'
                          : 'bg-slate-950 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">Accent Color</label>
                <div className="flex items-center gap-2.5">
                  {sampleColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewMemberColor(color)}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        newMemberColor === color ? 'scale-125 ring-2 ring-white' : 'opacity-80'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newMemberName.trim()}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-emerald-600/30"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Family Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <LogIn className="w-5 h-5 text-emerald-400" />
                Join Family Household
              </h3>
              <button
                onClick={() => setShowJoinModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleJoinWithCode} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  6-Character Family Invite Code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. FAMKIT"
                  maxLength={10}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-emerald-300"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Your Name</label>
                <input
                  type="text"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="Your display name in this family"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white"
                />
              </div>

              {joinError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                  {joinError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!joinCode.trim()}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-emerald-600/30"
                >
                  Join Household
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
