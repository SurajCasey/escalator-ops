/**
 * Schedule.tsx — Calendar + List view
 *
 * Calendar view: shows individual visits — each visit appears on its own date.
 * List view: shows parent jobs, each expandable to reveal their visits.
 *
 * Data sources:
 *  - useJobs()             → parent jobs (for list view + stats)
 *  - visits_with_job view  → visits with denormalised job info (for calendar)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, ChevronDown, Clock3,
  Filter, LayoutList, MapPin, Pencil, Plus,
  RefreshCw, RotateCcw, Search, Trash2, Users,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useJobs, type Job, type JobStatus, type VisitWithJob, frequencyLabel } from "../../../hooks/Usejobs";
import { useRole } from "../../../hooks/useRole";
import BookingModal from "../../jobs/components/BookingModal";
import EditBookingModal from "../../jobs/components/EditBookingModal";
import JobDetailPanel from "../../jobs/components/JobDetailPanel";

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode  = "calendar" | "list";
type ShiftName = "Morning" | "Midday" | "Night";

type CalendarDay = {
  key: string;
  date: Date;
  isCurrentMonth: boolean;
  visits: VisitWithJob[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<JobStatus, string> = {
  DRAFT:       "bg-slate-50 text-slate-500 border-slate-200",
  SCHEDULED:   "bg-blue-50 text-blue-700 border-blue-100",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-100",
  COMPLETED:   "bg-emerald-50 text-emerald-700 border-emerald-100",
  OVERDUE:     "bg-rose-50 text-rose-700 border-rose-100",
  CANCELLED:   "bg-slate-100 text-slate-500 border-slate-200",
};

const CAL_STATUS_STYLES: Record<string, string> = {
  DRAFT:       "bg-slate-100 text-slate-500",
  SCHEDULED:   "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED:   "bg-emerald-100 text-emerald-800",
  OVERDUE:     "bg-rose-100 text-rose-800",
  CANCELLED:   "bg-slate-100 text-slate-500",
};

const VISIT_DOT: Record<string, string> = {
  DRAFT:       "bg-slate-300",
  SCHEDULED:   "bg-blue-500",
  IN_PROGRESS: "bg-amber-500",
  COMPLETED:   "bg-emerald-500",
  OVERDUE:     "bg-rose-500",
  CANCELLED:   "bg-slate-200",
};

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getShift(iso: string): ShiftName {
  const h = new Date(iso).getHours();
  if (h < 11) return "Morning";
  if (h < 17) return "Midday";
  return "Night";
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short", day: "numeric", month: "short",
  }).format(new Date(iso));
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  }).format(date);
}

function humanize(value: string) {
  return value.toLowerCase().split("_").map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
}

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function Schedule() {
  const { jobs, loading: jobsLoading, fetchJobs, deleteJob, undoComplete } = useJobs();
  const { isAdmin } = useRole();

  // ── Visits (for calendar view) ─────────────────────────────────────────────
  const [visits, setVisits]       = useState<VisitWithJob[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);

  const fetchVisits = useCallback(async () => {
    setVisitsLoading(true);
    const { data } = await supabase
      .from("visits_with_job")
      .select("*")
      .neq("status", "CANCELLED")
      .order("scheduled_at", { ascending: true });
    setVisits((data ?? []) as VisitWithJob[]);
    setVisitsLoading(false);
  }, []);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchJobs(), fetchVisits()]);
  }, [fetchJobs, fetchVisits]);

  // visits indexed by job_id (for list view expansion)
  const visitsByJobId = useMemo(() => {
    const map = new Map<string, VisitWithJob[]>();
    for (const v of visits) {
      if (!map.has(v.job_id)) map.set(v.job_id, []);
      map.get(v.job_id)!.push(v);
    }
    return map;
  }, [visits]);

  // ── View state ─────────────────────────────────────────────────────────────
  const [view, setView] = useState<ViewMode>("list");

  // Calendar state
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));

  // List state
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | JobStatus>("ALL");
  const [shiftFilter, setShiftFilter]   = useState<"ALL" | ShiftName>("ALL");
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [editingJob, setEditingJob]     = useState<Job | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Shared
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);

  const loading = jobsLoading || visitsLoading;

  // ── Calendar data ──────────────────────────────────────────────────────────
  const calendarDays = useMemo(
    () => buildCalendarDays(monthCursor, visits),
    [monthCursor, visits]
  );
  const selectedDay = useMemo(
    () => calendarDays.find((d) => d.key === selectedDateKey) ?? calendarDays[0],
    [calendarDays, selectedDateKey]
  );
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

  // ── List data ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q ||
        job.title.toLowerCase().includes(q) ||
        job.client_name.toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" || job.status === statusFilter;
      // Shift filter on first visit
      const firstVisit = visitsByJobId.get(job.id)?.[0];
      const matchShift = shiftFilter === "ALL" || (firstVisit ? getShift(firstVisit.scheduled_at) === shiftFilter : true);
      return matchSearch && matchStatus && matchShift;
    });
  }, [jobs, search, statusFilter, shiftFilter, visitsByJobId]);

  const listStats = useMemo(() => ({
    scheduled: jobs.filter((j) => j.status === "SCHEDULED").length,
    active:    jobs.filter((j) => j.status === "IN_PROGRESS").length,
    overdue:   jobs.filter((j) => j.status === "OVERDUE").length,
    total:     jobs.length,
  }), [jobs]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await deleteJob(id);
    setConfirmDelete(null);
    fetchVisits();
  };

  const toggleJob = (id: string) =>
    setExpandedJobs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 xl:p-8 space-y-6">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-lg md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-slate-300">Operations Planning</p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Schedule</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              {isAdmin ? "Manage and track all escalator jobs." : "Your assigned jobs and upcoming shifts."}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {view === "calendar" ? (
              <>
                {[
                  { icon: <CalendarDays className="h-3.5 w-3.5 md:h-4 md:w-4" />, label: "Visits",  value: monthStats.total  },
                  { icon: <Clock3       className="h-3.5 w-3.5 md:h-4 md:w-4" />, label: "Live",    value: monthStats.active },
                  { icon: <MapPin       className="h-3.5 w-3.5 md:h-4 md:w-4" />, label: "Sites",   value: monthStats.sites  },
                  { icon: <Users        className="h-3.5 w-3.5 md:h-4 md:w-4" />, label: "Jobs",    value: monthStats.jobs   },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/15 bg-white/10 px-2 py-2 md:px-4 md:py-3 backdrop-blur-sm text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-200">{s.icon}<span className="text-[10px] md:text-xs uppercase tracking-wide hidden sm:inline">{s.label}</span></div>
                    <p className="mt-1 text-lg md:text-2xl font-bold">{s.value}</p>
                  </div>
                ))}
              </>
            ) : (
              <>
                {[
                  { icon: <CalendarDays className="h-3.5 w-3.5 md:h-4 md:w-4" />, label: "Jobs",      value: listStats.total     },
                  { icon: <Clock3       className="h-3.5 w-3.5 md:h-4 md:w-4" />, label: "Live",      value: listStats.active    },
                  { icon: <Filter       className="h-3.5 w-3.5 md:h-4 md:w-4" />, label: "Scheduled", value: listStats.scheduled },
                  { icon: <Users        className="h-3.5 w-3.5 md:h-4 md:w-4" />, label: "Overdue",   value: listStats.overdue   },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/15 bg-white/10 px-2 py-2 md:px-4 md:py-3 backdrop-blur-sm text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-200">{s.icon}<span className="text-[10px] md:text-xs uppercase tracking-wide hidden sm:inline">{s.label}</span></div>
                    <p className="mt-1 text-lg md:text-2xl font-bold">{s.value}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── View toggle + Add Job ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setView("calendar")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              view === "calendar" ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <CalendarDays className="h-4 w-4" /> Calendar
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              view === "list" ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <LayoutList className="h-4 w-4" /> List
          </button>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowBookingModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition"
          >
            <Plus className="h-4 w-4" /> New Job
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CALENDAR VIEW — shows visits, each on its own date
      ═══════════════════════════════════════════════════════════════════════ */}
      {view === "calendar" && (
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

            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
              {WEEK_DAYS.map((d) => (
                <div key={d} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const isSelected = day.key === selectedDay?.key;
                const isToday    = day.key === toDateKey(new Date());
                return (
                  <button
                    key={day.key}
                    onClick={() => setSelectedDateKey(day.key)}
                    className={`min-h-[3rem] md:min-h-28 border-b border-r border-slate-100 p-1.5 md:p-3 text-left transition
                      ${day.isCurrentMonth ? "bg-white hover:bg-slate-50" : "bg-slate-50/70 text-slate-400 hover:bg-slate-100"}
                      ${isSelected ? "ring-2 ring-inset ring-teal-500" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-full text-xs md:text-sm font-semibold
                        ${isToday ? "bg-teal-600 text-white" : "text-slate-700"}`}>
                        {day.date.getDate()}
                      </span>
                      {day.visits.length > 0 && (
                        <span className="hidden md:inline text-xs font-medium text-slate-500">{day.visits.length}</span>
                      )}
                    </div>
                    {/* Mobile: colored dots */}
                    {day.visits.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-0.5 md:hidden">
                        {day.visits.slice(0, 4).map((v) => (
                          <span key={v.id} className={`h-2 w-2 rounded-full ${VISIT_DOT[v.status] ?? VISIT_DOT.SCHEDULED}`} />
                        ))}
                        {day.visits.length > 4 && <span className="text-[9px] text-slate-400">+{day.visits.length - 4}</span>}
                      </div>
                    )}
                    {/* Desktop: text labels */}
                    <div className="mt-2 space-y-1 hidden md:block">
                      {day.visits.slice(0, 2).map((v) => (
                        <div key={v.id} className={`truncate rounded px-1.5 py-0.5 text-xs font-medium flex items-center gap-1 ${CAL_STATUS_STYLES[v.status] ?? CAL_STATUS_STYLES.SCHEDULED}`}>
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
          <aside className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">{selectedDay ? formatLongDate(selectedDay.date) : "—"}</h2>
                <p className="text-sm text-slate-500">
                  {selectedDay?.visits.length ?? 0} visit{selectedDay?.visits.length !== 1 ? "s" : ""} scheduled
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowBookingModal(true)}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              )}
            </div>

            <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {loading && <p className="px-5 py-8 text-sm text-slate-500">Loading…</p>}
              {!loading && (!selectedDay || selectedDay.visits.length === 0) && (
                <p className="px-5 py-8 text-center text-sm text-slate-400">No visits scheduled for this day.</p>
              )}
              {!loading && selectedDay?.visits.map((visit) => (
                <button
                  key={visit.id}
                  onClick={() => setDetailJobId(visit.job_id)}
                  className="w-full px-5 py-4 text-left hover:bg-slate-50 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-900 text-sm truncate">{visit.job_title}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CAL_STATUS_STYLES[visit.status] ?? CAL_STATUS_STYLES.SCHEDULED}`}>
                      {humanize(visit.status)}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3 w-3" />{visit.site_name ?? visit.client_name}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <Clock3 className="h-3 w-3 text-slate-400" />{formatTime(visit.scheduled_at)}
                    </span>
                    <span className="text-slate-400">{getShift(visit.scheduled_at)}</span>
                  </div>
                  {(visit.job_notes || visit.notes) && (
                    <p className="mt-1 text-xs text-slate-400 italic truncate">{visit.job_notes ?? visit.notes}</p>
                  )}
                </button>
              ))}
            </div>
          </aside>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          LIST VIEW — parent jobs, expandable visits
      ═══════════════════════════════════════════════════════════════════════ */}
      {view === "list" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Filters */}
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex flex-nowrap gap-2 overflow-x-auto pb-0.5 items-center">
              <div className="relative shrink-0 w-36">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-sm text-slate-700 outline-none focus:border-teal-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-teal-500 bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="OVERDUE">Overdue</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value as typeof shiftFilter)}
                className="shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-teal-500 bg-white"
              >
                <option value="ALL">All Shifts</option>
                <option value="Morning">Morning</option>
                <option value="Midday">Midday</option>
                <option value="Night">Night</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {loading && (
              <p className="px-5 py-12 text-center text-sm text-slate-500">Loading…</p>
            )}
            {!loading && filtered.length === 0 && (
              <p className="px-5 py-12 text-center text-sm text-slate-500">No jobs match the current filters.</p>
            )}
            {!loading && filtered.map((job) => {
              const jobVisits  = visitsByJobId.get(job.id) ?? [];
              const expanded   = expandedJobs.has(job.id);
              const visitCount = job.visit_count || jobVisits.length;

              // Date range display
              const firstAt = job.scheduled_start ?? jobVisits[0]?.scheduled_at;
              const lastAt  = job.scheduled_end   ?? jobVisits[jobVisits.length - 1]?.scheduled_at;
              const dateRange = firstAt
                ? (lastAt && lastAt !== firstAt)
                  ? `${formatDate(firstAt)} → ${formatDate(lastAt)}`
                  : formatDate(firstAt)
                : "No visits";

              return (
                <div key={job.id}>
                  {/* ── Job row ── */}
                  <div className={`flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition group ${job.status === "CANCELLED" ? "opacity-60" : ""}`}>

                    {/* Expand toggle */}
                    {visitCount > 0 ? (
                      <button
                        onClick={() => toggleJob(job.id)}
                        className="shrink-0 p-1 rounded-md hover:bg-slate-200 transition text-slate-400"
                        title={expanded ? "Collapse visits" : "Show visits"}
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </button>
                    ) : (
                      <div className="w-6 shrink-0" />
                    )}

                    {/* Main content — click opens detail */}
                    <button
                      onClick={() => setDetailJobId(job.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {job.job_type === "CONTRACT" && (
                          <RefreshCw className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                        )}
                        <p className={`font-semibold text-sm ${job.status === "CANCELLED" ? "text-slate-400 line-through" : "text-slate-900"}`}>
                          {job.title}
                        </p>
                        {visitCount > 0 && (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                            {visitCount} visit{visitCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {job.client_name}
                        {job.site_name && ` · ${job.site_name}`}
                        {" · "}{dateRange}
                        {job.job_type === "CONTRACT" && job.frequency_days && ` · ${frequencyLabel(job.frequency_days)}`}
                      </p>
                    </button>

                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium shrink-0 ${STATUS_STYLES[job.status]}`}>
                      {humanize(job.status)}
                    </span>

                    {isAdmin && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                        {job.status === "COMPLETED" && (
                          <button
                            onClick={() => undoComplete(job.id)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition"
                            title="Undo completion"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditingJob(job)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(job.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Expanded visits ── */}
                  {expanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50">
                      {jobVisits.length === 0 && (
                        <p className="pl-14 pr-5 py-3 text-xs text-slate-400 italic">No visits loaded yet.</p>
                      )}
                      {jobVisits.map((visit, idx) => (
                        <div key={visit.id} className="flex items-center gap-3 pl-14 pr-5 py-3 border-b border-slate-100 last:border-b-0 hover:bg-white transition group/visit">
                          <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800">{formatDateTime(visit.scheduled_at)}</p>
                            <p className="text-xs text-slate-500">{getShift(visit.scheduled_at)} shift</p>
                          </div>
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${STATUS_STYLES[visit.status as JobStatus] ?? STATUS_STYLES.SCHEDULED}`}>
                            {humanize(visit.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Job detail panel ─────────────────────────────────────────────── */}
      {detailJobId && (
        <JobDetailPanel jobId={detailJobId} onClose={() => setDetailJobId(null)} />
      )}

      {/* ── New booking modal ────────────────────────────────────────────── */}
      {isAdmin && (
        <BookingModal
          open={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          onSaved={refreshAll}
          defaultDate={selectedDay ? toDateKey(selectedDay.date) : undefined}
        />
      )}

      {/* ── Edit modal ───────────────────────────────────────────────────── */}
      {isAdmin && (
        <EditBookingModal
          open={!!editingJob}
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSaved={refreshAll}
        />
      )}

      {/* ── Delete confirm ───────────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative z-10 rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-slate-900 text-lg">Delete job?</h3>
            <p className="text-sm text-slate-500 mt-1">This will also delete all visits under this job. Cannot be undone.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
