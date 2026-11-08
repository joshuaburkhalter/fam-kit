import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
} from 'date-fns';
import type { CalendarEvent } from '../types';
import { usePWA } from '../context/PWAContext';
import { useRegisterFab } from '../context/ActionFabContext';
import { api } from '../lib/api';
import { Drawer } from '../components/ui/Drawer';
import { Toast } from '../components/ui/Toast';
import {
  CalendarHeader,
  CalendarViewMode,
} from '../components/calendar/CalendarHeader';
import { MonthView } from '../components/calendar/MonthView';
import { WeekView } from '../components/calendar/WeekView';
import { DayView } from '../components/calendar/DayView';

// Module-level calendar cache for instant zero-latency page transitions
let calendarCache: { householdId: string; events: CalendarEvent[] } | null = null;

export const clearCalendarCache = () => {
  calendarCache = null;
};

export const CalendarPage: React.FC = () => {
  const { currentUser, household, users } = usePWA();
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    if (calendarCache && household && calendarCache.householdId === household.id) {
      return calendarCache.events;
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return !calendarCache || calendarCache.householdId !== household?.id;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Calendar View & Navigation (Desktop Google Calendar style)
  const [calendarView, setCalendarView] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  // Filter & Agenda State
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [agendaDaysCount, setAgendaDaysCount] = useState<number>(14);
  const [showPastEvents, setShowPastEvents] = useState<boolean>(false);
  const [pastDaysCount, setPastDaysCount] = useState<number>(14);

  // Live Current Time state for horizontal indicator lines
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastAction, setToastAction] = useState<{ label: string; onClick: () => void } | undefined>(undefined);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (
    msg: string,
    action?: { label: string; onClick: () => void },
    duration: number = 3600
  ) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    setToastAction(action);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      setToastAction(undefined);
    }, duration);
  };

  const setEventsWithCache = (updater: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) => {
    setEvents((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (household) {
        calendarCache = { householdId: household.id, events: next };
      }
      return next;
    });
  };

  // Unified Add / Edit Modal State
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

  const loadData = async (silent = false) => {
    if (!household) return;
    const hasCache = calendarCache && calendarCache.householdId === household.id;
    if (!silent && !hasCache) {
      setIsLoading(true);
    }
    try {
      const eventData = await api.getCalendarEvents(household.id);
      setEventsWithCache(eventData);
    } catch (err) {
      console.error('Failed to load calendar events:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await api.syncGoogleCalendar();
      await loadData(true);
      showToast('Google Calendar synced');
    } catch (err) {
      console.error('Failed to sync Google Calendar:', err);
      showToast('Failed to sync Google Calendar');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setTimeout(() => {
      loadData(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [household]);

  // Filter events by assigned member
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (selectedMemberId === 'all') return true;
      return ev.assigned_user_id === selectedMemberId;
    });
  }, [events, selectedMemberId]);

  // Register bottom speed-dial FAB actions for Calendar
  useRegisterFab(
    useMemo(
      () => ({
        pillLabel: 'Event',
        icon: Plus,
        actions: [
          {
            id: 'add-calendar-event',
            label: 'Add Event',
            icon: Plus,
            color: 'emerald',
            onClick: () => handleOpenAddModal(),
          },
          {
            id: 'sync-google-calendar',
            label: 'Sync Google Calendar',
            icon: RefreshCw,
            color: 'teal',
            onClick: handleManualSync,
          },
        ],
      }),
      [handleManualSync]
    ),
    [handleManualSync]
  );

  // Dynamic Navigation Title based on view mode (Google Calendar style)
  const headerTitle = useMemo(() => {
    if (calendarView === 'month') {
      return format(currentDate, 'MMMM yyyy');
    }
    if (calendarView === 'week') {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      if (isSameMonth(weekStart, weekEnd)) {
        return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'd, yyyy')}`;
      }
      return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    if (calendarView === 'day') {
      return format(currentDate, 'MMMM d, yyyy');
    }
    return format(currentDate, 'MMMM yyyy');
  }, [calendarView, currentDate]);

  // Navigation handlers
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handlePrev = () => {
    if (calendarView === 'month') {
      setCurrentDate((prev) => subMonths(prev, 1));
    } else if (calendarView === 'week') {
      setCurrentDate((prev) => subWeeks(prev, 1));
    } else if (calendarView === 'day') {
      setCurrentDate((prev) => subDays(prev, 1));
    } else {
      setShowPastEvents(true);
    }
  };

  const handleNext = () => {
    if (calendarView === 'month') {
      setCurrentDate((prev) => addMonths(prev, 1));
    } else if (calendarView === 'week') {
      setCurrentDate((prev) => addWeeks(prev, 1));
    } else if (calendarView === 'day') {
      setCurrentDate((prev) => addDays(prev, 1));
    } else {
      setAgendaDaysCount((prev) => prev + 14);
    }
  };

  // Add / Edit Modal handlers
  const handleOpenAddModal = (dateStr?: string, timeStr?: string) => {
    setEditingEventId(null);
    setFormTitle('');
    setFormDescription('');
    setFormDate(dateStr || format(currentDate, 'yyyy-MM-dd'));
    setFormIsAllDay(!timeStr);
    setFormStartTime(timeStr || '09:00');
    setFormEndTime(
      timeStr
        ? `${String((parseInt(timeStr.split(':')[0], 10) + 1) % 24).padStart(2, '0')}:${
            timeStr.split(':')[1] || '00'
          }`
        : '10:00'
    );
    setFormLocation('');
    setFormAssignedUser(currentUser?.id || '');
    setIsModalOpen(true);
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
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !formTitle.trim()) return;
    setIsSaving(true);

    try {
      const startTimeVal = formIsAllDay ? '' : formStartTime;
      const endTimeVal = formIsAllDay ? '' : formEndTime;
      const startStr = formIsAllDay
        ? `${formDate}T00:00:00`
        : `${formDate}T${startTimeVal || '09:00'}:00`;
      const endStr = formIsAllDay
        ? `${formDate}T23:59:59`
        : `${formDate}T${endTimeVal || '10:00'}:00`;

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
        setEventsWithCache((prev) => prev.map((it) => (it.id === editingEventId ? updated : it)));
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
        setEventsWithCache((prev) => [...prev, created]);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save event:', err);
      showToast('Failed to save event');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = (id: string) => {
    const eventToDelete = events.find((ev) => ev.id === id);
    if (!eventToDelete) return;

    setEventsWithCache((prev) => prev.filter((ev) => ev.id !== id));
    setIsModalOpen(false);

    let undoClicked = false;
    showToast(`Deleted "${eventToDelete.title}"`, {
      label: 'Undo',
      onClick: async () => {
        undoClicked = true;
        if (!household) return;
        setEventsWithCache((prev) =>
          prev.some((ev) => ev.id === eventToDelete.id) ? prev : [...prev, eventToDelete]
        );

        try {
          const restored = await api.createCalendarEvent(household.id, {
            title: eventToDelete.title,
            description: eventToDelete.description,
            start_time: eventToDelete.start_time,
            end_time: eventToDelete.end_time,
            is_all_day: eventToDelete.is_all_day,
            location: eventToDelete.location,
            assigned_user_id: eventToDelete.assigned_user_id,
          });
          setEventsWithCache((prev) =>
            prev.map((ev) => (ev.id === eventToDelete.id ? restored : ev))
          );
          showToast(`Restored "${eventToDelete.title}"`);
        } catch (err) {
          console.error('Failed to restore event:', err);
          showToast('Failed to restore event');
        }
      },
    });

    (async () => {
      try {
        await api.deleteCalendarEvent(id);
      } catch (err) {
        console.error('Failed to delete event in background:', err);
        if (!undoClicked) {
          setEventsWithCache((prev) =>
            prev.some((ev) => ev.id === eventToDelete.id) ? prev : [...prev, eventToDelete]
          );
          showToast('Failed to delete event');
        }
      }
    })();
  };

  // Helper for Agenda / Schedule View
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

  const upcomingDays = eachDayOfInterval({
    start: todayStart,
    end: addDays(todayStart, agendaDaysCount),
  });

  const pastDays = eachDayOfInterval({
    start: subDays(todayStart, pastDaysCount),
    end: yesterday,
  }).reverse();

  const timelineDays = showPastEvents ? pastDays : upcomingDays;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 pb-28 md:pb-20 space-y-4">
      {/* Top Google Calendar Header */}
      <CalendarHeader
        title={headerTitle}
        viewMode={calendarView}
        onViewModeChange={setCalendarView}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        selectedMemberId={selectedMemberId}
        onSelectMember={setSelectedMemberId}
        users={users}
        isLoading={isLoading}
        isSyncing={isSyncing}
        onAddEvent={() => handleOpenAddModal()}
        onSyncGoogle={handleManualSync}
      />

      {/* Primary Calendar Views */}
      {calendarView === 'month' && (
        <MonthView
          currentDate={currentDate}
          events={filteredEvents}
          users={users}
          onSelectEvent={handleOpenEditModal}
          onAddEvent={(dateStr) => handleOpenAddModal(dateStr)}
          onSelectDate={(date) => {
            setCurrentDate(date);
            setCalendarView('day');
          }}
        />
      )}

      {calendarView === 'week' && (
        <WeekView
          currentDate={currentDate}
          events={filteredEvents}
          users={users}
          currentTime={currentTime}
          onSelectEvent={handleOpenEditModal}
          onAddEvent={(dateStr, timeStr) => handleOpenAddModal(dateStr, timeStr)}
        />
      )}

      {calendarView === 'day' && (
        <DayView
          currentDate={currentDate}
          events={filteredEvents}
          users={users}
          currentTime={currentTime}
          onSelectEvent={handleOpenEditModal}
          onAddEvent={(dateStr, timeStr) => handleOpenAddModal(dateStr, timeStr)}
        />
      )}

      {calendarView === 'schedule' && (
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Agenda Feed ({filteredEvents.length} total events)
            </span>
            <button
              type="button"
              onClick={() => setShowPastEvents((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${
                showPastEvents
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                  : 'bg-slate-900 text-slate-300 hover:text-white border-white/10'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{showPastEvents ? 'Showing Past Events' : 'Show Past Events'}</span>
              {pastEventsCount > 0 && <span>({pastEventsCount})</span>}
            </button>
          </div>

          <div className="relative pt-2">
            <div className="absolute left-[4.5rem] -translate-x-1/2 top-4 bottom-14 w-[2px] bg-slate-800 pointer-events-none" />

            {timelineDays.map((day, idx) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isCurDay = isToday(day);
              const dayEvents = filteredEvents
                .filter((ev) => {
                  try {
                    return isSameDay(parseISO(ev.start_time), day);
                  } catch {
                    return false;
                  }
                })
                .sort((a, b) => {
                  const aAll = a.is_all_day ? 1 : 0;
                  const bAll = b.is_all_day ? 1 : 0;
                  if (aAll !== bAll) return bAll - aAll;
                  try {
                    return parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime();
                  } catch {
                    return 0;
                  }
                });

              const prevDay = idx > 0 ? timelineDays[idx - 1] : null;
              const isFirstOfMonth = !prevDay || format(prevDay, 'M') !== format(day, 'M');

              return (
                <React.Fragment key={dateStr}>
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

                  <div className="relative flex items-start gap-3 py-2.5 group">
                    <div className="w-14 shrink-0 text-right pr-2">
                      <div
                        className={`text-xs font-bold uppercase tracking-wider ${
                          isCurDay ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {format(day, 'EEE')}
                      </div>
                      <div
                        className={`text-base font-black ${
                          isCurDay ? 'text-emerald-400' : 'text-white'
                        }`}
                      >
                        {format(day, 'd')}
                      </div>
                    </div>

                    <div className="w-6 shrink-0 flex items-center justify-center pt-1.5 relative z-10">
                      <div
                        className={`w-3 h-3 rounded-full border-2 border-slate-950 ${
                          isCurDay ? 'bg-emerald-400 ring-4 ring-emerald-400/20' : 'bg-slate-700'
                        }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      {dayEvents.length > 0 ? (
                        dayEvents.map((ev) => {
                          const assignedUser = users.find((u) => u.id === ev.assigned_user_id);
                          return (
                            <div
                              key={ev.id}
                              onClick={() => handleOpenEditModal(ev)}
                              className="p-3.5 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-white/10 hover:border-white/20 transition-all cursor-pointer shadow-sm group/item"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-sm text-white group-hover/item:text-emerald-300 transition-colors">
                                  {ev.title}
                                </span>
                                {assignedUser && (
                                  <span
                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shrink-0"
                                    style={{
                                      backgroundColor: assignedUser.avatar_color || '#10b981',
                                    }}
                                  >
                                    {assignedUser.name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                                <span className="flex items-center gap-1 font-mono">
                                  <Clock className="w-3.5 h-3.5" />
                                  {ev.is_all_day
                                    ? 'All Day'
                                    : `${format(parseISO(ev.start_time), 'h:mm a')}`}
                                </span>
                                {ev.location && (
                                  <span className="flex items-center gap-1 truncate">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {ev.location}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div
                          onClick={() => handleOpenAddModal(dateStr)}
                          className="py-2 px-3 rounded-xl hover:bg-white/5 text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer flex items-center justify-between"
                        >
                          <span>{isCurDay ? 'No events today' : 'No events'}</span>
                          <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                            <Plus className="w-3 h-3" /> Add Event
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            {(!showPastEvents || pastEventsCount > 0) && (
              <div className="pt-4 pb-2 flex justify-center">
                {showPastEvents ? (
                  <button
                    type="button"
                    onClick={() => setPastDaysCount((prev) => prev + 14)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 border border-amber-500/30 hover:border-amber-500/60 text-amber-300 text-xs font-semibold cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span>Show More Past Events</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAgendaDaysCount((prev) => prev + 14)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 border border-white/10 hover:border-emerald-500/40 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span>Load 14 More Days</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
                onClick={() => handleDeleteEvent(editingEventId)}
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

      <Toast
        message={toastMessage}
        action={toastAction}
        onClose={() => {
          setToastMessage(null);
          setToastAction(undefined);
        }}
      />
    </div>
  );
};
