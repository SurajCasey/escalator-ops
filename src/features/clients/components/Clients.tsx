import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import { Pencil, Trash2 } from "lucide-react";
import AddClientModal, { type ClientRecord } from "./AddClientModal";

type TabFilter = "all" | "active" | "inactive" | "pending";

const STATUS_CONFIG = {
  ACTIVE:   { label: "Active",   dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  INACTIVE: { label: "Inactive", dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-600" },
  PENDING:  { label: "Pending",  dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700" },
};

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function avatarColor(name: string) {
  const colors = [
    "bg-blue-500", "bg-purple-500", "bg-pink-500",
    "bg-teal-500", "bg-orange-500", "bg-indigo-500",
  ];
  return colors[name.charCodeAt(0) % colors.length];
}

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients]         = useState<ClientRecord[]>([]);
  const [loading, setLoading]         = useState(false);
  const [tab, setTab]                 = useState<TabFilter>("all");
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const pageSize = 10;

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setClients((data ?? []) as ClientRecord[]);
  };

  useEffect(() => { void fetchClients(); }, []);

  const filtered = clients.filter((c) => {
    const matchesTab =
      tab === "all" ||
      (tab === "active"   && c.status === "ACTIVE")   ||
      (tab === "inactive" && c.status === "INACTIVE") ||
      (tab === "pending"  && c.status === "PENDING");
    const matchesSearch =
      search === "" ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_person ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "All Statuses" ||
      c.status === statusFilter.toUpperCase();
    return matchesTab && matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated  = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const stats = {
    total:    clients.length,
    active:   clients.filter((c) => c.status === "ACTIVE").length,
    pending:  clients.filter((c) => c.status === "PENDING").length,
    inactive: clients.filter((c) => c.status === "INACTIVE").length,
  };

  async function handleDelete(client: ClientRecord) {
    if (!window.confirm(`Delete "${client.name}"? This cannot be undone.`)) return;
    setDeletingId(client.id);
    const { error } = await supabase.from("clients").delete().eq("id", client.id);
    setDeletingId(null);
    if (error) { toast.error(error.message); return; }
    setClients((all) => all.filter((c) => c.id !== client.id));
    toast.success("Client deleted.");
  }

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all",      label: "All Clients" },
    { key: "active",   label: "Active" },
    { key: "inactive", label: "Inactive" },
    { key: "pending",  label: "Pending" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 text-white px-6 py-8 md:px-10">
        <div className="max-w-7xl mx-auto flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-slate-400">Operations</p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Client Management</h1>
            <p className="mt-2 text-sm text-slate-300">
              Manage your customer database, track status, and view historical engagement.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-white text-slate-900 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-blue-50 shadow-md transition-all self-start md:self-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Client
          </button>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-5">

        {/* Search + Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, email, or contact…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option>All Statuses</option>
              <option>Active</option>
              <option>Inactive</option>
              <option>Pending</option>
            </select>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => { setTab(t.key); setCurrentPage(1); }}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === t.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}>
                {t.label}
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
              Loading clients…
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Client</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Contact</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Address</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Created</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-slate-400 text-sm">No clients found.</td>
                    </tr>
                  ) : (
                    paginated.map((client) => {
                      const cfg = STATUS_CONFIG[client.status] ?? STATUS_CONFIG.INACTIVE;
                      const fullAddress = [client.unit, client.address].filter(Boolean).join(" / ");
                      return (
                        <tr
                          key={client.id}
                          onClick={() => navigate(`/admin/clients/${client.id}`)}
                          className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                        >
                          {/* Client Name */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarColor(client.name)}`}>
                                {getInitials(client.name)}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900 text-sm hover:text-blue-600 transition-colors">{client.name}</p>
                                {client.company_type && (
                                  <p className="text-xs text-slate-400">{client.company_type}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Contact */}
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-700">{client.contact_person ?? "—"}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{client.email ?? ""}</p>
                            <p className="text-xs text-slate-400">{client.phone ?? ""}</p>
                          </td>

                          {/* Address */}
                          <td className="px-6 py-4">
                            {fullAddress ? (
                              <>
                                {client.unit && (
                                  <span className="inline-block mb-1 text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                    {client.unit}
                                  </span>
                                )}
                                <p className="text-sm text-slate-600">{client.address ?? "—"}</p>
                              </>
                            ) : (
                              <p className="text-sm text-slate-400">—</p>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                          </td>

                          {/* Created */}
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {new Date(client.created_at).toLocaleDateString("en-AU", {
                              day: "2-digit", month: "short", year: "numeric",
                            })}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditingClient(client)}
                                title="Edit client"
                                className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => void handleDelete(client)}
                                disabled={deletingId === client.id}
                                title="Delete client"
                                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                              >
                                {deletingId === client.id ? (
                                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                  </svg>
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Showing{" "}
                  <span className="font-medium">{filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span>–
                  <span className="font-medium">{Math.min(currentPage * pageSize, filtered.length)}</span>{" "}
                  of <span className="font-medium">{filtered.length}</span>
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
                    <button key={page} onClick={() => setCurrentPage(page)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page
                          ? "bg-blue-600 text-white"
                          : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}>
                      {page}
                    </button>
                  ))}
                  {totalPages > 5 && <span className="text-slate-400 px-1">…</span>}
                  {totalPages > 5 && (
                    <button onClick={() => setCurrentPage(totalPages)}
                      className="w-9 h-9 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50">
                      {totalPages}
                    </button>
                  )}
                  <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Clients",     value: stats.total,    color: "text-blue-600",    bg: "bg-blue-50" },
            { label: "Active",            value: stats.active,   color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Pending Approval",  value: stats.pending,  color: "text-amber-600",   bg: "bg-amber-50" },
            { label: "Inactive",          value: stats.inactive, color: "text-slate-500",   bg: "bg-slate-100" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Add modal */}
      <AddClientModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={fetchClients}
      />

      {/* Edit modal */}
      <AddClientModal
        open={!!editingClient}
        editClient={editingClient}
        onClose={() => setEditingClient(null)}
        onSaved={fetchClients}
      />
    </div>
  );
}
