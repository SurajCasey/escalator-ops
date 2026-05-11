import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  DollarSign,
  FileText,
  MapPin,
  Minus,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  Timer,
  UserCheck,
  Users,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useJobs, type JobStatus, frequencyLabel } from "../../../hooks/Usejobs";
import BookingModal from "../../jobs/components/BookingModal";

/* ─── Types ─────────────────────────────────────────────────────── */
type Role = "ADMIN" | "EMPLOYEE";

type LowStockItem = {
  id: string;
  name: string;
  quantity: number;
  min_quantity: number | null;
};

type CrewMember = {
  userId: string;
  name: string;
  clockIn: string;
  jobTitle: string | null;
  clientName: string | null;
  jobStatus: JobStatus | null;
};

/* ─── Helpers ────────────────────────────────────────────────────── */
function fmtTime(v: string) {
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit" }).format(d);
}

function fmtShortDate(v: string) {
  return new Date(v).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

function humanize(v: string) {
  return v.toLowerCase().split("_").map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
}

function timeSince(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h${rem > 0 ? ` ${rem}m` : ""}`;
}

function howLate(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins <= 0) return "upcoming";
  if (mins < 60) return `${mins}m late`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h late`;
  return `${Math.floor(hrs / 24)}d late`;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency", currency: "AUD", maximumFractionDigits: 0,
  }).format(n);
}

function startOfMonth(offset = 0) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}

function startOfWeek(d: Date) {
  const c = new Date(d);
  const day = c.getDay();
  c.setDate(c.getDate() - (day === 0 ? 6 : day - 1));
  c.setHours(0, 0, 0, 0);
  return c;
}

/* ─── Status maps ────────────────────────────────────────────────── */
const STATUS_BG: Record<JobStatus, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  OVERDUE: "bg-rose-50 text-rose-700",
  CANCELLED: "bg-slate-100 text-slate-500",
  DRAFT: ""
};

const STATUS_DOT: Record<JobStatus, string> = {
  SCHEDULED: "bg-blue-400",
  IN_PROGRESS: "bg-amber-400",
  COMPLETED: "bg-emerald-400",
  OVERDUE: "bg-rose-500",
  CANCELLED: "bg-slate-300",
  DRAFT: ""
};

const STATUS_LEFT: Record<JobStatus, string> = {
  SCHEDULED: "border-l-blue-400",
  IN_PROGRESS: "border-l-amber-400",
  COMPLETED: "border-l-emerald-400",
  OVERDUE: "border-l-rose-500",
  CANCELLED: "border-l-slate-200",
  DRAFT: ""
};

