import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, RefreshCw, Users } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import type { JobStatus, VisitWithJob } from "../../../hooks/Usejobs";
import BookingModal from "../../jobs/components/BookingModal";

/* ── Status styles ─────────────────────────────────────────────── */
const STATUS_STYLES: Record<string, string> = {
  DRAFT:       "bg-slate-100 text-slate-500",
  SCHEDULED:   "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED:   "bg-emerald-100 text-emerald-800",
  OVERDUE:     "bg-rose-100 text-rose-800",
  CANCELLED:   "bg-slate-100 text-slate-500",
};

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ── Helpers ──────────────────────────────────────────────────── */
function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  }).format(date);
}

function humanize(value: string) {
  return value.toLowerCase().split("_").map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
}

/* ── Calendar day type ────────────────────────────────────────── */
type CalendarDay = {
  key: string;
  date: Date;
  isCurrentMonth: boolean;
  visits: VisitWithJob[];
};

function buildCalendarDays(cursor: Date, visits: VisitWithJob[]): CalendarDay[] {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  start.setDate(start.getDate() - start.getDay());

  const visitMap = new Map<string, VisitWithJob[]>();
  for (const v of visits) {
    const key = toDateKey(new Date(v.scheduled_at));
    const arr = visitMap.get(key) ?? [];
    arr.push(v);
    arr.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    visitMap.set(key, arr);
  }

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = toDateKey(date);
    return {
      key,
      date,
      isCurrentMonth: date.getMonth() === cursor.getMonth(),
      visits: visitMap.get(key) ?? [],
    };
  });
}

/* ════════════════════════════════════════════════════════════════ */
export default function Calendar() {
  const [visits, setVisits]     = useState<VisitWithJob[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));

  /* ── Fetch visits_with_job ──────────────────────────────────── */
  const fetchVisits = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("visits_with_job")
      .select("*")
      .neq("status", "CANCELLED")
      .order("scheduled_at", { ascending: true });

    if (!error) setVisits((data ?? []) as VisitWithJob[]);
    setLoading(false);
  };

  useEffect(() => { fetchVisits(); }, []);

  /* ── Calendar grid ──────────────────────────────────────────── */
  const calendarDays = useMemo(
    () => buildCalendarDays(monthCursor, visits),
    [monthCursor, visits]
  );

  const selectedDay = useMemo(
    () => calendarDays.find((d) => d.key === selectedDateKey) ?? calendarDays[0],
    [calendarDays, selectedDateKey]
  );

  /* ── Month stats ────────────────────────────────────────────── */
  const monthStats = useMemo(() => {
    const m = monthCursor.getMonth();
    const y = monthCursor.getFullYear();
    const monthVisits = visits.filter((v) => {
      const d = new Date(v.scheduled_at);
      return d.getMonth() === m && d.getFullYear() === y;
    });
    return {
      total:  monthVisits.length,
      active: monthVisits.filter((v) => v.status === "IN_PROGRESS").length,
      sites:  new Set(monthVisits.map((v) => v.site_name ?? v.client_name)).size,
      jobs:   new Set(monthVisits.map((v) => v.job_id)).size,
    };
  }, [visits, monthCursor]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 xl:p-8 space-y-6">
      {/* Header */}
      <section className="rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-lg md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-slate-300">Operations Planning</p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Calendar View</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200 md:text-base">
              Each dot is a scheduled visit — jobs with multiple visits appear on every day.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: <CalendarDays className="h-4 w-4" />, label: "Visits",    value: monthStats.total  },
              { icon: <Clock3       className="h-4 w-4" />, label: "Live",      value: monthStats.active },
              { icon: <MapPin       className="h-4 w-4" />, label: "Sites",     value: monthStats.sites  },
              { icon: <Users        className="h-4 w-4" />, label: "Jobs",      value: monthStats.jobs   },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-slate-200">{s.icon}<span className="text-xs uppercase tracking-wide">{s.label}</span></div>
                <p className="mt-2 text-2xl font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_360px]">
        {/* Calendar grid */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <h2 className="font-semibold text-slate-900">
              {new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(monthCursor)}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Prev month"
              ><ChevronLeft className="h-4 w-4" /></button>
              <button
                onClick={() => {
                  const n = new Date();
                  setMonthCursor(new Date(n.getFullYear(), n.getMonth(), 1));
                  setSelectedDateKey(toDateKey(n));
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >Today</button>
              <button
                onClick={() => setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Next month"
              ><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {WEEK_DAYS.map((d) => (
              <div key={d} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const isSelected = day.key === selectedDay?.key;
              const isToday    = day.key === toDateKey(new Date());
              return (
                <button
                  key={day.key}
                  onClick={() => setSelectedDateKey(day.key)}
                  className={`min-h-28 border-b border-r border-slate-100 p-3 text-left transition ${
                    day.isCurrentMonth ? "bg-white hover:bg-slate-50" : "bg-slate-50/70 text-slate-400 hover:bg-slate-100"
                  } ${isSelected ? "ring-2 ring-inset ring-cyan-500" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                      isToday ? "bg-cyan-600 text-white" : "text-slate-700"
                    }`}>
                      {day.date.getDate()}
                    </span>
                    {day.visits.length > 0 && (
                      <span className="text-xs font-medium text-slate-500">{day.visits.length}</span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    {day.visits.slice(0, 2).map((v) => (
                      <div
                        key={v.id}
                        className={`truncate rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLES[v.status] ?? STATUS_STYLES.SCHEDULED}`}
                      >
                        {formatTime(v.scheduled_at)} {v.client_name}
                      </div>
                    ))}
                    {day.visits.length > 2 && (
                      <p className="text-xs text-slate-500">+{day.visits.length - 2} more</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
          <div className="border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900">{selectedDay ? formatLongDate(selectedDay.date) : "—"}</h2>
              <p className="text-sm text-slate-500">
                {selectedDay?.visits.length ?? 0} visit{selectedDay?.visits.length !== 1 ? "s" : ""} scheduled
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {loading && <p className="px-5 py-8 text-sm text-slate-500">Loading…</p>}
            {!loading && (!selectedDay || selectedDay.visits.length === 0) && (
              <p className="px-5 py-8 text-sm text-slate-500">No visits scheduled for this day.</p>
            )}
            {!loading && selectedDay?.visits.map((visit) => (
              <div key={visit.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900 text-sm truncate">{visit.job_title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[visit.status] ?? STATUS_STYLES.SCHEDULED}`}>
                    {humanize(visit.status)}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="h-3 w-3" />
                  {visit.site_name ?? visit.client_name}
                </p>
                <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <Clock3 className="h-3 w-3 text-slate-400" />
                    {formatTime(visit.scheduled_at)}
                  </span>
                </div>
                {visit.job_notes && (
                  <p className="mt-2 text-xs text-slate-400 italic">{visit.job_notes}</p>
                )}
                {visit.notes && (
                  <p className="mt-1 text-xs text-slate-400 italic">{visit.notes}</p>
                )}
              </div>
            ))}
          </div>
        </aside>
      </section>

      <BookingModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={fetchVisits}
        defaultDate={selectedDateKey}
      />
    </div>
  );
}
