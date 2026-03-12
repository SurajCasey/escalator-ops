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

type Role = "ADMIN" | "EMPLOYEE";
type JobStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";

type JobItem = {
  id: string;
  title: string;
  client: string;
  status: JobStatus;
  scheduledAt: string | null;
  assignedTo: string | null;
};

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

type Snapshot = {
  totalJobs: number;
  completedJobs: number;
  overdueJobs: number;
  completionRate: number;
  upcomingSchedules: number;
  reportsThisWeek: number;
  activeClients: number;
  activeEmployees: number;
};

type DashboardData = {
  role: Role;
  name: string;
  jobs: JobItem[];
  reports: ReportItem[];
  activity: ActivityItem[];
  snapshot: Snapshot;
  usedDemoData: boolean;
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

const DEMO_JOBS: JobItem[] = [
  {
    id: "demo-1",
    title: "Westfield CBD - Morning Escalator Clean",
    client: "Westfield Sydney",
    status: "SCHEDULED",
    scheduledAt: futureDate(0, 9, 0),
    assignedTo: "A. Patel",
  },
  {
    id: "demo-2",
    title: "Town Hall Station - Deep Clean",
    client: "Sydney Trains",
    status: "IN_PROGRESS",
    scheduledAt: futureDate(0, 11, 30),
    assignedTo: "S. Brown",
  },
  {
    id: "demo-3",
    title: "Parramatta Mall - End of Day Pass",
    client: "Parramatta Council",
    status: "OVERDUE",
    scheduledAt: futureDate(-1, 18, 0),
    assignedTo: "J. Nguyen",
  },
  {
    id: "demo-4",
    title: "Airport T2 - Weekly Sanitization",
    client: "Sydney Airport",
    status: "COMPLETED",
    scheduledAt: futureDate(-1, 7, 30),
    assignedTo: "R. Singh",
  },
  {
    id: "demo-5",
    title: "Chatswood Interchange - Handrail Polish",
    client: "Transport NSW",
    status: "SCHEDULED",
    scheduledAt: futureDate(1, 6, 45),
    assignedTo: "D. Lee",
  },
];

const DEMO_REPORTS: ReportItem[] = [
  { id: "r1", title: "Daily Completion Summary", createdAt: futureDate(0, 16, 40), status: "SUBMITTED" },
  { id: "r2", title: "Incident Follow-up Report", createdAt: futureDate(-1, 17, 15), status: "APPROVED" },
  { id: "r3", title: "Material Consumption Snapshot", createdAt: futureDate(-2, 15, 5), status: "DRAFT" },
];

const DEMO_ACTIVITY: ActivityItem[] = [
  { id: "a1", message: "Job assigned: Westfield CBD - Morning Escalator Clean", createdAt: futureDate(0, 8, 35) },
  { id: "a2", message: "Schedule updated: Town Hall Station moved to 11:30 AM", createdAt: futureDate(0, 7, 50) },
  { id: "a3", message: "Report approved: Incident Follow-up Report", createdAt: futureDate(-1, 19, 5) },
  { id: "a4", message: "Client note added: Sydney Airport access code updated", createdAt: futureDate(-1, 13, 10) },
];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        setError("Session expired. Please log in again.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", session.user.id)
        .single<{ full_name: string | null; role: Role }>();

      if (profileError || !profile) {
        setError("Unable to load your profile.");
        setLoading(false);
        return;
      }

      const role = profile.role;
      const displayName = profile.full_name?.trim() || session.user.email || "Team Member";

      const [jobsResult, reportsResult, logsResult, clientsResult, employeesResult] = await Promise.all([
        supabase.from("jobs").select("*").limit(250),
        supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(6),
        supabase.from("schedule_logs").select("*").order("created_at", { ascending: false }).limit(8),
        supabase.from("clients").select("id, status"),
        supabase.from("profiles").select("id, status, role").eq("role", "EMPLOYEE"),
      ]);

      const jobsRows = jobsResult.error ? [] : (jobsResult.data ?? []);
      const reportsRows = reportsResult.error ? [] : (reportsResult.data ?? []);
      const logsRows = logsResult.error ? [] : (logsResult.data ?? []);
      const clientsRows = clientsResult.error ? [] : (clientsResult.data ?? []);
      const employeesRows = employeesResult.error ? [] : (employeesResult.data ?? []);

      const parsedJobs = parseJobs(jobsRows);
      const parsedReports = parseReports(reportsRows);
      const parsedLogs = parseLogs(logsRows);

      const usedDemoData =
        jobsResult.error !== null ||
        reportsResult.error !== null ||
        logsResult.error !== null ||
        parsedJobs.length === 0;

      const jobs = usedDemoData ? DEMO_JOBS : parsedJobs;
      const reports = usedDemoData ? DEMO_REPORTS : parsedReports;
      const activity = usedDemoData ? DEMO_ACTIVITY : parsedLogs;

      const snapshot = buildSnapshot(jobs, reports, clientsRows, employeesRows);

      setData({
        role,
        name: displayName,
        jobs,
        reports,
        activity,
        snapshot,
        usedDemoData,
      });
      setLoading(false);
    };

    load();
  }, []);

  const nextThreeJobs = useMemo(() => {
    if (!data) return [];
    return [...data.jobs]
      .filter((job) => job.scheduledAt !== null)
      .sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime())
      .slice(0, 3);
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="animate-pulse space-y-5">
          <div className="h-10 w-64 rounded-lg bg-slate-200" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-28 rounded-xl bg-white border border-slate-200" />
            ))}
          </div>
          <div className="h-72 rounded-xl bg-white border border-slate-200" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-100 p-8 flex items-center justify-center">
        <div className="bg-white border border-rose-200 text-rose-700 rounded-xl px-6 py-5 max-w-lg w-full">
          <p className="font-semibold">Unable to load dashboard</p>
          <p className="text-sm mt-1">{error ?? "Unknown error"}</p>
        </div>
      </div>
    );
  }

  const greetingRole = data.role === "ADMIN" ? "Admin" : "Employee";

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 xl:p-8 space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white p-6 md:p-8 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <p className="text-sm text-slate-300">Escalator Cleaning Operations</p>
            <h1 className="text-2xl md:text-3xl font-bold mt-1">Welcome back, {data.name}</h1>
            <p className="text-sm md:text-base text-slate-200 mt-2 max-w-2xl">
              {greetingRole} dashboard with live job health, schedule visibility, and reporting progress.
            </p>
          </div>
          <div className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 backdrop-blur-sm min-w-56">
            <p className="text-xs uppercase tracking-wide text-slate-300">Today at a glance</p>
            <div className="mt-2 text-sm space-y-1.5">
              <p className="flex items-center justify-between gap-3">
                <span>Jobs scheduled</span>
                <strong>{data.snapshot.upcomingSchedules}</strong>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span>Completion rate</span>
                <strong>{data.snapshot.completionRate}%</strong>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span>Overdue jobs</span>
                <strong className={data.snapshot.overdueJobs > 0 ? "text-rose-300" : "text-emerald-300"}>
                  {data.snapshot.overdueJobs}
                </strong>
              </p>
            </div>
          </div>
        </div>
        {data.usedDemoData && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-amber-500/20 border border-amber-300/30 px-3 py-2 text-xs text-amber-100">
            <AlertCircle className="h-4 w-4" />
            Using sample job/schedule/report data. Add `jobs`, `reports`, and `schedule_logs` tables for live metrics.
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Jobs"
          value={data.snapshot.totalJobs}
          subtitle="Across all active schedules"
          icon={<Briefcase className="h-5 w-5" />}
        />
        <StatCard
          title="Completed"
          value={data.snapshot.completedJobs}
          subtitle="Finished and logged"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          title="Reports This Week"
          value={data.snapshot.reportsThisWeek}
          subtitle="Submitted inspection reports"
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          title={data.role === "ADMIN" ? "Active Employees" : "Active Clients"}
          value={data.role === "ADMIN" ? data.snapshot.activeEmployees : data.snapshot.activeClients}
          subtitle={data.role === "ADMIN" ? "Approved and available" : "Currently serviced"}
          icon={data.role === "ADMIN" ? <Users className="h-5 w-5" /> : <CircleGauge className="h-5 w-5" />}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Schedule Log</h2>
            <span className="text-xs text-slate-500">Next jobs in queue</span>
          </div>
          <div className="divide-y divide-slate-100">
            {nextThreeJobs.length === 0 && (
              <p className="px-5 py-8 text-sm text-slate-500">No upcoming schedule found.</p>
            )}
            {nextThreeJobs.map((job) => (
              <div key={job.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{job.title}</p>
                  <p className="text-sm text-slate-500">{job.client}</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`px-2.5 py-1 rounded-full border ${STATUS_CLASS[job.status]}`}>{humanize(job.status)}</span>
                  <span className="text-slate-600">{formatDateTime(job.scheduledAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-slate-900">Job Health</h2>
          <p className="text-xs text-slate-500 mt-0.5">Live distribution by status</p>
          <div className="mt-5 space-y-4">
            {buildStatusRows(data.jobs).map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-slate-600">{row.label}</span>
                  <span className="font-medium text-slate-900">{row.value}</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`${row.color} h-2.5 rounded-full`} style={{ width: `${row.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Reports</h2>
            <FileText className="h-4 w-4 text-slate-500" />
          </div>
          <div className="divide-y divide-slate-100">
            {data.reports.slice(0, 5).map((report) => (
              <div key={report.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{report.title}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(report.createdAt)}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${REPORT_STATUS_CLASS[report.status]}`}>
                  {report.status}
                </span>
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
            {data.activity.slice(0, 5).map((item) => (
              <div key={item.id} className="px-5 py-3.5">
                <p className="text-sm text-slate-800">{item.message}</p>
                <p className="text-xs text-slate-500 mt-1">{formatDateTime(item.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickAction icon={<CalendarDays className="h-4 w-4" />} title="Manage Schedule" desc="Review routes and assign crews" />
        <QuickAction icon={<FileText className="h-4 w-4" />} title="Submit Report" desc="Upload completion and incident notes" />
        <QuickAction icon={<TrendingUp className="h-4 w-4" />} title="Performance" desc="Track monthly completion trends" />
        <QuickAction icon={<Briefcase className="h-4 w-4" />} title="Job Board" desc="Monitor open and overdue work" />
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
}) {
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

function buildSnapshot(jobs: JobItem[], reports: ReportItem[], clientsRows: Array<{ status?: string }>, employeesRows: Array<{ status?: string }>): Snapshot {
  const now = new Date();
  const startWeek = new Date(now);
  startWeek.setDate(now.getDate() - 7);

  const completedJobs = jobs.filter((job) => job.status === "COMPLETED").length;
  const overdueJobs = jobs.filter((job) => job.status === "OVERDUE").length;
  const upcomingSchedules = jobs.filter((job) => {
    if (!job.scheduledAt) return false;
    const t = new Date(job.scheduledAt).getTime();
    return t >= now.getTime() && t <= now.getTime() + 24 * 60 * 60 * 1000;
  }).length;

  const reportsThisWeek = reports.filter((report) => new Date(report.createdAt) >= startWeek).length;
  const activeClients = clientsRows.filter((row) => String(row.status ?? "").toUpperCase() === "ACTIVE").length;
  const activeEmployees = employeesRows.filter((row) => String(row.status ?? "").toUpperCase() === "ACTIVE").length;

  return {
    totalJobs: jobs.length,
    completedJobs,
    overdueJobs,
    completionRate: jobs.length === 0 ? 0 : Math.round((completedJobs / jobs.length) * 100),
    upcomingSchedules,
    reportsThisWeek,
    activeClients,
    activeEmployees,
  };
}

function parseJobs(rows: Record<string, unknown>[]): JobItem[] {
  return rows
    .map((row, index) => {
      const status = normalizeJobStatus(getFirstString(row, ["status", "job_status", "state"]));
      const scheduledAt = getFirstString(row, ["scheduled_at", "scheduled_date", "start_time", "date"]);
      const client = getFirstString(row, ["client_name", "site_name", "location", "client"]) ?? "Unknown Site";
      const title = getFirstString(row, ["title", "job_name", "name"]) ?? `Job #${index + 1}`;
      const assignedTo = getFirstString(row, ["assigned_to_name", "assigned_to", "technician"]);
      const id = getFirstString(row, ["id"]) ?? `job-${index + 1}`;

      return {
        id,
        title,
        client,
        status,
        scheduledAt,
        assignedTo,
      };
    })
    .filter((job) => job.title.length > 0);
}

function parseReports(rows: Record<string, unknown>[]): ReportItem[] {
  return rows.map((row, index) => {
    const createdAt =
      getFirstString(row, ["created_at", "submitted_at", "date"]) ?? new Date().toISOString();
    const status = normalizeReportStatus(getFirstString(row, ["status", "report_status", "state"]));

    return {
      id: getFirstString(row, ["id"]) ?? `report-${index + 1}`,
      title: getFirstString(row, ["title", "name", "report_name"]) ?? `Report ${index + 1}`,
      createdAt,
      status,
    };
  });
}

function parseLogs(rows: Record<string, unknown>[]): ActivityItem[] {
  return rows.map((row, index) => {
    const createdAt = getFirstString(row, ["created_at", "timestamp", "date"]) ?? new Date().toISOString();

    return {
      id: getFirstString(row, ["id"]) ?? `log-${index + 1}`,
      message: getFirstString(row, ["message", "description", "action"]) ?? "Activity recorded",
      createdAt,
    };
  });
}

function buildStatusRows(jobs: JobItem[]) {
  const total = Math.max(jobs.length, 1);
  const count = {
    scheduled: jobs.filter((j) => j.status === "SCHEDULED").length,
    inProgress: jobs.filter((j) => j.status === "IN_PROGRESS").length,
    completed: jobs.filter((j) => j.status === "COMPLETED").length,
    overdue: jobs.filter((j) => j.status === "OVERDUE").length,
  };

  return [
    { label: "Scheduled", value: count.scheduled, percentage: Math.round((count.scheduled / total) * 100), color: "bg-blue-500" },
    { label: "In Progress", value: count.inProgress, percentage: Math.round((count.inProgress / total) * 100), color: "bg-amber-500" },
    { label: "Completed", value: count.completed, percentage: Math.round((count.completed / total) * 100), color: "bg-emerald-500" },
    { label: "Overdue", value: count.overdue, percentage: Math.round((count.overdue / total) * 100), color: "bg-rose-500" },
  ];
}

function normalizeJobStatus(value: string | null): JobStatus {
  const v = String(value ?? "").toUpperCase();
  if (v.includes("COMP")) return "COMPLETED";
  if (v.includes("PROGRESS") || v.includes("START")) return "IN_PROGRESS";
  if (v.includes("OVERDUE") || v.includes("LATE")) return "OVERDUE";
  return "SCHEDULED";
}

function normalizeReportStatus(value: string | null): ReportItem["status"] {
  const v = String(value ?? "").toUpperCase();
  if (v.includes("APPROV")) return "APPROVED";
  if (v.includes("SUBMIT")) return "SUBMITTED";
  return "DRAFT";
}

function getFirstString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
}

function formatDateTime(value: string | null) {
  if (!value) return "TBD";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function futureDate(dayOffset: number, hour: number, minute: number) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
