/**
 * EditBookingModal — edit a job and all its visits.
 *
 * Loads visits from the `visits` table for the given parent job.
 * Team is managed via `visit_assignments` (new model).
 * Cancel sets the parent job + all visits to CANCELLED.
 */

import { useEffect, useState } from "react";
import {
  AlertTriangle, Ban, CalendarDays, Check,
  ChevronDown, Clock, DollarSign, FileText, MapPin,
  Save, Users, X,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import type { Job, JobStatus, VisitStatus } from "../../../hooks/Usejobs";
import toast from "react-hot-toast";

/* ── Types ───────────────────────────────────────────────── */
type Employee = { id: string; full_name: string | null; email: string; avatar_url?: string | null };

type VisitRow = {
  id: string;
  scheduled_at: string; // datetime-local string for input
  status: VisitStatus;
};

type Props = {
  open: boolean;
  job: Job | null;
  onClose: () => void;
  onSaved: () => void;
};

/* ── Helpers ─────────────────────────────────────────────── */
const PALETTE = ["bg-blue-500","bg-violet-500","bg-pink-500","bg-teal-500","bg-orange-500","bg-indigo-500","bg-emerald-500"];
function avatarBg(name: string | null) { return name ? PALETTE[name.charCodeAt(0) % PALETTE.length] : PALETTE[0]; }
function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function toLocalDatetime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

const VISIT_STATUS_OPTIONS: VisitStatus[] = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "OVERDUE", "CANCELLED"];

const STATUS_COLORS: Record<string, string> = {
  DRAFT:       "bg-slate-50 text-slate-500 border-slate-200",
  SCHEDULED:   "bg-blue-50 text-blue-700 border-blue-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETED:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  OVERDUE:     "bg-rose-50 text-rose-700 border-rose-200",
  CANCELLED:   "bg-slate-100 text-slate-500 border-slate-200",
};

function humanize(s: string) {
  return s.split("_").map(w => w[0] + w.slice(1).toLowerCase()).join(" ");
}

