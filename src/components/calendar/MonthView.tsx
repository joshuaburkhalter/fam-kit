import React from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';
import { Plus } from 'lucide-react';
import type { CalendarEvent, User } from '../../types';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  users: User[];
  onSelectEvent: (event: CalendarEvent) => void;
  onAddEvent: (dateStr: string) => void;
  onSelectDate: (date: Date) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  events,
  users,
  onSelectEvent,
  onAddEvent,
  onSelectDate,
}) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const userMap = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-2xl flex flex-col w-full">
      {/* Weekday Column Headers */}
      <div className="grid grid-cols-7 border-b border-white/10 bg-slate-900/90 text-center py-2.5">
        {weekDayNames.map((name, i) => (
          <div
            key={name}
            className={`text-xs font-bold uppercase tracking-wider ${
              i === 0 || i === 6 ? 'text-slate-500' : 'text-slate-300'
            }`}
          >
            <span className="hidden sm:inline">{name}</span>
            <span className="sm:hidden">{name.charAt(0)}</span>
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-white/5 bg-slate-950/40">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isCurMonth = isSameMonth(day, monthStart);
          const isCurDay = isToday(day);

          // Find events for this day
          const dayEvents = events
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

          const MAX_VISIBLE_EVENTS = 3;
          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const overflowCount = dayEvents.length - MAX_VISIBLE_EVENTS;

          return (
            <div
              key={dateStr}
              onClick={() => onAddEvent(dateStr)}
              className={`min-h-[95px] sm:min-h-[120px] md:min-h-[135px] p-1.5 sm:p-2 flex flex-col justify-between group transition-colors cursor-pointer relative ${
                isCurMonth
                  ? isCurDay
                    ? 'bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]'
                    : 'bg-slate-900/30 hover:bg-slate-900/60'
                  : 'bg-slate-950/40 text-slate-600 hover:bg-slate-950/60'
              }`}
            >
              {/* Day Header Row */}
              <div className="flex items-center justify-between gap-1 mb-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectDate(day);
                  }}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCurDay
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/30 scale-105'
                      : isCurMonth
                      ? 'text-slate-300 hover:text-white hover:bg-white/10'
                      : 'text-slate-600 hover:text-slate-400'
                  }`}
                  title={`View ${format(day, 'MMMM d')}`}
                >
                  {format(day, 'd')}
                </button>

                {/* Quick Add Button on Hover */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddEvent(dateStr);
                  }}
                  className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md bg-white/10 hover:bg-emerald-500 hover:text-slate-950 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                  title="Add Event"
                >
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                </button>
              </div>

              {/* Event Chips List */}
              <div className="flex-1 space-y-1 overflow-hidden min-h-0">
                {visibleEvents.map((ev) => {
                  const user = ev.assigned_user_id ? userMap.get(ev.assigned_user_id) : undefined;
                  const chipColor = user?.avatar_color || '#10b981';

                  let timeStr = '';
                  if (!ev.is_all_day) {
                    try {
                      timeStr = format(parseISO(ev.start_time), 'h:mma').toLowerCase();
                    } catch {}
                  }

                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(ev);
                      }}
                      className={`px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold truncate transition-all cursor-pointer flex items-center gap-1 leading-tight group/chip ${
                        ev.is_all_day
                          ? 'text-white border shadow-xs hover:brightness-125'
                          : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/5 hover:border-white/20'
                      }`}
                      style={
                        ev.is_all_day
                          ? {
                              backgroundColor: `${chipColor}33`,
                              borderColor: `${chipColor}66`,
                              color: '#ffffff',
                            }
                          : undefined
                      }
                      title={`${ev.title}${timeStr ? ` (${timeStr})` : ''}${
                        user ? ` • ${user.name}` : ''
                      }`}
                    >
                      {!ev.is_all_day && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: chipColor }}
                        />
                      )}
                      {timeStr && (
                        <span className="text-slate-400 text-[9px] font-mono shrink-0 hidden sm:inline">
                          {timeStr}
                        </span>
                      )}
                      <span className="truncate group-hover/chip:text-white font-medium">
                        {ev.title}
                      </span>
                    </div>
                  );
                })}

                {/* Overflow count link */}
                {overflowCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDate(day);
                    }}
                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 hover:underline px-1 py-0.5 block truncate text-left cursor-pointer"
                  >
                    +{overflowCount} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