/* ─── Sub-components ─────────────────────────────────────────────── */
function StatCard({
  title, value, subtitle, icon, accent, suffix = "", trend,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  suffix?: string;
  trend?: { delta: number; label: string };
}) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5 flex gap-3 items-start border-t-4 ${accent}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
        <p className="text-xl md:text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}{suffix}
        </p>
        <p className="text-[10px] md:text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
        {trend !== undefined && (
          <div className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend.delta > 0 ? "bg-emerald-50 text-emerald-700" :
            trend.delta < 0 ? "bg-rose-50 text-rose-700" :
            "bg-slate-50 text-slate-500"
          }`}>
            {trend.delta > 0
              ? <ArrowUpRight className="h-3 w-3" />
              : trend.delta < 0
              ? <ArrowDownRight className="h-3 w-3" />
              : <Minus className="h-3 w-3" />}
            {trend.label}
          </div>
        )}
      </div>
      <div className="h-9 w-9 md:h-11 md:w-11 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
        {icon}
      </div>
    </div>
  );
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-right">
      <p className="text-xl font-bold tabular-nums text-white">
        {now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>
      <p className="text-xs text-blue-200 mt-0.5">
        {now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
      </p>
    </div>
  );
}

function CrewAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const COLORS = ["bg-blue-500","bg-violet-500","bg-teal-500","bg-orange-500","bg-pink-500","bg-indigo-500","bg-cyan-500"];
  const color = COLORS[name.charCodeAt(0) % COLORS.length];
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const sz = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <div className={`${sz} rounded-full ${color} text-white font-bold flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { jobs, loading: jobsLoading, fetchJobs } = useJobs();
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [role, setRole] = useState<Role>("EMPLOYEE");
  const [name, setName] = useState("Team Member");
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeClients, setActiveClients] = useState(0);
  const [activeEmployees, setActiveEmployees] = useState(0);
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [myActiveEntry, setMyActiveEntry] = useState<{ id: string; clock_in: string } | null>(null);
  const [draftDocuments, setDraftDocuments] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [clockedInCrew, setClockedInCrew] = useState<CrewMember[]>([]);

  // Alert state
  const [overdueInvoices, setOverdueInvoices]       = useState<{ id: string; client_name?: string | null }[]>([]);
  const [pendingReceipts, setPendingReceipts]         = useState<{ id: string; amount?: number | null }[]>([]);
  const [pendingAvailability, setPendingAvailability] = useState<{ id: string }[]>([]);
  const [pendingPayroll, setPendingPayroll]           = useState<{ id: string }[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) { setProfileLoading(false); return; }
      const uid = session.user.id;

      const [profileRes, clientsRes, employeesRes] = await Promise.all([
        supabase.from("profiles").select("full_name, role").eq("id", uid).single<{ full_name: string | null; role: Role }>(),
        supabase.from("clients").select("id, status"),
        supabase.from("profiles").select("id, status").eq("role", "EMPLOYEE"),
      ]);

      let resolvedRole: Role = "EMPLOYEE";
      if (profileRes.data) {
        resolvedRole = profileRes.data.role;
        setRole(resolvedRole);
        setName(profileRes.data.full_name?.trim() || session.user.email || "Team Member");
      }
      if (clientsRes.data) {
        setActiveClients(
          clientsRes.data.filter((c: { status?: string }) => String(c.status ?? "").toUpperCase() === "ACTIVE").length
        );
      }
      if (employeesRes.data) {
        setActiveEmployees(
          employeesRes.data.filter((e: { status?: string }) => String(e.status ?? "").toUpperCase() === "ACTIVE").length
        );
      }

      // Weekly hours for current user
      const weekStart = startOfWeek(new Date()).toISOString();
      const { data: teData } = await supabase
        .from("time_entries")
        .select("duration_minutes, clock_out, user_id")
        .gte("clock_in", weekStart);
      if (teData) {
        const myMins = (teData as { duration_minutes: number | null; clock_out: string | null; user_id: string }[])
          .filter(e => e.clock_out && e.user_id === uid)
          .reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
        setWeeklyMinutes(myMins);
      }

      // My active clock-in
      const { data: openEntry } = await supabase
        .from("time_entries")
        .select("id, clock_in")
        .eq("user_id", uid)
        .is("clock_out", null)
        .maybeSingle();
      if (openEntry) setMyActiveEntry(openEntry as { id: string; clock_in: string });

      const { data: draftDocs } = await supabase
        .from("report_documents")
        .select("id", { count: "exact", head: false })
        .eq("user_id", uid)
        .eq("status", "DRAFT");
      setDraftDocuments((draftDocs ?? []).length);

      // Low stock items
      const { data: invData } = await supabase
        .from("inventory")
        .select("id, name, quantity, min_quantity")
        .order("name");
      if (invData) {
        setLowStockItems(
          (invData as LowStockItem[]).filter(
            item => item.quantity === 0 || (item.min_quantity != null && item.quantity <= item.min_quantity)
          )
        );
      }

      // Crew status — admin only: all clocked-in people
      if (resolvedRole === "ADMIN") {
        const { data: allEntries } = await supabase
          .from("time_entries")
          .select("user_id, clock_in")
          .is("clock_out", null);

        if (allEntries && allEntries.length > 0) {
          const entries = allEntries as { user_id: string; clock_in: string }[];
          const userIds = [...new Set(entries.map(e => e.user_id))];
          const { data: profData } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);
          const profileMap = new Map(
            (profData ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? "Unknown"])
          );
          setClockedInCrew(
            entries.map(e => ({
              userId: e.user_id,
              name: profileMap.get(e.user_id) ?? "Unknown",
              clockIn: e.clock_in,
              jobTitle: null,
              clientName: null,
              jobStatus: null,
            }))
          );
        }
      }

      // Operational alerts (admin only) — use allSettled so one bad table never breaks the rest
      if (resolvedRole === "ADMIN") {
        const today    = new Date().toISOString().split("T")[0];
        const weekAgo  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [invRes, recRes, availRes, payRes] = await Promise.allSettled([
          supabase.from("invoices").select("id, client_name").neq("status", "PAID").neq("status", "CANCELLED").lt("due_date", today),
          supabase.from("receipts").select("id, amount").eq("status", "PENDING"),
          supabase.from("employee_availability").select("id").gte("created_at", weekAgo),
          supabase.from("payroll_runs").select("id").neq("status", "PAID").lt("period_end", today),
        ]);

        if (invRes.status   === "fulfilled" && invRes.value.data)   setOverdueInvoices(invRes.value.data as { id: string; client_name?: string | null }[]);
        if (recRes.status   === "fulfilled" && recRes.value.data)   setPendingReceipts(recRes.value.data as { id: string; amount?: number | null }[]);
        if (availRes.status === "fulfilled" && availRes.value.data) setPendingAvailability(availRes.value.data as { id: string }[]);
        if (payRes.status   === "fulfilled" && payRes.value.data)   setPendingPayroll(payRes.value.data as { id: string }[]);
      }

      setProfileLoading(false);
    };
    load();
  }, []);

  /* ─── Derived data ───────────────────────────────────────────────── */

  // Today's jobs, sorted by time, no cancelled
  const todayJobs = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end   = new Date(); end.setHours(23, 59, 59, 999);
    return jobs
      .filter(j => {
        const t = new Date(j.scheduled_at);
        return t >= start && t <= end && j.status !== "CANCELLED";
      })
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [jobs]);

  // Week's jobs grouped by day (Mon–Sun)
  const weekJobsByDay = useMemo(() => {
    const ws = startOfWeek(new Date());
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws);
      d.setDate(ws.getDate() + i);
      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(d); dayEnd.setHours(23, 59, 59, 999);
      const dayJobs  = jobs
        .filter(j => {
          const t = new Date(j.scheduled_at);
          return t >= dayStart && t <= dayEnd && j.status !== "CANCELLED";
        })
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      const isToday = d.toDateString() === today.toDateString();
      return {
        key:      d.toISOString().split("T")[0],
        date:     d,
        label:    d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" }),
        isToday,
        jobs:     dayJobs,
      };
    });
  }, [jobs]);

  const weekJobsTotal = useMemo(
    () => weekJobsByDay.reduce((s, d) => s + d.jobs.length, 0),
    [weekJobsByDay]
  );

  const employeeWeekRemaining = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return jobs.filter((job) => {
      const when = new Date(job.scheduled_at);
      return (
        when >= now &&
        when >= weekStart &&
        when < weekEnd &&
        job.status !== "COMPLETED" &&
        job.status !== "CANCELLED"
      );
    }).length;
  }, [jobs]);

  // Jobs overdue or running late — needs attention (no cap; grouped by client in render)
  const attentionJobs = useMemo(() => {
    const now = new Date();
    return jobs
      .filter(j =>
        j.status !== "CANCELLED" && j.status !== "COMPLETED" &&
        new Date(j.scheduled_at) < now
      )
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [jobs]);

  // Group attentionJobs by client for compact rendering
  const attentionByClient = useMemo(() => {
    const map = new Map<string, typeof attentionJobs>();
    attentionJobs.forEach(j => {
      const key = j.client_name ?? "Unknown Client";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(j);
    });
    return [...map.entries()]; // [ [clientName, jobs[]], ... ]
  }, [attentionJobs]);

  // Upcoming contract visits in next 30 days
  const upcomingContracts = useMemo(() => {
    const now   = new Date();
    const in30  = new Date(); in30.setDate(in30.getDate() + 30);
    return jobs
      .filter(j => j.job_type === "CONTRACT" && j.status === "SCHEDULED")
      .filter(j => { const t = new Date(j.scheduled_at); return t >= now && t <= in30; })
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .slice(0, 4);
  }, [jobs]);

  const nextAssignedJob = useMemo(() => {
    const now = new Date();
    return jobs
      .filter((job) => {
        const scheduled = new Date(job.scheduled_at);
        return (
          scheduled >= now &&
          job.status !== "COMPLETED" &&
          job.status !== "CANCELLED"
        );
      })
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null;
  }, [jobs]);

  const employeeUpcomingJobs = useMemo(() => {
    const now = new Date();
    return jobs
      .filter((job) => {
        const scheduled = new Date(job.scheduled_at);
        return (
          scheduled >= now &&
          job.status !== "COMPLETED" &&
          job.status !== "CANCELLED"
        );
      })
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .slice(0, 4);
  }, [jobs]);

  // Revenue: this month vs last month
  const { monthRevenue, lastMonthRevenue, monthCompletedCount } = useMemo(() => {
    const thisStart = startOfMonth(0);
    const lastStart = startOfMonth(-1);
    const lastEnd   = new Date(thisStart.getTime() - 1);
    const completed = jobs.filter(j => j.status === "COMPLETED" && j.flat_rate);
    const thisJobs  = completed.filter(j => j.completed_at && new Date(j.completed_at) >= thisStart);
    const lastJobs  = completed.filter(j => {
      if (!j.completed_at) return false;
      const d = new Date(j.completed_at);
      return d >= lastStart && d <= lastEnd;
    });
    return {
      monthRevenue:       thisJobs.reduce((s, j) => s + (j.flat_rate ?? 0), 0),
      lastMonthRevenue:   lastJobs.reduce((s, j) => s + (j.flat_rate ?? 0), 0),
      monthCompletedCount: thisJobs.length,
    };
  }, [jobs]);

  const revenuePct = useMemo(() => {
    if (lastMonthRevenue === 0) return null;
    return Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100);
  }, [monthRevenue, lastMonthRevenue]);

  // Snapshot
  const snapshot = useMemo(() => {
    const active = jobs.filter(j => j.status !== "CANCELLED");
    const completed = active.filter(j => j.status === "COMPLETED").length;
    const completionRate = active.length === 0 ? 0 : Math.round((completed / active.length) * 100);
    return {
      totalJobs: active.length,
      completedJobs: completed,
      overdueJobs: active.filter(j => j.status === "OVERDUE").length,
      inProgress: active.filter(j => j.status === "IN_PROGRESS").length,
      completionRate,
    };
  }, [jobs]);

  // Enrich crew with their today job (match by assigned_to_name)
  const enrichedCrew = useMemo(() => {
    return clockedInCrew
      .map(member => {
        const job = todayJobs.find(j => j.assigned_to_name === member.name);
        return {
          ...member,
          jobTitle:   job?.title ?? null,
          clientName: job?.client_name ?? null,
          jobStatus:  job?.status ?? null,
        };
      })
      .sort((a, b) => {
        // On-job members first, then by clock-in time
        if (!!a.jobTitle !== !!b.jobTitle) return a.jobTitle ? -1 : 1;
        return new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime();
      });
  }, [clockedInCrew, todayJobs]);

  // Total actionable alerts count (for badge)
  const outOfStock   = lowStockItems.filter(i => i.quantity === 0);
  const totalAlerts  = overdueInvoices.length + pendingReceipts.length + outOfStock.length + pendingAvailability.length + pendingPayroll.length;

  const loading = profileLoading || jobsLoading;

  /* ─── Loading skeleton ───────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 space-y-5">
        <div className="animate-pulse space-y-5">
          <div className="h-44 rounded-2xl bg-slate-200" />
          <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
            {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl bg-slate-200" />)}
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            <div className="h-80 rounded-2xl bg-slate-200 xl:col-span-2" />
            <div className="h-80 rounded-2xl bg-slate-200" />
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            <div className="h-64 rounded-2xl bg-slate-200 xl:col-span-2" />
            <div className="h-64 rounded-2xl bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  /* ─── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 xl:p-8 space-y-6">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 text-white shadow-xl p-4 md:p-8">
        <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-28 h-44 w-44 rounded-full bg-indigo-500/15 blur-2xl" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
              Statewide Escalator Operations
            </p>
            <h1 className="mt-1.5 text-2xl font-extrabold md:mt-2 md:text-3xl">
              {greeting},{" "}
              <span className="text-blue-300">{name.split(" ")[0]}</span>
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              {role === "ADMIN" ? "Admin overview" : "Your operations hub"}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2.5 md:mt-4 md:gap-3">
              {role === "ADMIN" && (
                <button
                  onClick={() => setAddJobOpen(true)}
                  className="inline-flex items-center gap-2 bg-white text-slate-900 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-blue-50 transition-all shadow-md active:scale-95"
                >
                  <Plus className="h-4 w-4" /> Add New Job
                </button>
              )}
              {myActiveEntry && (
                <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 px-3 py-2 text-sm text-emerald-200">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                  </span>
                  Clocked in · {timeSince(myActiveEntry.clock_in)}
                </div>
              )}
              {snapshot.overdueJobs > 0 && (
                <div className="inline-flex items-center gap-2 rounded-xl bg-rose-500/20 border border-rose-400/30 px-3 py-2 text-xs font-medium text-rose-200">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {snapshot.overdueJobs} overdue job{snapshot.overdueJobs !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2.5 shrink-0 md:gap-4">
            <LiveClock />
            <div className="grid grid-cols-3 gap-1.5 text-center md:gap-2">
              {[
                { label: "This Week",    value: jobs.filter(j => { const t = new Date(j.scheduled_at); const ws = startOfWeek(new Date()); const we = new Date(ws); we.setDate(we.getDate() + 7); return t >= ws && t < we && j.status !== "CANCELLED"; }).length },
                { label: "In Progress",  value: snapshot.inProgress },
                { label: "Overdue",      value: snapshot.overdueJobs },
              ].map(s => (
                <div key={s.label} className="rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm px-2.5 py-2 md:px-3 md:py-2.5">
                  <p className="text-base font-bold tabular-nums md:text-lg">{s.value}</p>
                  <p className="mt-0.5 text-[10px] text-slate-300">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Low Stock Warning ── */}
      {lowStockItems.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 md:p-5">
          <div className="flex items-start gap-3">
            <div className="shrink-0 h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    {lowStockItems.length} item{lowStockItems.length !== 1 ? "s" : ""} need restocking
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">At or below minimum stock level</p>
                </div>
                <Link
                  to={role === "ADMIN" ? "/admin/inventory" : "/inventory"}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                >
                  View Inventory <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {lowStockItems.slice(0, 6).map(item => (
                  <span key={item.id} className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                    item.quantity === 0
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-amber-100 text-amber-800 border-amber-200"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${item.quantity === 0 ? "bg-rose-500" : "bg-amber-500"}`} />
                    {item.name}
                    <span className="font-bold ml-0.5">
                      {item.quantity === 0 ? "Out" : `×${item.quantity}`}
                    </span>
                  </span>
                ))}
                {lowStockItems.length > 6 && (
                  <span className="text-xs text-amber-600 font-medium self-center">+{lowStockItems.length - 6} more</span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Stat Cards ── */}
      <section className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {role === "ADMIN" ? (
          <>
            <StatCard
              title="Jobs This Week"
              value={weekJobsTotal}
              subtitle={`${todayJobs.length} today · ${snapshot.inProgress} in progress`}
              icon={<CalendarDays className="h-5 w-5" />}
              accent="border-t-blue-500"
            />
            <StatCard
              title="This Month Revenue"
              value={formatMoney(monthRevenue)}
              subtitle={`${monthCompletedCount} completed flat-rate jobs`}
              icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
              accent="border-t-emerald-500"
              trend={revenuePct != null ? {
                delta: revenuePct,
                label: `${Math.abs(revenuePct)}% vs last month`,
              } : undefined}
            />
            <StatCard
              title="Needs Attention"
              value={attentionJobs.length}
              subtitle={`${snapshot.overdueJobs} overdue · ${attentionByClient.length} client groups`}
              icon={<AlertCircle className="h-5 w-5 text-rose-500" />}
              accent="border-t-rose-500"
            />
            <StatCard
              title="Active Crew"
              value={enrichedCrew.length}
              subtitle={`${activeEmployees} active employees on roster`}
              icon={<UserCheck className="h-5 w-5 text-amber-500" />}
              accent="border-t-amber-500"
            />
          </>
        ) : (
          <>
            <StatCard
              title="My Jobs This Week"
              value={weekJobsTotal}
              subtitle={`${todayJobs.length} today · ${employeeWeekRemaining} remaining`}
              icon={<CalendarDays className="h-5 w-5 text-blue-500" />}
              accent="border-t-blue-500"
            />
            <StatCard
              title="Hours This Week"
              value={Math.round((weeklyMinutes / 60) * 10) / 10}
              suffix="h"
              subtitle="From your clocked time entries"
              icon={<Timer className="h-5 w-5 text-amber-500" />}
              accent="border-t-amber-500"
            />
            <StatCard
              title="Next Job"
              value={nextAssignedJob ? fmtTime(nextAssignedJob.scheduled_at) : "None"}
              subtitle={
                nextAssignedJob
                  ? `${fmtShortDate(nextAssignedJob.scheduled_at)} · ${nextAssignedJob.site_name ?? nextAssignedJob.client_name}`
                  : "No upcoming assigned job"
              }
              icon={<MapPin className="h-5 w-5 text-violet-500" />}
              accent="border-t-violet-500"
            />
            <StatCard
              title="Pending Submissions"
              value={draftDocuments}
              subtitle="Draft reports, pre-starts, and SWMS"
              icon={<FileText className="h-5 w-5 text-emerald-500" />}
              accent="border-t-emerald-500"
            />
          </>
        )}
      </section>

      {/* ── Today's Focus + Crew Status ── */}
      <section className={`grid gap-5 ${role === "ADMIN" ? "xl:grid-cols-3" : ""}`}>

        {/* This Week's Schedule */}
        <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${role === "ADMIN" ? "xl:col-span-2" : ""}`}>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">This Week's Schedule</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {weekJobsTotal === 0
                  ? "No jobs scheduled this week"
                  : `${weekJobsTotal} job${weekJobsTotal !== 1 ? "s" : ""} across the week`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {role === "ADMIN" && (
                <button
                  onClick={() => setAddJobOpen(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              )}
              <Link
                to={role === "ADMIN" ? "/admin/schedule" : "/schedule"}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                Schedule <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {weekJobsTotal === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <CalendarDays className="h-10 w-10 text-slate-200" />
              <p className="text-sm font-medium text-slate-400">Clear week — no jobs scheduled</p>
              {role === "ADMIN" && (
                <button
                  onClick={() => setAddJobOpen(true)}
                  className="mt-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Book a job
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-y-auto max-h-130">
              {weekJobsByDay.map(day => {
                // Skip empty non-today days
                if (day.jobs.length === 0 && !day.isToday) return null;
                return (
                  <div key={day.key}>
                    {/* Day header */}
                    <div className={`flex items-center justify-between px-5 py-2 sticky top-0 z-10 ${
                      day.isToday
                        ? "bg-blue-600 text-white"
                        : "bg-slate-50 text-slate-500 border-b border-slate-100"
                    }`}>
                      <span className={`text-xs font-bold uppercase tracking-wide ${day.isToday ? "text-white" : "text-slate-500"}`}>
                        {day.label}{day.isToday && " · Today"}
                      </span>
                      {day.jobs.length > 0 && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          day.isToday ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                        }`}>
                          {day.jobs.length}
                        </span>
                      )}
                    </div>

                    {/* Jobs or empty-today state */}
                    {day.jobs.length === 0 ? (
                      <div className="px-5 py-3 text-xs text-slate-400 italic">No jobs today</div>
                    ) : (
                      day.jobs.map(job => (
                        <div
                          key={job.id}
                          className={`flex items-start border-l-4 ${STATUS_LEFT[job.status]} hover:bg-slate-50 transition-colors`}
                        >
                          {/* Time */}
                          <div className="w-16 shrink-0 px-3 py-3.5 text-right">
                            <p className="text-xs font-bold text-slate-600 tabular-nums">{fmtTime(job.scheduled_at)}</p>
                          </div>
                          {/* Dot */}
                          <div className="pt-4 pr-3 shrink-0">
                            <div className={`h-2 w-2 rounded-full ${STATUS_DOT[job.status]}`} />
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0 py-3 pr-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">{job.title}</p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                  <span className="flex items-center gap-1 text-xs text-slate-500">
                                    <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                    {job.site_name ?? job.client_name}
                                  </span>
                                  <span className="flex items-center gap-1 text-xs text-slate-500">
                                    <Users className="h-3 w-3 text-slate-400 shrink-0" />
                                    {job.assigned_to_name ?? "Unassigned"}
                                  </span>
                                  {job.job_type === "CONTRACT" && (
                                    <span className="flex items-center gap-1 text-xs text-violet-600 font-medium">
                                      <RefreshCw className="h-3 w-3" />
                                      {frequencyLabel(job.frequency_days)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className={`shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_BG[job.status]}`}>
                                {humanize(job.status)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alerts & Crew — admin only */}
        {role === "ADMIN" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">

            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                  Operations
                  {totalAlerts > 0 && (
                    <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                      {totalAlerts > 99 ? "99+" : totalAlerts}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {totalAlerts === 0 ? "All clear — nothing needs attention" : `${totalAlerts} item${totalAlerts !== 1 ? "s" : ""} need your attention`}
                </p>
              </div>
              <AlertCircle className={`h-4 w-4 ${totalAlerts > 0 ? "text-rose-400" : "text-slate-200"}`} />
            </div>

            {/* Alert rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">

              {/* All clear */}
              {totalAlerts === 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-300" />
                  <p className="text-sm text-slate-400">Nothing needs attention</p>
                </div>
              )}

              {/* Overdue Invoices */}
              {overdueInvoices.length > 0 && (
                <Link to="/admin/invoices" className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                  <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Overdue Invoices</p>
                    <p className="text-xs text-slate-400 truncate">
                      {overdueInvoices.slice(0, 2).map(i => i.client_name).filter(Boolean).join(", ")}
                      {overdueInvoices.length > 2 ? ` +${overdueInvoices.length - 2} more` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-rose-600">{overdueInvoices.length}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </Link>
              )}

              {/* Pending Receipts */}
              {pendingReceipts.length > 0 && (
                <Link to="/admin/receipts" className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                  <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                    <Receipt className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Receipts to Approve</p>
                    <p className="text-xs text-slate-400">Awaiting admin review</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-amber-600">{pendingReceipts.length}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </Link>
              )}

              {/* Out of Stock */}
              {outOfStock.length > 0 && (
                <Link to="/admin/inventory" className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                  <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4 text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Out of Stock</p>
                    <p className="text-xs text-slate-400 truncate">
                      {outOfStock.slice(0, 2).map(i => i.name).join(", ")}
                      {outOfStock.length > 2 ? ` +${outOfStock.length - 2} more` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-rose-600">{outOfStock.length}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </Link>
              )}

              {/* Pending Availability Requests */}
              {pendingAvailability.length > 0 && (
                <Link to="/admin/availability" className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                  <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                    <CalendarOff className="h-4 w-4 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Unavailability Submitted</p>
                    <p className="text-xs text-slate-400">New requests this week</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-violet-600">{pendingAvailability.length}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </Link>
              )}

              {/* Payroll Due */}
              {pendingPayroll.length > 0 && (
                <Link to="/admin/payroll" className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    <Banknote className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Payroll Overdue</p>
                    <p className="text-xs text-slate-400">Period ended, not yet paid</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-emerald-700">{pendingPayroll.length}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </Link>
              )}

              {/* ── Crew divider ── */}
              <div className="px-5 py-2.5 bg-slate-50 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="h-3 w-3" /> Crew Clocked In
                </span>
                <span className="text-[10px] text-slate-400">
                  {enrichedCrew.length === 0 ? "None" : enrichedCrew.length}
                </span>
              </div>

              {/* Crew members */}
              {enrichedCrew.length === 0 ? (
                <div className="px-5 py-3 text-xs text-slate-400 italic">Nobody clocked in yet</div>
              ) : (
                enrichedCrew.map(member => (
                  <div key={member.userId} className="px-5 py-3 flex items-center gap-3">
                    <CrewAvatar name={member.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold text-slate-900 truncate">{member.name}</p>
                        <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">{timeSince(member.clockIn)}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {member.jobTitle ?? "No job assigned today"}
                      </p>
                    </div>
                    {member.jobStatus && (
                      <div className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[member.jobStatus]}`} />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Needs Attention + Revenue ── */}
      <section className={`grid gap-5 ${role === "ADMIN" ? "xl:grid-cols-3" : ""}`}>

        {/* Needs Attention */}
        <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${role === "ADMIN" ? "xl:col-span-2" : ""}`}>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Needs Attention</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {attentionJobs.length === 0
                  ? "Everything is on track"
                  : `${attentionJobs.length} job${attentionJobs.length !== 1 ? "s" : ""} require action · ${attentionByClient.length} client${attentionByClient.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            {snapshot.overdueJobs > 0 && (
              <span className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                {snapshot.overdueJobs} overdue
              </span>
            )}
          </div>

          {attentionJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-300" />
              <p className="text-sm font-medium text-slate-500">All jobs on track</p>
              <p className="text-xs text-slate-300">No overdue or stalled jobs</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-105">
              {attentionByClient.map(([clientName, clientJobs]) => (
                <div key={clientName}>
                  {/* Client group header */}
                  <div className="flex items-center justify-between px-5 py-2 bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-700 truncate">{clientName}</span>
                      {clientJobs[0]?.site_name && (
                        <span className="text-xs text-slate-400 truncate hidden sm:inline">
                          · {clientJobs[0].site_name}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full shrink-0 ml-2">
                      {clientJobs.length} job{clientJobs.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Compact job rows */}
                  {clientJobs.map((job, idx) => {
                    const isOverdue = job.status === "OVERDUE";
                    const isLast    = idx === clientJobs.length - 1;
                    return (
                      <div
                        key={job.id}
                        className={`flex items-center gap-3 px-5 py-2.5 border-l-4 transition-colors hover:bg-slate-50 ${
                          isOverdue ? "border-l-rose-500" : "border-l-amber-400"
                        } ${!isLast ? "border-b border-slate-50" : ""}`}
                      >
                        {/* Date + time column */}
                        <div className="w-24 shrink-0 text-right">
                          <p className="text-[10px] font-semibold text-slate-500 tabular-nums">
                            {fmtShortDate(job.scheduled_at)}
                          </p>
                          <p className="text-[10px] text-slate-400 tabular-nums">
                            {fmtTime(job.scheduled_at)}
                          </p>
                        </div>

                        {/* Divider */}
                        <div className="w-px h-8 bg-slate-100 shrink-0" />

                        {/* Job info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">{job.title}</p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {job.assigned_to_name ?? "Unassigned"}
                          </p>
                        </div>

                        {/* Status + lateness */}
                        <div className="text-right shrink-0">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BG[job.status]}`}>
                            {humanize(job.status)}
                          </span>
                          <p className={`text-[10px] font-bold mt-0.5 tabular-nums ${isOverdue ? "text-rose-500" : "text-amber-600"}`}>
                            {howLate(job.scheduled_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revenue — admin only */}
        {role === "ADMIN" && (
          <div className="bg-linear-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-blue-100">Revenue This Month</p>
              <DollarSign className="h-4 w-4 text-blue-300" />
            </div>
            <p className="text-3xl font-extrabold tabular-nums mt-1">{formatMoney(monthRevenue)}</p>

            {revenuePct != null && (
              <div className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                revenuePct >= 0 ? "bg-white/20" : "bg-white/10"
              }`}>
                {revenuePct >= 0
                  ? <ArrowUpRight className="h-3.5 w-3.5" />
                  : <ArrowDownRight className="h-3.5 w-3.5" />}
                {Math.abs(revenuePct)}% vs last month ({formatMoney(lastMonthRevenue)})
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-white/20 space-y-2.5">
              {[
                { label: "Jobs completed",   value: String(monthCompletedCount) },
                { label: "Completion rate",  value: `${snapshot.completionRate}%` },
                { label: "Active clients",   value: String(activeClients) },
                { label: "Active employees", value: String(activeEmployees) },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-blue-200">{row.label}</span>
                  <span className="font-bold">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-blue-200 mb-1.5">
                <span>Completion</span>
                <span>{snapshot.completionRate}%</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(snapshot.completionRate, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Upcoming Contract Visits ── */}
      {role === "ADMIN" && upcomingContracts.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-violet-500" />
                Upcoming Contract Visits
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Next 30 days · {upcomingContracts.length} scheduled
              </p>
            </div>
            <Link
              to={role === "ADMIN" ? "/admin/schedule" : "/schedule"}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {upcomingContracts.map(job => (
              <div key={job.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                    <RefreshCw className="h-4 w-4 text-violet-500" />
                  </div>
                  {job.frequency_days != null && (
                    <span className="text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                      {frequencyLabel(job.frequency_days)}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-900 truncate">{job.client_name}</p>
                {job.site_name && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">{job.site_name}</p>
                )}
                <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                  <CalendarDays className="h-3 w-3 text-slate-400" />
                  {fmtShortDate(job.scheduled_at)}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 ml-4">{fmtTime(job.scheduled_at)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {role === "EMPLOYEE" && employeeUpcomingJobs.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">My Upcoming Jobs</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Your next {employeeUpcomingJobs.length} scheduled job{employeeUpcomingJobs.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Link
              to="/schedule"
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {employeeUpcomingJobs.map((job) => (
              <div key={job.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <CalendarDays className="h-4 w-4 text-blue-500" />
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BG[job.status]}`}>
                    {humanize(job.status)}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900 truncate">{job.title}</p>
                <p className="text-xs text-slate-500 truncate mt-0.5">{job.site_name ?? job.client_name}</p>
                <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                  <CalendarDays className="h-3 w-3 text-slate-400" />
                  {fmtShortDate(job.scheduled_at)}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 ml-4">{fmtTime(job.scheduled_at)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Booking Modal ── */}
      {role === "ADMIN" && (
        <BookingModal
          open={addJobOpen}
          onClose={() => setAddJobOpen(false)}
          onSaved={fetchJobs}
        />
      )}
    </div>
  );
}
