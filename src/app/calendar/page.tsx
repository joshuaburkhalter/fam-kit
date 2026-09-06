'use client';

import React, { useState, useEffect } from 'react';
import { usePWA } from '@/components/pwa/PWAProvider';
import { CalendarEventData, FamilyMember } from '@/types';
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Trash2,
  X,
  Sparkles
} from 'lucide-react';

export default function CalendarPage() {
  const { activeMember, household } = usePWA();
  const [events, setEvents] = useState<CalendarEventData[]>([]);
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);

  // Add/Edit Event Modal
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventStartTime, setEventStartTime] = useState('16:00');
  const [eventEndTime, setEventEndTime] = useState('17:00');
  const [eventCategory, setEventCategory] = useState<CalendarEventData['category']>('Family');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventAssignedMemberId, setEventAssignedMemberId] = useState<string>('');

  // Fetch events
  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const url =
        selectedMemberFilter !== 'all'
          ? `/api/calendar?memberId=${selectedMemberFilter}`
          : '/api/calendar';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [selectedMemberFilter]);

  // Create Event
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDate) return;

    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: eventTitle.trim(),
          date: eventDate,
          startTime: eventStartTime || undefined,
          endTime: eventEndTime || undefined,
          category: eventCategory,
          location: eventLocation.trim() || undefined,
          description: eventDescription.trim() || undefined,
          assignedMemberId: eventAssignedMemberId || undefined,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setEvents((prev) => [...prev, created]);
        setShowEventModal(false);
        setEventTitle('');
        setEventLocation('');
        setEventDescription('');
      }
    } catch (err) {
      console.error('Failed to create event:', err);
    }
  };

  // Delete Event
  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    setEvents((prev) => prev.filter((e) => e.id !== id));
    try {
      await fetch(`/api/calendar?id=${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  // Month navigation calculation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Get days to render in 35/42 grid
  const daysInMonth = lastDayOfMonth.getDate();
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun

  const calendarDays = [];
  // Prev month padding
  for (let i = 0; i < startDayOfWeek; i++) {
    const prevDate = new Date(year, month, 0 - (startDayOfWeek - 1 - i));
    calendarDays.push({
      dateStr: prevDate.toISOString().split('T')[0],
      dayNum: prevDate.getDate(),
      isCurrentMonth: false,
    });
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    calendarDays.push({
      dateStr: d.toISOString().split('T')[0],
      dayNum: i,
      isCurrentMonth: true,
      isToday: d.toDateString() === new Date().toDateString(),
    });
  }
  // Next month padding to fill 35 or 42
  const remaining = 35 - calendarDays.length;
  if (remaining > 0) {
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      calendarDays.push({
        dateStr: nextDate.toISOString().split('T')[0],
        dayNum: i,
        isCurrentMonth: false,
      });
    }
  }

  const categoryColors: Record<string, string> = {
    Sports: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    School: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    Work: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    Appointment: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    Family: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    Celebration: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <CalendarIcon className="w-7 h-7 text-emerald-400" />
            Family Shared Calendar
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Keep track of everyone's schedules, school activities, sports, and family events.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEventDate(new Date().toISOString().split('T')[0]);
              setShowEventModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all hover:scale-102"
          >
            <Plus className="w-4 h-4" />
            <span>Add Event</span>
          </button>
        </div>
      </div>

      {/* Member Filter Bar */}
      {household?.members && household.members.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedMemberFilter('all')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
              selectedMemberFilter === 'all'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>👨‍👩‍👧‍👦</span>
            <span>All Family</span>
          </button>

          {household.members.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelectedMemberFilter(member.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
                selectedMemberFilter === member.id
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>{member.avatar}</span>
              <span>{member.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Month Navigator */}
      <div className="flex items-center justify-between p-3 rounded-2xl glass-panel border border-slate-800">
        <button
          onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-base font-bold text-slate-100">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>

        <button
          onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/70 text-center py-2.5 text-xs font-bold text-slate-400">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days Matrix */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-800/60 bg-slate-950/40">
          {calendarDays.map((day, idx) => {
            const dayEvents = events.filter((e) => e.date === day.dateStr);

            return (
              <div
                key={idx}
                onClick={() => {
                  setEventDate(day.dateStr);
                  setShowEventModal(true);
                }}
                className={`min-h-[100px] sm:min-h-[120px] p-1.5 sm:p-2 transition-colors cursor-pointer hover:bg-slate-800/30 flex flex-col justify-between ${
                  !day.isCurrentMonth ? 'opacity-30 bg-slate-950/80' : ''
                } ${day.isToday ? 'bg-emerald-500/5' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      day.isToday
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/40'
                        : 'text-slate-300'
                    }`}
                  >
                    {day.dayNum}
                  </span>
                </div>

                {/* Events list in cell */}
                <div className="space-y-1 my-1 flex-1 overflow-y-auto max-h-20 no-scrollbar">
                  {dayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Open event info / deletion
                        handleDeleteEvent(ev.id);
                      }}
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border truncate transition-all ${
                        categoryColors[ev.category] || categoryColors.Family
                      }`}
                      title={`${ev.title} ${ev.startTime ? `@ ${ev.startTime}` : ''}`}
                    >
                      <span className="font-bold mr-1">{ev.startTime || ''}</span>
                      <span>{ev.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-emerald-400" />
                Add Calendar Event
              </h3>
              <button
                onClick={() => setShowEventModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Event Title</label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g. Leo Soccer Match, Dentist, Emma Ballet"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500/50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Date</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Category</label>
                  <select
                    value={eventCategory}
                    onChange={(e) => setEventCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Sports">Sports</option>
                    <option value="School">School</option>
                    <option value="Work">Work</option>
                    <option value="Appointment">Appointment</option>
                    <option value="Family">Family</option>
                    <option value="Celebration">Celebration</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Start Time</label>
                  <input
                    type="time"
                    value={eventStartTime}
                    onChange={(e) => setEventStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">End Time</label>
                  <input
                    type="time"
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {household?.members && household.members.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Assigned Family Member
                  </label>
                  <select
                    value={eventAssignedMemberId}
                    onChange={(e) => setEventAssignedMemberId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="">-- Entire Family --</option>
                    {household.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.avatar} {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Location</label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="e.g. Community Park Field #2"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!eventTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-emerald-600/30"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
