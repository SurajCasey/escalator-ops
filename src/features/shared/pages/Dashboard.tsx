import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  MapPin,
  Plus,
  RefreshCw,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useJobs, type JobStatus, frequencyLabel } from "../../../hooks/Usejobs";
import AddJobModal from "../../jobs/components/AddJobModal";

type Role = "ADMIN" | "EMPLOYEE";
type ReportItem = { id: string; title: string; createdAt: string; status: "DRAFT" | "SUBMITTED" | "APPROVED" };

/* ─── helpers ─── */
function fmtTime(v: string) {
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}
function humanize(v: string) {
  return v.toLowerCase().split("_").map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
}
function normalizeReportStatus(v: string | null): ReportItem["status"] {
  const s = String(v ?? "").toUpperCase();
  if (s.includes("APPROV")) return "APPROVED";
  if (s.includes("SUBMIT")) return "SUBMITTED";
  return "DRAFT";
}
function startOfWeek(d: Date) {
  const c = new Date(d);
  const day = c.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  c.setDate(c.getDate() + diff);
  c.setHours(0, 0, 0, 0);
  return c;
}

const STATUS_COLOR: Record<JobStatus, string> = {
  SCHEDULED: "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  COMPLETED: "#10b981",
  OVERDUE: "#ef4444",
};
const STATUS_BG: Record<JobStatus, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  OVERDUE: "bg-rose-50 text-rose-700",
};
const REPORT_STATUS_CLASS: Record<ReportItem["status"], string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-sky-100 text-sky-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
};

