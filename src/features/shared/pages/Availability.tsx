import { useEffect, useState } from "react";
import {
  AlertCircle, CalendarOff, Check, Pencil, Plus, Trash2, Users, X,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";

type Role = "ADMIN" | "EMPLOYEE";
type ApprovalStatus = "PENDING" | "APPROVED" | "DENIED";

type UnavailEntry = {
  id: string;
  employee_id: string;
  employee_name?: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: ApprovalStatus;
  created_at: string;
};

/* ─── helpers ─── */
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-AU", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function isSingleDay(start: string, end: string) { return start === end; }
function isActive(start: string, end: string) {
  const today = new Date().toISOString().split("T")[0];
  return start <= today && end >= today;
}
function isUpcoming(start: string) {
  return start > new Date().toISOString().split("T")[0];
}
function isPast(end: string) {
  return end < new Date().toISOString().split("T")[0];
}
function todayStr() { return new Date().toISOString().split("T")[0]; }

const APPROVAL_BADGE: Record<ApprovalStatus, string> = {
  PENDING:  "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  DENIED:   "bg-rose-100 text-rose-700 border-rose-200",
};
const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  PENDING:  "Pending approval",
  APPROVED: "Approved",
  DENIED:   "Denied",
};

/* ─── Edit Modal ─────────────────────────────────────────── */
type EditModalProps = {
  entry: UnavailEntry;
  onClose: () => void;
  onSaved: (updated: UnavailEntry) => void;
};

