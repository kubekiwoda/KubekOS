/**
 * KubekOS Calendar Application
 * Monthly grid view, event creation, event editing, and persistent IndexedDB storage via Dexie.
 */

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { osDb, type CalendarEventRecord } from '@/vfs/db';
import { useKernelStore } from '@/kernel/kernelStore';
import { ACCENT_COLORS } from '@/theme/tokens';

export const CalendarApp: React.FC = () => {
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDateIso, setSelectedDateIso] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [titleInput, setTitleInput] = useState('');
  const [timeInput, setTimeInput] = useState('10:00');
  const [notesInput, setNotesInput] = useState('');

  const loadEvents = async () => {
    const all = await osDb.calendarEvents.toArray();
    if (all.length === 0) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const sampleEvent: CalendarEventRecord = {
        id: 'evt-sample-1',
        title: 'KubekOS Architecture Review (Sample)',
        dateIso: todayIso,
        time: '14:00',
        category: 'WORK',
        notes: 'Verify VFS IndexedDB persistence and Window Manager snapping.',
        createdAt: Date.now(),
      };
      await osDb.calendarEvents.put(sampleEvent);
      setEvents([sampleEvent]);
    } else {
      setEvents(all);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleInput.trim()) return;

    const newRecord: CalendarEventRecord = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: titleInput.trim(),
      dateIso: selectedDateIso,
      time: timeInput,
      category: 'WORK',
      notes: notesInput.trim(),
      createdAt: Date.now(),
    };

    await osDb.calendarEvents.put(newRecord);
    setEvents((prev) => [...prev, newRecord]);
    setTitleInput('');
    setNotesInput('');
  };

  const handleDeleteEvent = async (id: string) => {
    await osDb.calendarEvents.delete(id);
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayWeekday = new Date(year, month, 1).getDay();

  const dayCells: (number | null)[] = [
    ...Array.from({ length: firstDayWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedDayEvents = events.filter((ev) => ev.dateIso === selectedDateIso);

  return (
    <div data-testid="app-calendar" className="h-full flex text-xs select-none">
      {/* Left Monthly Calendar Grid */}
      <div className="flex-1 p-5 flex flex-col border-r border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className={`w-4 h-4 ${accent.textClass}`} />
            <h2 className="text-base font-semibold text-white">
              {currentMonth.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-mono uppercase text-slate-400 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5 flex-1">
          {dayCells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty_${idx}`} className="rounded-xl bg-slate-900/20" />;
            }
            const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(
              2,
              '0'
            )}`;
            const isSelected = iso === selectedDateIso;
            const dayEvents = events.filter((ev) => ev.dateIso === iso);

            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedDateIso(iso)}
                className={`p-2 rounded-xl border flex flex-col items-start justify-between transition-colors cursor-pointer ${
                  isSelected
                    ? `${accent.subtleBgClass} ${accent.borderClass} text-white`
                    : 'bg-slate-900/50 border-slate-800/70 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <span className="font-semibold">{day}</span>
                {dayEvents.length > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${accent.bgClass} text-slate-950 font-semibold`}
                  >
                    {dayEvents.length} evt
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Selected Day Events & Creator */}
      <aside className="w-72 p-4 bg-slate-900/40 flex flex-col justify-between shrink-0">
        <div className="space-y-3 overflow-y-auto">
          <div className="font-semibold text-white">
            Schedule for {selectedDateIso}
          </div>

          {selectedDayEvents.map((ev) => (
            <div
              key={ev.id}
              className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className={`font-mono text-[10px] ${accent.textClass}`}>
                  {ev.time}
                </span>
                <button
                  type="button"
                  onClick={() => void handleDeleteEvent(ev.id)}
                  className="text-slate-500 hover:text-rose-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="font-medium text-white">{ev.title}</div>
              {ev.notes && <div className="text-[11px] text-slate-400">{ev.notes}</div>}
            </div>
          ))}

          {selectedDayEvents.length === 0 && (
            <div className="py-8 text-center text-slate-500">
              No events scheduled for this date.
            </div>
          )}
        </div>

        {/* Add Event Form */}
        <form
          onSubmit={(e) => void handleAddEvent(e)}
          className="pt-3 border-t border-slate-800 space-y-2"
        >
          <div className="font-medium text-slate-200">Add Event</div>
          <input
            type="text"
            data-testid="calendar-event-title"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="Event title..."
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none"
          />
          <input
            type="time"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none"
          />
          <input
            type="text"
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            placeholder="Optional notes..."
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none"
          />
          <button
            type="submit"
            data-testid="calendar-add-btn"
            className={`w-full py-2 rounded-xl ${accent.bgClass} text-slate-950 font-semibold flex items-center justify-center gap-1 cursor-pointer`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save Event</span>
          </button>
        </form>
      </aside>
    </div>
  );
};
