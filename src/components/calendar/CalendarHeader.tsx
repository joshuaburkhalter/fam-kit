import React, { useRef, useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  ChevronDown,
  Loader2,
  Camera,
} from 'lucide-react';
import type { User } from '../../types';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'schedule';

interface CalendarHeaderProps {
  title: string;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  selectedMemberId: string;
  onSelectMember: (memberId: string) => void;
  users: User[];
  isLoading: boolean;
  isSyncing: boolean;
  onAddEvent: () => void;
  onScanPhoto?: () => void;
  onSyncGoogle: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  title,
  viewMode,
  onViewModeChange,
  onPrev,
  onNext,
  onToday,
  selectedMemberId,
  onSelectMember,
  users,
  isLoading,
  isSyncing,
  onAddEvent,
  onScanPhoto,
  onSyncGoogle,
}) => {
  const [isSyncMenuOpen, setIsSyncMenuOpen] = useState(false);
  const syncMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (syncMenuRef.current && !syncMenuRef.current.contains(event.target as Node)) {
        setIsSyncMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-3">
      {/* Top Main Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-3 sm:p-4 shadow-xl">
        {/* Left Cluster: Brand, Today, Nav Arrows, and Month Title */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Logo / Brand - Hidden on mobile to save vertical space */}
          <div className="hidden md:flex items-center gap-2 mr-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-slate-950 shrink-0">
              <CalendarIcon className="w-5 h-5 stroke-[2.2]" />
            </div>
            <h1 className="text-xl font-black text-white hidden xl:inline">Calendar</h1>
            {isLoading && !isSyncing && <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />}
          </div>

          {/* Today Button */}
          <button
            type="button"
            onClick={onToday}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/10 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            Today
          </button>

          {/* Prev / Next Arrows */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onPrev}
              className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onNext}
              className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Main Month / Date Title (Google Calendar style) */}
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight ml-1.5 truncate">
            {title}
          </h2>
        </div>

        {/* Right Cluster: View Selector + Add / Sync */}
        <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-2.5">
          {/* View Selector: Month | Week | Day | Schedule */}
          <div className="flex items-center bg-slate-950/70 rounded-2xl p-1 border border-white/10 text-xs font-bold">
            {(['month', 'week', 'day', 'schedule'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onViewModeChange(mode)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl capitalize transition-all cursor-pointer ${
                  viewMode === mode
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/25 scale-[1.02]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode === 'schedule' ? 'Agenda' : mode}
              </button>
            ))}
          </div>

          {/* Add Event & Sync Dropdown (Desktop) */}
          <div className="hidden md:block relative" ref={syncMenuRef}>
            <button
              type="button"
              onClick={() => setIsSyncMenuOpen(!isSyncMenuOpen)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-black transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Add Event</span>
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 stroke-[2.5] animate-spin" />
              ) : (
                <ChevronDown
                  className={`w-3.5 h-3.5 stroke-[2.5] transition-transform duration-200 ${
                    isSyncMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              )}
            </button>

            {isSyncMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-1.5 shadow-2xl shadow-slate-950/80 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                {/* Add Event */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSyncMenuOpen(false);
                    onAddEvent();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500/25 flex items-center justify-center shrink-0 transition-colors">
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white">Add Event</div>
                    <div className="text-[10px] text-slate-400">Schedule on calendar</div>
                  </div>
                </button>

                {/* AI Photo Scan */}
                {onScanPhoto && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSyncMenuOpen(false);
                      onScanPhoto();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-400 group-hover:bg-purple-500/25 flex items-center justify-center shrink-0 transition-colors">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white">Photo Scan</div>
                      <div className="text-[10px] text-slate-400">Scan flyer or schedule</div>
                    </div>
                  </button>
                )}

                {/* Sync with Google Calendar */}
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => {
                    setIsSyncMenuOpen(false);
                    onSyncGoogle();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer group disabled:opacity-50"
                >
                  <div className="w-7 h-7 rounded-lg bg-teal-500/15 text-teal-400 group-hover:bg-teal-500/25 flex items-center justify-center shrink-0 transition-colors">
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white">
                      {isSyncing ? 'Syncing...' : 'Sync with Google'}
                    </div>
                    <div className="text-[10px] text-slate-400">Refresh Google Calendar</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-Bar: Family Member Filters */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 px-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1 shrink-0">
          Filter:
        </span>
        <button
          type="button"
          onClick={() => onSelectMember('all')}
          className={`h-7 px-3 rounded-full text-xs font-bold transition-all shrink-0 flex items-center justify-center cursor-pointer ${
            selectedMemberId === 'all'
              ? 'bg-emerald-500 text-slate-950 shadow-xs'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-white/10'
          }`}
        >
          All Members
        </button>

        {users.map((u) => {
          const isSelected = selectedMemberId === u.id;
          const initial = (u.name || 'U').charAt(0).toUpperCase();
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelectMember(isSelected ? 'all' : u.id)}
              className={`h-7 px-2.5 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-slate-800 text-white ring-2 ring-emerald-400 border border-white/20'
                  : selectedMemberId !== 'all'
                  ? 'opacity-40 hover:opacity-100 bg-slate-900 text-slate-400 border border-white/5'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white border border-white/10'
              }`}
            >
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                style={{ backgroundColor: u.avatar_color || '#10b981' }}
              >
                {initial}
              </div>
              <span className="truncate max-w-[100px]">{u.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
