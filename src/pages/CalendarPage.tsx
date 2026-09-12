import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  parseISO,
} from 'date-fns';
import type { CalendarEvent } from '../types';
import { usePWA } from '../context/PWAContext';
import { api } from '../lib/api';
import { useFabAutoClose } from '../hooks/useFabAutoClose';

export const CalendarPage: React.FC = () => {
  const { household, users } = usePWA();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isWeekDropdownOpen, setIsWeekDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsWeekDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Accordion open/close state per date 'yyyy-MM-dd'
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return { [todayStr]: true };
  });

  // Inline add input per date 'yyyy-MM-dd'
  const [inlineInputs, setInlineInputs] = useState<Record<string, string>>({});

  // Unified Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formLocation, setFormLocation] = useState('');
  const [formAssignedUser, setFormAssignedUser] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Quick Add State (Bottom-Right FAB)
  const [isQuickAddExpanded, setIsQuickAddExpanded] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [quickDate, setQuickDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const dockRef = useFabAutoClose<HTMLDivElement>({
    isOpen: isQuickAddExpanded,
    onClose: () => setIsQuickAddExpanded(false),
    ignore: isModalOpen,
  });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const isCurrentWeek = isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weekEvents = events.filter((ev) => {
    try {
      const d = parseISO(ev.start_time);
      return d >= weekStart && d <= weekEnd;
    } catch {
      return false;
    }
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
  }, [household, currentDate]);

  const formatTimeRange = (startTimeIso: string, endTimeIso?: string) => {
    try {
      const start = parseISO(startTimeIso);
      const startStr = format(start, 'h:mm a');
      if (!endTimeIso) return startStr;
      const end = parseISO(endTimeIso);
      const endStr = format(end, 'h:mm a');
      return `${startStr} – ${endStr}`;
    } catch {
      return 'Scheduled';
    }
  };

  const toggleDay = (dateStr: string, defaultOpen: boolean) => {
    setExpandedDays((prev) => {
      const current = prev[dateStr] !== undefined ? prev[dateStr] : defaultOpen;
      return {
        ...prev,
        [dateStr]: !current,
      };
    });
  };

  const handleOpenAddModal = (dateStr?: string) => {
    setEditingEventId(null);
    setFormTitle('');
    setFormDate(dateStr || format(new Date(), 'yyyy-MM-dd'));
    setFormStartTime('09:00');
    setFormEndTime('10:00');
    setFormLocation('');
    setFormAssignedUser('');
    setIsModalOpen(true);
    setIsQuickAddExpanded(false);
  };

  const handleOpenEditModal = (ev: CalendarEvent) => {
    setEditingEventId(ev.id);
    setFormTitle(ev.title);
    setFormDate(ev.start_time.split('T')[0]);
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
      const startIso = new Date(`${formDate}T${formStartTime}:00`).toISOString();
      const endIso = new Date(`${formDate}T${formEndTime}:00`).toISOString();

      if (editingEventId) {
        const updated = await api.updateCalendarEvent(household.id, editingEventId, {
          title: formTitle.trim(),
          start_time: startIso,
          end_time: endIso,
          location: formLocation.trim() || undefined,
          assigned_user_id: formAssignedUser || undefined,
        });
        setEvents((prev) => prev.map((it) => (it.id === editingEventId ? updated : it)));
      } else {
        const created = await api.createCalendarEvent(household.id, {
          title: formTitle.trim(),
          start_time: startIso,
          end_time: endIso,
          location: formLocation.trim() || undefined,
          assigned_user_id: formAssignedUser || undefined,
        });
        setEvents((prev) => [...prev, created]);
        setExpandedDays((prev) => ({ ...prev, [formDate]: true }));
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

  const handleInlineAdd = async (e: React.FormEvent, dateStr: string) => {
    e.preventDefault();
    const raw = inlineInputs[dateStr]?.trim();
    if (!household || !raw) return;

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
        start_time: `${dateStr}T${startTime}:00`,
        end_time: `${dateStr}T${endTime}:00`,
      });
      setEvents((prev) => [...prev, created]);
      setInlineInputs((prev) => ({ ...prev, [dateStr]: '' }));
    } catch (err) {
      console.error('Failed to inline add event:', err);
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
      });
      setEvents((prev) => [...prev, created]);
      setExpandedDays((prev) => ({ ...prev, [quickDate]: true }));
      setQuickInput('');
      setIsQuickAddExpanded(false);
    } catch (err) {
      console.error('Failed to quick add event:', err);
      loadData();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-2 sm:p-4 pb-36 md:pb-28 space-y-4">
      {/* Sleek, Full-Width Week Header (styled identically to the List Selector) */}
      <div className="relative z-30 w-full" ref={dropdownRef}>
        <div className="relative w-full">
          <button
            type="button"
            onClick={() => setIsWeekDropdownOpen(!isWeekDropdownOpen)}
            className="w-full flex items-center justify-between bg-slate-900/90 hover:bg-slate-850 border border-white/15 hover:border-indigo-500/40 px-4 py-2.5 sm:py-3 rounded-2xl transition-all group shadow-md"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl shrink-0">📅</span>
              <span className="text-sm sm:text-base font-bold text-white group-hover:text-indigo-400 transition-colors truncate">
                {isCurrentWeek
                  ? 'This Week'
                  : `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`}
              </span>
              <span className="text-xs font-mono text-slate-400 hidden sm:inline">
                ({format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')})
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Quick prev/next week arrows */}
              <div className="flex items-center gap-0.5 bg-white/5 rounded-xl p-0.5 border border-white/5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentDate(addDays(currentDate, -7));
                  }}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  title="Previous Week"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentDate(addDays(currentDate, 7));
                  }}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  title="Next Week"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {isLoading ? (
                <span className="text-xs bg-slate-800/80 text-slate-400 font-mono px-2.5 py-0.5 rounded-full border border-white/10 font-semibold animate-pulse">
                  loading...
                </span>
              ) : (
                <span className="text-xs bg-indigo-500/15 text-indigo-400 font-mono px-2.5 py-0.5 rounded-full border border-indigo-500/30 font-semibold">
                  {weekEvents.length} {weekEvents.length === 1 ? 'event' : 'events'}
                </span>
              )}

              <ChevronDown
                className={`w-4 h-4 text-slate-400 group-hover:text-white transition-transform duration-200 ${
                  isWeekDropdownOpen ? 'rotate-180 text-indigo-400' : ''
                }`}
              />
            </div>
          </button>

          {/* Dropdown Menu */}
          {isWeekDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 w-full max-w-md bg-slate-900/95 backdrop-blur-xl rounded-2xl p-2 shadow-2xl z-50 border border-white/15 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/5">
                Switch Calendar Week
              </div>

              <div className="py-1.5 space-y-1">
                {/* This Week Option */}
                <button
                  type="button"
                  onClick={() => {
                    setCurrentDate(new Date());
                    setIsWeekDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    isCurrentWeek
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      : 'hover:bg-white/5 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">📅</span>
                    <span>This Week (Today)</span>
                  </div>
                  {isCurrentWeek && <Check className="w-4 h-4" />}
                </button>

                {/* Next Week */}
                <button
                  type="button"
                  onClick={() => {
                    setCurrentDate(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7));
                    setIsWeekDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold hover:bg-white/5 text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">⏭️</span>
                    <span>Next Week</span>
                  </div>
                </button>

                {/* Last Week */}
                <button
                  type="button"
                  onClick={() => {
                    setCurrentDate(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), -7));
                    setIsWeekDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold hover:bg-white/5 text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">⏮️</span>
                    <span>Last Week</span>
                  </div>
                </button>

                {/* In 2 Weeks */}
                <button
                  type="button"
                  onClick={() => {
                    setCurrentDate(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 14));
                    setIsWeekDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold hover:bg-white/5 text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🗓️</span>
                    <span>In 2 Weeks</span>
                  </div>
                </button>
              </div>

              {/* Schedule Event Button in Dropdown */}
              <div className="pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setIsWeekDropdownOpen(false);
                    handleOpenAddModal(format(currentDate, 'yyyy-MM-dd'));
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-bold transition-colors border border-indigo-500/30"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Schedule New Event</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Daily Accordions List */}
      <div className="space-y-2">
        {daysInWeek.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isToday = isSameDay(day, new Date());

          const dayEvents = events.filter((ev) => {
            try {
              return isSameDay(parseISO(ev.start_time), day);
            } catch {
              return false;
            }
          });

          const isExpanded =
            expandedDays[dateStr] !== undefined ? expandedDays[dateStr] : isToday;

          return (
            <div
              key={dateStr}
              className={`rounded-xl border transition-all overflow-hidden ${
                isToday
                  ? 'border-indigo-500/40 bg-slate-900/90 shadow-sm shadow-indigo-500/10'
                  : 'border-white/10 bg-slate-900/60 hover:border-white/15'
              }`}
            >
              {/* Accordion Day Header */}
              <div
                onClick={() => toggleDay(dateStr, isToday)}
                className={`flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 cursor-pointer select-none transition-colors ${
                  isToday
                    ? 'bg-indigo-500/10 hover:bg-indigo-500/15'
                    : 'hover:bg-white/[0.03]'
                }`}
              >
                {/* Left: Day Title & Date */}
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isToday
                        ? 'bg-indigo-400 ring-2 ring-indigo-400/30'
                        : dayEvents.length > 0
                        ? 'bg-emerald-400'
                        : 'bg-slate-600'
                    }`}
                  />
                  <span
                    className={`text-sm sm:text-base font-semibold truncate ${
                      isToday ? 'text-indigo-300 font-bold' : 'text-slate-100'
                    }`}
                  >
                    {format(day, 'EEEE')}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {format(day, 'MMM d')}
                  </span>
                  {isToday && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Today
                    </span>
                  )}
                </div>

                {/* Right: Count Badge, Plus Button & Chevron */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-mono px-2 py-0.5 rounded font-medium ${
                      dayEvents.length > 0
                        ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                        : 'bg-white/5 text-slate-500'
                    }`}
                  >
                    {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                  </span>

                  {/* Plus button on right side of accordion */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenAddModal(dateStr);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    title={`Add event on ${format(day, 'MMM d')}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  <div className="text-slate-400 p-0.5">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-300" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* Accordion Content (Inside Day) */}
              {isExpanded && (
                <div className="p-2.5 sm:p-3 space-y-1.5 border-t border-white/5 bg-slate-950/40">
                  {/* Event Items List */}
                  {dayEvents.length === 0 ? (
                    <div className="py-2.5 text-center text-xs text-slate-500 italic">
                      No events scheduled for {format(day, 'EEEE')}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {dayEvents.map((ev) => {
                        const assignedUser = users.find((u) => u.id === ev.assigned_user_id);
                        return (
                          <div
                            key={ev.id}
                            onClick={() => handleOpenEditModal(ev)}
                            className="relative overflow-hidden flex items-center justify-between py-2.5 px-3 pl-3.5 sm:pl-4 rounded-lg bg-slate-900/80 hover:bg-slate-850 border border-white/5 hover:border-white/15 transition-all cursor-pointer group shadow-sm"
                          >
                            {/* Member Color Stripe on Left */}
                            <div
                              className="absolute left-0 top-0 bottom-0 w-1 sm:w-1.5"
                              style={{
                                backgroundColor: assignedUser?.avatar_color || '#818cf8',
                              }}
                            />

                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Time */}
                              <div className="text-xs font-mono text-indigo-300/90 font-medium shrink-0 flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-indigo-400/80" />
                                <span>{formatTimeRange(ev.start_time, ev.end_time)}</span>
                              </div>

                              {/* Title & Location */}
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-xs sm:text-sm font-medium text-slate-100 group-hover:text-white truncate">
                                  {ev.title}
                                </span>
                                {ev.location && (
                                  <span className="text-[11px] text-slate-400 hidden sm:flex items-center gap-1 shrink-0 truncate">
                                    <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span className="truncate">{ev.location}</span>
                                  </span>
                                )}
                              </div>

                              {/* Assigned Member Label */}
                              {assignedUser && (
                                <span className="text-[11px] text-slate-400 font-medium hidden md:inline shrink-0">
                                  {assignedUser.name}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Inline Quick Add Input */}
                  <form
                    onSubmit={(e) => handleInlineAdd(e, dateStr)}
                    className="flex items-center gap-2 pt-1"
                  >
                    <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-white/10 focus-within:border-indigo-500/50 transition-colors">
                      <Plus className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <input
                        type="text"
                        placeholder={`Add event to ${format(day, 'EEEE')} (e.g. Maya Soccer 4:30pm)...`}
                        value={inlineInputs[dateStr] || ''}
                        onChange={(e) =>
                          setInlineInputs((prev) => ({ ...prev, [dateStr]: e.target.value }))
                        }
                        className="flex-1 bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                    {inlineInputs[dateStr]?.trim() && (
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm shrink-0"
                      >
                        Add
                      </button>
                    )}
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unified Add / Edit Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl border border-white/10 space-y-4 bg-slate-900/95 backdrop-blur-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingEventId ? 'Edit Event' : 'Schedule Event'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingEventId ? 'Update details, time, or member' : 'Add an activity or appointment'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* EVENT FORM */}
            <form onSubmit={handleSaveModal} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Event Title
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Assign Member
                  </label>
                  <select
                    value={formAssignedUser}
                    onChange={(e) => setFormAssignedUser(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Whole Family / All</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
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
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Location (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Central Park Field 4, Dr. Smith Office..."
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/5">
                {editingEventId ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleDeleteEvent(editingEventId);
                      setIsModalOpen(false);
                    }}
                    className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!formTitle.trim() || isSaving}
                    className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-lg shadow-indigo-500/20 flex items-center gap-1.5"
                  >
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
                title="Add Event"
              >
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </button>
            ) : (
              <form onSubmit={handleQuickAdd} className="w-full flex items-center gap-2">
                {/* 1. Far Left: Close button */}
                <button
                  type="button"
                  onClick={() => setIsQuickAddExpanded(false)}
                  className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* 2. Secondary action: Full Modal Options Button */}
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

                {/* 3. Secondary action: Date selector */}
                <input
                  type="date"
                  value={quickDate}
                  onChange={(e) => setQuickDate(e.target.value)}
                  className="bg-white/5 border border-white/10 text-xs text-slate-300 rounded-2xl px-2 py-2 focus:outline-none focus:border-indigo-500 shrink-0"
                />

                {/* 4. Middle: Input */}
                <input
                  autoFocus
                  type="text"
                  placeholder="Add event (e.g. Soccer 4:30pm)..."
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none py-2 px-1"
                />

                {/* 5. Far Right: Add Button */}
                <button
                  type="submit"
                  disabled={!quickInput.trim()}
                  className="p-2 sm:px-3.5 sm:py-2 rounded-2xl text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 disabled:opacity-40 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 shadow-indigo-500/20"
                  title="Add Event"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add Event</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
