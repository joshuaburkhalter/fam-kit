import React, { useEffect, useRef } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  parseISO,
  differenceInMinutes,
  addMinutes,
} from 'date-fns';
import type { CalendarEvent, User } from '../../types';

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  users: User[];
  currentTime: Date;
  onSelectEvent: (event: CalendarEvent) => void;
  onAddEvent: (dateStr: string, timeStr?: string) => void;
}

const HOUR_HEIGHT = 56; // pixels per hour row
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const WeekView: React.FC<WeekViewProps> = ({
  currentDate,
  events,
  users,
  currentTime,
  onSelectEvent,
  onAddEvent,
}) => {
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const userMap = new Map(users.map((u) => [u.id, u]));

  // Auto-scroll to 8 AM on initial render
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 8 * HOUR_HEIGHT - 20;
    }
  }, [currentDate]);

  // Separate all-day vs timed events for each day
  const getDayEvents = (day: Date) => {
    return events.filter((ev) => {
      try {
        return isSameDay(parseISO(ev.start_time), day);
      } catch {
        return false;
      }
    });
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-2xl flex flex-col w-full">
      {/* Week Header Row */}
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-white/10 bg-slate-900/95 sticky top-0 z-20">
        {/* Time gutter corner */}
        <div className="border-r border-white/10 flex items-center justify-center text-[10px] text-slate-500 font-bold uppercase tracking-wider p-2">
          GMT{format(new Date(), 'x')}
        </div>

        {/* 7 Day Column Headers */}
        {weekDays.map((day) => {
          const isCurDay = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={`p-2.5 text-center border-r border-white/5 last:border-r-0 ${
                isCurDay ? 'bg-emerald-500/[0.06]' : ''
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {format(day, 'EEE')}
              </div>
              <div
                className={`w-7 h-7 mx-auto mt-0.5 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                  isCurDay
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                    : 'text-white'
                }`}
              >
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-Day Events Section (if any day has all-day events) */}
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-white/10 bg-slate-950/40 text-xs">
        <div className="border-r border-white/10 p-2 text-[10px] font-bold uppercase text-slate-500 flex items-center justify-end pr-2">
          All Day
        </div>
        {weekDays.map((day) => {
          const dayAllEvents = getDayEvents(day).filter((ev) => ev.is_all_day);
          const dateStr = format(day, 'yyyy-MM-dd');
          return (
            <div
              key={`allday-${dateStr}`}
              onClick={() => onAddEvent(dateStr)}
              className="p-1 border-r border-white/5 last:border-r-0 min-h-[36px] space-y-1 cursor-pointer hover:bg-white/[0.02]"
            >
              {dayAllEvents.map((ev) => {
                const user = ev.assigned_user_id ? userMap.get(ev.assigned_user_id) : undefined;
                const chipColor = user?.avatar_color || '#10b981';
                return (
                  <div
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(ev);
                    }}
                    className="px-2 py-1 rounded-md text-[11px] font-bold text-white truncate shadow-xs cursor-pointer hover:brightness-115 transition-all"
                    style={{
                      backgroundColor: `${chipColor}40`,
                      borderLeft: `3px solid ${chipColor}`,
                    }}
                    title={`${ev.title}${user ? ` • ${user.name}` : ''}`}
                  >
                    {ev.title}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Scrollable 24-Hour Time Grid */}
      <div
        ref={scrollContainerRef}
        className="overflow-y-auto max-h-[650px] relative bg-slate-950/30 no-scrollbar select-none"
      >
        <div className="grid grid-cols-[56px_repeat(7,1fr)] relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          {/* Hour Labels Left Column */}
          <div className="border-r border-white/10 select-none">
            {HOURS.map((hour) => {
              const hourDate = new Date();
              hourDate.setHours(hour, 0, 0, 0);
              return (
                <div
                  key={hour}
                  className="h-14 pr-2 text-right text-[10px] font-semibold text-slate-500 -mt-2.5"
                >
                  {hour === 0 ? '' : format(hourDate, 'h a')}
                </div>
              );
            })}
          </div>

          {/* 7 Columns for Days */}
          {weekDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isCurDay = isToday(day);
            const timedEvents = getDayEvents(day).filter((ev) => !ev.is_all_day);

            // Compute current time marker position
            let currentMinutes = 0;
            let currentTop = 0;
            if (isCurDay) {
              currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
              currentTop = (currentMinutes / 60) * HOUR_HEIGHT;
            }

            return (
              <div
                key={dateStr}
                className={`relative border-r border-white/5 last:border-r-0 ${
                  isCurDay ? 'bg-emerald-500/[0.02]' : ''
                }`}
              >
                {/* Hourly Horizontal Grid Lines */}
                {HOURS.map((hour) => {
                  const timeStr = `${String(hour).padStart(2, '0')}:00`;
                  return (
                    <div
                      key={hour}
                      onClick={() => onAddEvent(dateStr, timeStr)}
                      className="h-14 border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                    />
                  );
                })}

                {/* Red / Emerald Current Time Horizontal Marker */}
                {isCurDay && (
                  <div
                    className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
                    style={{ top: `${currentTop}px` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 -ml-1.5 shadow-sm shadow-emerald-400/50" />
                    <div className="h-[2px] flex-1 bg-emerald-400/80" />
                  </div>
                )}

                {/* Timed Event Blocks */}
                {timedEvents.map((ev) => {
                  try {
                    const start = parseISO(ev.start_time);
                    const end = ev.end_time ? parseISO(ev.end_time) : addMinutes(start, 60);
                    const startMin = start.getHours() * 60 + start.getMinutes();
                    const durationMin = Math.max(30, differenceInMinutes(end, start));

                    const topPx = (startMin / 60) * HOUR_HEIGHT;
                    const heightPx = Math.max(26, (durationMin / 60) * HOUR_HEIGHT - 2);

                    const user = ev.assigned_user_id ? userMap.get(ev.assigned_user_id) : undefined;
                    const chipColor = user?.avatar_color || '#10b981';

                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvent(ev);
                        }}
                        style={{
                          top: `${topPx}px`,
                          height: `${heightPx}px`,
                          backgroundColor: `${chipColor}33`,
                          borderLeft: `3.5px solid ${chipColor}`,
                        }}
                        className="absolute inset-x-1 rounded-lg p-1.5 text-xs text-white overflow-hidden shadow-md cursor-pointer hover:brightness-125 transition-all group/card border border-white/10 z-10"
                        title={`${ev.title} (${format(start, 'h:mm a')} - ${format(end, 'h:mm a')})`}
                      >
                        <div className="font-bold text-[11px] truncate leading-tight group-hover/card:text-emerald-200">
                          {ev.title}
                        </div>
                        <div className="text-[10px] text-slate-300 font-medium truncate mt-0.5 opacity-90">
                          {format(start, 'h:mm a')}
                        </div>
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
