import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  CircleGauge,
  Clock3,
  FileText,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useJobs, type JobStatus } from "../../../hooks/Usejobs";

type Role = "ADMIN" | "EMPLOYEE";

type ReportItem = {
  id: string;
  title: string;
  createdAt: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
};

type ActivityItem = {
  id: string;
  message: string;
  createdAt: string;
};

const STATUS_CLASS: Record<JobStatus, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-100",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-100",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  OVERDUE: "bg-rose-50 text-rose-700 border-rose-100",
};

const REPORT_STATUS_CLASS: Record<ReportItem["status"], string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-sky-100 text-sky-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
};

export default function Dashboard() {
  const { jobs, loading: jobsLoading } = useJobs();
  const [role, setRole] = useState<Role>("EMPLOYEE");
  const [name, setName] = useState("Team Member");
  const [profileLoading, setProfileLoading] = useState(true);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activeClients, setActiveClients] = useState(0);
  const [activeEmployees, setActiveEmployees] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) { setProfileLoading(false); return; }

      const [profileRes, reportsRes, logsRes, clientsRes, employeesRes] = await Promise.all([
        supabase.from("profiles").select("full_name, role").eq("id", session.user.id).single<{ full_name: string | null; role: Role }>(),
        supabase.from("reports").select("id, title, status, created_at").order("created_at", { ascending: false }).limit(6),
        supabase.from("schedule_logs").select("id, message, created_at").order("created_at", { ascending: false }).limit(8),
        supabase.from("clients").select("id, status"),
        supabase.from("profiles").select("id, status").eq("role", "EMPLOYEE"),
      ]);

      if (profileRes.data) {
        setRole(profileRes.data.role);
        setName(profileRes.data.full_name?.trim() || session.user.email || "Team Member");
      }

      if (reportsRes.data) {
        setReports(reportsRes.data.map((r) => ({
          id: r.id,
          title: r.title,
          createdAt: r.created_at,
          status: normalizeReportStatus(r.status),
        })));
      }

      if (logsRes.data) {
        setActivity(logsRes.data.map((l) => ({
          id: l.id,
          message: l.message,
          createdAt: l.created_at,
        })));
      }

      if (clientsRes.data) {
        setActiveClients(clientsRes.data.filter((c: { status?: string }) => String(c.status ?? "").toUpperCase() === "ACTIVE").length);
      }
      if (employeesRes.data) {
        setActiveEmployees(employeesRes.data.filter((e: { status?: string }) => String(e.status ?? "").toUpperCase() === "ACTIVE").length);
      }

      setProfileLoading(false);
    };
    load();
  }, []);

  const snapshot = useMemo(() => {
    const now = Date.now();
    const completed = jobs.filter((j) => j.status === "COMPLETED").length;
    const overdue = jobs.filter((j) => j.status === "OVERDUE").length;
    const upcoming = jobs.filter((j) => {
      const t = new Date(j.scheduled_at).getTime();
      return t >= now && t <= now + 86400000;
    }).length;
    const weekAgo = now - 7 * 86400000;
    const reportsThisWeek = reports.filter((r) => new Date(r.createdAt).getTime() >= weekAgo).length;
    return {
      totalJobs: jobs.length,
      completedJobs: completed,
      overdueJobs: overdue,
      completionRate: jobs.length === 0 ? 0 : Math.round((completed / jobs.length) * 100),
      upcomingSchedules: upcoming,
      reportsThisWeek,
      activeClients,
      activeEmployees,
    };
  }, [jobs, reports, activeClients, activeEmployees]);

  const nextThreeJobs = useMemo(() => {
    return [...jobs]
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .slice(0, 3);
  }, [jobs]);

  const loading = profileLoading || jobsLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="animate-pulse space-y-5">
          <div className="h-10 w-64 rounded-lg bg-slate-200" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-xl bg-white border border-slate-200" />)}
          </div>
          <div className="h-72 rounded-xl bg-white border border-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 xl:p-8 space-y-6">
      {/* Hero */}
      <section className="rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 text-white p-6 md:p-8 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <p className="text-sm text-slate-300">Escalator Cleaning Operations</p>
            <h1 className="text-2xl md:text-3xl font-bold mt-1">Welcome back, {name}</h1>
            <p className="text-sm md:text-base text-slate-200 mt-2 max-w-2xl">
              {role === "ADMIN" ? "Admin" : "Employee"} dashboard — live job health, schedule visibility, and reporting.
            </p>
          </div>
          <div className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 backdrop-blur-sm min-w-56">
            <p className="text-xs uppercase tracking-wide text-slate-300">Today at a glance</p>
            <div className="mt-2 text-sm space-y-1.5">
              <p className="flex items-center justify-between gap-3"><span>Jobs today</span><strong>{snapshot.upcomingSchedules}</strong></p>
              <p className="flex items-center justify-between gap-3"><span>Completion rate</span><strong>{snapshot.completionRate}%</strong></p>
              <p className="flex items-center justify-between gap-3">
                <span>Overdue</span>
                <strong className={snapshot.overdueJobs > 0 ? "text-rose-300" : "text-emerald-300"}>{snapshot.overdueJobs}</strong>
              </p>
            </div>
          </div>
        </div>
        {jobs.length === 0 && !jobsLoading && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-amber-500/20 border border-amber-300/30 px-3 py-2 text-xs text-amber-100">
            <AlertCircle className="h-4 w-4" />
            No jobs yet — use the Schedule page to add your first job.
          </div>
        )}
      </section>

      {/* Stat cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Jobs" value={snapshot.totalJobs} subtitle="Across all schedules" icon={<Briefcase className="h-5 w-5" />} />
        <StatCard title="Completed" value={snapshot.completedJobs} subtitle="Finished and logged" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard title="Reports This Week" value={snapshot.reportsThisWeek} subtitle="Submitted reports" icon={<FileText className="h-5 w-5" />} />
        <StatCard
          title={role === "ADMIN" ? "Active Employees" : "Active Clients"}
          value={role === "ADMIN" ? snapshot.activeEmployees : snapshot.activeClients}
          subtitle={role === "ADMIN" ? "Approved & available" : "Currently serviced"}
          icon={role === "ADMIN" ? <Users className="h-5 w-5" /> : <CircleGauge className="h-5 w-5" />}
        />
      </section>

      {/* Schedule log + Job health */}
      <section className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Next Jobs</h2>
            <span className="text-xs text-slate-500">Sorted by date</span>
          </div>
          <div className="divide-y divide-slate-100">
            {nextThreeJobs.length === 0 && <p className="px-5 py-8 text-sm text-slate-500">No jobs scheduled yet.</p>}
            {nextThreeJobs.map((job) => (
              <div key={job.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{job.title}</p>
                  <p className="text-sm text-slate-500">{job.client_name}</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`px-2.5 py-1 rounded-full border ${STATUS_CLASS[job.status]}`}>{humanize(job.status)}</span>
                  <span className="text-slate-600">{formatDateTime(job.scheduled_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-slate-900">Job Health</h2>
          <p className="text-xs text-slate-500 mt-0.5">Distribution by status</p>
          <div className="mt-5 space-y-4">
            {buildStatusRows(jobs).map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-slate-600">{row.label}</span>
                  <span className="font-medium text-slate-900">{row.value}</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`${row.color} h-2.5 rounded-full transition-all`} style={{ width: `${row.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reports + Activity */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Reports</h2>
            <FileText className="h-4 w-4 text-slate-500" />
          </div>
          <div className="divide-y divide-slate-100">
            {reports.length === 0 && <p className="px-5 py-8 text-sm text-slate-500">No reports yet.</p>}
            {reports.slice(0, 5).map((r) => (
              <div key={r.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{r.title}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${REPORT_STATUS_CLASS[r.status]}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Operations Activity</h2>
            <Clock3 className="h-4 w-4 text-slate-500" />
          </div>
          <div className="divide-y divide-slate-100">
            {activity.length === 0 && <p className="px-5 py-8 text-sm text-slate-500">No activity logged yet.</p>}
            {activity.slice(0, 5).map((item) => (
              <div key={item.id} className="px-5 py-3.5">
                <p className="text-sm text-slate-800">{item.message}</p>
                <p className="text-xs text-slate-500 mt-1">{formatDateTime(item.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickAction icon={<CalendarDays className="h-4 w-4" />} title="Manage Schedule" desc="Review routes and assign crews" />
        <QuickAction icon={<FileText className="h-4 w-4" />} title="Submit Report" desc="Upload completion and incident notes" />
        <QuickAction icon={<TrendingUp className="h-4 w-4" />} title="Performance" desc="Track monthly completion trends" />
        <QuickAction icon={<Briefcase className="h-4 w-4" />} title="Job Board" desc="Monitor open and overdue work" />
      </section>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon }: { title: string; value: number; subtitle: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        </div>
        <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">{icon}</div>
      </div>
    </div>
  );
}

function QuickAction({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-3">{icon}</div>
      <p className="font-medium text-slate-900">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{desc}</p>
    </div>
  );
}

function buildStatusRows(jobs: { status: JobStatus }[]) {
  const total = Math.max(jobs.length, 1);
  const c = {
    scheduled: jobs.filter((j) => j.status === "SCHEDULED").length,
    inProgress: jobs.filter((j) => j.status === "IN_PROGRESS").length,
    completed: jobs.filter((j) => j.status === "COMPLETED").length,
    overdue: jobs.filter((j) => j.status === "OVERDUE").length,
  };
  return [
    { label: "Scheduled", value: c.scheduled, percentage: Math.round((c.scheduled / total) * 100), color: "bg-blue-500" },
    { label: "In Progress", value: c.inProgress, percentage: Math.round((c.inProgress / total) * 100), color: "bg-amber-500" },
    { label: "Completed", value: c.completed, percentage: Math.round((c.completed / total) * 100), color: "bg-emerald-500" },
    { label: "Overdue", value: c.overdue, percentage: Math.round((c.overdue / total) * 100), color: "bg-rose-500" },
  ];
}

function normalizeReportStatus(value: string | null): ReportItem["status"] {
  const v = String(value ?? "").toUpperCase();
  if (v.includes("APPROV")) return "APPROVED";
  if (v.includes("SUBMIT")) return "SUBMITTED";
  return "DRAFT";
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

function humanize(value: string) {
  return value.toLowerCase().split("_").map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
}