/* ─── SVG Donut Chart ─── */
function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 70;
  const C = 2 * Math.PI * R; // circumference ≈ 439.82

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={R} fill="none" stroke="#e2e8f0" strokeWidth="22" />
        </svg>
        <p className="text-sm text-slate-400 mt-2">No jobs yet</p>
      </div>
    );
  }

  let offset = 0;
  const segments = data.map((d) => {
    const pct = d.value / total;
    const dash = pct * C;
    const gap = C - dash;
    const seg = { ...d, dash, gap, offset: C - offset };
    offset += dash;
    return seg;
  });

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
          <circle cx="80" cy="80" r={R} fill="none" stroke="#f1f5f9" strokeWidth="22" />
          {segments.map((seg) => (
            <circle
              key={seg.label}
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth="22"
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={seg.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900">{total}</span>
          <span className="text-xs text-slate-500">total jobs</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 w-full">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-xs text-slate-600 truncate">{d.label}</span>
            <span className="text-xs font-semibold text-slate-800 ml-auto">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── SVG Bar Chart ─── */
function BarChart({ bars }: { bars: { label: string; scheduled: number; completed: number }[] }) {
  const max = Math.max(...bars.map((b) => b.scheduled), 1);
  const H = 100;

  return (
    <div className="mt-2">
      <svg viewBox={`0 0 ${bars.length * 40} ${H + 24}`} className="w-full overflow-visible">
        {bars.map((b, i) => {
          const x = i * 40 + 4;
          const bw = 14;
          const schedH = Math.max((b.scheduled / max) * H, b.scheduled > 0 ? 4 : 0);
          const compH = Math.max((b.completed / max) * H, b.completed > 0 ? 4 : 0);
          return (
            <g key={b.label}>
              {/* scheduled bar */}
              <rect
                x={x}
                y={H - schedH}
                width={bw}
                height={schedH}
                rx="3"
                fill="#dbeafe"
              />
              {/* completed bar (overlay) */}
              <rect
                x={x}
                y={H - compH}
                width={bw}
                height={compH}
                rx="3"
                fill="#3b82f6"
              />
              {/* second bar (completed only, offset) */}
              <rect
                x={x + bw + 2}
                y={H - compH}
                width={bw}
                height={compH}
                rx="3"
                fill="#10b981"
                opacity={0.8}
              />
              <text
                x={x + bw}
                y={H + 16}
                textAnchor="middle"
                fontSize="9"
                fill="#94a3b8"
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 mt-1">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-2 w-3 rounded-sm bg-blue-200 inline-block" /> Scheduled
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-2 w-3 rounded-sm bg-emerald-400 inline-block" /> Completed
        </span>
      </div>
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({
  title, value, subtitle, icon, accent, prefix = "", suffix = "",
}: {
  title: string; value: number | string; subtitle: string;
  icon: React.ReactNode; accent: string; prefix?: string; suffix?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex gap-4 items-start border-t-4 ${accent}`}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
          {prefix}{typeof value === "number" ? value.toLocaleString() : value}{suffix}
        </p>
        <p className="text-xs text-slate-400 mt-1 truncate">{subtitle}</p>
      </div>
      <div className="h-11 w-11 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 shrink-0">
        {icon}
      </div>
    </div>
  );
}

/* ─── Live Clock ─── */
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="text-right">
      <p className="text-xl font-bold tabular-nums text-white">{time}</p>
      <p className="text-xs text-blue-200 mt-0.5">{date}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { jobs, loading: jobsLoading, fetchJobs } = useJobs();
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [role, setRole] = useState<Role>("EMPLOYEE");
  const [_userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("Team Member");
  const [profileLoading, setProfileLoading] = useState(true);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [activeClients, setActiveClients] = useState(0);
  const [activeEmployees, setActiveEmployees] = useState(0);
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [weeklyRevenue, setWeeklyRevenue] = useState(0);
  const [myActiveEntry, setMyActiveEntry] = useState<{ id: string; clock_in: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) { setProfileLoading(false); return; }
      const uid = session.user.id;
      setUserId(uid);

      const [profileRes, clientsRes, employeesRes, reportsRes] = await Promise.all([
        supabase.from("profiles").select("full_name, role, hourly_rate").eq("id", uid).single<{ full_name: string | null; role: Role; hourly_rate: number | null }>(),
        supabase.from("clients").select("id, status"),
        supabase.from("profiles").select("id, status").eq("role", "EMPLOYEE"),
        supabase.from("reports").select("id, title, status, created_at").order("created_at", { ascending: false }).limit(5),
      ]);

      if (profileRes.data) {
        setRole(profileRes.data.role);
        setName(profileRes.data.full_name?.trim() || session.user.email || "Team Member");
      }
      if (clientsRes.data) {
        setActiveClients(clientsRes.data.filter((c: { status?: string }) => String(c.status ?? "").toUpperCase() === "ACTIVE").length);
      }
      if (employeesRes.data) {
        setActiveEmployees(employeesRes.data.filter((e: { status?: string }) => String(e.status ?? "").toUpperCase() === "ACTIVE").length);
      }
      if (reportsRes.data) {
        setReports(reportsRes.data.map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at, status: normalizeReportStatus(r.status) })));
      }

      // Time entries this week
      const weekStart = startOfWeek(new Date()).toISOString();
      const teRes = await supabase
        .from("time_entries")
        .select("duration_minutes, clock_out")
        .gte("clock_in", weekStart);

      if (teRes.data) {
        const mins = teRes.data.filter((e: { clock_out?: string | null }) => e.clock_out).reduce((s: number, e: { duration_minutes?: number | null }) => s + (e.duration_minutes ?? 0), 0);
        setWeeklyMinutes(mins);
      }

      // Active clock-in for current user
      const openEntry = await supabase
        .from("time_entries")
        .select("id, clock_in")
        .eq("user_id", uid)
        .is("clock_out", null)
        .maybeSingle();
      if (openEntry.data) setMyActiveEntry(openEntry.data as { id: string; clock_in: string });

      setProfileLoading(false);
    };
    load();
  }, []);

  // Weekly revenue from completed jobs with flat_rate
  useEffect(() => {
    const weekStart = startOfWeek(new Date());
    const rev = jobs
      .filter((j) => j.status === "COMPLETED" && j.completed_at && new Date(j.completed_at) >= weekStart && j.flat_rate)
      .reduce((s, j) => s + (j.flat_rate ?? 0), 0);
    setWeeklyRevenue(rev);
  }, [jobs]);

  const snapshot = useMemo(() => {
    const now = Date.now();
    const todayEnd = now + 86400000;
    const completed = jobs.filter((j) => j.status === "COMPLETED").length;
    const overdue = jobs.filter((j) => j.status === "OVERDUE").length;
    const todayJobs = jobs.filter((j) => {
      const t = new Date(j.scheduled_at).getTime();
      return t >= now && t <= todayEnd;
    }).length;
    const completionRate = jobs.length === 0 ? 0 : Math.round((completed / jobs.length) * 100);
    return { totalJobs: jobs.length, completedJobs: completed, overdueJobs: overdue, completionRate, todayJobs, inProgress: jobs.filter((j) => j.status === "IN_PROGRESS").length, scheduled: jobs.filter((j) => j.status === "SCHEDULED").length };
  }, [jobs]);

  // Donut chart data
  const donutData = useMemo(() => [
    { label: "Scheduled", value: snapshot.scheduled, color: STATUS_COLOR.SCHEDULED },
    { label: "In Progress", value: snapshot.inProgress, color: STATUS_COLOR.IN_PROGRESS },
    { label: "Completed", value: snapshot.completedJobs, color: STATUS_COLOR.COMPLETED },
    { label: "Overdue", value: snapshot.overdueJobs, color: STATUS_COLOR.OVERDUE },
  ], [snapshot]);

  // Bar chart: last 7 days
  const last7Days = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-AU", { weekday: "short" });
      const dayJobs = jobs.filter((j) => j.scheduled_at.startsWith(dayStr));
      days.push({ label, scheduled: dayJobs.length, completed: dayJobs.filter((j) => j.status === "COMPLETED").length });
    }
    return days;
  }, [jobs]);

  // Upcoming jobs
  const upcomingJobs = useMemo(() => {
    const now = Date.now();
    return [...jobs]
      .filter((j) => j.status !== "COMPLETED")
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .filter((j) => new Date(j.scheduled_at).getTime() >= now - 86400000)
      .slice(0, 5);
  }, [jobs]);

  const loading = profileLoading || jobsLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 space-y-5">
        <div className="animate-pulse space-y-5">
          <div className="h-36 rounded-2xl bg-slate-200" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1,2,3,4].map((i) => <div key={i} className="h-28 rounded-2xl bg-slate-200" />)}
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            <div className="h-72 rounded-2xl bg-slate-200 xl:col-span-2" />
            <div className="h-72 rounded-2xl bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 xl:p-8 space-y-6">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 text-white shadow-xl p-6 md:p-8">
        {/* decorative blur blobs */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-24 h-40 w-40 rounded-full bg-indigo-500/15 blur-2xl" />

        <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">Statewide Escalator Operations</p>
            <h1 className="text-2xl md:text-3xl font-extrabold mt-2">
              Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
              <span className="text-blue-300">{name.split(" ")[0]}</span>
            </h1>
            <p className="text-sm text-slate-300 mt-2">
              {role === "ADMIN" ? "Admin overview" : "Your operations hub"} — {snapshot.todayJobs} job{snapshot.todayJobs !== 1 ? "s" : ""} scheduled today
            </p>
            {role === "ADMIN" && (
              <button
                onClick={() => setAddJobOpen(true)}
                className="mt-4 inline-flex items-center gap-2 bg-white text-slate-900 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-blue-50 transition-all shadow-md active:scale-95"
              >
                <Plus className="h-4 w-4" />
                Add New Job
              </button>
            )}

            {/* Active clock-in banner */}
            {myActiveEntry && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 border border-emerald-400/30 px-3 py-2 text-sm text-emerald-200">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                </span>
                Clocked in since {fmtTime(myActiveEntry.clock_in)}
              </div>
            )}
            {snapshot.overdueJobs > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-rose-500/20 border border-rose-400/30 px-3 py-2 text-xs text-rose-200">
                <AlertCircle className="h-3.5 w-3.5" />
                {snapshot.overdueJobs} overdue job{snapshot.overdueJobs !== 1 ? "s" : ""} need attention
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-4">
            <LiveClock />
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Today", value: snapshot.todayJobs },
                { label: "Rate", value: `${snapshot.completionRate}%` },
                { label: "Overdue", value: snapshot.overdueJobs },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm px-3 py-2.5">
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-xs text-slate-300 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stat Cards ── */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Jobs"
          value={snapshot.totalJobs}
          subtitle={`${snapshot.inProgress} in progress right now`}
          icon={<Briefcase className="h-5 w-5" />}
          accent="border-t-blue-500"
        />
        <StatCard
          title="Completed"
          value={snapshot.completedJobs}
          subtitle={`${snapshot.completionRate}% completion rate`}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          accent="border-t-emerald-500"
        />
        <StatCard
          title="Hours This Week"
          value={Math.round(weeklyMinutes / 60 * 10) / 10}
          subtitle="From clocked time entries"
          icon={<Timer className="h-5 w-5 text-violet-500" />}
          accent="border-t-violet-500"
          suffix="h"
        />
        <StatCard
          title={role === "ADMIN" ? "Active Employees" : "Active Clients"}
          value={role === "ADMIN" ? activeEmployees : activeClients}
          subtitle={role === "ADMIN" ? `${activeClients} active clients` : "Currently serviced"}
          icon={<Users className="h-5 w-5 text-amber-500" />}
          accent="border-t-amber-500"
        />
      </section>

      {/* ── Charts Row ── */}
      <section className="grid gap-5 md:grid-cols-3">

        {/* Weekly bar chart */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Jobs This Week</h2>
              <p className="text-xs text-slate-400 mt-0.5">Scheduled vs completed per day</p>
            </div>
            <span className="rounded-full bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1">Last 7 days</span>
          </div>
          <BarChart bars={last7Days} />
        </div>

        {/* Donut chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="font-semibold text-slate-900">Job Status</h2>
              <p className="text-xs text-slate-400 mt-0.5">Distribution overview</p>
            </div>
            <TrendingUp className="h-4 w-4 text-slate-300" />
          </div>
          <DonutChart data={donutData} />
        </div>
      </section>

      {/* ── Upcoming Jobs + Revenue ── */}
      <section className="grid gap-5 md:grid-cols-3">

        {/* Upcoming jobs */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Upcoming Jobs</h2>
              <p className="text-xs text-slate-400 mt-0.5">Active & scheduled work</p>
            </div>
            <div className="flex items-center gap-3">
              {role === "ADMIN" && (
                <button
                  onClick={() => setAddJobOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Job
                </button>
              )}
              <Link to={role === "ADMIN" ? "/admin/schedule" : "/schedule"} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {upcomingJobs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
                <CalendarDays className="h-8 w-8 opacity-40" />
                <p className="text-sm">No upcoming jobs</p>
              </div>
            )}
            {upcomingJobs.map((job) => (
              <div key={job.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                <div className="h-9 w-9 rounded-xl shrink-0 flex items-center justify-center" style={{ background: STATUS_COLOR[job.status] + "22" }}>
                  <Briefcase className="h-4 w-4" style={{ color: STATUS_COLOR[job.status] }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">{job.title}</p>
                    {job.job_type === "CONTRACT" && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
                        <RefreshCw className="h-2.5 w-2.5" />{frequencyLabel(job.frequency_days)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    <p className="text-xs text-slate-500 truncate">{job.client_name}{job.site_name ? ` · ${job.site_name}` : ""}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUS_BG[job.status]}`}>
                    {humanize(job.status)}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    {fmtTime(job.scheduled_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue + Quick Actions */}
        <div className="flex flex-col gap-5">
          {/* Revenue card — admin only */}
          {role === "ADMIN" && (
            <div className="bg-linear-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-blue-100">Revenue This Week</p>
                <DollarSign className="h-5 w-5 text-blue-300" />
              </div>
              <p className="text-3xl font-extrabold mt-2">${weeklyRevenue.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-blue-200 mt-1">From {jobs.filter(j => j.status === "COMPLETED" && j.flat_rate && j.completed_at && new Date(j.completed_at) >= startOfWeek(new Date())).length} completed flat-rate jobs</p>
              <div className="mt-4 h-px bg-white/20" />
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-blue-100">Completion rate</span>
                <span className="font-bold">{snapshot.completionRate}%</span>
              </div>
              <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${snapshot.completionRate}%` }} />
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-3">Quick Links</h2>
            <div className="space-y-2">
              {[
                { to: role === "ADMIN" ? "/admin/schedule" : "/schedule", icon: <CalendarDays className="h-4 w-4" />, label: "Schedule", color: "text-blue-600 bg-blue-50" },
                { to: role === "ADMIN" ? "/admin/inventory" : "/inventory", icon: <Zap className="h-4 w-4" />, label: "Inventory", color: "text-amber-600 bg-amber-50" },
                { to: role === "ADMIN" ? "/admin/reports" : "/reports", icon: <FileText className="h-4 w-4" />, label: "Reports", color: "text-violet-600 bg-violet-50" },
                ...(role === "ADMIN"
                  ? [{ to: "/admin/timesheet", icon: <Timer className="h-4 w-4" />, label: "Timesheets", color: "text-emerald-600 bg-emerald-50" }]
                  : [{ to: "/clock", icon: <Clock className="h-4 w-4" />, label: "Clock In/Out", color: "text-emerald-600 bg-emerald-50" }]
                ),
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                >
                  <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${item.color}`}>{item.icon}</span>
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 ml-auto transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Recent Reports ── */}
      {reports.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Reports</h2>
            <Link to={role === "ADMIN" ? "/admin/reports" : "/reports"} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {reports.slice(0, 3).map((r) => (
              <div key={r.id} className="px-5 py-4 flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{r.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{fmtTime(r.createdAt)}</p>
                  <span className={`mt-1.5 inline-block text-xs font-medium px-2 py-0.5 rounded-full ${REPORT_STATUS_CLASS[r.status]}`}>{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Add Job Modal (admin only) ── */}
      {role === "ADMIN" && (
        <AddJobModal
          open={addJobOpen}
          onClose={() => setAddJobOpen(false)}
          onSaved={() => { fetchJobs(); }}
        />
      )}

    </div>
  );
}
