import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  DollarSign,
  Mail,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Shield,
  UserCheck,
  UserMinus,
  Users,
  X,
} from "lucide-react";

type Role   = "ADMIN" | "EMPLOYEE";
type Status = "ACTIVE" | "PENDING" | "DISABLED";

type Person = {
  id: string;
  full_name: string | null;
  email: string;
  role: Role;
  status: Status;
  created_at: string;
  hourly_rate: number | null;
  avatar_url: string | null;
  job_title: string | null;
};

type EditForm = {
  full_name: string;
  role: Role;
  status: Status;
  hourly_rate: string;
  job_title: string;
};

/* ── helpers ── */
function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
const PALETTE = ["bg-blue-500","bg-violet-500","bg-pink-500","bg-teal-500","bg-orange-500","bg-indigo-500","bg-emerald-500","bg-rose-500"];
function avatarBg(name: string | null) {
  return name ? PALETTE[name.charCodeAt(0) % PALETTE.length] : PALETTE[0];
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_CFG = {
  ACTIVE:   { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Active" },
  PENDING:  { dot: "bg-amber-500",   badge: "bg-amber-50  text-amber-700  border-amber-200",  label: "Pending" },
  DISABLED: { dot: "bg-red-400",     badge: "bg-red-50    text-red-600    border-red-200",    label: "Disabled" },
};
const ROLE_CFG = {
  ADMIN:    { badge: "bg-violet-50 text-violet-700 border-violet-200", label: "Admin" },
  EMPLOYEE: { badge: "bg-blue-50   text-blue-700   border-blue-200",   label: "Employee" },
};

/* ══════════════════════════════════════════════════════════════ */
export default function People() {
  const [people, setPeople]     = useState<Person[]>([]);
  const [loading, setLoading]   = useState(true);
  const [isAdmin, setIsAdmin]   = useState(false);
  const [search, setSearch]     = useState("");
  const [statusTab, setStatusTab] = useState<"ALL" | Status>("ALL");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  const [editTarget, setEditTarget] = useState<Person | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ full_name: "", role: "EMPLOYEE", status: "ACTIVE", hourly_rate: "" });
  const [saving, setSaving]     = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  /* load */
  const load = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;

    const [meRes, peopleRes] = await Promise.all([
      uid ? supabase.from("profiles").select("role").eq("id", uid).single<{ role: Role }>() : Promise.resolve({ data: null }),
      supabase.from("profiles").select("id, full_name, email, role, status, created_at, hourly_rate, avatar_url, job_title").order("created_at", { ascending: false }),
    ]);

    setIsAdmin((meRes as { data: { role: Role } | null }).data?.role === "ADMIN");
    if (peopleRes.error) toast.error(peopleRes.error.message);
    else setPeople((peopleRes.data ?? []) as Person[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  /* filtered list — non-admins never see PENDING accounts */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return people.filter((p) => {
      if (!isAdmin && p.status === "PENDING") return false;
      if (statusTab !== "ALL" && p.status !== statusTab) return false;
      if (roleFilter !== "ALL" && p.role !== roleFilter) return false;
      if (q && !(p.full_name ?? "").toLowerCase().includes(q) && !p.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [people, statusTab, roleFilter, search, isAdmin]);

  /* stats */
  const stats = useMemo(() => ({
    total:    people.length,
    active:   people.filter((p) => p.status === "ACTIVE").length,
    pending:  people.filter((p) => p.status === "PENDING").length,
    admins:   people.filter((p) => p.role === "ADMIN").length,
    employees:people.filter((p) => p.role === "EMPLOYEE").length,
  }), [people]);

  /* open edit modal */
  const openEdit = (p: Person) => {
    setEditTarget(p);
    setEditForm({
      full_name:   p.full_name ?? "",
      role:        p.role,
      status:      p.status,
      hourly_rate: p.hourly_rate != null ? String(p.hourly_rate) : "",
      job_title:   p.job_title ?? "",
    });
  };

  /* save edit */
  const saveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    const patch: Record<string, unknown> = {
      full_name:   editForm.full_name.trim() || null,
      role:        editForm.role,
      status:      editForm.status,
      hourly_rate: editForm.hourly_rate !== "" ? Number(editForm.hourly_rate) : 0,
      job_title:   editForm.job_title.trim() || null,
    };
    const { error } = await supabase.from("profiles").update(patch).eq("id", editTarget.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated.");
    setPeople((prev) => prev.map((p) => p.id === editTarget.id ? {
      ...p,
      full_name:   patch.full_name as string | null,
      role:        patch.role as Role,
      status:      patch.status as Status,
      hourly_rate: patch.hourly_rate as number,
      job_title:   patch.job_title as string | null,
    } : p));
    setEditTarget(null);
  };

  /* quick approve / disable */
  const quickStatus = async (id: string, status: Status) => {
    setActingId(id);
    const person = people.find((p) => p.id === id);
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    setActingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "ACTIVE" ? `${person?.full_name ?? "User"} approved.` : `${person?.full_name ?? "User"} disabled.`);
    if (person?.email && status === "ACTIVE") {
      try { await sendEmail({ to: person.email, name: person.full_name ?? undefined, type: "approved" }); }
      catch { toast.error("Approval email failed to send."); }
    }
    setPeople((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
  };

  const TABS: { key: "ALL" | Status; label: string }[] = [
    { key: "ALL",      label: "Everyone" },
    { key: "ACTIVE",   label: "Active" },
    ...(isAdmin ? [{ key: "PENDING" as Status, label: "Pending" }] : []),
    { key: "DISABLED", label: "Disabled" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 text-white px-6 py-8 md:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">Statewide Escalator</p>
              <h1 className="text-2xl md:text-3xl font-extrabold mt-1">People & Access</h1>
              <p className="text-sm text-slate-300 mt-1">Manage team members, roles, and account access.</p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="self-start md:self-auto flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Stat pills */}
          <div className="mt-6 flex flex-wrap gap-3">
            {[
              { icon: <Users className="h-4 w-4" />,       label: "Total",     value: stats.total,     color: "bg-white/10" },
              { icon: <UserCheck className="h-4 w-4" />,   label: "Active",    value: stats.active,    color: "bg-emerald-500/20 border border-emerald-400/30" },
              { icon: <RefreshCw className="h-4 w-4" />,   label: "Pending",   value: stats.pending,   color: stats.pending > 0 ? "bg-amber-500/20 border border-amber-400/30" : "bg-white/10" },
              { icon: <Shield className="h-4 w-4" />,      label: "Admins",    value: stats.admins,    color: "bg-violet-500/20 border border-violet-400/30" },
              { icon: <Users className="h-4 w-4" />,       label: "Employees", value: stats.employees, color: "bg-blue-500/20 border border-blue-400/30" },
            ].map((s) => (
              <div key={s.label} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm ${s.color}`}>
                {s.icon}
                <span className="text-slate-300">{s.label}</span>
                <span className="font-bold text-white">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-4">

        {/* ── Filters ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
            </div>
            {/* Role filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as "ALL" | Role)}
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-36"
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
          </div>

          {/* Status tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const count = t.key === "ALL" ? stats.total
                : t.key === "ACTIVE" ? stats.active
                : t.key === "PENDING" ? stats.pending
                : people.filter((p) => p.status === "DISABLED").length;
              return (
                <button
                  key={t.key}
                  onClick={() => setStatusTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    statusTab === t.key
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {t.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    statusTab === t.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── People list ────────────────────────────────────── */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center gap-3">
            <RefreshCw className="animate-spin h-8 w-8 text-blue-400" />
            <p className="text-slate-400 text-sm">Loading team…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center gap-3">
            <Users className="h-10 w-10 text-slate-200" />
            <p className="text-slate-400 text-sm">No people match your filters.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Pending banner */}
            {isAdmin && statusTab === "ALL" && stats.pending > 0 && (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <RefreshCw className="h-4 w-4 text-amber-600" />
                </div>
                <p className="text-sm text-amber-800 font-medium">
                  {stats.pending} account{stats.pending !== 1 ? "s" : ""} waiting for approval
                </p>
                <button onClick={() => setStatusTab("PENDING")} className="ml-auto text-xs font-semibold text-amber-700 hover:underline">
                  Review →
                </button>
              </div>
            )}

            {filtered.map((person) => {
              const sCfg = STATUS_CFG[person.status];
              const rCfg = ROLE_CFG[person.role];
              const isActing = actingId === person.id;

              return (
                <div
                  key={person.id}
                  className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-4 transition-all hover:shadow-md ${
                    person.status === "PENDING" ? "border-amber-200" : "border-slate-100"
                  }`}
                >
                  {/* Avatar */}
                  <div className={`h-11 w-11 rounded-full overflow-hidden flex items-center justify-center text-white text-sm font-bold shrink-0 ${person.avatar_url ? "" : avatarBg(person.full_name)}`}>
                    {person.avatar_url
                      ? <img src={person.avatar_url} alt={person.full_name ?? "avatar"} className="h-full w-full object-cover" />
                      : initials(person.full_name)
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm truncate">
                        {person.full_name ?? "—"}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${rCfg.badge}`}>
                        {person.role === "ADMIN" && <Shield className="h-2.5 w-2.5" />}
                        {rCfg.label}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${sCfg.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${sCfg.dot}`} />
                        {sCfg.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Mail className="h-3 w-3" />{person.email}
                      </span>
                      {person.job_title && (
                        <span className="text-xs text-slate-500 font-medium">{person.job_title}</span>
                      )}
                      <span className="text-xs text-slate-400">Joined {fmtDate(person.created_at)}</span>
                      {person.hourly_rate != null && person.hourly_rate > 0 && isAdmin && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          <DollarSign className="h-3 w-3" />${person.hourly_rate}/hr
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-2 shrink-0">
                      {person.status === "PENDING" && (
                        <button
                          onClick={() => quickStatus(person.id, "ACTIVE")}
                          disabled={isActing}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-60"
                        >
                          {isActing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Approve
                        </button>
                      )}
                      {person.status === "ACTIVE" && (
                        <button
                          onClick={() => quickStatus(person.id, "DISABLED")}
                          disabled={isActing}
                          className="flex items-center gap-1.5 border border-slate-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 text-slate-500 px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-60"
                        >
                          {isActing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
                          Disable
                        </button>
                      )}
                      {person.status === "DISABLED" && (
                        <button
                          onClick={() => quickStatus(person.id, "ACTIVE")}
                          disabled={isActing}
                          className="flex items-center gap-1.5 border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 text-slate-500 px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-60"
                        >
                          {isActing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                          Re-enable
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(person)}
                        className="flex items-center gap-1.5 border border-slate-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 text-slate-500 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Edit Modal ──────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setEditTarget(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-100">
              <div className={`h-12 w-12 rounded-full overflow-hidden flex items-center justify-center text-white text-sm font-bold shrink-0 ${editTarget.avatar_url ? "" : avatarBg(editTarget.full_name)}`}>
                {editTarget.avatar_url
                  ? <img src={editTarget.avatar_url} alt={editTarget.full_name ?? "avatar"} className="h-full w-full object-cover" />
                  : initials(editTarget.full_name)
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{editTarget.full_name ?? "Unnamed"}</p>
                <p className="text-xs text-slate-400 truncate">{editTarget.email}</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Full Name</label>
                  <input
                    value={editForm.full_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                    placeholder="Full name"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Job Title</label>
                  <input
                    value={editForm.job_title}
                    onChange={(e) => setEditForm((f) => ({ ...f, job_title: e.target.value }))}
                    placeholder="e.g. Field Technician"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Role</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    {(["EMPLOYEE", "ADMIN"] as Role[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setEditForm((f) => ({ ...f, role: r }))}
                        className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                          editForm.role === r
                            ? r === "ADMIN" ? "bg-violet-600 text-white shadow-sm" : "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500"
                        }`}
                      >
                        {r === "ADMIN" ? "Admin" : "Employee"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as Status }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PENDING">Pending</option>
                    <option value="DISABLED">Disabled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                  Hourly Rate (AUD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editForm.hourly_rate}
                    onChange={(e) => setEditForm((f) => ({ ...f, hourly_rate: e.target.value }))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Used for timesheet pay calculations.</p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 px-6 pb-5">
              <button
                onClick={() => setEditTarget(null)}
                className="px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── email helper ── */
async function sendEmail(params: { to: string; name?: string; type: "approved" | "disabled" }) {
  const { data: sessionRes } = await supabase.auth.getSession();
  const token = sessionRes.session?.access_token;
  if (!token) return;
  await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });
}
