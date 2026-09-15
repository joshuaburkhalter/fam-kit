import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Clock,
  MapPin,
  X,
  Loader2,
  ArrowDown,
  Sparkles,
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  differenceInDays,
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

/**
 * Natural language parser for calendar events (fallback when Gemini is offline or unconfigured)
 * Handles inputs like "board game night on monday from 6-9", "soccer practice tomorrow at 4pm", etc.
 */
function parseNaturalLanguageEvent(raw: string, members: { id: string; name: string }[]) {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const now = new Date();

  // 1. Detect Day / Date
  let targetDate = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  if (lower.includes('tomorrow')) {
    targetDate = addDays(now, 1);
  } else if (lower.includes('today') || lower.includes('tonight')) {
    targetDate = now;
  } else {
    for (let i = 0; i < dayNames.length; i++) {
      const name = dayNames[i];
      const regex = new RegExp(`\\b(next\\s+)?${name}\\b`, 'i');
      const match = lower.match(regex);
      if (match) {
        const targetDayIndex = i;
        const currentDayIndex = now.getDay();
        let diff = targetDayIndex - currentDayIndex;
        if (diff <= 0) diff += 7; // next occurrence
        if (match[1]) diff += 7; // explicit "next [day]"
        targetDate = addDays(now, diff);
        break;
      }
    }
  }

  // 2. Detect Times
  let startTime = '18:00';
  let endTime = '19:00';
  let isAllDay = false;

  // Range match: "from 6-9", "6-9pm", "from 6:30 to 8:30pm", "6pm - 9pm"
  const rangeMatch = lower.match(
    /\b(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i
  );
  // Single time match: "at 4pm", "4:30pm", "at 10am"
  const singleMatch = lower.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);

  if (rangeMatch) {
    let startH = parseInt(rangeMatch[1], 10);
    const startM = rangeMatch[2] || '00';
    let endH = parseInt(rangeMatch[3], 10);
    const endM = rangeMatch[4] || '00';
    const ampm = (rangeMatch[5] || '').toLowerCase();

    // Default evening assumptions for typical ranges like 6-9, 5-7
    if (ampm === 'pm' || (!ampm && startH < 12)) {
      if (endH < 12) endH += 12;
      if (startH < 12 && startH <= endH - 12) startH += 12;
      else if (startH < 12 && endH >= 12 && startH < endH) startH += 12;
    } else if (ampm === 'am') {
      if (startH === 12) startH = 0;
      if (endH === 12) endH = 0;
    }

    startTime = `${String(startH).padStart(2, '0')}:${startM}`;
    endTime = `${String(endH).padStart(2, '0')}:${endM}`;
  } else if (singleMatch) {
    let hour = parseInt(singleMatch[1], 10);
    const min = singleMatch[2] || '00';
    const ampm = singleMatch[3].toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    startTime = `${String(hour).padStart(2, '0')}:${min}`;
    endTime = `${String((hour + 1) % 24).padStart(2, '0')}:${min}`;
  } else if (lower.includes('all day')) {
    isAllDay = true;
    startTime = '00:00';
    endTime = '23:59';
  }

  // 3. Clean up Title
  let cleanTitle = text
    .replace(/\b(?:on\s+)?(?:next\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, '')
    .replace(/\b(?:tomorrow|today|tonight|all day)\b/gi, '')
    .replace(/\b(?:from\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:-|–|to)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '')
    .replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanTitle) cleanTitle = 'Family Event';
  cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

  // 4. Assigned Member
  let assignedUserId: string | undefined;
  for (const m of members) {
    if (lower.includes(m.name.toLowerCase())) {
      assignedUserId = m.id;
      break;
    }
  }

  return {
    title: cleanTitle,
    date: format(targetDate, 'yyyy-MM-dd'),
    startTime,
    endTime,
    isAllDay,
    assignedUserId,
  };
}

