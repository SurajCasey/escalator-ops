import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import {
  AlertTriangle, ArrowLeft, Briefcase, Check, CheckCircle2,
  ChevronLeft, ChevronRight, Clock, LogIn, LogOut, MapPin, RefreshCw,
} from "lucide-react";
import JobCompletionModal from "../../jobs/components/JobCompletionModal";

/* ── Types ──────────────────────────────────────────────────── */
type Escalator = {
  id: string;
  unit_number: string;
  location: string | null;
  completed: boolean;
  sort_order: number;
};

/**
 * A "Visit" enriched with parent-job info (from visits_with_job view),
 * plus escalators loaded separately.
 */
type VisitJob = {
  id: string;          // visit id
  job_id: string;
  title: string;       // job_title from view
  client_name: string;
  site_name: string | null;
  scheduled_at: string; // visit's scheduled_at
  status: string;       // visit status
  flat_rate: number | null;
  notes: string | null; // job_notes from view
  visit_notes: string | null; // visit-level notes
  escalators: Escalator[];
};

type TimeEntry = {
  id: string;
  job_id: string | null;
  visit_id: string | null;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  lat_in: number | null;
  lng_in: number | null;
  lat_out: number | null;
  lng_out: number | null;
};

/* ── Helpers ─────────────────────────────────────────────────── */
function localIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
}

function fmtFullDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function fmtElapsed(startIso: string) {
  const secs = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // align to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getGps(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000 }
    );
  });
}

/* ── Status config ───────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; color: string; dotColor: string }> = {
  SCHEDULED:   { label: "BOOKED",   color: "text-emerald-600", dotColor: "bg-emerald-500" },
  IN_PROGRESS: { label: "STARTED",  color: "text-blue-600",    dotColor: "bg-blue-500"    },
  COMPLETED:   { label: "COMPLETE", color: "text-slate-400",   dotColor: "bg-slate-300"   },
  OVERDUE:     { label: "OVERDUE",  color: "text-rose-600",    dotColor: "bg-rose-500"    },
};

/* ── ElapsedTimer ────────────────────────────────────────────── */
function ElapsedTimer({ since, className = "" }: { since: string; className?: string }) {
  const [display, setDisplay] = useState(fmtElapsed(since));
  useEffect(() => {
    setDisplay(fmtElapsed(since));
    const t = setInterval(() => setDisplay(fmtElapsed(since)), 1000);
    return () => clearInterval(t);
  }, [since]);
  return <span className={`tabular-nums font-mono ${className}`}>{display}</span>;
}

/* ── WeekStrip ───────────────────────────────────────────────── */
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function WeekStrip({
  weekDays, selectedDate, jobDates, todayIso,
  onPrev, onNext, onSelectDate,
}: {
  weekDays: Date[];
  selectedDate: string;
  jobDates: Set<string>;
  todayIso: string;
  onPrev: () => void;
  onNext: () => void;
  onSelectDate: (iso: string) => void;
}) {
  const rangeLabel = `${weekDays[0].toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – ${weekDays[6].toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="bg-slate-900 pb-4">
      <div className="flex items-center justify-between px-4 py-2">
        <button onClick={onPrev} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-semibold text-slate-400 tracking-wide">{rangeLabel}</span>
        <button onClick={onNext} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 px-3 gap-0.5">
        {weekDays.map((d, i) => {
          const iso = localIsoDate(d);
          const isToday    = iso === todayIso;
          const isSelected = iso === selectedDate;
          const hasJobs    = jobDates.has(iso);
          return (
            <button key={iso} onClick={() => onSelectDate(iso)}
              className="flex flex-col items-center gap-1 py-1">
              <span className={`text-[10px] font-medium transition-colors ${isSelected ? "text-blue-300" : "text-slate-500"}`}>
                {DAY_LABELS[i]}
              </span>
              <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold transition-all
                ${isSelected
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/40"
                  : isToday
                    ? "ring-1 ring-white/40 text-white"
                    : "text-slate-400 hover:bg-white/10 hover:text-white"
                }`}>
                {d.getDate()}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full transition-all ${hasJobs ? (isSelected ? "bg-blue-300" : "bg-emerald-400") : "invisible"}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── JobCard ─────────────────────────────────────────────────── */
