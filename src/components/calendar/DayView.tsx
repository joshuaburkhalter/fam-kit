import React, { useEffect, useRef } from 'react';
import {
  format,
  isSameDay,
  isToday,
  parseISO,
  differenceInMinutes,
  addMinutes,
} from 'date-fns';
import { MapPin, User as UserIcon } from 'lucide-react';
import type { CalendarEvent, User } from '../../types';

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  users: User[];
  currentTime: Date;
  onSelectEvent: (event: CalendarEvent) => void;
  onAddEvent: (dateStr: string, timeStr?: string) => void;
}

const HOUR_HEIGHT = 64; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const DayView: React.FC<DayViewProps> = ({
  currentDate,
  events,
  users,
  currentTime,
  onSelectEvent,
  onAddEvent,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isCurDay = isToday(currentDate);
  const dateStr = format(currentDate, 'yyyy-MM-dd');

  const userMap = new Map(users.map((u) => [u.id, u]));

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 8 * HOUR_HEIGHT - 20;
    }
  }, [currentDate]);

  const dayEvents = events.filter((ev) => {
    try {
      return isSameDay(parseISO(ev.start_time), currentDate);
    } catch {
      return false;
    }
  });

  const allDayEvents = dayEvents.filter((ev) => ev.is_all_day);
  const timedEvents = dayEvents.filter((ev) => !ev.is_all_day);

  let currentTop = 0;
  if (isCurDay) {
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    currentTop = (currentMinutes / 60) * HOUR_HEIGHT;
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-2xl flex flex-col w-full">
      {/* Day Banner Header */}
      <div className="p-4 border-b border-white/10 bg-slate-900/90 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            {format(currentDate, 'EEEE')}
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white">
            {format(currentDate, 'MMMM d, yyyy')}
          </h3>
        </div>
        <div className="text-xs text-slate-400 font-semibold">
          {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'} scheduled
        </div>
      </div>

      {/* All-Day Events Banner */}
      {allDayEvents.length > 0 && (
        <div className="p-3 border-b border-white/10 bg-slate-950/40 flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-2">
            All Day:
          </span>
          {allDayEvents.map((ev) => {
            const user = ev.assigned_user_id ? userMap.get(ev.assigned_user_id) : undefined;
            const chipColor = user?.avatar_color || '#10b981';
            return (
              <div
                key={ev.id}
                onClick={() => onSelectEvent(ev)}
                className="px-3 py-1 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer hover:brightness-125 transition-all flex items-center gap-1.5"
                style={{
                  backgroundColor: `${chipColor}40`,
                  border: `1px solid ${chipColor}`,
                }}
              >
                <span>{ev.title}</span>
                {user && (
                  <span className="text-[10px] opacity-80 font-normal">• {user.name}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Scrollable 24-Hour Time Grid */}
      <div
        ref={scrollContainerRef}
        className="overflow-y-auto max-h-[650px] relative bg-slate-950/30 no-scrollbar select-none"
      >
        <div className="grid grid-cols-[64px_1fr] relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          {/* Left Hour Column */}
          <div className="border-r border-white/10 select-none">
            {HOURS.map((hour) => {
              const hourDate = new Date();
              hourDate.setHours(hour, 0, 0, 0);
              return (
                <div
                  key={hour}
                  className="h-16 pr-3 text-right text-xs font-semibold text-slate-500 -mt-3"
                >
                  {hour === 0 ? '' : format(hourDate, 'h a')}
                </div>
              );
            })}
          </div>

          {/* Single Day Event Track */}
          <div className="relative">
            {/* Hourly Slot Bars */}
            {HOURS.map((hour) => {
              const timeStr = `${String(hour).padStart(2, '0')}:00`;
              return (
                <div
                  key={hour}
                  onClick={() => onAddEvent(dateStr, timeStr)}
                  className="h-16 border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer flex items-center justify-end pr-4 group"
                >
                  <span className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-500 transition-opacity">
                    Click to add event
                  </span>
                </div>
              );
            })}

            {/* Current Time Indicator Line */}
            {isCurDay && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                style={{ top: `${currentTop}px` }}
              >
                <div className="w-3 h-3 rounded-full bg-emerald-400 -ml-1.5 shadow-md shadow-emerald-400/50" />
                <div className="h-[2px] flex-1 bg-emerald-400" />
              </div>
            )}

            {/* Timed Event Cards */}
            {timedEvents.map((ev) => {
              try {
                const start = parseISO(ev.start_time);
                const end = ev.end_time ? parseISO(ev.end_time) : addMinutes(start, 60);
                const startMin = start.getHours() * 60 + start.getMinutes();
                const durationMin = Math.max(30, differenceInMinutes(end, start));

                const topPx = (startMin / 60) * HOUR_HEIGHT;
                const heightPx = Math.max(36, (durationMin / 60) * HOUR_HEIGHT - 2);

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
                      backgroundColor: `${chipColor}30`,
                      borderLeft: `4px solid ${chipColor}`,
                    }}
                    className="absolute inset-x-2 rounded-xl p-2 sm:p-2.5 text-xs text-white overflow-hidden shadow-lg cursor-pointer hover:brightness-125 transition-all group/card border border-white/10 z-10 flex flex-col justify-between"
                  >
                    <div>
                      <div className="font-bold text-sm text-white group-hover/card:text-emerald-200 truncate">
                        {ev.title}
                      </div>
                      <div className="text-[11px] text-slate-300 font-medium truncate mt-0.5">
                        {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1 truncate">
                      {ev.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{ev.location}</span>
                        </span>
                      )}
                      {user && (
                        <span className="flex items-center gap-1 shrink-0 font-medium text-slate-300">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: chipColor }}
                          />
                          <span>{user.name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              } catch {
                return null;
              }
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
