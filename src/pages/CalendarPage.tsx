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
  ChevronDown,
  ChevronUp,
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
import { Drawer } from '../components/ui/Drawer';

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
        targetDate = addDays(now, diff);
        break;
      }
    }
  }

  // 2. Detect Times (e.g., "from 6-9", "at 4pm", "6:30pm", "14:00")
  let startTime = '09:00';
  let endTime = '10:00';
  let isAllDay = true; // Default to all day if no time specified

  // Match pattern like "from 6 to 8", "from 6-8pm", "6-9pm"
  const rangeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (rangeMatch) {
    isAllDay = false;
    let sH = parseInt(rangeMatch[1], 10);
    const sM = rangeMatch[2] || '00';
    let sMeridiem = rangeMatch[3];

    let eH = parseInt(rangeMatch[4], 10);
    const eM = rangeMatch[5] || '00';
    const eMeridiem = rangeMatch[6];

    // Inherit meridiem if only provided on end time (e.g., "6-8pm")
    if (!sMeridiem && eMeridiem) {
      sMeridiem = eMeridiem;
    }

    if (sMeridiem === 'pm' && sH < 12) sH += 12;
    if (sMeridiem === 'am' && sH === 12) sH = 0;
    if (eMeridiem === 'pm' && eH < 12) eH += 12;
    if (eMeridiem === 'am' && eH === 12) eH = 0;

    startTime = `${String(sH).padStart(2, '0')}:${sM}`;
    endTime = `${String(eH).padStart(2, '0')}:${eM}`;
  } else {
    // Single time match like "at 4pm", "at 6:30", "18:00"
    const singleMatch = lower.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
    if (singleMatch) {
      isAllDay = false;
      let h = parseInt(singleMatch[1], 10);
      const m = singleMatch[2] || '00';
      const meridiem = singleMatch[3];
      if (meridiem === 'pm' && h < 12) h += 12;
      if (meridiem === 'am' && h === 12) h = 0;
      startTime = `${String(h).padStart(2, '0')}:${m}`;
      endTime = `${String((h + 1) % 24).padStart(2, '0')}:${m}`;
    }
  }

  // 3. Detect Assigned Member
  let assignedUserId: string | undefined;
  for (const m of members) {
    const firstName = m.name.split(' ')[0].toLowerCase();
    if (lower.includes(firstName)) {
      assignedUserId = m.id;
      break;
    }
  }

  // 4. Clean Cleaned Title
  let title = text
    .replace(/\b(tomorrow|today|tonight)\b/gi, '')
    .replace(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, '')
    .replace(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi, '')
    .replace(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi, '')
    .replace(/\b(for|with)\s+([A-Z][a-z]+)\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!title) {
    title = 'Family Event';
  }

  // Capitalize First Letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return {
    title,
    date: format(targetDate, 'yyyy-MM-dd'),
    startTime,
    endTime,
    isAllDay,
    assignedUserId,
  };
}

