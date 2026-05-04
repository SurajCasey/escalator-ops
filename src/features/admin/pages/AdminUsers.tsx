import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import { RefreshCw } from "lucide-react";

type Status = "PENDING" | "ACTIVE" | "DISABLED";
type Role = "ADMIN" | "EMPLOYEE";

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  role: Role;
  status: Status;
  created_at: string;
};

const STATUS_CONFIG = {
  ACTIVE: { label: "Active", dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-100" },
  PENDING: { label: "Pending", dot: "bg-yellow-500", badge: "bg-yellow-50 text-yellow-700 border-yellow-100" },
  DISABLED: { label: "Disabled", dot: "bg-red-400", badge: "bg-red-50 text-red-600 border-red-100" },
};

const ROLE_CONFIG = {
  ADMIN: { label: "Admin", cls: "bg-purple-50 text-purple-700 border-purple-100" },
  EMPLOYEE: { label: "Employee", cls: "bg-blue-50 text-blue-700 border-blue-100" },
};

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function avatarColor(name: string | null) {
  const colors = ["bg-blue-500", "bg-purple-500", "bg-pink-500", "bg-teal-500", "bg-orange-500", "bg-indigo-500"];
  if (!name) return colors[0];
  return colors[name.charCodeAt(0) % colors.length];
}

export default function AdminUsers() {
  const [tab, setTab] = useState<Status | "ALL">("ALL");
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesTab = tab === "ALL" || u.status === tab;
      const matchesSearch =
        search === "" ||
        (u.full_name?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole =
        roleFilter === "All Roles" || u.role === roleFilter;
      return matchesTab && matchesSearch && matchesRole;
    });
  }, [users, tab, search, roleFilter]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.status === "ACTIVE").length,
    pending: users.filter((u) => u.status === "PENDING").length,
    disabled: users.filter((u) => u.status === "DISABLED").length,
  }), [users]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, status, created_at")
      .order("created_at", { ascending: false })
      .overrideTypes<Profile[]>();
    setLoading(false);
    if (error) return toast.error(error.message);
    setUsers(data ?? []);
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateStatus = async (id: string, status: Status) => {
    setActingId(id);
    const user = users.find((u) => u.id === id);
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    setActingId(null);

    if (error) return toast.error(error.message);

    toast.success(
      status === "ACTIVE"
        ? `${user?.full_name ?? "User"} has been approved.`
        : `${user?.full_name ?? "User"}'s account is now disabled.`
    );

    if (user?.email) {
      try {
        await sendEmail({ to: user.email, name: user.full_name ?? undefined, type: status === "ACTIVE" ? "approved" : "disabled" });
      } catch (err) {
        console.error(err);
        toast.error(`Email failed to send for ${user.full_name ?? "user"}`);
      }
    }

    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
  };

  const approveUser = (id: string) => updateStatus(id, "ACTIVE");
  const disableUser = (id: string) => updateStatus(id, "DISABLED");

  const tabs: { key: Status | "ALL"; label: string }[] = [
    { key: "ALL", label: "All Users" },
    { key: "ACTIVE", label: "Active" },
    { key: "DISABLED", label: "Disabled" },
    { key: "PENDING", label: "Pending" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 text-white px-6 py-8 md:px-10">
        <div className="max-w-7xl mx-auto flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-slate-400">Admin</p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">User Management</h1>
            <p className="mt-2 text-sm text-slate-300">Approve, disable, and manage user access across your platform.</p>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-white text-slate-900 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-blue-50 shadow-md transition-all disabled:opacity-60 self-start md:self-auto"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-5">
        {/* Search + Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-32.5"
            >
              <option>All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === t.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
                {t.key !== "ALL" && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    t.key === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                    t.key === "ACTIVE" ? "bg-green-100 text-green-700" :
                    "bg-red-100 text-red-600"
                  }`}>
                    {t.key === "PENDING" ? stats.pending : t.key === "ACTIVE" ? stats.active : stats.disabled}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
              <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Loading users...
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">User</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Email</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Role</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Joined</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-slate-400 text-sm">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const statusCfg = STATUS_CONFIG[u.status];
                    const roleCfg = ROLE_CONFIG[u.role] ?? { label: u.role, cls: "bg-slate-100 text-slate-600 border-slate-200" };
                    const isActing = actingId === u.id;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarColor(u.full_name)}`}>
                              {getInitials(u.full_name)}
                            </div>
                            <span className="font-medium text-slate-900 text-sm">{u.full_name ?? "—"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${roleCfg.cls}`}>
                            {roleCfg.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {new Date(u.created_at).toLocaleDateString("en-US", {
                            month: "short", day: "2-digit", year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            {u.status === "PENDING" && (
                              <>
                                <button
                                  onClick={() => approveUser(u.id)}
                                  disabled={isActing}
                                  className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
                                >
                                  {isActing ? (
                                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                  ) : (
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  {isActing ? "Approving..." : "Approve"}
                                </button>
                                <button
                                  onClick={() => disableUser(u.id)}
                                  disabled={isActing}
                                  className="inline-flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
                                >
                                  Disable
                                </button>
                              </>
                            )}
                            {u.status === "ACTIVE" && (
                              <button
                                onClick={() => disableUser(u.id)}
                                disabled={isActing}
                                className="inline-flex items-center gap-1.5 border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
                              >
                                {isActing ? "Disabling..." : "Disable"}
                              </button>
                            )}
                            {u.status === "DISABLED" && (
                              <button
                                onClick={() => approveUser(u.id)}
                                disabled={isActing}
                                className="inline-flex items-center gap-1.5 border border-slate-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
                              >
                                {isActing ? "Enabling..." : "Re-enable"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Stats Footer */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: "Total Users", value: stats.total,
              iconBg: "bg-blue-50",
              icon: (
                <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-5-4m-4 6H2v-2a4 4 0 015-4m4-4a4 4 0 110-8 4 4 0 010 8zm6 4a4 4 0 10-8 0" />
                </svg>
              ),
            },
            {
              label: "Active", value: stats.active,
              iconBg: "bg-green-50",
              icon: (
                <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
            {
              label: "Pending Approval", value: stats.pending,
              iconBg: "bg-yellow-50",
              icon: (
                <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
            {
              label: "Disabled", value: stats.disabled,
              iconBg: "bg-red-50",
              icon: (
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              ),
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${stat.iconBg}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900">{stat.value.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Email function ---
async function sendEmail(params: { to: string; name?: string; type: "approved" | "disabled" }) {
  const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;
  const token = sessionRes.session?.access_token;
  if (!token) throw new Error("No session token (please login again).");

  const res = await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send email: ${text}`);
  }
}
