import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Users,
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

export const CalendarPage: React.FC = () => {
  const { household, users, currentUser } = usePWA();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newEventStartTime, setNewEventStartTime] = useState('09:00');
  const [newEventEndTime, setNewEventEndTime] = useState('10:00');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventAssignedUser, setNewEventAssignedUser] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const loadEvents = async () => {
    if (!household) return;
    setIsLoading(true);
    try {
      const data = await api.getCalendarEvents(household.id);
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [household]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !newEventTitle.trim()) return;

    try {
      const startIso = new Date(`${newEventDate}T${newEventStartTime}:00`).toISOString();
      const endIso = new Date(`${newEventDate}T${newEventEndTime}:00`).toISOString();

      const created = await api.createCalendarEvent(household.id, {
        title: newEventTitle.trim(),
        start_time: startIso,
        end_time: endIso,
        location: newEventLocation.trim() || undefined,
        assigned_user_id: newEventAssignedUser || undefined,
      });

      setEvents((prev) => [...prev, created]);
      setNewEventTitle('');
      setNewEventLocation('');
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Failed to create event:', err);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
      await api.deleteCalendarEvent(id);
    } catch (err) {
      console.error('Failed to delete event:', err);
      loadEvents();
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (selectedUserFilter === 'all') return true;
    return ev.assigned_user_id === selectedUserFilter;
  });

  return (
    <div className="max-w-6xl mx-auto p-2 sm:p-4 pb-24 md:pb-12 space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-3xl glass-panel border border-white/10">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Family Calendar
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Coordinate schedules, school events, and sports practices
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Week Navigation */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => setCurrentDate(addDays(currentDate, -7))}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-200 px-2 font-mono">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </span>
            <button
              onClick={() => setCurrentDate(addDays(currentDate, 7))}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        </div>
      </div>

      {/* Member Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
          <Users className="w-3.5 h-3.5" /> Filter:
        </span>
        <button
          onClick={() => setSelectedUserFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            selectedUserFilter === 'all'
              ? 'bg-indigo-500 text-white shadow-md'
              : 'glass-panel text-slate-400 hover:text-slate-200'
          }`}
        >
          All Members
        </button>
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => setSelectedUserFilter(u.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedUserFilter === u.id
                ? 'bg-indigo-500 text-white shadow-md'
                : 'glass-panel text-slate-400 hover:text-slate-200'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: u.avatar_color }}
            />
            {u.name}
          </button>
        ))}
      </div>

      {/* 7-Day Calendar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {daysInWeek.map((day) => {
          const isToday = isSameDay(day, new Date());
          const dayEvents = filteredEvents.filter((ev) => {
            try {
              return isSameDay(parseISO(ev.start_time), day);
            } catch {
              return false;
            }
          });

          return (
            <div
              key={day.toISOString()}
              className={`rounded-3xl glass-panel p-3 border flex flex-col min-h-[320px] transition-all ${
                isToday
                  ? 'border-indigo-500/50 ring-1 ring-indigo-500/20 shadow-lg shadow-indigo-500/5'
                  : 'border-white/10'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-2">
                <div>
                  <div
                    className={`text-xs font-bold ${
                      isToday ? 'text-indigo-400' : 'text-slate-200'
                    }`}
                  >
                    {format(day, 'EEEE')}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {format(day, 'MMM d')}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setNewEventDate(format(day, 'yyyy-MM-dd'));
                    setIsAddModalOpen(true);
                  }}
                  className="p-1 rounded-xl bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-400 text-slate-400 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Event Cards */}
              <div className="flex-1 space-y-2">
                {dayEvents.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[11px] text-slate-600 italic">
                    No events
                  </div>
                ) : (
                  dayEvents.map((ev) => {
                    const assignedUser = users.find((u) => u.id === ev.assigned_user_id);
                    return (
                      <div
                        key={ev.id}
                        className="p-2.5 rounded-2xl bg-slate-900/80 border border-white/5 hover:border-white/15 transition-all group relative overflow-hidden"
                      >
                        {/* Member Color Accent Bar */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1"
                          style={{
                            backgroundColor: assignedUser?.avatar_color || '#6366f1',
                          }}
                        />

                        <div className="pl-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-mono text-indigo-300 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(parseISO(ev.start_time), 'h:mm a')}
                            </span>
                            <button
                              onClick={() => handleDeleteEvent(ev.id)}
                              className="p-0.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="text-xs font-bold text-slate-100 mt-1 leading-snug">
                            {ev.title}
                          </div>

                          {ev.location && (
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              <span className="truncate">{ev.location}</span>
                            </div>
                          )}

                          {assignedUser && (
                            <div className="mt-1.5 flex items-center gap-1">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: assignedUser.avatar_color }}
                              />
                              <span className="text-[10px] text-slate-300 font-medium">
                                {assignedUser.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Event Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/10 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-indigo-400" />
              Schedule Family Event
            </h3>

            <form onSubmit={handleAddEvent} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Soccer Tournament, Dentist Appointment..."
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
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
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Assign Member
                  </label>
                  <select
                    value={newEventAssignedUser}
                    onChange={(e) => setNewEventAssignedUser(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Everyone / Whole Family</option>
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
                    value={newEventStartTime}
                    onChange={(e) => setNewEventStartTime(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={newEventEndTime}
                    onChange={(e) => setNewEventEndTime(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
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
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newEventTitle.trim()}
                  className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-lg shadow-indigo-500/20"
                >
                  Schedule Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
