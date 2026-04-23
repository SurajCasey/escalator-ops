import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Users } from "lucide-react";
import { supabase } from "../../../lib/supabase";

type JobStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";

type CalendarJob = {
  id: string;
  title: string;
  site: string;
  assignedTo: string;
  scheduledAt: string;
  status: JobStatus;
};

type CalendarDay = {
  key: string;
  date: Date;
  isCurrentMonth: boolean;
  jobs: CalendarJob[];
};

const STATUS_STYLES: Record<JobStatus, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  OVERDUE: "bg-rose-100 text-rose-800",
};

const DEMO_JOBS: CalendarJob[] = [
  buildDemoJob("demo-1", "Westfield CBD - Morning Escalator Clean", "Westfield Sydney", "A. Patel", 0, 9, 0, "SCHEDULED"),
  buildDemoJob("demo-2", "Town Hall Station - Deep Clean", "Sydney Trains", "S. Brown", 0, 11, 30, "IN_PROGRESS"),
  buildDemoJob("demo-3", "Macquarie Centre - Handrail Polish", "Macquarie Centre", "J. Nguyen", 1, 14, 15, "SCHEDULED"),
  buildDemoJob("demo-4", "Airport T2 - Weekly Sanitization", "Sydney Airport", "R. Singh", 3, 7, 30, "SCHEDULED"),
  buildDemoJob("demo-5", "Parramatta Mall - End of Day Pass", "Parramatta Council", "D. Lee", 5, 18, 0, "OVERDUE"),
  buildDemoJob("demo-6", "Chatswood Interchange - Safety Sweep", "Transport NSW", "K. Taylor", 8, 6, 45, "COMPLETED"),
];

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Calendar() {
  const [jobs, setJobs] = useState<CalendarJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [usedDemoData, setUsedDemoData] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));
  const [monthCursor, setMonthCursor] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("scheduled_at", { ascending: true })
        .limit(250);

      const parsedJobs = error ? [] : parseJobs(data ?? []);
      const nextJobs = parsedJobs.length > 0 ? parsedJobs : DEMO_JOBS;

      setJobs(nextJobs);
      setUsedDemoData(parsedJobs.length === 0);
      setLoading(false);
    };

    load();
  }, []);

  const calendarDays = useMemo(() => buildCalendarDays(monthCursor, jobs), [monthCursor, jobs]);

  const selectedDay = useMemo(() => {
    return calendarDays.find((day) => day.key === selectedDateKey) ?? calendarDays.find((day) => day.jobs.length > 0) ?? calendarDays[0];
  }, [calendarDays, selectedDateKey]);

  const monthStats = useMemo(() => {
    const month = monthCursor.getMonth();
    const year = monthCursor.getFullYear();
    const jobsThisMonth = jobs.filter((job) => {
      const date = new Date(job.scheduledAt);
      return date.getMonth() === month && date.getFullYear() === year;
    });

    return {
      total: jobsThisMonth.length,
      active: jobsThisMonth.filter((job) => job.status === "IN_PROGRESS").length,
      sites: new Set(jobsThisMonth.map((job) => job.site)).size,
      crews: new Set(jobsThisMonth.map((job) => job.assignedTo)).size,
    };
  }, [jobs, monthCursor]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 xl:p-8 space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-900 p-6 text-white shadow-lg md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-slate-300">Operations Planning</p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Calendar View</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200 md:text-base">
              Track scheduled escalator jobs by day and inspect the selected day’s run sheet.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={<CalendarDays className="h-4 w-4" />} label="Month Jobs" value={monthStats.total} />
            <StatCard icon={<Clock3 className="h-4 w-4" />} label="Live Jobs" value={monthStats.active} />
            <StatCard icon={<MapPin className="h-4 w-4" />} label="Sites" value={monthStats.sites} />
            <StatCard icon={<Users className="h-4 w-4" />} label="Crews" value={monthStats.crews} />
          </div>
        </div>
        {usedDemoData && (
          <div className="mt-5 inline-flex rounded-lg border border-amber-300/30 bg-amber-500/20 px-3 py-2 text-xs text-amber-100">
            Using sample calendar jobs until the `jobs` table returns live data.
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                {new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(monthCursor)}
              </h2>
              <p className="text-sm text-slate-500">Select a day to inspect assigned jobs.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
                  setSelectedDateKey(toDateKey(now));
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Today
              </button>
              <button
                onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {WEEK_DAYS.map((day) => (
              <div key={day} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const isSelected = day.key === selectedDay?.key;
              const isToday = day.key === toDateKey(new Date());

              return (
                <button
                  key={day.key}
                  onClick={() => setSelectedDateKey(day.key)}
                  className={`min-h-32 border-b border-r border-slate-100 p-3 text-left transition ${
                    day.isCurrentMonth ? "bg-white hover:bg-slate-50" : "bg-slate-50/70 text-slate-400 hover:bg-slate-100"
                  } ${isSelected ? "ring-2 ring-inset ring-cyan-500" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                        isToday ? "bg-cyan-600 text-white" : "text-slate-700"
                      }`}
                    >
                      {day.date.getDate()}
                    </span>
                    {day.jobs.length > 0 && <span className="text-xs font-medium text-slate-500">{day.jobs.length} jobs</span>}
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {day.jobs.slice(0, 2).map((job) => (
                      <div key={job.id} className={`truncate rounded-md px-2 py-1 text-xs font-medium ${STATUS_STYLES[job.status]}`}>
                        {formatTime(job.scheduledAt)} {job.site}
                      </div>
                    ))}
                    {day.jobs.length > 2 && <p className="text-xs text-slate-500">+{day.jobs.length - 2} more</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">{selectedDay ? formatLongDate(selectedDay.date) : "Selected Day"}</h2>
            <p className="text-sm text-slate-500">
              {selectedDay?.jobs.length ?? 0} scheduled {selectedDay?.jobs.length === 1 ? "job" : "jobs"} for this day.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {loading && <p className="px-5 py-8 text-sm text-slate-500">Loading calendar...</p>}
            {!loading && selectedDay && selectedDay.jobs.length === 0 && (
              <p className="px-5 py-8 text-sm text-slate-500">No jobs scheduled for the selected day.</p>
            )}
            {!loading &&
              selectedDay?.jobs.map((job) => (
                <div key={job.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{job.title}</p>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                        <MapPin className="h-3.5 w-3.5" />
                        {job.site}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[job.status]}`}>
                      {humanize(job.status)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <p className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-slate-400" />
                      {formatTime(job.scheduledAt)}
                    </p>
                    <p className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-slate-400" />
                      {job.assignedTo}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </aside>
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

function parseJobs(rows: Record<string, unknown>[]): CalendarJob[] {
  return rows
    .map((row, index) => {
      const scheduledAt =
        getFirstString(row, ["scheduled_at", "scheduled_date", "start_time", "date"]) ?? buildIsoDate(index, 8, 0);

      return {
        id: getFirstString(row, ["id"]) ?? `job-${index + 1}`,
        title: getFirstString(row, ["title", "job_name", "name"]) ?? `Job ${index + 1}`,
        site: getFirstString(row, ["client_name", "site_name", "location", "client"]) ?? "Unknown Site",
        assignedTo: getFirstString(row, ["assigned_to_name", "assigned_to", "technician"]) ?? "Unassigned",
        scheduledAt,
        status: normalizeJobStatus(getFirstString(row, ["status", "job_status", "state"])),
      };
    })
    .filter((job) => job.title.trim().length > 0);
}

function buildCalendarDays(monthCursor: Date, jobs: CalendarJob[]) {
  const start = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  start.setDate(start.getDate() - start.getDay());

  const jobMap = new Map<string, CalendarJob[]>();
  for (const job of jobs) {
    const key = toDateKey(new Date(job.scheduledAt));
    const existing = jobMap.get(key) ?? [];
    existing.push(job);
    existing.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    jobMap.set(key, existing);
  }

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = toDateKey(date);

    return {
      key,
      date,
      isCurrentMonth: date.getMonth() === monthCursor.getMonth(),
      jobs: jobMap.get(key) ?? [],
    } satisfies CalendarDay;
  });
}

function buildDemoJob(
  id: string,
  title: string,
  site: string,
  assignedTo: string,
  dayOffset: number,
  hour: number,
  minute: number,
  status: JobStatus,
): CalendarJob {
  return {
    id,
    title,
    site,
    assignedTo,
    scheduledAt: buildIsoDate(dayOffset, hour, minute),
    status,
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

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildIsoDate(dayOffset: number, hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatLongDate(value: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
