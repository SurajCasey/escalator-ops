import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import {
  Briefcase,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  Timer,
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────────── */
type Escalator = {
  id: string;
  unit_number: string;
  location: string | null;
  completed: boolean;
  sort_order: number;
};
type Job = {
  id: string;
  title: string;
  client_name: string;
  site_name: string | null;
  scheduled_at: string;
  status: string;
  escalators: Escalator[];
};
type TimeEntry = {
  id: string;
  job_id: string | null;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  lat_in: number | null;
  lng_in: number | null;
  lat_out: number | null;
  lng_out: number | null;
  notes: string | null;
};
type JobTitle = { id: string; title: string; client_name: string };

/* ── Formatters ─────────────────────────────────────────────── */
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { weekday: "short", day: "2-digit", month: "short" });
}
function fmtDuration(mins: number | null) {
  if (mins === null) return "—";
  const h = Math.floor(mins / 60); const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtElapsed(startIso: string) {
  const secs = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ── GPS ────────────────────────────────────────────────────── */
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

/* ── Live elapsed timer ─────────────────────────────────────── */
function ElapsedTimer({ since }: { since: string }) {
  const [display, setDisplay] = useState(fmtElapsed(since));
  useEffect(() => {
    setDisplay(fmtElapsed(since));
    const t = setInterval(() => setDisplay(fmtElapsed(since)), 1000);
    return () => clearInterval(t);
  }, [since]);
  return <span className="tabular-nums font-mono text-5xl font-bold tracking-tight">{display}</span>;
}

/* ── Live wall clock ────────────────────────────────────────── */
function WallClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="tabular-nums font-mono text-sm text-slate-400 mt-1">
      {now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </p>
  );
}

/* ── Escalator progress ring ────────────────────────────────── */
function EscProgress({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  const allDone = done === total;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${allDone ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
      {done}/{total} escalators
    </span>
  );
}

/* ════════════════════════════════════════════════════════════ */
export default function ClockIn() {
  const [userId, setUserId]         = useState<string | null>(null);
  const [todaysJobs, setTodaysJobs] = useState<Job[]>([]);
  const [entries, setEntries]       = useState<TimeEntry[]>([]);
  const [jobTitles, setJobTitles]   = useState<Record<string, JobTitle>>({});
  const [openEntry, setOpenEntry]   = useState<TimeEntry | null>(null);
  const [loading, setLoading]       = useState(true);
  const [busy, setBusy]             = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [clockNote, setClockNote]   = useState("");
  const [locDenied, setLocDenied]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) { setLoading(false); return; }
    setUserId(uid);

    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    /* Step 1 – get assigned job IDs */
    const { data: assignments } = await supabase
      .from("job_assignments")
      .select("job_id")
      .eq("employee_id", uid);

    const assignedIds = (assignments ?? []).map((a: { job_id: string }) => a.job_id);

    /* Step 2 – fetch today's assigned jobs + their escalators */
    type RawJob = Omit<Job, "escalators"> & { job_escalators: Escalator[] };
    let jobs: Job[] = [];
    if (assignedIds.length > 0) {
      const { data: jobData } = await supabase
        .from("jobs")
        .select("id, title, client_name, site_name, scheduled_at, status, job_escalators(id, unit_number, location, completed, sort_order)")
        .in("id", assignedIds)
        .gte("scheduled_at", today.toISOString())
        .lt("scheduled_at", tomorrow.toISOString())
        .order("scheduled_at");

      jobs = (jobData ?? []).map((j: RawJob) => ({
        id:          j.id,
        title:       j.title,
        client_name: j.client_name,
        site_name:   j.site_name,
        scheduled_at: j.scheduled_at,
        status:      j.status,
        escalators:  [...(j.job_escalators ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      }));
    }

    /* Step 3 – recent time entries */
    const { data: entryData } = await supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", uid)
      .order("clock_in", { ascending: false })
      .limit(30);

    const rawEntries: TimeEntry[] = entryData ?? [];

    setTodaysJobs(jobs);
    setEntries(rawEntries);
    setOpenEntry(rawEntries.find((e) => !e.clock_out) ?? null);

    /* resolve job titles for entries */
    const ids = [...new Set(rawEntries.map((e) => e.job_id).filter(Boolean))] as string[];
    if (ids.length > 0) {
      const { data: jd } = await supabase.from("jobs").select("id, title, client_name").in("id", ids);
      const map: Record<string, JobTitle> = {};
      (jd ?? []).forEach((j: JobTitle) => { map[j.id] = j; });
      setJobTitles(map);
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Auto-select if only one job today */
  useEffect(() => {
    if (todaysJobs.length === 1 && !openEntry) setSelectedJobId(todaysJobs[0].id);
  }, [todaysJobs, openEntry]);

  /* Clock in */
  const handleClockIn = async () => {
    if (!userId) return;
    setBusy(true);
    const gps = await getGps();
    setLocDenied(!gps);

    const payload: Record<string, unknown> = {
      user_id:  userId,
      job_id:   selectedJobId || null,
      clock_in: new Date().toISOString(),
      notes:    clockNote.trim() || null,
    };
    if (gps) { payload.lat_in = gps.lat; payload.lng_in = gps.lng; }

    const { error } = await supabase.from("time_entries").insert(payload);
    if (error) { toast.error(error.message); setBusy(false); return; }
    toast.success("Clocked in!");
    setClockNote(""); setSelectedJobId("");
    setBusy(false);
    await load();
  };

  /* Clock out */
  const handleClockOut = async () => {
    if (!openEntry) return;
    setBusy(true);
    const gps = await getGps();

    const patch: Record<string, unknown> = { clock_out: new Date().toISOString() };
    if (gps) { patch.lat_out = gps.lat; patch.lng_out = gps.lng; }

    const { error } = await supabase.from("time_entries").update(patch).eq("id", openEntry.id);
    if (error) { toast.error(error.message); setBusy(false); return; }
    toast.success("Clocked out. Great work!");
    setBusy(false);
    await load();
  };

  /* Mark job complete */
  const handleMarkComplete = async (jobId: string) => {
    const { error } = await supabase
      .from("jobs")
      .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
      .eq("id", jobId);
    if (error) { toast.error(error.message); return; }
    toast.success("Job marked complete!");
    await load();
  };

  /* Toggle escalator */
  const handleToggleEscalator = async (jobId: string, escalatorId: string, completed: boolean) => {
    const patch: Record<string, unknown> = { completed };
    if (completed) { patch.completed_at = new Date().toISOString(); patch.completed_by = userId; }
    else           { patch.completed_at = null; patch.completed_by = null; }

    const { error } = await supabase.from("job_escalators").update(patch).eq("id", escalatorId);
    if (error) { toast.error(error.message); return; }

    /* optimistic UI update */
    setTodaysJobs(prev => prev.map(job =>
      job.id !== jobId ? job : {
        ...job,
        escalators: job.escalators.map(e => e.id === escalatorId ? { ...e, completed } : e),
      }
    ));
  };

  const isClockedIn = !!openEntry;
  const activeJob   = openEntry?.job_id ? jobTitles[openEntry.job_id] : null;
  const todayTotal  = entries
    .filter((e) => e.clock_out && fmtDate(e.clock_in) === fmtDate(new Date().toISOString()))
    .reduce((s, e) => s + (e.duration_minutes ?? 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center animate-pulse">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Clock In / Out</h1>
          <p className="text-xs text-slate-400">
            {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button onClick={() => load()}
          className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* ── Big Clock Action Card ───────────────────────────── */}
        <div className={`relative overflow-hidden rounded-3xl shadow-lg ${isClockedIn
          ? "bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800"
          : "bg-linear-to-br from-slate-800 via-slate-900 to-blue-950"
        }`}>
          <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
          <div className="pointer-events-none absolute bottom-0 -left-8 h-32 w-32 rounded-full bg-white/5 blur-xl" />

          <div className="relative p-7">
            {/* Status pill */}
            <div className="flex items-center gap-2 mb-6">
              <span className="relative flex h-3 w-3">
                {isClockedIn && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${isClockedIn ? "bg-white" : "bg-slate-500"}`} />
              </span>
              <span className="text-sm font-semibold text-white/80">
                {isClockedIn ? "You are clocked in" : "Not clocked in"}
              </span>
            </div>

            {/* Timer / idle display */}
            <div className="text-white mb-6">
              {isClockedIn && openEntry ? (
                <>
                  <p className="text-xs uppercase tracking-widest text-white/50 mb-1">Time elapsed</p>
                  <ElapsedTimer since={openEntry.clock_in} />
                  <WallClock />
                  {activeJob && (
                    <div className="mt-3 flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 w-fit">
                      <Briefcase className="h-3.5 w-3.5 text-white/70" />
                      <span className="text-sm text-white/90 font-medium">{activeJob.title}</span>
                    </div>
                  )}
                  {openEntry.lat_in && (
                    <a href={`https://maps.google.com/?q=${openEntry.lat_in},${openEntry.lng_in}`}
                      target="_blank" rel="noopener noreferrer"
                      className="mt-2 flex items-center gap-1.5 text-xs text-white/60 hover:text-white/90 w-fit">
                      <MapPin className="h-3 w-3" /> Clock-in location recorded
                    </a>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs uppercase tracking-widest text-white/50 mb-1">Current time</p>
                  <p className="tabular-nums font-mono text-5xl font-bold tracking-tight">
                    {new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </p>
                  <WallClock />
                  {todayTotal > 0 && (
                    <div className="mt-3 flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 w-fit">
                      <Timer className="h-3.5 w-3.5 text-white/70" />
                      <span className="text-sm text-white/90">{fmtDuration(todayTotal)} logged today</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Clock-in selectors */}
            {!isClockedIn && (
              <div className="grid gap-3 sm:grid-cols-2 mb-5">
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">
                    Link to job {todaysJobs.length > 0 ? `(${todaysJobs.length} assigned today)` : ""}
                  </label>
                  <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/30">
                    <option value="" className="text-slate-900">— No specific job —</option>
                    {todaysJobs.map(j => (
                      <option key={j.id} value={j.id} className="text-slate-900">{j.title}</option>
                    ))}
                  </select>
                  {todaysJobs.length === 0 && (
                    <p className="text-xs text-white/40 mt-1">No jobs assigned to you today</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">Note (optional)</label>
                  <input value={clockNote} onChange={e => setClockNote(e.target.value)}
                    placeholder="e.g. Starting Level 1 run"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 text-sm backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/30" />
                </div>
              </div>
            )}

            {/* Location warning */}
            {locDenied && (
              <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/30 rounded-xl px-3 py-2 mb-4">
                <MapPin className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                <p className="text-xs text-amber-200">Location not captured — enable GPS for attendance tracking</p>
              </div>
            )}

            {/* Action button */}
            {isClockedIn ? (
              <button onClick={handleClockOut} disabled={busy}
                className="w-full flex items-center justify-center gap-3 bg-white text-emerald-700 font-bold text-base py-4 rounded-2xl hover:bg-emerald-50 disabled:opacity-60 transition-all shadow-lg active:scale-95">
                {busy ? <RefreshCw className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                {busy ? "Getting location…" : "Clock Out"}
              </button>
            ) : (
              <button onClick={handleClockIn} disabled={busy}
                className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-bold text-base py-4 rounded-2xl hover:bg-blue-50 disabled:opacity-60 transition-all shadow-lg active:scale-95">
                {busy ? <RefreshCw className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                {busy ? "Getting location…" : "Clock In"}
              </button>
            )}
          </div>
        </div>

        {/* ── Today's Assigned Jobs ───────────────────────────── */}
        {todaysJobs.length > 0 ? (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Today's Jobs</h2>
              <span className="text-xs text-slate-400">{todaysJobs.length} assigned</span>
            </div>
            <div className="space-y-3">
              {todaysJobs.map((job) => {
                const done     = job.status === "COMPLETED";
                const escDone  = job.escalators.filter(e => e.completed).length;
                const escTotal = job.escalators.length;

                return (
                  <div key={job.id}
                    className={`bg-white rounded-2xl border shadow-sm transition-all ${done ? "border-emerald-200 opacity-80" : "border-slate-100"}`}>

                    {/* Job header row */}
                    <div className="flex items-center gap-4 p-4">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${done ? "bg-emerald-100" : "bg-blue-50"}`}>
                        {done
                          ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          : <Briefcase className="h-5 w-5 text-blue-600" />
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${done ? "text-slate-500 line-through" : "text-slate-900"}`}>
                          {job.title}
                        </p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {job.client_name}{job.site_name ? ` · ${job.site_name}` : ""}
                        </p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3 w-3" />{fmtTime(job.scheduled_at)}
                          </span>
                          {escTotal > 0 && <EscProgress done={escDone} total={escTotal} />}
                        </div>
                      </div>

                      {done ? (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full shrink-0">
                          Complete
                        </span>
                      ) : (
                        <button onClick={() => handleMarkComplete(job.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 rounded-xl shrink-0 transition-colors active:scale-95">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Complete
                        </button>
                      )}
                    </div>

                    {/* ── Escalator checklist ── */}
                    {escTotal > 0 && (
                      <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Escalators</span>
                          <span className={`text-xs font-medium ${escDone === escTotal ? "text-emerald-600" : "text-slate-400"}`}>
                            {escDone} / {escTotal} done
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {job.escalators.map((esc) => (
                            <button
                              key={esc.id}
                              type="button"
                              disabled={done}
                              onClick={() => handleToggleEscalator(job.id, esc.id, !esc.completed)}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${
                                done
                                  ? "cursor-not-allowed opacity-60 bg-slate-50 border-slate-200"
                                  : esc.completed
                                    ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                                    : "bg-slate-50 border-slate-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer"
                              }`}
                            >
                              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                esc.completed ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white"
                              }`}>
                                {esc.completed && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <span className={`text-sm font-semibold ${esc.completed ? "text-emerald-600 line-through" : "text-slate-800"}`}>
                                {esc.unit_number}
                              </span>
                              {esc.location && (
                                <span className="text-xs text-slate-400 ml-auto shrink-0 truncate max-w-20">
                                  {esc.location}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Briefcase className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-500">No jobs assigned to you today</p>
            <p className="text-xs text-slate-400">Contact your admin if you were expecting a shift</p>
          </div>
        )}

        {/* ── Time History ─────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Recent Time Entries</h2>
            <span className="text-xs text-slate-400">{entries.length} entries</span>
          </div>

          {entries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-10 flex flex-col items-center gap-3 shadow-sm">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Timer className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm text-slate-400">No time entries yet</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {entries.map((entry) => {
                const active = !entry.clock_out;
                return (
                  <div key={entry.id}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${active ? "border-emerald-200" : "border-slate-100"}`}>
                    {active && <div className="h-1 bg-linear-to-r from-emerald-400 to-teal-500" />}
                    <div className="px-4 py-3.5 flex items-center gap-3">
                      <div className={`h-11 w-11 rounded-xl flex flex-col items-center justify-center shrink-0 ${active ? "bg-emerald-100" : "bg-slate-50"}`}>
                        <Clock className={`h-4 w-4 ${active ? "text-emerald-600" : "text-slate-400"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{fmtTime(entry.clock_in)}</span>
                          {entry.clock_out && (
                            <>
                              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                              <span className="text-sm font-semibold text-slate-900">{fmtTime(entry.clock_out)}</span>
                            </>
                          )}
                          {active && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-slate-400">{fmtDate(entry.clock_in)}</span>
                          {entry.job_id && jobTitles[entry.job_id] && (
                            <span className="text-xs text-blue-600 truncate max-w-32">{jobTitles[entry.job_id].title}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-sm font-bold ${active ? "text-emerald-600" : "text-slate-700"}`}>
                          {active ? <ElapsedTimer since={entry.clock_in} /> : fmtDuration(entry.duration_minutes)}
                        </span>
                        {entry.lat_in && (
                          <a href={`https://maps.google.com/?q=${entry.lat_in},${entry.lng_in}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-700">
                            <MapPin className="h-3 w-3" /> Map
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