export const CalendarPage: React.FC = () => {
  const { currentUser, household, users } = usePWA();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [daysCount, setDaysCount] = useState<number>(14);
  const [showPastEvents, setShowPastEvents] = useState<boolean>(false);
  const [pastDaysCount, setPastDaysCount] = useState<number>(14);
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

  const dockRef = useFabAutoClose<HTMLDivElement>({
    isOpen: isQuickAddExpanded,
    onClose: () => setIsQuickAddExpanded(false),
    ignore: isModalOpen,
  });

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

  // Live Current Time state to follow hours of the day along the timeline
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const todayRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

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

  const isEventPast = (ev: CalendarEvent) => {
    try {
      if (ev.is_all_day) {
        const start = parseISO(ev.start_time);
        const todayStart = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
        const eventStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        return eventStart < todayStart;
      }
      const endTime = ev.end_time ? parseISO(ev.end_time) : parseISO(ev.start_time);
      return endTime < currentTime;
    } catch {
      return false;
    }
  };

  const isEventActive = (ev: CalendarEvent) => {
    if (ev.is_all_day) return false;
    try {
      const start = parseISO(ev.start_time);
      const end = ev.end_time ? parseISO(ev.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
      return start <= currentTime && currentTime <= end;
    } catch {
      return false;
    }
  };

  // Filter events by assigned member
  const filteredEvents = events.filter((ev) => {
    if (selectedMemberId === 'all') return true;
    return ev.assigned_user_id === selectedMemberId;
  });

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterday = subDays(todayStart, 1);

  const pastEventsCount = filteredEvents.filter((ev) => {
    try {
      const start = parseISO(ev.start_time);
      const evDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      return evDate < todayStart;
    } catch {
      return false;
    }
  }).length;

  // 1. Upcoming Timeline: starts Today and goes forward
  const upcomingDays = eachDayOfInterval({
    start: todayStart,
    end: addDays(todayStart, daysCount),
  });

  // 2. Past Timeline: starts Yesterday and scrolls down into the past (most recent first)
  const pastDays = eachDayOfInterval({
    start: subDays(todayStart, pastDaysCount),
    end: yesterday,
  }).reverse();

  // Active timeline days depending on view mode
  const timelineDays = showPastEvents ? pastDays : upcomingDays;

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
    const startParts = ev.start_time.split('T');
    const endParts = (ev.end_time || '').split('T');
    setFormDate(startParts[0]);
    setFormIsAllDay(Boolean(ev.is_all_day));
    setFormStartTime(startParts[1]?.substring(0, 5) || '09:00');
    setFormEndTime(endParts[1]?.substring(0, 5) || '10:00');
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
      const startTimeVal = formIsAllDay ? '' : formStartTime;
      const endTimeVal = formIsAllDay ? '' : formEndTime;
      const startStr = formIsAllDay ? `${formDate}T00:00:00` : `${formDate}T${startTimeVal || '09:00'}:00`;
      const endStr = formIsAllDay ? `${formDate}T23:59:59` : `${formDate}T${endTimeVal || '10:00'}:00`;

      if (editingEventId) {
        const updated = await api.updateCalendarEvent(household.id, editingEventId, {
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          start_time: startStr,
          end_time: endStr,
          is_all_day: formIsAllDay,
          location: formLocation.trim() || undefined,
          assigned_user_id: formAssignedUser || undefined,
        });
        setEvents((prev) => prev.map((it) => (it.id === editingEventId ? updated : it)));
      } else {
        const created = await api.createCalendarEvent(household.id, {
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          start_time: startStr,
          end_time: endStr,
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
          (a: any) => a.tool === 'calendar_event_added' || a.tool === 'add_calendar_events'
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
        const startStr = parsed.isAllDay ? `${parsed.date}T00:00:00` : `${parsed.date}T${parsed.startTime}:00`;
        const endStr = parsed.isAllDay ? `${parsed.date}T23:59:59` : `${parsed.date}T${parsed.endTime}:00`;

        await api.createCalendarEvent(household.id, {
          title: parsed.title,
          start_time: startStr,
          end_time: endStr,
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
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Calendar
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />}
          </h1>
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
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
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
                    ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 scale-105 shadow-sm'
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

        {/* Smaller & Simpler View Mode Toggle + Past Quick Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowPastEvents((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${
              showPastEvents
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-white/10'
            }`}
            title={showPastEvents ? 'Switch back to upcoming events' : 'View past events'}
          >
            <Clock className={`w-3 h-3 ${showPastEvents ? 'text-slate-950 stroke-[2.5]' : 'text-slate-400'}`} />
            <span>Past</span>
            {pastEventsCount > 0 && (
              <span className={`text-[10px] font-mono ${showPastEvents ? 'text-slate-950 font-bold' : 'opacity-80'}`}>
                ({pastEventsCount})
              </span>
            )}
          </button>

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
      </div>

      {/* Clean Synchronous Timeline List */}
      <div className="relative pt-1">

        {showPastEvents && pastEventsCount === 0 && (
          <div className="text-center py-12 px-4 rounded-2xl bg-slate-900/40 border border-white/5 my-4">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No past events recorded</p>
            <p className="text-xs text-slate-500 mt-1">
              Events that have already taken place will appear here.
            </p>
            <button
              type="button"
              onClick={() => setShowPastEvents(false)}
              className="mt-4 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all cursor-pointer"
            >
              Back to Upcoming Events
            </button>
          </div>
        )}

        {/* Continuous Synchronous Timeline Rail Spine */}
        <div className="absolute left-[4.5rem] -translate-x-1/2 top-4 bottom-14 w-[2px] bg-slate-800 pointer-events-none" />

        {timelineDays.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isCurrentDay = isToday(day);
          const isTomorrowDay = isTomorrow(day);
          const isYesterdayDay = isYesterday(day);

          // Events on this day (sorted with all-day first, then by start time)
          const dayEvents = filteredEvents
            .filter((ev) => {
              try {
                return isSameDay(parseISO(ev.start_time), day);
              } catch {
                return false;
              }
            })
            .sort((a, b) => {
              try {
                const aAllDay = a.is_all_day ? 1 : 0;
                const bAllDay = b.is_all_day ? 1 : 0;
                if (aAllDay !== bAllDay) return bAllDay - aAllDay;
                return parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime();
              } catch {
                return 0;
              }
            });

          // In "events-only" mode, hide days without events unless it's today
          if (viewMode === 'events-only' && dayEvents.length === 0 && !isCurrentDay) {
            return null;
          }

          // Check if this day starts a new month
          const prevDay = idx > 0 ? timelineDays[idx - 1] : null;
          const isFirstOfMonth = !prevDay || format(prevDay, 'M') !== format(day, 'M');

          // Find if any event today is currently active
          const activeEvent = dayEvents.find((ev) => !ev.is_all_day && isEventActive(ev));
          const hasActiveEvent = Boolean(activeEvent);

          // Determine chronological placement index for Now indicator among Today's events when no event is currently active
          let nowIndex = -1;
          if (isCurrentDay && !hasActiveEvent) {
            nowIndex = 0;
            for (let i = 0; i < dayEvents.length; i++) {
              const ev = dayEvents[i];
              if (ev.is_all_day) {
                nowIndex = i + 1;
                continue;
              }
              try {
                const end = ev.end_time ? parseISO(ev.end_time) : parseISO(ev.start_time);
                if (end <= currentTime) {
                  nowIndex = i + 1;
                } else {
                  break;
                }
              } catch {
                // fallback
              }
            }
          }

          const renderCurrentTimeMarker = () => (
            <div className="relative flex items-center py-1.5 my-0.5 pointer-events-none select-none z-10">
              {/* Pulsing Green Dot on the Continuous Rail Spine */}
              <div className="absolute -left-[24px] -translate-x-1/2 flex items-center justify-center pointer-events-none">
                <span className="absolute w-4 h-4 rounded-full bg-emerald-400/40 animate-ping" />
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20 ring-offset-2 ring-offset-slate-950 shadow-sm shadow-emerald-500/60" />
              </div>

              {/* Current Time Badge & Horizontal Indicator Line */}
              <div className="flex items-center gap-2 flex-1 min-w-0 pointer-events-auto">
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-slate-950/95 border border-emerald-500/40 px-2.5 py-0.5 rounded-full shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{format(currentTime, 'h:mm a')}</span>
                  <span className="text-emerald-400/70 font-semibold text-[9px] uppercase tracking-wider">Now</span>
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/40 via-emerald-500/15 to-transparent" />
              </div>
            </div>
          );

          return (
            <React.Fragment key={dateStr}>
              {/* Subtle Month Header seamlessly integrated into timeline */}
              {isFirstOfMonth && (
                <div className="relative flex items-center gap-3 pt-4 pb-2 sticky top-0 z-20 backdrop-blur-md bg-slate-950/90">
                  <div className="w-12 shrink-0 flex items-center justify-center">
                    <CalendarIcon className="w-3.5 h-3.5 text-emerald-400/80" />
                  </div>
                  <div className="w-6 shrink-0 flex items-center justify-center relative z-10">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700 ring-2 ring-slate-950" />
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 font-mono">
                      {format(day, 'MMMM yyyy')}
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                </div>
              )}

              {/* Day Row */}
              <div
                ref={isCurrentDay ? todayRowRef : undefined}
                className={`relative flex items-start gap-3 pb-3.5 group ${
                  isCurrentDay ? 'scroll-mt-20' : ''
                }`}
              >
                {/* 1. Date Column */}
                <div className="w-12 shrink-0 flex flex-col items-center pt-0.5 select-none">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isCurrentDay ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {format(day, 'EEE')}
                  </span>

                  {isCurrentDay ? (
                    <div className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-sm shadow-sm mt-0.5">
                      {format(day, 'd')}
                    </div>
                  ) : (
                    <span className="text-base font-bold text-slate-200 mt-0.5">
                      {format(day, 'd')}
                    </span>
                  )}

                  {isCurrentDay && (
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-tight mt-0.5">
                      Today
                    </span>
                  )}
                  {isTomorrowDay && (
                    <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tight mt-0.5">
                      Tmrw
                    </span>
                  )}
                  {isYesterdayDay && (
                    <span className="text-[9px] font-medium text-amber-400 uppercase tracking-tight mt-0.5">
                      Yest
                    </span>
                  )}
                </div>

                {/* 2. Timeline Rail Node */}
                <div className="w-6 shrink-0 flex flex-col items-center pt-2 relative z-10">
                  {isCurrentDay && !hasActiveEvent && nowIndex === 0 ? (
                    <div className="w-2.5 h-2.5 rounded-full opacity-0" />
                  ) : (
                    <div
                      className={`rounded-full transition-all ${
                        isCurrentDay
                          ? 'w-2.5 h-2.5 bg-slate-700 ring-2 ring-slate-950'
                          : dayEvents.length > 0
                          ? 'w-2.5 h-2.5 bg-slate-600 ring-2 ring-slate-950 group-hover:bg-slate-400 group-hover:scale-125'
                          : 'w-2 h-2 bg-slate-700 ring-2 ring-slate-950 group-hover:bg-slate-500 group-hover:scale-125'
                      }`}
                    />
                  )}
                </div>

                {/* 3. Content Column */}
                <div className="flex-1 min-w-0 pt-0.5">
                  {dayEvents.length > 0 ? (
                    <div className="space-y-1.5">
                      {dayEvents.map((ev, evIdx) => {
                        const assignedUser = users.find((u) => u.id === ev.assigned_user_id);
                        const isPast = isEventPast(ev);
                        const isActive = isCurrentDay && isEventActive(ev);
                        const isPrimaryActive = isActive && ev.id === activeEvent?.id;

                        return (
                          <React.Fragment key={ev.id}>
                            {isCurrentDay && !hasActiveEvent && evIdx === nowIndex && renderCurrentTimeMarker()}
                            <div className="relative">
                              {/* Pulsing Green Dot on Rail Spine & Bridge Line directly next to Active Event */}
                              {isPrimaryActive && (
                                <>
                                  <div className="absolute -left-[24px] top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none z-20">
                                    <span className="absolute w-4 h-4 rounded-full bg-emerald-400/40 animate-ping" />
                                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20 ring-offset-2 ring-offset-slate-950 shadow-sm shadow-emerald-500/60" />
                                  </div>
                                  <div className="absolute -left-[24px] top-1/2 -translate-y-1/2 w-[24px] h-[2px] bg-emerald-500/60 pointer-events-none z-10" />
                                </>
                              )}

                              <div
                                onClick={() => handleOpenEditModal(ev)}
                                className={`relative overflow-hidden p-2.5 sm:p-3 rounded-xl transition-all cursor-pointer group active:scale-[0.99] shadow-xs ${
                                  isActive
                                    ? 'bg-slate-900/95 border-2 border-emerald-500/60 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-400/20'
                                    : isPast
                                    ? 'bg-slate-900/60 border border-white/5 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 hover:border-emerald-500/30'
                                    : 'bg-slate-900 border border-white/10 hover:border-emerald-500/40'
                                }`}
                              >
                                {/* Overlay Indicator Line across the Active Event Card */}
                                {isPrimaryActive && (
                                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-emerald-500/50 via-emerald-500/20 to-transparent pointer-events-none z-10" />
                                )}

                                {/* Member Color Stripe */}
                                <div
                                  className="absolute left-0 top-0 bottom-0 w-1"
                                  style={{
                                    backgroundColor: assignedUser?.avatar_color || '#10b981',
                                  }}
                                />

                                <div className="pl-1 space-y-1 relative z-10">
                                  {/* Top row: Time & Member */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div
                                      className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-medium shrink-0 ${
                                        isActive ? 'text-emerald-300 font-bold' : isPast ? 'text-slate-400' : 'text-emerald-400'
                                      }`}
                                    >
                                      <Clock className={`w-3 h-3 shrink-0 ${isActive ? 'text-emerald-300' : isPast ? 'text-slate-400' : 'text-emerald-400'}`} />
                                      <span className="whitespace-nowrap">{formatTimeRange(ev)}</span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {isActive && (
                                        <span
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-[10px] text-emerald-300 font-bold shrink-0"
                                          title={`Active now (${format(currentTime, 'h:mm a')})`}
                                        >
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                          <span>Active</span>
                                        </span>
                                      )}

                                      {ev.is_google_event && (
                                        <span
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-medium"
                                          title="Synced from Google Calendar"
                                        >
                                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
                                          </svg>
                                          <span className="hidden sm:inline">Google</span>
                                        </span>
                                      )}

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
                                  </div>

                                  {/* Event Title */}
                                  <h3
                                    className={`text-sm font-semibold transition-colors ${
                                      isActive
                                        ? 'text-white font-bold'
                                        : isPast
                                        ? 'text-slate-300 group-hover:text-white'
                                        : 'text-white group-hover:text-emerald-200'
                                    }`}
                                  >
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
                            </div>
                          </React.Fragment>
                        );
                      })}
                      {isCurrentDay && !hasActiveEvent && nowIndex >= dayEvents.length && renderCurrentTimeMarker()}
                    </div>
                  ) : (
                    /* Minimalist Empty Day Row */
                    <div className="space-y-1.5">
                      {isCurrentDay && renderCurrentTimeMarker()}
                      <div
                        onClick={() => handleOpenAddModal(dateStr)}
                        className="py-1 px-2.5 rounded-lg hover:bg-slate-900/60 transition-colors cursor-pointer flex items-center justify-between group/add"
                      >
                        <span className="text-xs text-slate-500 group-hover/add:text-slate-400">
                          {isCurrentDay ? 'No events today' : 'No events'}
                        </span>
                        <button
                          type="button"
                          className="opacity-0 group-hover/add:opacity-100 text-slate-400 hover:text-emerald-400 text-xs flex items-center gap-0.5 transition-opacity"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Load More Days / Past Events (+14 Days) */}
        {(!showPastEvents || pastEventsCount > 0) && (
          <div className="pt-3 pb-8 flex justify-center">
            {showPastEvents ? (
              <button
                type="button"
                onClick={() => setPastDaysCount((prev) => prev + 14)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 border border-amber-500/30 hover:border-amber-500/60 text-amber-300 hover:text-white text-xs font-semibold transition-all active:scale-95 shadow-sm cursor-pointer"
              >
                <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                <span>Show More Past Events (14 Earlier Days)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setDaysCount((prev) => prev + 14)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 border border-white/10 hover:border-emerald-500/40 text-slate-300 hover:text-white text-xs font-semibold transition-all active:scale-95 shadow-sm cursor-pointer"
              >
                <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                <span>Load 14 More Days</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Unified Add / Edit Event Drawer */}
      <Drawer
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEventId ? 'Edit Event' : 'Schedule Event'}
        subtitle={editingEventId ? 'Update event details' : 'Add to family calendar'}
        icon={<CalendarIcon className="w-5 h-5 text-emerald-400" />}
        footer={
          <div className="w-full flex items-center justify-between gap-3">
            {editingEventId ? (
              <button
                type="button"
                onClick={async () => {
                  await handleDeleteEvent(editingEventId);
                  setIsModalOpen(false);
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
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
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="event-form"
                disabled={!formTitle.trim() || isSaving}
                className="min-h-[40px] px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{editingEventId ? 'Save' : 'Add Event'}</span>
              </button>
            </div>
          </div>
        }
      >
        {/* EVENT FORM */}
        <form id="event-form" onSubmit={handleSaveModal} className="space-y-3.5">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Event Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Soccer game, Dentist, Family Dinner..."
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
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
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Assign Member
              </label>
              <select
                value={formAssignedUser}
                onChange={(e) => setFormAssignedUser(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
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
              className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-white/20 focus:ring-emerald-500"
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
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
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
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
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
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
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
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>
        </form>
      </Drawer>

      {/* Floating Feedback Toast */}
      {assistantFeedback && (
        <div className="fixed bottom-[calc(76px+4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-20 left-4 right-4 z-50 flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2 pointer-events-auto backdrop-blur-xl ${
              assistantFeedback.type === 'success'
                ? 'bg-slate-900/95 border-emerald-500/40 text-emerald-300 shadow-emerald-500/20'
                : 'bg-red-950/95 border-red-500/40 text-red-200 shadow-red-500/20'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
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
                ? 'w-full rounded-3xl border-white/25 bg-slate-900/95 backdrop-blur-xl shadow-emerald-500/10 px-2.5'
                : 'w-[50px] rounded-full border-emerald-400/40 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 cursor-pointer shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 justify-center'
            }`}
          >
            {!isQuickAddExpanded ? (
              <button
                type="button"
                onClick={() => setIsQuickAddExpanded(true)}
                className="w-full h-full flex items-center justify-center text-slate-950 cursor-pointer"
                title="Add Event"
              >
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </button>
            ) : (
              <div className="w-full flex items-center gap-2 animate-in fade-in duration-200">
                {/* Close button */}
                <button
                  type="button"
                  onClick={() => setIsQuickAddExpanded(false)}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
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
                  className="h-8 px-2 sm:px-2.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                  title="Open full event form"
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Details</span>
                </button>

                {/* Form for input and submit button */}
                <form onSubmit={handleAssistantSchedule} className="flex-1 min-w-0 flex items-center gap-2">
                  {/* Single Smart Input: Just type what you want to add */}
                  <input
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
                    className="h-8 px-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 shrink-0 active:scale-95 cursor-pointer"
                  >
                    {isAssistantSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    )}
                    <span>{isAssistantSubmitting ? 'Adding...' : 'Add'}</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
