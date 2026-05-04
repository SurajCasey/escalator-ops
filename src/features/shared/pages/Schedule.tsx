/**
 * Schedule.tsx — merged Calendar + List view
 *
 * Defaults to Calendar view for everyone.
 * Toggle to List view for a full table breakdown.
 * Admin-only: Add Job, Edit, Delete actions.
 * Employees: see only jobs assigned to them (filtered in useJobs hook).
 */

import { useMemo, useState } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock3,
  Filter, LayoutList, MapPin, Pencil, Plus,
  RefreshCw, RotateCcw, Search, Trash2, Users,
} from "lucide-react";
import { useJobs, type Job, type JobStatus, frequencyLabel } from "../../../hooks/Usejobs";
import { useRole } from "../../../hooks/useRole";
import AddJobModal from "../../jobs/components/AddJobModal";
import BookingModal from "../../jobs/components/BookingModal";
import JobDetailPanel from "../../jobs/components/JobDetailPanel";

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = "calendar" | "list";
type ShiftName = "Morning" | "Midday" | "Night";

type CalendarDay = {
  key: string;
  date: Date;
  isCurrentMonth: boolean;
  jobs: Job[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<JobStatus, string> = {
  SCHEDULED:   "bg-blue-50 text-blue-700 border-blue-100",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-100",
  COMPLETED:   "bg-emerald-50 text-emerald-700 border-emerald-100",
  OVERDUE:     "bg-rose-50 text-rose-700 border-rose-100",
};

const CAL_STATUS_STYLES: Record<JobStatus, string> = {
  SCHEDULED:   "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED:   "bg-emerald-100 text-emerald-800",
  OVERDUE:     "bg-rose-100 text-rose-800",
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

type ListRow =
  | { kind: "booking"; bookingId: string; jobs: Job[] }
  | { kind: "job"; job: Job };

function buildListRows(jobs: Job[]): ListRow[] {
  const bookingMap = new Map<string, Job[]>();
  const standalone: Job[] = [];
  for (const job of jobs) {
    const bid = (job as Job & { booking_id?: string | null }).booking_id;
    if (bid) {
      if (!bookingMap.has(bid)) bookingMap.set(bid, []);
      bookingMap.get(bid)!.push(job);
    } else {
      standalone.push(job);
    }
  }
  const rows: ListRow[] = [];
  bookingMap.forEach((bJobs, bookingId) => {
    rows.push({ kind: "booking", bookingId, jobs: bJobs.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)) });
  });
  standalone.forEach(job => rows.push({ kind: "job", job }));
  return rows.sort((a, b) => {
    const dateA = a.kind === "booking" ? a.jobs[0].scheduled_at : a.job.scheduled_at;
    const dateB = b.kind === "booking" ? b.jobs[0].scheduled_at : b.job.scheduled_at;
    return dateA.localeCompare(dateB);
  });
}

function humanize(value: string) {
  return value.toLowerCase().split("_").map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
}

function buildCalendarDays(cursor: Date, jobs: Job[]): CalendarDay[] {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  start.setDate(start.getDate() - start.getDay());

  const jobMap = new Map<string, Job[]>();
  for (const job of jobs) {
    const key = toDateKey(new Date(job.scheduled_at));
    const arr = jobMap.get(key) ?? [];
    arr.push(job);
    arr.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    jobMap.set(key, arr);
  }

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = toDateKey(date);
    return { key, date, isCurrentMonth: date.getMonth() === cursor.getMonth(), jobs: jobMap.get(key) ?? [] };
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Schedule() {
  const { jobs, loading, fetchJobs, deleteJob, undoComplete } = useJobs();
  const { isAdmin } = useRole();

  // View state
  const [view, setView] = useState<ViewMode>("calendar");

  // Calendar state
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));

  // List state
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | JobStatus>("ALL");
  const [shiftFilter, setShiftFilter]   = useState<"ALL" | ShiftName>("ALL");
  const [editing, setEditing]           = useState<Job | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());

  // Shared state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showEditModal, setShowEditModal]       = useState(false);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);

  // ── Calendar data ──────────────────────────────────────────────────────────
  const calendarDays = useMemo(() => buildCalendarDays(monthCursor, jobs), [monthCursor, jobs]);
  const selectedDay  = useMemo(
    () => calendarDays.find((d) => d.key === selectedDateKey) ?? calendarDays[0],
    [calendarDays, selectedDateKey],
  );
  const monthStats = useMemo(() => {
    const m = monthCursor.getMonth();
    const y = monthCursor.getFullYear();
    const monthJobs = jobs.filter((j) => {
      const d = new Date(j.scheduled_at);
      return d.getMonth() === m && d.getFullYear() === y;
    });
    return {
      total:  monthJobs.length,
      active: monthJobs.filter((j) => j.status === "IN_PROGRESS").length,
      sites:  new Set(monthJobs.map((j) => j.site_name ?? j.client_name)).size,
      crews:  new Set(monthJobs.map((j) => j.assigned_to_name).filter(Boolean)).size,
    };
  }, [jobs, monthCursor]);

  // ── List data ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q ||
        job.title.toLowerCase().includes(q) ||
        job.client_name.toLowerCase().includes(q) ||
        (job.assigned_to_name ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" || job.status === statusFilter;
      const matchShift  = shiftFilter  === "ALL" || getShift(job.scheduled_at) === shiftFilter;
      return matchSearch && matchStatus && matchShift;
    });
  }, [jobs, search, statusFilter, shiftFilter]);

  const listRows = useMemo(() => buildListRows(filtered), [filtered]);

  const listStats = useMemo(() => ({
    scheduled: jobs.filter((j) => j.status === "SCHEDULED").length,
    active:    jobs.filter((j) => j.status === "IN_PROGRESS").length,
    upcoming:  jobs.filter((j) => new Date(j.scheduled_at).getTime() >= Date.now()).length,
    crews:     new Set(jobs.map((j) => j.assigned_to_name).filter(Boolean)).size,
  }), [jobs]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await deleteJob(id);
    setConfirmDelete(null);
  };

  const openAdd  = () => setShowBookingModal(true);
  const openEdit = (job: Job) => { setEditing(job); setShowEditModal(true); };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 xl:p-8 space-y-6">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-lg md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-slate-300">Operations Planning</p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Schedule</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              {isAdmin ? "Manage and track all escalator jobs." : "Your assigned jobs and upcoming shifts."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {view === "calendar" ? (
              <>
                {[
                  { icon: <CalendarDays className="h-4 w-4" />, label: "Month Jobs", value: monthStats.total },
                  { icon: <Clock3 className="h-4 w-4" />,       label: "Live Jobs",  value: monthStats.active },
                  { icon: <MapPin className="h-4 w-4" />,        label: "Sites",      value: monthStats.sites },
                  { icon: <Users className="h-4 w-4" />,         label: "Crews",      value: monthStats.crews },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-slate-200">{s.icon}<span className="text-xs uppercase tracking-wide">{s.label}</span></div>
                    <p className="mt-2 text-2xl font-bold">{s.value}</p>
                  </div>
                ))}
              </>
            ) : (
              <>
                {[
                  { icon: <CalendarDays className="h-4 w-4" />, label: "Scheduled", value: listStats.scheduled },
                  { icon: <Clock3 className="h-4 w-4" />,       label: "Live Jobs", value: listStats.active },
                  { icon: <Filter className="h-4 w-4" />,        label: "Upcoming",  value: listStats.upcoming },
                  { icon: <Users className="h-4 w-4" />,         label: "Crews",     value: listStats.crews },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-slate-200">{s.icon}<span className="text-xs uppercase tracking-wide">{s.label}</span></div>
                    <p className="mt-2 text-2xl font-bold">{s.value}</p>
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
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition"
          >
            <Plus className="h-4 w-4" /> Add Job
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CALENDAR VIEW
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
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    const n = new Date();
                    setMonthCursor(new Date(n.getFullYear(), n.getMonth(), 1));
                    setSelectedDateKey(toDateKey(n));
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Today
                </button>
                <button
                  onClick={() => setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
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
                    className={`min-h-28 border-b border-r border-slate-100 p-3 text-left transition
                      ${day.isCurrentMonth ? "bg-white hover:bg-slate-50" : "bg-slate-50/70 text-slate-400 hover:bg-slate-100"}
                      ${isSelected ? "ring-2 ring-inset ring-teal-500" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold
                        ${isToday ? "bg-teal-600 text-white" : "text-slate-700"}`}>
                        {day.date.getDate()}
                      </span>
                      {day.jobs.length > 0 && (
                        <span className="text-xs font-medium text-slate-500">{day.jobs.length}</span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      {day.jobs.slice(0, 2).map((j) => (
                        <div key={j.id} className={`truncate rounded px-1.5 py-0.5 text-xs font-medium flex items-center gap-1 ${CAL_STATUS_STYLES[j.status]}`}>
                          {j.job_type === "CONTRACT" && <RefreshCw className="h-2.5 w-2.5 shrink-0 opacity-70" />}
                          {formatTime(j.scheduled_at)} {j.client_name}
                        </div>
                      ))}
                      {day.jobs.length > 2 && (
                        <p className="text-xs text-slate-500">+{day.jobs.length - 2} more</p>
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
                  {selectedDay?.jobs.length ?? 0} job{selectedDay?.jobs.length !== 1 ? "s" : ""} scheduled
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={openAdd}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              )}
            </div>

            <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {loading && <p className="px-5 py-8 text-sm text-slate-500">Loading…</p>}
              {!loading && (!selectedDay || selectedDay.jobs.length === 0) && (
                <p className="px-5 py-8 text-center text-sm text-slate-400">No jobs for this day.</p>
              )}
              {!loading && selectedDay?.jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => setDetailJobId(job.id)}
                  className="w-full px-5 py-4 text-left hover:bg-slate-50 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {job.job_type === "CONTRACT" && <RefreshCw className="h-3.5 w-3.5 text-violet-500 shrink-0" />}
                      <p className="font-medium text-slate-900 text-sm truncate">{job.title}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CAL_STATUS_STYLES[job.status]}`}>
                      {humanize(job.status)}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3 w-3" />{job.site_name ?? job.client_name}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1"><Clock3 className="h-3 w-3 text-slate-400" />{formatTime(job.scheduled_at)}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3 text-slate-400" />{job.assigned_to_name ?? "Unassigned"}</span>
                  </div>
                  {job.job_type === "CONTRACT" && job.frequency_days && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-xs text-violet-700 font-medium">
                      <RefreshCw className="h-3 w-3" />{frequencyLabel(job.frequency_days)}
                    </div>
                  )}
                  {job.notes && <p className="mt-1 text-xs text-slate-400 italic">{job.notes}</p>}
                </button>
              ))}
            </div>
          </aside>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          LIST VIEW
      ═══════════════════════════════════════════════════════════════════════ */}
      {view === "list" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row flex-wrap md:items-center">
              <label className="relative flex-1 min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search jobs, clients, crew…"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-teal-500 md:w-64"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-500 bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="OVERDUE">Overdue</option>
              </select>
              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value as typeof shiftFilter)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-500 bg-white"
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
            {!loading && listRows.length === 0 && (
              <p className="px-5 py-12 text-center text-sm text-slate-500">No jobs match the current filters.</p>
            )}
            {!loading && listRows.map((row) => {
              /* ── Booking group row ── */
              if (row.kind === "booking") {
                const { bookingId, jobs: bJobs } = row;
                const expanded = expandedBookings.has(bookingId);
                const first = bJobs[0];
                const last  = bJobs[bJobs.length - 1];
                const allDone = bJobs.every(j => j.status === "COMPLETED");
                const anyActive = bJobs.some(j => j.status === "IN_PROGRESS");
                const anyOverdue = bJobs.some(j => j.status === "OVERDUE");
                const summaryStatus: JobStatus = allDone ? "COMPLETED" : anyActive ? "IN_PROGRESS" : anyOverdue ? "OVERDUE" : "SCHEDULED";
                const dateRange = bJobs.length === 1
                  ? formatDateTime(first.scheduled_at)
                  : `${formatDateTime(first.scheduled_at)} → ${formatDateTime(last.scheduled_at)}`;

                return (
                  <div key={bookingId}>
                    {/* Booking summary row */}
                    <button
                      onClick={() => setExpandedBookings(prev => {
                        const next = new Set(prev);
                        next.has(bookingId) ? next.delete(bookingId) : next.add(bookingId);
                        return next;
                      })}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition text-left"
                    >
                      <ChevronRight className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900">{first.client_name}</p>
                          <span className="text-xs font-medium bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                            {bJobs.length}-day booking
                          </span>
                          {first.site_name && <p className="text-xs text-slate-500">{first.site_name}</p>}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{dateRange}</p>
                      </div>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium shrink-0 ${STATUS_STYLES[summaryStatus]}`}>
                        {humanize(summaryStatus)}
                      </span>
                    </button>

                    {/* Expanded day rows */}
                    {expanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50">
                        {bJobs.map((job, dayIdx) => (
                          <div key={job.id} className="flex items-center gap-4 pl-12 pr-5 py-3 border-b border-slate-100 last:border-b-0 hover:bg-white transition group">
                            <div className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {dayIdx + 1}
                            </div>
                            <button onClick={() => setDetailJobId(job.id)} className="flex-1 min-w-0 text-left">
                              <p className="text-sm font-medium text-slate-800">{formatDateTime(job.scheduled_at)}</p>
                              <p className="text-xs text-slate-500">{getShift(job.scheduled_at)} shift · {job.assigned_to_name ?? "Unassigned"}</p>
                            </button>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${STATUS_STYLES[job.status]}`}>
                              {humanize(job.status)}
                            </span>
                            {isAdmin && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {job.status === "COMPLETED" && (
                                  <button onClick={() => undoComplete(job.id)}
                                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition" title="Undo completion">
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button onClick={() => openEdit(job)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition" title="Edit">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setConfirmDelete(job.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition" title="Delete">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              /* ── Standalone job row ── */
              const { job } = row;
              return (
                <div key={job.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition cursor-pointer group"
                  onClick={() => setDetailJobId(job.id)}>
                  <div className="w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{job.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {job.client_name} · {formatDateTime(job.scheduled_at)} · {getShift(job.scheduled_at)}
                      {job.assigned_to_name && ` · ${job.assigned_to_name}`}
                    </p>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium shrink-0 ${STATUS_STYLES[job.status]}`}>
                    {humanize(job.status)}
                  </span>
                  {isAdmin && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      {job.status === "COMPLETED" && (
                        <button onClick={() => undoComplete(job.id)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition" title="Undo completion">
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => openEdit(job)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setConfirmDelete(job.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Job detail panel ───────────────────────────────────────────────── */}
      {detailJobId && (
        <JobDetailPanel jobId={detailJobId} onClose={() => setDetailJobId(null)} />
      )}

      {/* ── New booking modal (admin only) ────────────────────────────────── */}
      {isAdmin && (
        <BookingModal
          open={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          onSaved={fetchJobs}
          defaultDate={selectedDay ? toDateKey(selectedDay.date) : undefined}
        />
      )}

      {/* ── Edit existing job modal (admin only) ───────────────────────────── */}
      {isAdmin && (
        <AddJobModal
          open={showEditModal}
          onClose={() => { setShowEditModal(false); setEditing(null); }}
          onSaved={fetchJobs}
          editing={editing}
        />
      )}

      {/* ── Delete confirm ─────────────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative z-10 rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-slate-900 text-lg">Delete job?</h3>
            <p className="text-sm text-slate-500 mt-1">This action cannot be undone.</p>
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