/* ════════════════════════════════════════════════════════════ */
export default function EditBookingModal({ open, job, onClose, onSaved }: Props) {
  const [visitRows, setVisitRows]           = useState<VisitRow[]>([]);
  const [siteName, setSiteName]             = useState("");
  const [flatRate, setFlatRate]             = useState("");
  const [notes, setNotes]                   = useState("");
  const [employees, setEmployees]           = useState<Employee[]>([]);
  const [assignedEmployees, setAssignedEmployees] = useState<string[]>([]);
  const [saving, setSaving]                 = useState(false);
  const [loadingData, setLoadingData]       = useState(false);

  /* Cancel flow */
  const [showCancelPanel, setShowCancelPanel] = useState(false);
  const [cancelReason, setCancelReason]       = useState("");
  const [cancelling, setCancelling]           = useState(false);

  /* ── Load job data + visits + team ─── */
  useEffect(() => {
    if (!open || !job) return;
    setShowCancelPanel(false); setCancelReason("");
    setLoadingData(true);

    const load = async () => {
      // Fetch visits for this job
      const { data: visits } = await supabase
        .from("visits")
        .select("id, scheduled_at, status")
        .eq("job_id", job.id)
        .neq("status", "CANCELLED")
        .order("scheduled_at");

      setVisitRows(
        ((visits ?? []) as { id: string; scheduled_at: string; status: VisitStatus }[]).map(v => ({
          id: v.id,
          scheduled_at: toLocalDatetime(v.scheduled_at),
          status: v.status,
        }))
      );

      // Common fields from parent job
      setSiteName(job.site_name ?? "");
      setFlatRate(job.flat_rate != null ? String(job.flat_rate) : "");
      setNotes(job.notes ?? "");

      // Load all active employees
      const { data: empData } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("status", "ACTIVE")
        .order("full_name");
      setEmployees((empData ?? []) as Employee[]);

      // Load current team from visit_assignments (deduplicated across all visits)
      const visitIds = ((visits ?? []) as { id: string }[]).map(v => v.id);
      if (visitIds.length > 0) {
        const { data: vaRows } = await supabase
          .from("visit_assignments")
          .select("employee_id")
          .in("visit_id", visitIds);
        const uniqueIds = [...new Set((vaRows ?? []).map((r: { employee_id: string }) => r.employee_id))];
        setAssignedEmployees(uniqueIds);
      } else {
        setAssignedEmployees([]);
      }

      setLoadingData(false);
    };

    load();
  }, [open, job]);

  if (!open || !job) return null;

  const toggleEmployee = (id: string) =>
    setAssignedEmployees(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);

  const updateRow = <K extends keyof VisitRow>(idx: number, key: K, value: VisitRow[K]) =>
    setVisitRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [key]: value };
      // Auto-reset OVERDUE status when the date is moved into the future
      if (key === "scheduled_at" && updated.status === "OVERDUE") {
        const newDate = new Date(value as string);
        if (!isNaN(newDate.getTime()) && newDate > new Date()) {
          updated.status = "SCHEDULED";
        }
      }
      return updated;
    }));

  const hasMultipleVisits = visitRows.length > 1;

  /* ── Save all changes ─── */
  const handleSave = async () => {
    setSaving(true);
    const rate = flatRate ? parseFloat(flatRate) : null;

    try {
      // Update parent job shared fields
      const { error: jobErr } = await supabase.from("jobs").update({
        site_name: siteName || null,
        flat_rate:  rate,
        notes:      notes || null,
      }).eq("id", job.id);
      if (jobErr) throw new Error(jobErr.message);

      // Update each visit's scheduled_at and status
      // Safety net: if a visit is OVERDUE but its new date is in the future, reset to SCHEDULED
      const now = new Date();
      for (const row of visitRows) {
        const newDate = new Date(row.scheduled_at);
        const resolvedStatus: VisitStatus =
          row.status === "OVERDUE" && newDate > now ? "SCHEDULED" : row.status;

        const { error: visitErr } = await supabase.from("visits").update({
          scheduled_at: newDate.toISOString(),
          status:        resolvedStatus,
        }).eq("id", row.id);
        if (visitErr) throw new Error(visitErr.message);
      }

      // If the parent job is OVERDUE but all visits are now in the future, reset it to SCHEDULED
      const allFuture = visitRows.every(r => new Date(r.scheduled_at) > now);
      if (job.status === "OVERDUE" && allFuture) {
        await supabase.from("jobs").update({ status: "SCHEDULED" }).eq("id", job.id);
      }

      // Re-sync team: replace visit_assignments for all visits
      const visitIds = visitRows.map(r => r.id);
      if (visitIds.length > 0) {
        const { error: delErr } = await supabase
          .from("visit_assignments")
          .delete()
          .in("visit_id", visitIds);
        if (delErr) throw new Error(delErr.message);

        if (assignedEmployees.length > 0 && visitIds.length > 0) {
          const insRows = visitIds.flatMap(vid =>
            assignedEmployees.map(empId => ({ visit_id: vid, employee_id: empId }))
          );
          const { error: insErr } = await supabase.from("visit_assignments").insert(insRows);
          if (insErr) throw new Error(insErr.message);
        }
      }

      toast.success(hasMultipleVisits ? "Booking updated." : "Job updated.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  /* ── Cancel booking (job + all visits) ─── */
  const handleCancel = async () => {
    if (!cancelReason.trim()) { toast.error("Please enter a reason."); return; }
    setCancelling(true);
    try {
      // Cancel the parent job
      const { error: jobErr } = await supabase.from("jobs").update({
        status: "CANCELLED" as JobStatus,
        cancellation_reason: cancelReason.trim(),
      }).eq("id", job.id);
      if (jobErr) throw new Error(jobErr.message);

      // Cancel all visits
      const visitIds = visitRows.map(r => r.id);
      if (visitIds.length > 0) {
        const { error: visitErr } = await supabase
          .from("visits")
          .update({ status: "CANCELLED" as VisitStatus })
          .in("id", visitIds);
        if (visitErr) throw new Error(visitErr.message);
      }

      toast.success(hasMultipleVisits ? "Booking cancelled." : "Job cancelled.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setCancelling(false);
    }
  };

  /* ──────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {hasMultipleVisits ? "Edit Booking" : "Edit Job"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {hasMultipleVisits
                ? `${visitRows.length} visits · ${job.client_name}`
                : job.client_name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {loadingData ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
          ) : (
            <>

              {/* ── Visits ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-800">
                    {hasMultipleVisits
                      ? `Scheduled Visits (${visitRows.length})`
                      : "Scheduled Date & Time"}
                  </h3>
                </div>

                {visitRows.length === 0 && (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    No active visits — all may have been cancelled.
                  </p>
                )}

                <div className="space-y-2">
                  {visitRows.map((row, idx) => (
                    <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {hasMultipleVisits && (
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </div>
                        )}
                        <input
                          type="datetime-local"
                          value={row.scheduled_at}
                          onChange={e => updateRow(idx, "scheduled_at", e.target.value)}
                          className="flex-1 min-w-0 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="relative">
                          <select
                            value={row.status}
                            onChange={e => updateRow(idx, "status", e.target.value as VisitStatus)}
                            className={`pl-2 pr-7 py-1.5 text-xs font-medium rounded-lg border appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${STATUS_COLORS[row.status] ?? STATUS_COLORS.SCHEDULED}`}
                          >
                            {VISIT_STATUS_OPTIONS.map(s => (
                              <option key={s} value={s}>{humanize(s)}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none text-current opacity-60" />
                        </div>
                      </div>
                      {hasMultipleVisits && (
                        <p className="text-[10px] text-slate-400 mt-1.5 ml-7 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {fmtDate(row.scheduled_at || new Date().toISOString())}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Common fields ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" /> Site / Location
                  </label>
                  <input value={siteName} onChange={e => setSiteName(e.target.value)}
                    placeholder="e.g. Level 3 – Escalator Bay A"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-slate-400" /> Flat Rate (AUD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input type="number" min={0} step={0.01} value={flatRate}
                      onChange={e => setFlatRate(e.target.value)} placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {hasMultipleVisits && flatRate && (
                    <p className="text-xs text-slate-400 mt-1">
                      Total: ${(parseFloat(flatRate) * visitRows.length).toFixed(2)} across {visitRows.length} visits
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                    <FileText className="h-3.5 w-3.5 text-slate-400" /> Notes
                    {hasMultipleVisits && <span className="text-[10px] text-slate-400 font-normal">(applies to all visits)</span>}
                  </label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                    placeholder="Access codes, special instructions…"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* ── Team members ── */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-800">Team Members</span>
                  {hasMultipleVisits && <span className="text-[10px] text-slate-400">(assigned to all visits)</span>}
                  <span className="ml-auto text-xs text-slate-500">
                    {assignedEmployees.length > 0 ? `${assignedEmployees.length} selected` : "None"}
                  </span>
                </div>
                <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
                  {employees.map(emp => {
                    const selected = assignedEmployees.includes(emp.id);
                    return (
                      <button key={emp.id} type="button" onClick={() => toggleEmployee(emp.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${selected ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                        <div className={`h-8 w-8 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0 ${emp.avatar_url ? "" : avatarBg(emp.full_name)}`}>
                          {emp.avatar_url
                            ? <img src={emp.avatar_url} className="h-full w-full object-cover" alt="" />
                            : initials(emp.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{emp.full_name ?? emp.email}</p>
                          {emp.full_name && <p className="text-xs text-slate-400 truncate">{emp.email}</p>}
                        </div>
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selected ? "border-blue-600 bg-blue-600" : "border-slate-300"}`}>
                          {selected && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Cancel panel ── */}
              {showCancelPanel ? (
                <div className="rounded-xl border-2 border-rose-200 bg-rose-50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                    <p className="text-sm font-semibold text-rose-800">
                      Cancel {hasMultipleVisits ? `this booking (${visitRows.length} visits)` : "this job"}?
                    </p>
                  </div>
                  <p className="text-xs text-rose-600">
                    The job and {hasMultipleVisits ? "all its visits" : "its visit"} will be marked as <strong>Cancelled</strong> and kept in records.
                  </p>
                  <textarea
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    rows={3}
                    placeholder="Reason for cancellation (required)…"
                    className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm text-slate-900 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => { setShowCancelPanel(false); setCancelReason(""); }}
                      className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
                      Keep Job
                    </button>
                    <button type="button" onClick={handleCancel} disabled={cancelling || !cancelReason.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60">
                      <Ban className="h-4 w-4" />
                      {cancelling ? "Cancelling…" : "Confirm Cancellation"}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button"
                  onClick={() => setShowCancelPanel(true)}
                  className="flex items-center gap-2 text-sm font-medium text-rose-600 hover:text-rose-800 transition-colors">
                  <Ban className="h-4 w-4" />
                  Cancel {hasMultipleVisits ? "entire booking" : "this job"}…
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loadingData && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
              Close
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : hasMultipleVisits ? "Save All Changes" : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