export const CalendarPage: React.FC = () => {
  const { household, users, currentUser } = usePWA();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Timeline configuration: 14 days by default, expandable by 14
  const [daysCount, setDaysCount] = useState<number>(14);
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
  const [isAssistantSubmitting, setIsAssistantSubmitting] = useState(false);
  const [assistantFeedback, setAssistantFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    date?: string;
  } | null>(null);

  const todayRef = useRef<HTMLDivElement>(null);

  const dockRef = useFabAutoClose<HTMLDivElement>({
    isOpen: isQuickAddExpanded,
    onClose: () => setIsQuickAddExpanded(false),
    ignore: isModalOpen,
  });

  // Calculate timeline date range: starts from yesterday (1 day past context) through 14 days ahead
  const rangeStart = subDays(new Date(), 1);
  const rangeEnd = addDays(rangeStart, daysCount);
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

  // Assistant Natural Language Scheduling Handler
  const handleAssistantSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !quickInput.trim() || isAssistantSubmitting) return;

    const raw = quickInput.trim();
    setIsAssistantSubmitting(true);
    setAssistantFeedback(null);

    try {
      let scheduledTitle = '';
      let scheduledDate = '';

      // 1. First attempt via Gemini Assistant API
      try {
        const now = new Date();
        const res = await api.sendAssistantMessage({
          message: raw,
          householdId: household.id,
          userId: currentUser?.id,
          clientDate: format(now, 'yyyy-MM-dd'),
          clientDay: format(now, 'EEEE'),
          clientTime: format(now, 'HH:mm'),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });

        const calAction = res.actionsExecuted?.find(
          (a) => a.tool === 'calendar_event_added' || a.tool === 'add_calendar_events'
        );

        if (calAction && calAction.data && calAction.data.length > 0) {
          scheduledTitle = calAction.data[0].title;
          scheduledDate = calAction.data[0].date;
        }
      } catch {
        // Fallback silently to client natural language parser
      }

      // 2. If Gemini didn't execute action, use local natural language parser
      if (!scheduledTitle) {
        const parsed = parseNaturalLanguageEvent(raw, users);
        const startIso = new Date(`${parsed.date}T${parsed.startTime}:00`).toISOString();
        const endIso = new Date(`${parsed.date}T${parsed.endTime}:00`).toISOString();

        await api.createCalendarEvent(household.id, {
          title: parsed.title,
          start_time: startIso,
          end_time: endIso,
          is_all_day: parsed.isAllDay,
          assigned_user_id: parsed.assignedUserId || currentUser?.id,
        });

        scheduledTitle = parsed.title;
        scheduledDate = parsed.date;
      }

      // 3. Ensure date is within visible span
      if (scheduledDate) {
        try {
          const parsedD = parseISO(scheduledDate);
          const daysDiff = differenceInDays(parsedD, new Date());
          if (daysDiff >= daysCount) {
            setDaysCount(daysDiff + 7);
          }
        } catch {}
      }

      // 4. Reload calendar events
      await loadData();

      // 5. Success feedback
      let dateLabel = scheduledDate;
      try {
        dateLabel = format(parseISO(scheduledDate), 'EEE, MMM d');
      } catch {}

      setAssistantFeedback({
        type: 'success',
        message: `Added "${scheduledTitle}" for ${dateLabel}!`,
        date: scheduledDate,
      });

      setQuickInput('');
      setIsQuickAddExpanded(false);

      setTimeout(() => {
        setAssistantFeedback(null);
      }, 4000);
    } catch (err) {
      console.error('Failed to schedule event:', err);
      setAssistantFeedback({
        type: 'error',
        message: 'Could not schedule event. Please try again or tap a day to add.',
      });
    } finally {
      setIsAssistantSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 pt-3 pb-36 md:pb-28 space-y-4">
      {/* Consistent Mobile-First Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-slate-950">
            <CalendarIcon className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Calendar
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />}
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
              14-day family agenda & schedule
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Today Jump Button */}
          <button
            type="button"
            onClick={scrollToToday}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 hover:border-theme/40 text-theme text-xs font-semibold transition-all active:scale-95 shadow-sm"
            title="Jump to Today"
          >
            <Sparkles className="w-3.5 h-3.5 text-theme" />
            <span>Today</span>
          </button>

          {/* New Event Button */}
          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-theme hover:bg-theme-hover text-theme-text text-xs font-bold transition-all shadow-md shadow-theme/20 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Event</span>
          </button>
        </div>
      </div>

      {/* Sub-Bar: Compact Family Avatars + Tiny All/Events Toggle */}
      <div className="flex items-center justify-between gap-2 py-1">
        {/* Simple, Small Family User Toggle */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {/* "All" button */}
          <button
            type="button"
            onClick={() => setSelectedMemberId('all')}
            className={`h-7 px-2.5 rounded-full text-[11px] font-bold transition-all shrink-0 flex items-center justify-center ${
              selectedMemberId === 'all'
                ? 'bg-theme text-theme-text shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-white/10'
            }`}
          >
            All
          </button>

          {/* Member Avatar Dots */}
          {users.map((u) => {
            const isSelected = selectedMemberId === u.id;
            const initial = (u.name || 'U').charAt(0).toUpperCase();
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedMemberId(isSelected ? 'all' : u.id)}
                title={u.name}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white transition-all shrink-0 ${
                  isSelected
                    ? 'ring-2 ring-theme ring-offset-2 ring-offset-slate-950 scale-105 shadow-sm'
                    : selectedMemberId !== 'all'
                    ? 'opacity-40 hover:opacity-100'
                    : 'opacity-90 hover:opacity-100 hover:scale-105'
                }`}
                style={{ backgroundColor: u.avatar_color || '#10b981' }}
              >
                {initial}
              </button>
            );
          })}
        </div>

        {/* Smaller & Simpler View Mode Toggle */}
        <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-white/10 shrink-0 text-[11px]">
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`px-2 py-0.5 rounded-md font-medium transition-all ${
              viewMode === 'all'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setViewMode('events-only')}
            className={`px-2 py-0.5 rounded-md font-medium transition-all ${
              viewMode === 'events-only'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Events
          </button>
        </div>
      </div>

      {/* Clean Timeline List */}
      <div className="relative pt-1">
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
              {/* Subtle Month Header */}
              {isFirstOfMonth && (
                <div className="pt-3 pb-1.5 sticky top-0 z-10 backdrop-blur-md bg-slate-950/85 flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    {format(day, 'MMMM yyyy')}
                  </span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              )}

              {/* Day Row */}
              <div
                ref={isCurrentDay ? todayRef : undefined}
                className={`relative flex gap-3 pb-3 group ${
                  isCurrentDay ? 'scroll-mt-20' : ''
                }`}
              >
                {/* 1. Date Column */}
                <div className="w-12 shrink-0 flex flex-col items-center pt-0.5 select-none">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isCurrentDay ? 'text-theme' : 'text-slate-400'
                    }`}
                  >
                    {format(day, 'EEE')}
                  </span>

                  {isCurrentDay ? (
                    <div className="w-7 h-7 rounded-full bg-theme text-theme-text flex items-center justify-center font-bold text-sm shadow-sm mt-0.5">
                      {format(day, 'd')}
                    </div>
                  ) : (
                    <span className="text-base font-bold text-slate-200 mt-0.5">
                      {format(day, 'd')}
                    </span>
                  )}

                  {isCurrentDay && (
                    <span className="text-[9px] font-bold text-theme uppercase tracking-tight mt-0.5">
                      Today
                    </span>
                  )}
                  {isTomorrowDay && (
                    <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tight mt-0.5">
                      Tmrw
                    </span>
                  )}
                </div>

                {/* 2. Thin Timeline Rail Line */}
                <div className="relative flex flex-col items-center">
                  <div
                    className={`absolute top-0 bottom-0 w-[1px] ${
                      isCurrentDay ? 'bg-theme/50' : 'bg-slate-800'
                    }`}
                  />
                  <div
                    className={`relative z-10 rounded-full mt-2 ${
                      isCurrentDay
                        ? 'w-2.5 h-2.5 bg-theme ring-2 ring-theme/30'
                        : dayEvents.length > 0
                        ? 'w-2 h-2 bg-theme'
                        : 'w-1.5 h-1.5 bg-slate-700'
                    }`}
                  />
                </div>

                {/* 3. Content Column */}
                <div className="flex-1 min-w-0 pt-0.5">
                  {dayEvents.length > 0 ? (
                    <div className="space-y-1.5">
                      {dayEvents.map((ev) => {
                        const assignedUser = users.find((u) => u.id === ev.assigned_user_id);
                        return (
                          <div
                            key={ev.id}
                            onClick={() => handleOpenEditModal(ev)}
                            className="relative overflow-hidden p-2.5 sm:p-3 rounded-xl bg-slate-900 border border-white/10 hover:border-theme/40 transition-all cursor-pointer group active:scale-[0.99] shadow-xs"
                          >
                            {/* Member Color Stripe */}
                            <div
                              className="absolute left-0 top-0 bottom-0 w-1"
                              style={{
                                backgroundColor: assignedUser?.avatar_color || '#10b981',
                              }}
                            />

                            <div className="pl-1 space-y-1">
                              {/* Top row: Time & Member */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="inline-flex items-center gap-1 text-[11px] font-mono text-theme font-medium">
                                  <Clock className="w-3 h-3 text-theme" />
                                  <span>{formatTimeRange(ev)}</span>
                                </div>

                                {assignedUser && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <div
                                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                      style={{
                                        backgroundColor: assignedUser.avatar_color || '#10b981',
                                      }}
                                    >
                                      {assignedUser.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                                      {assignedUser.name}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Event Title */}
                              <h3 className="text-sm font-semibold text-white group-hover:text-emerald-200 transition-colors">
                                {ev.title}
                              </h3>

                              {/* Location */}
                              {ev.location && (
                                <div className="flex items-center gap-1 text-[11px] text-slate-400 pt-0.5">
                                  <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                                  <span className="truncate">{ev.location}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Minimalist Empty Day Row */
                    <div
                      onClick={() => handleOpenAddModal(dateStr)}
                      className="py-1 px-2 rounded-lg hover:bg-slate-900/60 transition-colors cursor-pointer flex items-center justify-between group"
                    >
                      <span className="text-xs text-slate-500 group-hover:text-slate-400">
                        {isCurrentDay ? 'No events today' : 'No events'}
                      </span>
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-400 text-xs flex items-center gap-0.5 transition-opacity"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Load More Days (+14 Days) */}
        <div className="pt-3 pb-8 flex justify-center">
          <button
            type="button"
            onClick={() => setDaysCount((prev) => prev + 14)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 border border-white/10 hover:border-theme/40 text-slate-300 hover:text-white text-xs font-semibold transition-all active:scale-95 shadow-sm"
          >
            <ArrowDown className="w-3.5 h-3.5 text-theme" />
            <span>Load 14 More Days</span>
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
                <div className="w-8 h-8 rounded-xl bg-theme/20 text-theme flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingEventId ? 'Edit Event' : 'Schedule Event'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingEventId ? 'Update event details' : 'Add to family calendar'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* EVENT FORM */}
            <form onSubmit={handleSaveModal} className="space-y-3.5">
              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Soccer game, Dentist, Family Dinner..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-theme"
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
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-theme"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Assign Member
                  </label>
                  <select
                    value={formAssignedUser}
                    onChange={(e) => setFormAssignedUser(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-theme"
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
              <div className="flex items-center justify-between py-0.5 px-0.5">
                <label className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
                  All Day Event
                </label>
                <input
                  type="checkbox"
                  checked={formIsAllDay}
                  onChange={(e) => setFormIsAllDay(e.target.checked)}
                  className="w-4 h-4 rounded text-theme bg-slate-950 border-white/20 focus:ring-theme"
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
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-theme"
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
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-theme"
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
                  placeholder="e.g. Park, School, Dr. Smith Office..."
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-theme"
                />
              </div>

              {/* Notes / Description */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional notes or details..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-theme resize-none"
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
                    className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
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
                    className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!formTitle.trim() || isSaving}
                    className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold bg-theme hover:bg-theme-hover disabled:opacity-50 text-theme-text shadow-md shadow-theme/20 flex items-center gap-1.5 transition-all"
                  >
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingEventId ? 'Save' : 'Add Event'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Feedback Toast */}
      {assistantFeedback && (
        <div className="fixed bottom-[calc(76px+4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-20 left-4 right-4 z-50 flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2 pointer-events-auto backdrop-blur-xl ${
              assistantFeedback.type === 'success'
                ? 'bg-slate-900/95 border-theme/40 text-theme shadow-theme/20'
                : 'bg-red-950/95 border-red-500/40 text-red-200 shadow-red-500/20'
            }`}
          >
            <Sparkles className="w-4 h-4 text-theme shrink-0" />
            <span>{assistantFeedback.message}</span>
          </div>
        </div>
      )}

      {/* Animated Expanding Quick Add Dock & Add FAB */}
      <div className="fixed bottom-[calc(76px+1rem+env(safe-area-inset-bottom,0px))] md:bottom-8 left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-none flex justify-end">
          <div
            ref={dockRef}
            className={`fab-dock-transition pointer-events-auto h-[50px] border shadow-2xl flex items-center overflow-hidden ${
              isQuickAddExpanded
                ? 'w-full rounded-3xl border-white/20 bg-slate-900/95 backdrop-blur-xl px-2'
                : 'w-[50px] rounded-full border-theme/30 bg-theme hover:bg-theme-hover cursor-pointer shadow-xl shadow-theme/30 hover:scale-105 active:scale-95 justify-center'
            }`}
          >
            {!isQuickAddExpanded ? (
              <button
                type="button"
                onClick={() => setIsQuickAddExpanded(true)}
                className="w-full h-full flex items-center justify-center text-theme-text"
                title="Add Event"
              >
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </button>
            ) : (
              <form onSubmit={handleAssistantSchedule} className="w-full flex items-center gap-2">
                {/* Close button */}
                <button
                  type="button"
                  onClick={() => setIsQuickAddExpanded(false)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* More Details (Full Form) Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickAddExpanded(false);
                    handleOpenAddModal();
                  }}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
                  title="Open full event form"
                >
                  <CalendarIcon className="w-4 h-4" />
                </button>

                {/* Single Smart Input: Just type what you want to add */}
                <input
                  autoFocus
                  type="text"
                  placeholder="Add event (e.g. Board game night on monday 6-9pm)..."
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  disabled={isAssistantSubmitting}
                  className="flex-1 min-w-0 bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none py-1.5 px-1"
                />

                {/* Add Button */}
                <button
                  type="submit"
                  disabled={!quickInput.trim() || isAssistantSubmitting}
                  className="px-3.5 py-1.5 rounded-xl text-theme-text font-bold text-xs flex items-center gap-1 transition-all shadow-md shrink-0 disabled:opacity-40 bg-theme hover:bg-theme-hover shadow-theme/25 active:scale-95"
                >
                  {isAssistantSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  )}
                  <span>{isAssistantSubmitting ? 'Adding...' : 'Add'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
