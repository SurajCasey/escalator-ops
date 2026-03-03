import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "ACTIVE" | "INACTIVE" | "PENDING";
  created_at: string;
  company_type?: string;
};

type TabFilter = "all" | "active" | "inactive" | "pending";

const STATUS_CONFIG = {
  ACTIVE: { label: "Active", dot: "bg-green-500", badge: "bg-green-50 text-green-700" },
  INACTIVE: { label: "Inactive", dot: "bg-gray-400", badge: "bg-gray-100 text-gray-600" },
  PENDING: { label: "Pending", dot: "bg-yellow-500", badge: "bg-yellow-50 text-yellow-700" },
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function AvatarColors(name: string) {
  const colors = [
    "bg-blue-500", "bg-purple-500", "bg-pink-500",
    "bg-teal-500", "bg-orange-500", "bg-indigo-500",
  ];
  const i = name.charCodeAt(0) % colors.length;
  return colors[i];
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setClients(data ?? []);
  };

  useEffect(() => { fetchClients(); }, []);

  const filtered = clients.filter((c) => {
    const matchesTab =
      tab === "all" ||
      (tab === "active" && c.status === "ACTIVE") ||
      (tab === "inactive" && c.status === "INACTIVE") ||
      (tab === "pending" && c.status === "PENDING");
    const matchesSearch =
      search === "" ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "All Statuses" ||
      c.status === statusFilter.toUpperCase();
    return matchesTab && matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const stats = {
    total: clients.length,
    active: clients.filter((c) => c.status === "ACTIVE").length,
    pending: clients.filter((c) => c.status === "PENDING").length,
    inactive: clients.filter((c) => c.status === "INACTIVE").length,
  };

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All Clients" },
    { key: "active", label: "Active" },
    { key: "inactive", label: "Inactive" },
    { key: "pending", label: "Pending" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex justify-between items-start max-w-7xl mx-auto w-full">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Client Management</h1>
            <p className="text-gray-500 text-sm mt-1">
              Manage your customer database, track status, and view historical engagement data.
            </p>
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Client
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-5">
        {/* Search + Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by client name, email, or company..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[140px]"
            >
              <option>All Statuses</option>
              <option>Active</option>
              <option>Inactive</option>
              <option>Pending</option>
            </select>
            <button className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 flex items-center gap-2 hover:bg-gray-50 transition-colors bg-white">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Last 30 Days
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setCurrentPage(1); }}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === t.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
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
              <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Loading clients...
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Client Name</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Email</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Phone</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Created At</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-gray-400 text-sm">No clients found.</td>
                    </tr>
                  ) : (
                    paginated.map((client) => {
                      const cfg = STATUS_CONFIG[client.status] ?? STATUS_CONFIG.INACTIVE;
                      return (
                        <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${AvatarColors(client.name)}`}>
                                {getInitials(client.name)}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 text-sm">{client.name}</div>
                                {client.company_type && (
                                  <div className="text-xs text-gray-400">{client.company_type}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{client.email}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{client.phone}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(client.created_at).toLocaleDateString("en-US", {
                              month: "short", day: "2-digit", year: "numeric",
                            })}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Edit">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
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
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing <span className="font-medium">{filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to{" "}
                  <span className="font-medium">{Math.min(currentPage * pageSize, filtered.length)}</span> of{" "}
                  <span className="font-medium">{filtered.length}</span> results
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === page
                            ? "bg-blue-600 text-white"
                            : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  {totalPages > 5 && <span className="text-gray-400 px-1">...</span>}
                  {totalPages > 5 && (
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors`}
                    >
                      {totalPages}
                    </button>
                  )}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
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
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: "Total Clients", value: stats.total,
              icon: (
                <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-5-4m-4 6H2v-2a4 4 0 015-4m4-4a4 4 0 110-8 4 4 0 010 8zm6 4a4 4 0 10-8 0" />
                </svg>
              ),
              iconBg: "bg-blue-50",
            },
            {
              label: "Active", value: stats.active,
              icon: (
                <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
              iconBg: "bg-green-50",
            },
            {
              label: "Pending Approval", value: stats.pending,
              icon: (
                <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              ),
              iconBg: "bg-yellow-50",
            },
            {
              label: "Inactive", value: stats.inactive,
              icon: (
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                </svg>
              ),
              iconBg: "bg-gray-100",
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${stat.iconBg}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}