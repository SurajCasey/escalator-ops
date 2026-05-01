import { useMemo, useState } from "react";
import { CalendarDays, Clock3, Filter, Plus, Search, Trash2, Users, Pencil } from "lucide-react";
import { useJobs, type Job, type JobStatus } from "../../../hooks/Usejobs";
import AddJobModal from "../../jobs/components/AddJobModal";
import JobDetailPanel from "../../jobs/components/JobDetailPanel";

type ShiftName = "Morning" | "Midday" | "Night";

const STATUS_STYLES: Record<JobStatus, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-100",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-100",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  OVERDUE: "bg-rose-50 text-rose-700 border-rose-100",
};

function getShift(iso: string): ShiftName {
  const h = new Date(iso).getHours();
  if (h < 11) return "Morning";
  if (h < 17) return "Midday";
  return "Night";
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function humanize(value: string) {
  return value.toLowerCase().split("_").map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
}

export default function Schedule() {
  const { jobs, loading, fetchJobs, deleteJob } = useJobs();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | JobStatus>("ALL");
  const [shiftFilter, setShiftFilter] = useState<"ALL" | ShiftName>("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        job.title.toLowerCase().includes(q) ||
        job.client_name.toLowerCase().includes(q) ||
        (job.assigned_to_name ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" || job.status === statusFilter;
      const matchShift = shiftFilter === "ALL" || getShift(job.scheduled_at) === shiftFilter;
      return matchSearch && matchStatus && matchShift;
    });
  }, [jobs, search, statusFilter, shiftFilter]);

  const stats = useMemo(() => ({
    scheduled: jobs.filter((j) => j.status === "SCHEDULED").length,
    active: jobs.filter((j) => j.status === "IN_PROGRESS").length,
    upcoming: jobs.filter((j) => new Date(j.scheduled_at).getTime() >= Date.now()).length,
    crews: new Set(jobs.map((j) => j.assigned_to_name).filter(Boolean)).size,
  }), [jobs]);

  const openCreate = () => { setEditing(null); setShowModal(true); };
  const openEdit = (job: Job) => { setEditing(job); setShowModal(true); };

  const handleDelete = async (id: string) => {
    await deleteJob(id);
    setConfirmDelete(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 xl:p-8 space-y-6">
      {/* Header */}
      <section className="rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-cyan-900 text-white p-6 md:p-8 shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-slate-300">Operations Planning</p>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold">Schedule Table</h1>
            <p className="mt-2 max-w-2xl text-sm md:text-base text-slate-200">
              Manage escalator cleaning jobs, assigned crews, and shift timing.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: <CalendarDays className="h-4 w-4" />, label: "Scheduled", value: stats.scheduled },
              { icon: <Clock3 className="h-4 w-4" />, label: "Live Jobs", value: stats.active },
              { icon: <Filter className="h-4 w-4" />, label: "Upcoming", value: stats.upcoming },
              { icon: <Users className="h-4 w-4" />, label: "Crews", value: stats.crews },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-slate-200">{s.icon}<span className="text-xs uppercase tracking-wide">{s.label}</span></div>
                <p className="mt-2 text-2xl font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Table card */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Schedule Overview</h2>
              <p className="text-sm text-slate-500">{jobs.length} total jobs</p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row flex-wrap">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search jobs, clients, crew"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-cyan-500 md:w-64"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "ALL" | JobStatus)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-cyan-500 bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="OVERDUE">Overdue</option>
              </select>
              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value as "ALL" | ShiftName)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-cyan-500 bg-white"
              >
                <option value="ALL">All Shifts</option>
                <option value="Morning">Morning</option>
                <option value="Midday">Midday</option>
                <option value="Night">Night</option>
              </select>
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Job
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                {["Job", "Client", "Assigned Crew", "Date & Time", "Shift", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">Loading schedule…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">No jobs match the current filters.</td></tr>
              )}
              {!loading && filtered.map((job) => (
                <tr
                  key={job.id}
                  onClick={() => setDetailJobId(job.id)}
                  className="hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{job.title}</p>
                    {job.site_name && <p className="text-xs text-slate-500">{job.site_name}</p>}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-700">{job.client_name}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{job.assigned_to_name ?? <span className="text-slate-400 italic">Unassigned</span>}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{formatDateTime(job.scheduled_at)}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{getShift(job.scheduled_at)}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[job.status]}`}>
                      {humanize(job.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEdit(job)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(job.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Job detail panel */}
      {detailJobId && (
        <JobDetailPanel jobId={detailJobId} onClose={() => setDetailJobId(null)} />
      )}

      {/* Modals */}
      <AddJobModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={fetchJobs}
        editing={editing}
      />

      {/* Confirm delete */}
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
