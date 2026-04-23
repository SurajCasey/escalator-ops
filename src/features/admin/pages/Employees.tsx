import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import { RefreshCw, Search, Pencil, X, Save } from "lucide-react";

type Role = "ADMIN" | "EMPLOYEE";
type Status = "ACTIVE" | "PENDING" | "DISABLED";

type Employee = {
  id: string;
  full_name: string | null;
  email: string;
  role: Role;
  status: Status;
  created_at: string;
};

const STATUS_CONFIG = {
  ACTIVE: { dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-100" },
  PENDING: { dot: "bg-yellow-500", badge: "bg-yellow-50 text-yellow-700 border-yellow-100" },
  DISABLED: { dot: "bg-red-400", badge: "bg-red-50 text-red-600 border-red-100" },
};

const ROLE_CONFIG = {
  ADMIN: { cls: "bg-purple-50 text-purple-700 border-purple-100" },
  EMPLOYEE: { cls: "bg-blue-50 text-blue-700 border-blue-100" },
};

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function avatarBg(name: string | null) {
  const palette = ["bg-blue-500","bg-violet-500","bg-pink-500","bg-teal-500","bg-orange-500","bg-indigo-500"];
  return name ? palette[name.charCodeAt(0) % palette.length] : palette[0];
}

type EditForm = { full_name: string; role: Role; status: Status };

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"ALL" | Status>("ALL");
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ full_name: "", role: "EMPLOYEE", status: "ACTIVE" });
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetch = async () => {
    setLoading(true);
    const [profileRes, empRes] = await Promise.all([
      supabase.auth.getSession(),
      supabase.from("profiles").select("id, full_name, email, role, status, created_at").order("created_at", { ascending: false }),
    ]);

    const session = profileRes.data.session;
    if (session) {
      const { data: me } = await supabase.from("profiles").select("role").eq("id", session.user.id).single<{ role: Role }>();
      setIsAdmin(me?.role === "ADMIN");
    }

    if (empRes.error) toast.error(empRes.error.message);
    else setEmployees((empRes.data ?? []) as Employee[]);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const q = search.toLowerCase();
      const matchTab = tab === "ALL" || e.status === tab;
      const matchSearch = !q || (e.full_name ?? "").toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
      return matchTab && matchSearch;
    });
  }, [employees, search, tab]);

  const stats = useMemo(() => ({
    total: employees.length,
    active: employees.filter((e) => e.status === "ACTIVE").length,
    pending: employees.filter((e) => e.status === "PENDING").length,
    admin: employees.filter((e) => e.role === "ADMIN").length,
  }), [employees]);

  const startEdit = (emp: Employee) => {
    setEditing(emp.id);
    setEditForm({ full_name: emp.full_name ?? "", role: emp.role, status: emp.status });
  };

  const cancelEdit = () => { setEditing(null); };

  const saveEdit = async (id: string) => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: editForm.full_name.trim() || null,
      role: editForm.role,
      status: editForm.status,
    }).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Employee updated.");
    setEditing(null);
    setEmployees((prev) => prev.map((e) => e.id === id ? { ...e, ...editForm, full_name: editForm.full_name.trim() || null } : e));
  };

  const tabs: { key: "ALL" | Status; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "ACTIVE", label: "Active" },
    { key: "PENDING", label: "Pending" },
    { key: "DISABLED", label: "Disabled" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex justify-between items-start max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
            <p className="text-gray-500 text-sm mt-1">View and manage all team members.</p>
          </div>
          <button
            onClick={fetch}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total", value: stats.total, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Active", value: stats.active, color: "text-green-600", bg: "bg-green-50" },
            { label: "Pending", value: stats.pending, color: "text-yellow-600", bg: "bg-yellow-50" },
            { label: "Admins", value: stats.admin, color: "text-purple-600", bg: "bg-purple-50" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${s.bg} flex items-center justify-center`}>
                <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
              </div>
              <p className="text-sm text-gray-600 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search + Tabs */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-1 border-b border-gray-200">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              <RefreshCw className="animate-spin h-5 w-5 mr-2" /> Loading…
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Employee</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Email</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Role</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Joined</th>
                  {isAdmin && <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 6 : 5} className="text-center py-16 text-gray-400 text-sm">No employees found.</td></tr>
                ) : filtered.map((emp) => {
                  const isEditingThis = editing === emp.id;
                  const sCfg = STATUS_CONFIG[emp.status];
                  const rCfg = ROLE_CONFIG[emp.role];

                  return (
                    <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarBg(emp.full_name)}`}>
                            {initials(emp.full_name)}
                          </div>
                          {isEditingThis ? (
                            <input
                              value={editForm.full_name}
                              onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                              className="border border-gray-200 rounded px-2 py-1 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Full name"
                            />
                          ) : (
                            <span className="font-medium text-gray-900 text-sm">{emp.full_name ?? "—"}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{emp.email}</td>
                      <td className="px-6 py-4">
                        {isEditingThis && isAdmin ? (
                          <select
                            value={editForm.role}
                            onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as Role }))}
                            className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="EMPLOYEE">Employee</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${rCfg.cls}`}>
                            {emp.role}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isEditingThis && isAdmin ? (
                          <select
                            value={editForm.status}
                            onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as Status }))}
                            className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="PENDING">Pending</option>
                            <option value="DISABLED">Disabled</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${sCfg.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />
                            {emp.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(emp.created_at).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            {isEditingThis ? (
                              <>
                                <button
                                  onClick={() => saveEdit(emp.id)}
                                  disabled={saving}
                                  className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-60"
                                >
                                  <Save className="h-3 w-3" />{saving ? "Saving…" : "Save"}
                                </button>
                                <button onClick={cancelEdit} className="inline-flex items-center gap-1 border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium">
                                  <X className="h-3 w-3" /> Cancel
                                </button>
                              </>
                            ) : (
                              <button onClick={() => startEdit(emp)} className="inline-flex items-center gap-1 border border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                                <Pencil className="h-3 w-3" /> Edit
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