function EditModal({ entry, onClose, onSaved }: EditModalProps) {
  const [startDate, setStartDate] = useState(entry.start_date);
  const [endDate,   setEndDate]   = useState(entry.end_date);
  const [reason,    setReason]    = useState(entry.reason ?? "");
  const [saving,    setSaving]    = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (endDate < startDate) { toast.error("End date must be on or after start date"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("employee_unavailability")
      .update({
        start_date: startDate,
        end_date:   endDate,
        reason:     reason.trim() || null,
        status:     "PENDING",   // reset to pending on edit so admin re-reviews
      })
      .eq("id", entry.id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Entry updated — awaiting re-approval");
    onSaved({ ...entry, start_date: startDate, end_date: endDate, reason: reason.trim() || null, status: "PENDING" });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Edit Unavailability</h2>
            <p className="text-xs text-slate-400 mt-0.5">Changes reset approval to Pending</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date *</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={e => setEndDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason <span className="text-xs font-normal text-slate-400">— optional</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Annual leave, medical appointment…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function Availability() {
  const [role,    setRole]    = useState<Role>("EMPLOYEE");
  const [myId,    setMyId]    = useState<string | null>(null);
  const [entries, setEntries] = useState<UnavailEntry[]>([]);
  const [loading, setLoading] = useState(true);

  /* add form */
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [reason,    setReason]    = useState("");
  const [saving,    setSaving]    = useState(false);

  /* edit modal */
  const [editEntry, setEditEntry] = useState<UnavailEntry | null>(null);

  /* admin filter */
  const [filterEmployee, setFilterEmployee] = useState<string>("ALL");
  const [filterStatus,   setFilterStatus]   = useState<string>("ALL");
  const [allEmployees,   setAllEmployees]   = useState<{ id: string; name: string }[]>([]);

  /* ── load ── */
  useEffect(() => {
    const load = async () => {
      const { data: sd } = await supabase.auth.getSession();
      if (!sd.session) { setLoading(false); return; }
      const uid = sd.session.user.id;
      setMyId(uid);

      const { data: prof } = await supabase
        .from("profiles").select("role").eq("id", uid)
        .single<{ role: Role }>();
      const userRole: Role = prof?.role ?? "EMPLOYEE";
      setRole(userRole);

      await fetchEntries(userRole, uid);
      if (userRole === "ADMIN") await fetchEmployees();
      setLoading(false);
    };
    load();
  }, []);

  const fetchEntries = async (userRole: Role, uid: string) => {
    let query = supabase
      .from("employee_unavailability")
      .select("id, employee_id, start_date, end_date, reason, status, created_at")
      .order("start_date", { ascending: true });

    if (userRole === "EMPLOYEE") query = query.eq("employee_id", uid);

    const { data, error } = await query;
    if (error) { toast.error("Failed to load availability"); return; }

    if (userRole === "ADMIN" && data) {
      const ids = [...new Set((data as UnavailEntry[]).map(e => e.employee_id))];
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles").select("id, full_name").in("id", ids);
        const nameMap: Record<string, string> = {};
        (profiles ?? []).forEach((p: { id: string; full_name: string | null }) => {
          nameMap[p.id] = p.full_name ?? "Unknown";
        });
        setEntries((data as UnavailEntry[]).map(e => ({ ...e, employee_name: nameMap[e.employee_id] ?? "Unknown" })));
      } else {
        setEntries([]);
      }
    } else {
      setEntries((data ?? []) as UnavailEntry[]);
    }
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("profiles").select("id, full_name")
      .eq("role", "EMPLOYEE").eq("status", "ACTIVE").order("full_name");
    setAllEmployees((data ?? []).map((p: { id: string; full_name: string | null }) => ({
      id: p.id, name: p.full_name ?? "Unknown",
    })));
  };

  /* ── add ── */
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !myId) return;
    if (endDate < startDate) { toast.error("End date must be on or after start date"); return; }
    setSaving(true);
    const { error } = await supabase.from("employee_unavailability").insert({
      employee_id: myId,
      start_date:  startDate,
      end_date:    endDate,
      reason:      reason.trim() || null,
      status:      "PENDING",
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Request submitted — awaiting admin approval");
    setStartDate(""); setEndDate(""); setReason("");
    setSaving(false);
    await fetchEntries(role, myId!);
  };

  /* ── delete ── */
  const handleDelete = async (id: string) => {
    if (!confirm("Remove this unavailability entry?")) return;
    const { error } = await supabase.from("employee_unavailability").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Entry removed");
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  /* ── approve / deny (admin) ── */
  const handleApproval = async (id: string, newStatus: "APPROVED" | "DENIED") => {
    const { error } = await supabase
      .from("employee_unavailability")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus === "APPROVED" ? "Request approved" : "Request denied");
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e));
  };

  /* ── edit saved ── */
  const handleEditSaved = (updated: UnavailEntry) => {
    setEntries(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
  };

  /* ── filtered entries ── */
  const filteredEntries = entries.filter(e => {
    if (role === "ADMIN" && filterEmployee !== "ALL" && e.employee_id !== filterEmployee) return false;
    if (role === "ADMIN" && filterStatus !== "ALL" && e.status !== filterStatus) return false;
    return true;
  });

  /* ── counts ── */
  const pendingCount  = entries.filter(e => e.status === "PENDING").length;
  const approvedCount = entries.filter(e => e.status === "APPROVED" && (isActive(e.start_date, e.end_date) || isUpcoming(e.start_date))).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 space-y-5">
        <div className="animate-pulse space-y-4">
          <div className="h-36 rounded-2xl bg-slate-200" />
          <div className="h-48 rounded-2xl bg-slate-200" />
          <div className="h-64 rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 xl:p-8 space-y-6">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-indigo-900 text-white shadow-xl p-6 md:p-8">
        <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-24 h-40 w-40 rounded-full bg-blue-500/15 blur-2xl" />
        <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">
              {role === "ADMIN" ? "Team Management" : "My Account"}
            </p>
            <h1 className="text-2xl md:text-3xl font-extrabold mt-2">
              {role === "ADMIN" ? "Team Availability" : "My Availability"}
            </h1>
            <p className="text-sm text-slate-300 mt-2">
              {role === "ADMIN"
                ? "Review and approve employee unavailability requests."
                : "Submit unavailability requests for admin approval."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center shrink-0">
            {role === "ADMIN" ? (
              <>
                <div className="rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm px-4 py-3">
                  <p className="text-xl font-bold text-amber-300">{pendingCount}</p>
                  <p className="text-xs text-slate-300 mt-0.5">Pending Review</p>
                </div>
                <div className="rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm px-4 py-3">
                  <p className="text-xl font-bold text-emerald-300">{approvedCount}</p>
                  <p className="text-xs text-slate-300 mt-0.5">Approved Active</p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm px-4 py-3">
                  <p className="text-xl font-bold text-amber-300">{entries.filter(e => e.status === "PENDING").length}</p>
                  <p className="text-xs text-slate-300 mt-0.5">Pending</p>
                </div>
                <div className="rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm px-4 py-3">
                  <p className="text-xl font-bold text-emerald-300">{entries.filter(e => e.status === "APPROVED").length}</p>
                  <p className="text-xs text-slate-300 mt-0.5">Approved</p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Add Form (employee only) ── */}
      {role === "EMPLOYEE" && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="font-semibold text-slate-900 mb-1">Request Unavailability</h2>
          <p className="text-xs text-slate-500 mb-4">
            Submit a request — your admin will approve or deny it. You'll see the status below.
          </p>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
                <input
                  type="date"
                  value={startDate}
                  min={todayStr()}
                  onChange={e => { setStartDate(e.target.value); if (!endDate || e.target.value > endDate) setEndDate(e.target.value); }}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Date *</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || todayStr()}
                  onChange={e => setEndDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reason <span className="text-xs font-normal text-slate-400">— optional</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Annual leave, medical appointment, personal…"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || !startDate || !endDate}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Plus className="h-4 w-4" />
                {saving ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── Admin filters ── */}
      {role === "ADMIN" && (
        <div className="flex flex-wrap items-center gap-3">
          <Users className="h-4 w-4 text-slate-500 shrink-0" />
          <select
            value={filterEmployee}
            onChange={e => setFilterEmployee(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Employees</option>
            {allEmployees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DENIED">Denied</option>
          </select>
          <span className="text-xs text-slate-500">
            {filteredEntries.length} entr{filteredEntries.length !== 1 ? "ies" : "y"}
          </span>
        </div>
      )}

      {/* ── Entries list ── */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              {role === "ADMIN" ? "Unavailability Requests" : "My Requests"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {role === "ADMIN"
                ? "Approve or deny employee requests — approved ones show as warnings when scheduling jobs."
                : "Edit pending requests or remove entries you no longer need."}
            </p>
          </div>
          <CalendarOff className="h-4 w-4 text-slate-300" />
        </div>

        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <CalendarOff className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">No requests found</p>
            {role === "EMPLOYEE" && (
              <p className="text-xs">Use the form above to submit an unavailability request.</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredEntries.map((entry) => {
              const active   = isActive(entry.start_date, entry.end_date);
              const upcoming = isUpcoming(entry.start_date);
              const past     = isPast(entry.end_date);
              const single   = isSingleDay(entry.start_date, entry.end_date);

              /* Icon accent based on approval status */
              const iconBg = entry.status === "APPROVED"
                ? (active ? "bg-rose-50" : upcoming ? "bg-emerald-50" : "bg-slate-100")
                : entry.status === "DENIED" ? "bg-rose-50"
                : "bg-amber-50";
              const iconColor = entry.status === "APPROVED"
                ? (active ? "text-rose-500" : upcoming ? "text-emerald-500" : "text-slate-300")
                : entry.status === "DENIED" ? "text-rose-400"
                : "text-amber-500";

              /* Employee can only edit PENDING entries; can delete any */
              const canEdit   = role === "EMPLOYEE" && entry.status === "PENDING";
              const canDelete = role === "ADMIN" || entry.employee_id === myId;

              return (
                <div
                  key={entry.id}
                  className={`px-5 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors ${
                    entry.status === "PENDING" ? "border-l-4 border-l-amber-400" :
                    entry.status === "DENIED"  ? "border-l-4 border-l-rose-300"  :
                    "border-l-4 border-l-transparent"
                  }`}
                >
                  {/* Icon */}
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                    <AlertCircle className={`h-5 w-5 ${iconColor}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Employee name (admin view) */}
                    {role === "ADMIN" && entry.employee_name && (
                      <p className="text-xs font-semibold text-indigo-600 mb-0.5">{entry.employee_name}</p>
                    )}

                    {/* Date range */}
                    <p className="text-sm font-semibold text-slate-900">
                      {single
                        ? fmtDate(entry.start_date)
                        : `${fmtDate(entry.start_date)} — ${fmtDate(entry.end_date)}`}
                    </p>

                    {/* Reason */}
                    {entry.reason && (
                      <p className="text-xs text-slate-500 mt-0.5">{entry.reason}</p>
                    )}

                    {/* Badges row */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {/* Approval status */}
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${APPROVAL_BADGE[entry.status]}`}>
                        {entry.status === "APPROVED" && <Check className="h-3 w-3" />}
                        {entry.status === "DENIED"   && <X    className="h-3 w-3" />}
                        {APPROVAL_LABEL[entry.status]}
                      </span>
                      {/* Date context (only for approved) */}
                      {entry.status === "APPROVED" && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          active   ? "bg-rose-100 text-rose-700"   :
                          upcoming ? "bg-sky-100 text-sky-700"     :
                          past     ? "bg-slate-100 text-slate-500" :
                                     "bg-slate-100 text-slate-500"
                        }`}>
                          {active ? "Currently away" : upcoming ? "Upcoming" : "Past"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Admin: approve / deny buttons for PENDING */}
                  {role === "ADMIN" && entry.status === "PENDING" && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleApproval(entry.id, "APPROVED")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                        title="Approve"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleApproval(entry.id, "DENIED")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors"
                        title="Deny"
                      >
                        <X className="h-3.5 w-3.5" /> Deny
                      </button>
                    </div>
                  )}

                  {/* Admin: re-review approved/denied */}
                  {role === "ADMIN" && entry.status !== "PENDING" && (
                    <div className="flex items-center gap-1 shrink-0">
                      {entry.status === "APPROVED" && (
                        <button
                          onClick={() => handleApproval(entry.id, "DENIED")}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors"
                          title="Revoke approval"
                        >
                          Revoke
                        </button>
                      )}
                      {entry.status === "DENIED" && (
                        <button
                          onClick={() => handleApproval(entry.id, "APPROVED")}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-50 border border-slate-200 transition-colors"
                          title="Approve after all"
                        >
                          Approve
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Remove entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Employee: edit (pending only) + delete */}
                  {role === "EMPLOYEE" && (
                    <div className="flex items-center gap-1 shrink-0">
                      {canEdit && (
                        <button
                          onClick={() => setEditEntry(entry)}
                          className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Edit request"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Remove entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Edit Modal ── */}
      {editEntry && (
        <EditModal
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSaved={handleEditSaved}
        />
      )}

    </div>
  );
}
