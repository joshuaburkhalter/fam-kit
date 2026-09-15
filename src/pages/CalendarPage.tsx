import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Clock,
  MapPin,
  ChevronDown,
  X,
  Loader2,
  Filter,
  ArrowDown,
  Sparkles,
  User,
  Check,
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  isSameDay,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
  eachDayOfInterval,
} from 'date-fns';
import type { CalendarEvent } from '../types';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { useFabAutoClose } from '../hooks/useFabAutoClose';

export const CalendarPage: React.FC = () => {
  const { household, users, currentUser } = usePWA();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Timeline configuration
  const [spanDays, setSpanDays] = useState<number>(30); // 14, 30, 60 days
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'all' | 'events-only'>('all');

  // Unified Add / Edit Bottom Sheet State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formIsAllDay, setFormIsAllDay] = useState(false);
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formLocation, setFormLocation] = useState('');
  const [formAssignedUser, setFormAssignedUser] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Quick Add State (Bottom-Right FAB)
  const [isQuickAddExpanded, setIsQuickAddExpanded] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [quickDate, setQuickDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const todayRef = useRef<HTMLDivElement>(null);

  const dockRef = useFabAutoClose<HTMLDivElement>({
    isOpen: isQuickAddExpanded,
    onClose: () => setIsQuickAddExpanded(false),
    ignore: isModalOpen,
  });

  // Calculate timeline date range: start from 2 days ago for immediate recent context, span forward
  const rangeStart = subDays(new Date(), 2);
  const rangeEnd = addDays(new Date(), spanDays);
  const timelineDays = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  const loadData = async () => {
    if (!household) return;
    setIsLoading(true);
    try {
      const eventData = await api.getCalendarEvents(household.id);
      setEvents(eventData);
    } catch (err) {
      console.error('Failed to load calendar events:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [household]);

  const scrollToToday = () => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const formatTimeRange = (ev: CalendarEvent) => {
    if (ev.is_all_day) return 'All Day';
    try {
      const start = parseISO(ev.start_time);
      const startStr = format(start, 'h:mm a');
      if (!ev.end_time) return startStr;
      const end = parseISO(ev.end_time);
      const endStr = format(end, 'h:mm a');
      return `${startStr} – ${endStr}`;
    } catch {
      return 'Scheduled';
    }
  };

  // Filter events by assigned member
  const filteredEvents = events.filter((ev) => {
    if (selectedMemberId === 'all') return true;
    return ev.assigned_user_id === selectedMemberId;
  });

  // Count upcoming events
  const upcomingCount = filteredEvents.filter((ev) => {
    try {
      const d = parseISO(ev.start_time);
      return d >= subDays(new Date(), 1);
    } catch {
      return false;
    }
  }).length;

  const handleOpenAddModal = (dateStr?: string) => {
    setEditingEventId(null);
    setFormTitle('');
    setFormDescription('');
    setFormDate(dateStr || format(new Date(), 'yyyy-MM-dd'));
    setFormIsAllDay(false);
    setFormStartTime('09:00');
    setFormEndTime('10:00');
    setFormLocation('');
    setFormAssignedUser(currentUser?.id || '');
    setIsModalOpen(true);
    setIsQuickAddExpanded(false);
  };

  const handleOpenEditModal = (ev: CalendarEvent) => {
    setEditingEventId(ev.id);
    setFormTitle(ev.title);
    setFormDescription(ev.description || '');
    setFormDate(ev.start_time.split('T')[0]);
    setFormIsAllDay(Boolean(ev.is_all_day));
    setFormStartTime(ev.start_time.split('T')[1]?.substring(0, 5) || '09:00');
    setFormEndTime(ev.end_time?.split('T')[1]?.substring(0, 5) || '10:00');
    setFormLocation(ev.location || '');
    setFormAssignedUser(ev.assigned_user_id || '');
    setIsModalOpen(true);
    setIsQuickAddExpanded(false);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !formTitle.trim()) return;
    setIsSaving(true);

    try {
      const startTimeVal = formIsAllDay ? '00:00' : formStartTime;
      const endTimeVal = formIsAllDay ? '23:59' : formEndTime;
      const startIso = new Date(`${formDate}T${startTimeVal}:00`).toISOString();
      const endIso = new Date(`${formDate}T${endTimeVal}:00`).toISOString();

      if (editingEventId) {
        const updated = await api.updateCalendarEvent(household.id, editingEventId, {
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          start_time: startIso,
          end_time: endIso,
          is_all_day: formIsAllDay,
          location: formLocation.trim() || undefined,
          assigned_user_id: formAssignedUser || undefined,
        });
        setEvents((prev) => prev.map((it) => (it.id === editingEventId ? updated : it)));
      } else {
        const created = await api.createCalendarEvent(household.id, {
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          start_time: startIso,
          end_time: endIso,
          is_all_day: formIsAllDay,
          location: formLocation.trim() || undefined,
          assigned_user_id: formAssignedUser || undefined,
        });
        setEvents((prev) => [...prev, created]);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save event:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
      await api.deleteCalendarEvent(id);
    } catch (err) {
      console.error('Failed to delete event:', err);
      loadData();
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !quickInput.trim()) return;

    const raw = quickInput.trim();
    let startTime = '09:00';
    let endTime = '10:00';

    const timeMatch = raw.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      const min = timeMatch[2] || '00';
      const ampm = timeMatch[3].toLowerCase();
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      const startHourStr = String(hour).padStart(2, '0');
      startTime = `${startHourStr}:${min}`;
      const endHourStr = String((hour + 1) % 24).padStart(2, '0');
      endTime = `${endHourStr}:${min}`;
    }

    try {
      const created = await api.createCalendarEvent(household.id, {
        title: raw,
        start_time: `${quickDate}T${startTime}:00`,
        end_time: `${quickDate}T${endTime}:00`,
        assigned_user_id: currentUser?.id,
      });
      setEvents((prev) => [...prev, created]);
      setQuickInput('');
      setIsQuickAddExpanded(false);
    } catch (err) {
      console.error('Failed to quick add event:', err);
      loadData();
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-2 pb-36 md:pb-28 space-y-4">
      {/* Top Header Card */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Family Agenda
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
              </h1>
              <p className="text-xs text-slate-400">
                Timeline spanning {spanDays} days • {upcomingCount} upcoming {upcomingCount === 1 ? 'event' : 'events'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Jump to Today Button */}
            <button
              type="button"
              onClick={scrollToToday}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-all active:scale-95 shadow-sm"
              title="Jump to Today in timeline"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Today</span>
            </button>

            {/* Schedule New Event */}
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Event</span>
            </button>
          </div>
        </div>

        {/* Span Selector & View Mode Switch */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
          {/* Days Span Selector */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-white/5 text-xs">
            <span className="text-slate-400 text-[11px] px-2 font-medium">Span:</span>
            {[
              { label: '14 Days', days: 14 },
              { label: '30 Days', days: 30 },
              { label: '60 Days', days: 60 },
            ].map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => setSpanDays(opt.days)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  spanDays === opt.days
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* View Filter: All Days vs Events Only */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-white/5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                viewMode === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Days
            </button>
            <button
              type="button"
              onClick={() => setViewMode('events-only')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                viewMode === 'events-only'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Events Only
            </button>
          </div>
        </div>

        {/* Member Filter Chips */}
        {users.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setSelectedMemberId('all')}
              className={`px-3 py-1 rounded-full font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                selectedMemberId === 'all'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-transparent'
              }`}
            >
              <span>Whole Family</span>
            </button>
            {users.map((u) => {
              const isSelected = selectedMemberId === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedMemberId(u.id)}
                  className={`px-2.5 py-1 rounded-full font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-800 text-white border border-white/20'
                      : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: u.avatar_color || '#818cf8' }}
                  />
                  <span>{u.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Vertical Agenda Timeline */}
      <div className="relative pl-1 sm:pl-2">
        {timelineDays.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isCurrentDay = isToday(day);
          const isTomorrowDay = isTomorrow(day);
          const isYesterdayDay = isYesterday(day);

          // Events on this day
          const dayEvents = filteredEvents.filter((ev) => {
            try {
              return isSameDay(parseISO(ev.start_time), day);
            } catch {
              return false;
            }
          });

          // In "events-only" mode, hide days without events unless it's today
          if (viewMode === 'events-only' && dayEvents.length === 0 && !isCurrentDay) {
            return null;
          }

          // Check if this day starts a new month
          const prevDay = idx > 0 ? timelineDays[idx - 1] : null;
          const isFirstOfMonth = !prevDay || format(prevDay, 'M') !== format(day, 'M');

          return (
            <React.Fragment key={dateStr}>
              {/* Month Transition Header Banner */}
              {isFirstOfMonth && (
                <div className="pt-4 pb-2 sticky top-0 z-20 backdrop-blur-md bg-slate-950/80 -mx-2 px-2 py-1.5 flex items-center gap-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">
                    {format(day, 'MMMM yyyy')}
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/30 to-transparent" />
                </div>
              )}

              {/* Day Timeline Row */}
              <div
                ref={isCurrentDay ? todayRef : undefined}
                className={`relative flex gap-3 sm:gap-4 pb-5 group transition-colors ${
                  isCurrentDay ? 'scroll-mt-24' : ''
                }`}
              >
                {/* 1. Left Date Badge Column */}
                <div className="w-14 sm:w-16 shrink-0 flex flex-col items-center pt-0.5 select-none">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      isCurrentDay
                        ? 'text-indigo-400'
                        : isTomorrowDay
                        ? 'text-purple-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {format(day, 'EEE')}
                  </span>
                  <span
                    className={`text-lg sm:text-xl font-black leading-tight ${
                      isCurrentDay
                        ? 'text-indigo-300 scale-110 drop-shadow-md'
                        : 'text-slate-200'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {format(day, 'MMM')}
                  </span>
                </div>

                {/* 2. Central Vertical Timeline Rail & Connector Node */}
                <div className="relative flex flex-col items-center">
                  {/* Timeline Rail Connecting Line */}
                  <div
                    className={`absolute top-0 bottom-0 w-0.5 -z-0 ${
                      isCurrentDay
                        ? 'bg-gradient-to-b from-indigo-500 via-indigo-500/40 to-slate-800'
                        : 'bg-slate-800'
                    }`}
                  />

                  {/* Timeline Node Dot */}
                  <div
                    className={`relative z-10 rounded-full mt-1.5 transition-transform group-hover:scale-125 ${
                      isCurrentDay
                        ? 'w-4 h-4 bg-indigo-500 ring-4 ring-indigo-500/30 shadow-lg shadow-indigo-500/50'
                        : dayEvents.length > 0
                        ? 'w-3 h-3 bg-emerald-400 ring-2 ring-emerald-400/20'
                        : 'w-2 h-2 bg-slate-700'
                    }`}
                  />
                </div>

                {/* 3. Right Content: Events Container */}
                <div className="flex-1 min-w-0">
                  {/* Day Subheader */}
                  <div className="flex items-center justify-between gap-2 mb-1.5 pt-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-xs font-bold truncate ${
                          isCurrentDay ? 'text-indigo-300' : 'text-slate-300'
                        }`}
                      >
                        {format(day, 'EEEE')}
                      </span>

                      {isCurrentDay && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/25 text-indigo-300 border border-indigo-500/40">
                          Today
                        </span>
                      )}
                      {isTomorrowDay && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Tomorrow
                        </span>
                      )}
                      {isYesterdayDay && (
                        <span className="text-[10px] font-medium text-slate-400 text-[11px]">
                          Yesterday
                        </span>
                      )}
                    </div>

                    {/* Quick Add on Date Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenAddModal(dateStr)}
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors shrink-0"
                      title={`Add event on ${format(day, 'MMM d')}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Event Cards List */}
                  {dayEvents.length > 0 ? (
                    <div className="space-y-2">
                      {dayEvents.map((ev) => {
                        const assignedUser = users.find((u) => u.id === ev.assigned_user_id);
                        return (
                          <div
                            key={ev.id}
                            onClick={() => handleOpenEditModal(ev)}
                            className="relative overflow-hidden p-3 sm:p-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-white/10 hover:border-indigo-500/40 transition-all cursor-pointer group shadow-sm active:scale-[0.99]"
                          >
                            {/* Member Color Stripe on Left */}
                            <div
                              className="absolute left-0 top-0 bottom-0 w-1.5"
                              style={{
                                backgroundColor: assignedUser?.avatar_color || '#818cf8',
                              }}
                            />

                            <div className="pl-1.5 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                {/* Time Range Badge */}
                                <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                                  <Clock className="w-3 h-3 text-indigo-400" />
                                  <span>{formatTimeRange(ev)}</span>
                                </div>

                                {/* Member Assigned Avatar / Name */}
                                {assignedUser && (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <div
                                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                                      style={{
                                        backgroundColor: assignedUser.avatar_color || '#818cf8',
                                      }}
                                    >
                                      {assignedUser.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-xs text-slate-300 font-medium hidden sm:inline">
                                      {assignedUser.name}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Title */}
                              <h3 className="text-sm sm:text-base font-semibold text-white group-hover:text-indigo-200 transition-colors">
                                {ev.title}
                              </h3>

                              {/* Description if present */}
                              {ev.description && (
                                <p className="text-xs text-slate-400 line-clamp-2">
                                  {ev.description}
                                </p>
                              )}

                              {/* Location if present */}
                              {ev.location && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-0.5">
                                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  <span className="truncate">{ev.location}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Empty Day Placeholder */
                    <div
                      onClick={() => handleOpenAddModal(dateStr)}
                      className="py-2.5 px-3 rounded-xl border border-dashed border-white/5 hover:border-white/20 bg-slate-900/30 hover:bg-slate-900/60 transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <span className="text-xs text-slate-400 italic group-hover:text-slate-300 transition-colors">
                        No events scheduled
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 group-hover:text-indigo-400 flex items-center gap-1 transition-colors">
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Load More Days Button at bottom */}
        <div className="pt-4 pb-8 flex justify-center">
          <button
            type="button"
            onClick={() => setSpanDays((prev) => prev + 30)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 border border-white/15 hover:border-indigo-500/40 text-slate-300 hover:text-white text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <ArrowDown className="w-4 h-4 text-indigo-400" />
            <span>Load More Days (+30 Days)</span>
          </button>
        </div>
      </div>

      {/* Unified Add / Edit Event Bottom Sheet */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border-t border-white/15 rounded-t-3xl p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto space-y-4">
            {/* Top Drag Handle */}
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto" />

            {/* Bottom Sheet Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingEventId ? 'Edit Event' : 'Schedule Event'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingEventId ? 'Update event details' : 'Add to family agenda timeline'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* EVENT FORM */}
            <form onSubmit={handleSaveModal} className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Maya Soccer Tournament, Dentist Appointment..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Date & Member */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Assign Member
                  </label>
                  <select
                    value={formAssignedUser}
                    onChange={(e) => setFormAssignedUser(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Whole Family</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* All Day Toggle */}
              <div className="flex items-center justify-between py-1 px-1">
                <label className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
                  All Day Event
                </label>
                <input
                  type="checkbox"
                  checked={formIsAllDay}
                  onChange={(e) => setFormIsAllDay(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-white/20 focus:ring-indigo-500"
                />
              </div>

              {/* Times */}
              {!formIsAllDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Location */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Location (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Central Park Field 4, Dr. Smith Office..."
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Notes / Description */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Notes / Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional details, reminder notes, equipment needed..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
                {editingEventId ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleDeleteEvent(editingEventId);
                      setIsModalOpen(false);
                    }}
                    className="min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!formTitle.trim() || isSaving}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-lg shadow-indigo-600/25 flex items-center gap-1.5 transition-all"
                  >
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{editingEventId ? 'Save Changes' : 'Schedule Event'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Animated Expanding Quick Add Dock & FAB */}
      <div className="fixed bottom-[calc(76px+1rem+env(safe-area-inset-bottom,0px))] md:bottom-8 left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-none flex justify-end">
          <div
            ref={dockRef}
            className={`fab-dock-transition pointer-events-auto h-[52px] border shadow-2xl flex items-center overflow-hidden ${
              isQuickAddExpanded
                ? 'w-full rounded-3xl border-white/25 bg-slate-900/95 backdrop-blur-xl shadow-indigo-500/10 px-2'
                : 'w-[52px] rounded-full border-indigo-400/40 bg-gradient-to-r from-indigo-500 to-purple-500 cursor-pointer shadow-xl shadow-indigo-500/30 hover:scale-105 active:scale-95 justify-center'
            }`}
          >
            {!isQuickAddExpanded ? (
              <button
                type="button"
                onClick={() => setIsQuickAddExpanded(true)}
                className="w-full h-full flex items-center justify-center text-white"
                title="Quick Add Event"
              >
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </button>
            ) : (
              <form onSubmit={handleQuickAdd} className="w-full flex items-center gap-2">
                {/* Close button */}
                <button
                  type="button"
                  onClick={() => setIsQuickAddExpanded(false)}
                  className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Secondary action: Full Modal Options Button */}
                <button
                  type="button"
                  onClick={() => {
                    handleOpenAddModal(quickDate);
                  }}
                  className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
                  title="More details & scheduling"
                >
                  <CalendarIcon className="w-4 h-4" />
                </button>

                {/* Secondary action: Date selector */}
                <input
                  type="date"
                  value={quickDate}
                  onChange={(e) => setQuickDate(e.target.value)}
                  className="bg-white/5 border border-white/10 text-xs text-slate-300 rounded-2xl px-2 py-2 focus:outline-none focus:border-indigo-500 shrink-0"
                />

                {/* Middle: Input */}
                <input
                  autoFocus
                  type="text"
                  placeholder="Quick add (e.g. Soccer 4:30pm)..."
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none py-2 px-1"
                />

                {/* Far Right: Add Button */}
                <button
                  type="submit"
                  disabled={!quickInput.trim()}
                  className="p-2 sm:px-3.5 sm:py-2 rounded-2xl text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 disabled:opacity-40 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 shadow-indigo-500/20"
                  title="Add Event"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
