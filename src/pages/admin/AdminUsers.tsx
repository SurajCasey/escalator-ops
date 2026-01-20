import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";
import { Divide, RefreshCw } from "lucide-react";

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

const TABS: Status[] = ["PENDING", "ACTIVE", "DISABLED"];

export default function AdminUsers() {
  const [tab, setTab] = useState<Status>("PENDING");
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const filtered = useMemo(() => users.filter((u) => u.status === tab), [users, tab]);

  const fetchUsers = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, status, created_at")
      .order("created_at", { ascending: false })
      .overrideTypes<Profile[]>();

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setUsers(data ?? []);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateStatus = async (id: string, status: Status) => {
    setActingId(id);

    const user = users.find((u) => u.id === id);

    const { error } = await supabase
      .from("profiles")
      .update({ status })
      .eq("id", id);

    setActingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(status === "ACTIVE" ? 
        `${user?.full_name ?? "User"}'s account is approved successfully` : 
        `${user?.full_name ?? "User"}'s account is now disabled. ` 
    );

    // Update local state quickly (no full refetch required)
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
  };

  const approveUser = (id: string) => updateStatus(id, "ACTIVE");
  const disableUser = (id: string) => updateStatus(id, "DISABLED");

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-sm text-gray-600">Approve or disable user access.</p>
        </div>

        <button
          onClick={fetchUsers}
          className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
          disabled={loading}
        >
          {loading ? "Refreshing..." : (<div className="flex items-center gap-2"><RefreshCw/> <span>Refresh</span></div>) }
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-3 py-2 rounded-md text-sm border",
              tab === t ? "bg-black text-white border-black" : "bg-white hover:bg-gray-50",
            ].join(" ")}
          >
            {t === "PENDING" ? "Pending" : t === "ACTIVE" ? "Active" : "Disabled"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Role</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Loading users...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No users in this tab.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.full_name ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border px-2 py-0.5">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {u.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => approveUser(u.id)}
                              disabled={actingId === u.id}
                              className="rounded-md bg-black px-3 py-2 text-white text-xs disabled:opacity-60"
                            >
                              {actingId === u.id ? "Approving..." : "Approve"}
                            </button>
                            <button
                              onClick={() => disableUser(u.id)}
                              disabled={actingId === u.id}
                              className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-60"
                            >
                              {actingId === u.id ? "Disabling..." : "Disable"}
                            </button>
                          </>
                        )}

                        {u.status === "ACTIVE" && (
                          <button
                            onClick={() => disableUser(u.id)}
                            disabled={actingId === u.id}
                            className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-60"
                          >
                            {actingId === u.id ? "Disabling..." : "Disable"}
                          </button>
                        )}

                        {u.status === "DISABLED" && (
                          <button
                            onClick={() => approveUser(u.id)}
                            disabled={actingId === u.id}
                            className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-60"
                          >
                            {actingId === u.id ? "Enabling..." : "Re-enable"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Tip: Approving a user sets <code>status=ACTIVE</code>. Disabled users cannot access the app.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const label = status === "PENDING" ? "Pending" : status === "ACTIVE" ? "Active" : "Disabled";

  const cls =
    status === "ACTIVE"
      ? "border-green-200 bg-green-50 text-green-700"
      : status === "PENDING"
      ? "border-yellow-200 bg-yellow-50 text-yellow-800"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      {label}
    </span>
  );
}
