import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Filter, Search, Users } from "lucide-react";
import { supabase } from "../../../lib/supabase";

type JobStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";
type ShiftName = "Morning" | "Midday" | "Night";

type ScheduleRow = {
  id: string;
  title: string;
  site: string;
  assignedTo: string;
  scheduledAt: string;
  status: JobStatus;
  shift: ShiftName;
};

const STATUS_STYLES: Record<JobStatus, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-100",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-100",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  OVERDUE: "bg-rose-50 text-rose-700 border-rose-100",
};

const DEMO_ROWS: ScheduleRow[] = [
  buildDemoRow("demo-1", "Westfield CBD - Morning Escalator Clean", "Westfield Sydney", "A. Patel", 0, 9, 0, "SCHEDULED"),
  buildDemoRow("demo-2", "Town Hall Station - Deep Clean", "Sydney Trains", "S. Brown", 0, 11, 30, "IN_PROGRESS"),
  buildDemoRow("demo-3", "Macquarie Centre - Handrail Polish", "Macquarie Centre", "J. Nguyen", 0, 14, 15, "SCHEDULED"),
  buildDemoRow("demo-4", "Airport T2 - Weekly Sanitization", "Sydney Airport", "R. Singh", 1, 7, 30, "SCHEDULED"),
  buildDemoRow("demo-5", "Parramatta Mall - End of Day Pass", "Parramatta Council", "D. Lee", 1, 18, 0, "OVERDUE"),
  buildDemoRow("demo-6", "Chatswood Interchange - Safety Sweep", "Transport NSW", "K. Taylor", 2, 6, 45, "COMPLETED"),
];

export default function Schedule() {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usedDemoData, setUsedDemoData] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | JobStatus>("ALL");
  const [shiftFilter, setShiftFilter] = useState<"ALL" | ShiftName>("ALL");

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("scheduled_at", { ascending: true })
        .limit(250);

      const parsedRows = error ? [] : parseJobs(data ?? []);
      const nextRows = parsedRows.length > 0 ? parsedRows : DEMO_ROWS;

      setRows(nextRows);
      setUsedDemoData(parsedRows.length === 0);
      setLoading(false);
    };

    load();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q.length === 0 ||
        row.title.toLowerCase().includes(q) ||
        row.site.toLowerCase().includes(q) ||
        row.assignedTo.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || row.status === statusFilter;
      const matchesShift = shiftFilter === "ALL" || row.shift === shiftFilter;
      return matchesSearch && matchesStatus && matchesShift;
    });
  }, [rows, search, statusFilter, shiftFilter]);

  const stats = useMemo(() => {
    const scheduled = rows.filter((row) => row.status === "SCHEDULED").length;
    const active = rows.filter((row) => row.status === "IN_PROGRESS").length;
    const upcoming = rows.filter((row) => new Date(row.scheduledAt).getTime() >= Date.now()).length;
    const teams = new Set(rows.map((row) => row.assignedTo)).size;

    return { scheduled, active, upcoming, teams };
  }, [rows]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 xl:p-8 space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-900 text-white p-6 md:p-8 shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-slate-300">Operations Planning</p>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold">Schedule Table</h1>
            <p className="mt-2 max-w-2xl text-sm md:text-base text-slate-200">
              Review escalator cleaning jobs, assigned crews, and shift timing in one place.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={<CalendarDays className="h-4 w-4" />} label="Scheduled" value={stats.scheduled} />
            <StatCard icon={<Clock3 className="h-4 w-4" />} label="Live Jobs" value={stats.active} />
            <StatCard icon={<Filter className="h-4 w-4" />} label="Upcoming" value={stats.upcoming} />
            <StatCard icon={<Users className="h-4 w-4" />} label="Crews" value={stats.teams} />
          </div>
        </div>
        {usedDemoData && (
          <div className="mt-5 inline-flex rounded-lg border border-amber-300/30 bg-amber-500/20 px-3 py-2 text-xs text-amber-100">
            Using sample schedule rows until the `jobs` table returns live data.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Schedule Overview</h2>
              <p className="text-sm text-slate-500">Completed table with search and shift/status filters.</p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search jobs, sites, or crew"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-cyan-500 md:w-72"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "ALL" | JobStatus)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="OVERDUE">Overdue</option>
              </select>
              <select
                value={shiftFilter}
                onChange={(event) => setShiftFilter(event.target.value as "ALL" | ShiftName)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Shifts</option>
                <option value="Morning">Morning</option>
                <option value="Midday">Midday</option>
                <option value="Night">Night</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Job</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Site</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned Crew</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Shift</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                    Loading schedule...
                  </td>
                </tr>
              )}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                    No schedule rows match the current filters.
                  </td>
                </tr>
              )}
              {!loading &&
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-medium text-slate-900">{row.title}</p>
                        <p className="text-xs text-slate-500">#{row.id}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">{row.site}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{row.assignedTo}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{formatDateTime(row.scheduledAt)}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{row.shift}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[row.status]}`}>
                        {humanize(row.status)}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-slate-200">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function parseJobs(rows: Record<string, unknown>[]): ScheduleRow[] {
  return rows
    .map((row, index) => {
      const scheduledAt =
        getFirstString(row, ["scheduled_at", "scheduled_date", "start_time", "date"]) ?? buildIsoDate(index, 8, 0);
      const status = normalizeJobStatus(getFirstString(row, ["status", "job_status", "state"]));
      const assignedTo = getFirstString(row, ["assigned_to_name", "assigned_to", "technician"]) ?? "Unassigned";
      const title = getFirstString(row, ["title", "job_name", "name"]) ?? `Job ${index + 1}`;
      const site = getFirstString(row, ["client_name", "site_name", "location", "client"]) ?? "Unknown Site";
      const id = getFirstString(row, ["id"]) ?? `job-${index + 1}`;

      return {
        id,
        title,
        site,
        assignedTo,
        scheduledAt,
        status,
        shift: getShiftName(scheduledAt),
      };
    })
    .filter((row) => row.title.trim().length > 0);
}

function buildDemoRow(
  id: string,
  title: string,
  site: string,
  assignedTo: string,
  dayOffset: number,
  hour: number,
  minute: number,
  status: JobStatus,
): ScheduleRow {
  const scheduledAt = buildIsoDate(dayOffset, hour, minute);
  return {
    id,
    title,
    site,
    assignedTo,
    scheduledAt,
    status,
    shift: getShiftName(scheduledAt),
  };
}

function normalizeJobStatus(value: string | null): JobStatus {
  const normal = String(value ?? "").toUpperCase();
  if (normal.includes("COMP")) return "COMPLETED";
  if (normal.includes("PROGRESS") || normal.includes("START")) return "IN_PROGRESS";
  if (normal.includes("OVERDUE") || normal.includes("LATE")) return "OVERDUE";
  return "SCHEDULED";
}

function getFirstString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function buildIsoDate(dayOffset: number, hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function getShiftName(value: string): ShiftName {
  const hour = new Date(value).getHours();
  if (hour < 11) return "Morning";
  if (hour < 17) return "Midday";
  return "Night";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