function JobCard({ visit, isActive, onTap }: { visit: VisitJob; isActive: boolean; onTap: () => void }) {
  const cfg      = STATUS_CFG[visit.status] ?? STATUS_CFG.SCHEDULED;
  const escDone  = visit.escalators.filter(e => e.completed).length;
  const escTotal = visit.escalators.length;

  return (
    <button onClick={onTap}
      className="w-full text-left bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all active:scale-[0.985]">
      {isActive && <div className="h-1 bg-linear-to-r from-blue-500 to-emerald-400" />}
      <div className="p-4 space-y-2">
        {/* Time + status row */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">{fmtTime(visit.scheduled_at)}</span>
          <div className="flex items-center gap-1.5">
            {isActive && <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />}
            <span className={`text-xs font-bold tracking-wide ${cfg.color}`}>{cfg.label}</span>
          </div>
        </div>

        {/* Client name */}
        <p className="text-base font-semibold text-slate-900 leading-tight">{visit.client_name}</p>

        {/* Job title */}
        <p className="text-sm text-slate-500">{visit.title}</p>

        {/* Address */}
        {visit.site_name && (
          <div className="flex items-start gap-1.5 text-xs text-slate-400">
            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="leading-snug">{visit.site_name}</span>
          </div>
        )}

        {/* Escalator progress bar */}
        {escTotal > 0 && (
          <div className="pt-1">
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${(escDone / escTotal) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{escDone}/{escTotal} escalators complete</p>
          </div>
        )}
      </div>
    </button>
  );
}

/* ── JobDetailView ───────────────────────────────────────────── */
function JobDetailView({
  visit, openEntry, busy, locDenied,
  onBack, onClockIn, onClockOut, onMarkComplete, onToggleEscalator,
}: {
  visit: VisitJob;
  openEntry: TimeEntry | null;
  busy: boolean;
  locDenied: boolean;
  onBack: () => void;
  onClockIn: (visit: VisitJob) => void;
  onClockOut: (visit: VisitJob) => void;
  onMarkComplete: (visit: VisitJob) => void;
  onToggleEscalator: (jobId: string, escalatorId: string, completed: boolean) => void;
}) {
  // Match openEntry by visit_id first, then job_id (legacy fallback)
  const visitEntry      = openEntry?.visit_id === visit.id
    ? openEntry
    : openEntry?.job_id === visit.job_id && !openEntry?.visit_id
      ? openEntry
      : null;
  const isClockedInHere = !!visitEntry;
  const isOtherActive   = !!openEntry && !visitEntry;
  const isCompleted     = visit.status === "COMPLETED";
  const cfg             = STATUS_CFG[visit.status] ?? STATUS_CFG.SCHEDULED;
  const escDone  = visit.escalators.filter(e => e.completed).length;
  const escTotal = visit.escalators.length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Header */}
      <div className="bg-slate-900 text-white px-4 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-lg">
        <button onClick={onBack}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{visit.client_name}</p>
          <p className="text-xs text-slate-400 truncate">{visit.title}</p>
        </div>
        <span className={`text-[11px] font-bold tracking-wide ${cfg.color} bg-white/10 px-2.5 py-1 rounded-full`}>
          {cfg.label}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

          {/* Job info card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
            <div className="px-5 py-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Date & Time</p>
                <p className="text-sm font-semibold text-slate-900">{fmtFullDate(visit.scheduled_at)}</p>
                <p className="text-xs text-slate-500">{fmtTime(visit.scheduled_at)}</p>
              </div>
            </div>

            {visit.site_name && (
              <div className="px-5 py-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <MapPin className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Location</p>
                  <p className="text-sm font-semibold text-slate-900 leading-snug">{visit.site_name}</p>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(visit.site_name)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                    onClick={e => e.stopPropagation()}
                  >
                    Open in Maps →
                  </a>
                </div>
              </div>
            )}

            {(visit.notes || visit.visit_notes) && (
              <div className="px-5 py-4 flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Briefcase className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Instructions</p>
                  {visit.notes && <p className="text-sm text-slate-700 leading-relaxed">{visit.notes}</p>}
                  {visit.visit_notes && <p className="text-sm text-slate-600 leading-relaxed mt-1">{visit.visit_notes}</p>}
                </div>
              </div>
            )}
          </div>

          {/* ── Clock card ── */}
          {!isCompleted && (
            <div className={`rounded-2xl border overflow-hidden shadow-sm ${isClockedInHere ? "bg-emerald-600 border-emerald-500" : "bg-white border-slate-100"}`}>

              {/* Status / timer display */}
              <div className="px-5 pt-5 pb-4">
                {isClockedInHere && visitEntry ? (
                  <div className="text-center text-white">
                    <p className="text-[11px] uppercase tracking-widest text-emerald-200 mb-2">Time Elapsed</p>
                    <ElapsedTimer since={visitEntry.clock_in} className="text-5xl font-bold" />
                    <p className="text-xs text-emerald-200 mt-2">
                      Clocked in at {fmtTime(visitEntry.clock_in)}
                    </p>
                    {visitEntry.lat_in && (
                      <a href={`https://maps.google.com/?q=${visitEntry.lat_in},${visitEntry.lng_in}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-200 hover:text-white mt-1">
                        <MapPin className="h-3 w-3" /> Location recorded
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-600">Ready to start this job?</p>
                    {isOtherActive && (
                      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        You're clocked into another job — clocking in here will switch you over automatically.
                      </div>
                    )}
                  </div>
                )}

                {locDenied && (
                  <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <MapPin className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700">Location not captured — enable GPS for attendance tracking</p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="px-5 pb-5 space-y-2">
                {isClockedInHere ? (
                  <button onClick={() => onClockOut(visit)} disabled={busy}
                    className="w-full flex items-center justify-center gap-2 bg-white text-emerald-700 font-bold py-4 rounded-2xl hover:bg-emerald-50 disabled:opacity-60 shadow-lg active:scale-95 transition-all">
                    {busy ? <RefreshCw className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                    {busy ? "Getting location…" : "Clock Out"}
                  </button>
                ) : (
                  <button onClick={() => onClockIn(visit)} disabled={busy}
                    className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 disabled:opacity-60 shadow-lg active:scale-95 transition-all">
                    {busy ? <RefreshCw className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                    {busy ? "Getting location…" : "Clock In"}
                  </button>
                )}

                <button onClick={() => onMarkComplete(visit)} disabled={busy}
                  className={`w-full flex items-center justify-center gap-2 font-semibold py-3.5 rounded-2xl active:scale-95 transition-all disabled:opacity-60 ${
                    isClockedInHere
                      ? "bg-emerald-500 text-white hover:bg-emerald-400"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                  }`}>
                  <CheckCircle2 className="h-4 w-4" />
                  Mark Job Complete
                </button>

              </div>
            </div>
          )}

          {/* Completed banner */}
          {isCompleted && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-emerald-800">Job Completed</p>
                <p className="text-xs text-emerald-600 mt-1 leading-relaxed">
                  This job is locked. Contact your admin if you need to make changes.
                </p>
              </div>
            </div>
          )}

          {/* Escalator checklist */}
          {escTotal > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 text-sm">Escalators</h3>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(escDone / escTotal) * 100}%` }} />
                  </div>
                  <span className={`text-xs font-semibold ${escDone === escTotal ? "text-emerald-600" : "text-slate-500"}`}>
                    {escDone}/{escTotal}
                  </span>
                </div>
              </div>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {visit.escalators.map((esc) => (
                  <button key={esc.id} type="button" disabled={isCompleted}
                    onClick={() => onToggleEscalator(visit.job_id, esc.id, !esc.completed)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                      isCompleted
                        ? "opacity-60 cursor-not-allowed bg-slate-50 border-slate-100"
                        : esc.completed
                          ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                          : "bg-slate-50 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                    }`}>
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      esc.completed ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white"
                    }`}>
                      {esc.completed && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${esc.completed ? "text-emerald-600 line-through" : "text-slate-800"}`}>
                        {esc.unit_number}
                      </p>
                      {esc.location && (
                        <p className="text-xs text-slate-400 truncate">{esc.location}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
export default function ClockIn() {
  const [userId, setUserId]         = useState<string | null>(null);
  const [visits, setVisits]         = useState<VisitJob[]>([]);
  const [openEntry, setOpenEntry]   = useState<TimeEntry | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(localIsoDate(new Date()));
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedVisit, setSelectedVisit] = useState<VisitJob | null>(null);
  const [loading, setLoading]       = useState(true);
  const [busy, setBusy]             = useState(false);
  const [completingVisit, setCompletingVisit] = useState<{ id: string; visitId: string; title: string } | null>(null);
  const [locDenied, setLocDenied]   = useState(false);

  const todayIso = localIsoDate(new Date());

  const weekDays = useMemo(() => {
    const weekStart = getWeekStart(new Date());
    weekStart.setDate(weekStart.getDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  /* ── Data load ─────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) { setLoading(false); return; }
    setUserId(uid);

    const rangeStart = new Date(); rangeStart.setDate(rangeStart.getDate() - 14);
    const rangeEnd   = new Date(); rangeEnd.setDate(rangeEnd.getDate() + 21);

    // Query visits_with_job — RLS filters to visits this employee is assigned to
    const { data: visitData } = await supabase
      .from("visits_with_job")
      .select("*")
      .neq("status", "CANCELLED")
      .neq("status", "COMPLETED")
      .gte("scheduled_at", rangeStart.toISOString())
      .lte("scheduled_at", rangeEnd.toISOString())
      .order("scheduled_at");

    // Also load escalators for all relevant job_ids
    type RawVisit = {
      id: string; job_id: string; scheduled_at: string; status: string;
      notes: string | null; job_title: string; client_name: string;
      site_name: string | null; flat_rate: number | null; job_notes: string | null;
    };
    const rawVisits = (visitData ?? []) as RawVisit[];
    const jobIds = [...new Set(rawVisits.map(v => v.job_id))];

    let escalatorMap = new Map<string, Escalator[]>();
    if (jobIds.length > 0) {
      const { data: escData } = await supabase
        .from("job_escalators")
        .select("id, job_id, unit_number, location, completed, sort_order")
        .in("job_id", jobIds);

      for (const esc of (escData ?? []) as (Escalator & { job_id: string })[]) {
        const arr = escalatorMap.get(esc.job_id) ?? [];
        arr.push(esc);
        escalatorMap.set(esc.job_id, arr);
      }
      // Sort each job's escalators
      escalatorMap.forEach((arr, key) => {
        escalatorMap.set(key, arr.sort((a, b) => a.sort_order - b.sort_order));
      });
    }

    const enriched: VisitJob[] = rawVisits.map(v => ({
      id: v.id,
      job_id: v.job_id,
      title: v.job_title,
      client_name: v.client_name,
      site_name: v.site_name,
      scheduled_at: v.scheduled_at,
      status: v.status,
      flat_rate: v.flat_rate,
      notes: v.job_notes,
      visit_notes: v.notes,
      escalators: escalatorMap.get(v.job_id) ?? [],
    }));

    setVisits(enriched);

    // Time entries (recent, for open-entry detection)
    const { data: entryData } = await supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", uid)
      .order("clock_in", { ascending: false })
      .limit(50);
    const rawEntries: TimeEntry[] = entryData ?? [];
    setOpenEntry(rawEntries.find(e => !e.clock_out) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Keep selectedVisit in sync after a reload
  useEffect(() => {
    if (selectedVisit) {
      const updated = visits.find(v => v.id === selectedVisit.id);
      if (updated) setSelectedVisit(updated);
    }
  }, [visits]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayVisits = useMemo(() =>
    visits.filter(v => localIsoDate(new Date(v.scheduled_at)) === selectedDate),
    [visits, selectedDate]
  );

  const jobDates = useMemo(() => {
    const s = new Set<string>();
    visits.forEach(v => s.add(localIsoDate(new Date(v.scheduled_at))));
    return s;
  }, [visits]);

  /* ── Clock in ──────────────────────────────────────────── */
  const handleClockIn = async (visit: VisitJob) => {
    if (!userId) return;
    setBusy(true);

    // Auto-clock out of any other open entry first
    if (openEntry) {
      const gps = await getGps();
      const patch: Record<string, unknown> = { clock_out: new Date().toISOString() };
      if (gps) { patch.lat_out = gps.lat; patch.lng_out = gps.lng; }
      await supabase.from("time_entries").update(patch).eq("id", openEntry.id);
      toast("Automatically clocked out of previous job.", { icon: "↩️" });
    }

    const gps = await getGps();
    setLocDenied(!gps);
    const payload: Record<string, unknown> = {
      user_id:  userId,
      job_id:   visit.job_id,
      visit_id: visit.id,          // ← record visit_id
      clock_in: new Date().toISOString(),
    };
    if (gps) { payload.lat_in = gps.lat; payload.lng_in = gps.lng; }

    const { error } = await supabase.from("time_entries").insert(payload);
    if (error) { toast.error(error.message); setBusy(false); return; }

    // Move visit to IN_PROGRESS when employee clocks in
    if (visit.status === "SCHEDULED" || visit.status === "OVERDUE") {
      await supabase.from("visits").update({ status: "IN_PROGRESS" }).eq("id", visit.id);
    }

    // Also move the parent job to IN_PROGRESS if it hasn't started yet
    await supabase
      .from("jobs")
      .update({ status: "IN_PROGRESS" })
      .eq("id", visit.job_id)
      .in("status", ["SCHEDULED", "OVERDUE", "DRAFT"]);

    toast.success(`Clocked in — ${visit.title}`);
    setBusy(false);
    await load();
  };

  /* ── Clock out ─────────────────────────────────────────── */
  const handleClockOut = async (visit: VisitJob) => {
    const entry = openEntry?.visit_id === visit.id
      ? openEntry
      : openEntry?.job_id === visit.job_id && !openEntry?.visit_id
        ? openEntry
        : null;
    if (!entry) return;
    setBusy(true);
    const gps = await getGps();
    const patch: Record<string, unknown> = { clock_out: new Date().toISOString() };
    if (gps) { patch.lat_out = gps.lat; patch.lng_out = gps.lng; }
    const { error } = await supabase.from("time_entries").update(patch).eq("id", entry.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Clocked out.");
    await load();
  };

  /* ── Job completed callback ────────────────────────────── */
  const handleJobCompleted = async () => {
    if (openEntry) {
      const gps = await getGps();
      const patch: Record<string, unknown> = { clock_out: new Date().toISOString() };
      if (gps) { patch.lat_out = gps.lat; patch.lng_out = gps.lng; }
      await supabase.from("time_entries").update(patch).eq("id", openEntry.id);
      toast.success("Job complete — automatically clocked out.", { duration: 4000 });
    }
    setSelectedVisit(null);
    await load();
  };

  /* ── Toggle escalator ──────────────────────────────────── */
  const handleToggleEscalator = async (jobId: string, escalatorId: string, completed: boolean) => {
    const patch: Record<string, unknown> = { completed };
    if (completed) { patch.completed_at = new Date().toISOString(); patch.completed_by = userId; }
    else            { patch.completed_at = null; patch.completed_by = null; }
    const { error } = await supabase.from("job_escalators").update(patch).eq("id", escalatorId);
    if (error) { toast.error(error.message); return; }

    const updateVisits = (prev: VisitJob[]): VisitJob[] =>
      prev.map(v => v.job_id !== jobId ? v : {
        ...v,
        escalators: v.escalators.map(e => e.id === escalatorId ? { ...e, completed } : e),
      });
    setVisits(updateVisits);
    setSelectedVisit(prev => prev?.job_id === jobId
      ? { ...prev, escalators: prev.escalators.map(e => e.id === escalatorId ? { ...e, completed } : e) }
      : prev
    );
  };

  /* ── Loading ───────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center animate-pulse">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm text-slate-500">Loading your jobs…</p>
        </div>
      </div>
    );
  }

  /* ── Job detail view ───────────────────────────────────── */
  if (selectedVisit) {
    return (
      <>
        <JobDetailView
          visit={selectedVisit}
          openEntry={openEntry}
          busy={busy}
          locDenied={locDenied}
          onBack={() => setSelectedVisit(null)}
          onClockIn={handleClockIn}
          onClockOut={handleClockOut}
          onMarkComplete={(v) => setCompletingVisit({ id: v.job_id, visitId: v.id, title: v.title })}
          onToggleEscalator={handleToggleEscalator}
        />
        {completingVisit && (
          <JobCompletionModal
            jobId={completingVisit.id}
            visitId={completingVisit.visitId}
            jobTitle={completingVisit.title}
            onClose={() => setCompletingVisit(null)}
            onCompleted={handleJobCompleted}
          />
        )}
      </>
    );
  }

  /* ── Main list view ────────────────────────────────────── */
  const selectedDateFmt = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "short",
  });

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Week strip */}
      <WeekStrip
        weekDays={weekDays}
        selectedDate={selectedDate}
        jobDates={jobDates}
        todayIso={todayIso}
        onPrev={() => setWeekOffset(w => w - 1)}
        onNext={() => setWeekOffset(w => w + 1)}
        onSelectDate={setSelectedDate}
      />

      {/* Day label */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          {selectedDate === todayIso ? `Today · ${selectedDateFmt}` : selectedDateFmt}
          {dayVisits.length > 0 && <span className="ml-2 text-slate-400 font-normal">({dayVisits.length} visit{dayVisits.length !== 1 ? "s" : ""})</span>}
        </h2>
        <div className="flex items-center gap-2">
          {openEntry && (
            <div className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </div>
          )}
          <button onClick={() => load()} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Job cards */}
      <div className="px-4 pb-8 space-y-3">
        {dayVisits.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 flex flex-col items-center gap-3 text-slate-400">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Briefcase className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-500">No visits on this day</p>
            <p className="text-xs text-slate-400">Use the calendar above to view other days</p>
          </div>
        ) : (
          dayVisits.map(visit => (
            <JobCard
              key={visit.id}
              visit={visit}
              isActive={
                openEntry?.visit_id === visit.id ||
                (!openEntry?.visit_id && openEntry?.job_id === visit.job_id)
              }
              onTap={() => setSelectedVisit(visit)}
            />
          ))
        )}
      </div>
    </div>
  );
}
