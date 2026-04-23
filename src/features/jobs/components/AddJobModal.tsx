import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import type { Job, JobInput, JobStatus } from "../../../hooks/Usejobs";

type Employee = { id: string; full_name: string | null; email: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: Job | null;
};

const DEFAULT: JobInput = {
  title: "",
  client_name: "",
  site_name: "",
  assigned_to: null,
  assigned_to_name: "",
  status: "SCHEDULED",
  scheduled_at: "",
  notes: "",
};

function toLocalDatetime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AddJobModal({ open, onClose, onSaved, editing }: Props) {
  const [form, setForm] = useState<JobInput>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("status", "ACTIVE")
      .then(({ data }) => setEmployees(data ?? []));
  }, [open]);

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title,
        client_name: editing.client_name,
        site_name: editing.site_name ?? "",
        assigned_to: editing.assigned_to,
        assigned_to_name: editing.assigned_to_name ?? "",
        status: editing.status,
        scheduled_at: toLocalDatetime(editing.scheduled_at),
        notes: editing.notes ?? "",
      });
    } else {
      setForm(DEFAULT);
    }
  }, [editing, open]);

  if (!open) return null;

  const set = <K extends keyof JobInput>(key: K, value: JobInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleAssignee = (id: string) => {
    const emp = employees.find((e) => e.id === id);
    set("assigned_to", id || null);
    set("assigned_to_name", emp?.full_name ?? emp?.email ?? "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (!form.client_name.trim()) return;
    if (!form.scheduled_at) return;

    setSaving(true);
    const payload: JobInput = {
      ...form,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      site_name: form.site_name || undefined,
      notes: form.notes || undefined,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("jobs").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("jobs").insert(payload));
    }

    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{editing ? "Edit Job" : "New Job"}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Fill in job details below</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Job Title *</label>
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Westfield CBD - Morning Escalator Clean"
                required
                className="w-full px-3 py-2 border text-black border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client Name *</label>
              <input
                value={form.client_name}
                onChange={(e) => set("client_name", e.target.value)}
                placeholder="Westfield Sydney"
                required
                className="w-full px-3 py-2 text-black border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Site Name</label>
              <input
                value={form.site_name ?? ""}
                onChange={(e) => set("site_name", e.target.value)}
                placeholder="Level 3 - Escalator Bay A"
                className="w-full px-3 py-2 border text-black border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Scheduled Date & Time *</label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => set("scheduled_at", e.target.value)}
                required
                className="w-full px-3 py-2 border text-black border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as JobStatus)}
                className="w-full px-3 py-2 border text-black border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Crew Member</label>
              <select
                value={form.assigned_to ?? ""}
                onChange={(e) => handleAssignee(e.target.value)}
                className="w-full px-3 py-2 border text-black border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Unassigned —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name ?? emp.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                placeholder="Access codes, special instructions, equipment needed..."
                className="w-full px-3 py-2 border text-black border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : editing ? "Update Job" : "Create Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
