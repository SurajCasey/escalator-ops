import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Building2, Calendar, CheckCircle2,
  ChevronRight, Clock, Edit2, FileText, MapPin,
  Package, Phone, Plus, RefreshCw, Trash2, X,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";

/* ── Types ───────────────────────────────────────────────────── */
type Client = {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: "ACTIVE" | "INACTIVE" | "PENDING";
  company_type?: string;
  created_at: string;
};

type Asset = {
  id: string;
  client_id: string;
  unit_number: string;
  location: string | null;
  model: string | null;
  serial_number: string | null;
  install_date: string | null;
  notes: string | null;
  created_at: string;
};

type Job = {
  id: string;
  title: string;
  status: string;
  scheduled_at: string;
  assigned_to_name: string | null;
  site_name: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  issued_at: string;
  due_at: string | null;
};

type Tab = "overview" | "assets" | "jobs" | "invoices";

/* ── Helpers ─────────────────────────────────────────────────── */
const STATUS_CFG = {
  ACTIVE:   { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  INACTIVE: { badge: "bg-slate-100 text-slate-600 border-slate-200",     dot: "bg-slate-400"   },
  PENDING:  { badge: "bg-amber-50 text-amber-700 border-amber-200",      dot: "bg-amber-500"   },
};

const JOB_STATUS_CFG: Record<string, string> = {
  SCHEDULED:   "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  COMPLETED:   "bg-emerald-50 text-emerald-700",
  OVERDUE:     "bg-rose-50 text-rose-700",
};

const INV_STATUS_CFG: Record<string, string> = {
  UNPAID:  "bg-amber-50 text-amber-700",
  PAID:    "bg-emerald-50 text-emerald-700",
  OVERDUE: "bg-rose-50 text-rose-700",
};

function fmt(iso: string) {
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}
function money(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}
function humanize(s: string) {
  return s.toLowerCase().split("_").map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
}

/* ── Asset Form Modal ────────────────────────────────────────── */
type AssetForm = { unit_number: string; location: string; model: string; serial_number: string; install_date: string; notes: string };
const emptyForm: AssetForm = { unit_number: "", location: "", model: "", serial_number: "", install_date: "", notes: "" };

function AssetModal({
  clientId, asset, onClose, onSaved,
}: {
  clientId: string;
  asset: Asset | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AssetForm>(asset ? {
    unit_number: asset.unit_number,
    location: asset.location ?? "",
    model: asset.model ?? "",
    serial_number: asset.serial_number ?? "",
    install_date: asset.install_date ?? "",
    notes: asset.notes ?? "",
  } : emptyForm);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof AssetForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.unit_number.trim()) return toast.error("Unit number is required");
    setSaving(true);
    const payload = {
      client_id: clientId,
      unit_number: form.unit_number.trim(),
      location: form.location || null,
      model: form.model || null,
      serial_number: form.serial_number || null,
      install_date: form.install_date || null,
      notes: form.notes || null,
    };
    const { error } = asset
      ? await supabase.from("client_assets").update(payload).eq("id", asset.id)
      : await supabase.from("client_assets").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(asset ? "Asset updated" : "Asset added");
    onSaved();
    onClose();
  };

  const fields: { key: keyof AssetForm; label: string; type?: string; placeholder: string }[] = [
    { key: "unit_number",   label: "Unit Number *",   placeholder: "e.g. ESC-01" },
    { key: "location",      label: "Location",        placeholder: "e.g. Level 2, North Wing" },
    { key: "model",         label: "Model",           placeholder: "e.g. Otis 508A" },
    { key: "serial_number", label: "Serial Number",   placeholder: "e.g. SN-123456" },
    { key: "install_date",  label: "Install Date",    type: "date", placeholder: "" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{asset ? "Edit Asset" : "Add Escalator Unit"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
              <input
                type={f.type ?? "text"}
                value={form[f.key]}
                onChange={set(f.key)}
                placeholder={f.placeholder}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={set("notes")}
              rows={2}
              placeholder="Any relevant notes about this unit…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 border border-slate-200">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : asset ? "Save Changes" : "Add Unit"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient]   = useState<Client | null>(null);
  const [assets, setAssets]   = useState<Asset[]>([]);
  const [jobs, setJobs]       = useState<Job[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<Tab>("overview");
  const [assetModal, setAssetModal] = useState<{ open: boolean; asset: Asset | null }>({ open: false, asset: null });

  const fetchClient  = async () => { const { data } = await supabase.from("clients").select("*").eq("id", id).single(); if (data) setClient(data as Client); };
  const fetchAssets  = async () => { const { data } = await supabase.from("client_assets").select("*").eq("client_id", id).order("unit_number"); if (data) setAssets(data as Asset[]); };
  const fetchJobs    = async () => { const { data } = await supabase.from("jobs").select("id, title, status, scheduled_at, assigned_to_name, site_name").eq("client_id", id).order("scheduled_at", { ascending: false }); if (data) setJobs(data as Job[]); };
  const fetchInvoices = async () => { const { data } = await supabase.from("invoices").select("id, invoice_number, amount, status, issued_at, due_at").eq("client_id", id).order("created_at", { ascending: false }); if (data) setInvoices(data as Invoice[]); };

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchClient(), fetchAssets(), fetchJobs(), fetchInvoices()]);
      setLoading(false);
    };
    init();
  }, [id]);

  const deleteAsset = async (assetId: string) => {
    if (!confirm("Delete this unit?")) return;
    const { error } = await supabase.from("client_assets").delete().eq("id", assetId);
    if (error) { toast.error(error.message); return; }
    toast.success("Unit deleted");
    fetchAssets();
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="h-8 w-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" /></div>;
  if (!client) return <div className="p-8 text-slate-500">Client not found.</div>;

  const statusCfg = STATUS_CFG[client.status] ?? STATUS_CFG.INACTIVE;

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "overview",  label: "Overview" },
    { key: "assets",    label: "Assets",   count: assets.length },
    { key: "jobs",      label: "Jobs",     count: jobs.length },
    { key: "invoices",  label: "Invoices", count: invoices.length },
  ];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Clients
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
            {client.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{client.name}</h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusCfg.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                {client.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
              {client.contact_person && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{client.contact_person}</span>}
              {client.phone         && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
              {client.address       && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{client.address}</span>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-5 border-b border-slate-200 -mb-px">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tab === t.key ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-4 md:p-8 max-w-5xl mx-auto">

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div className="grid gap-5 md:grid-cols-3">
            {/* Stats */}
            {[
              { label: "Total Units",      value: assets.length,                                           icon: <Package className="h-5 w-5 text-blue-500" /> },
              { label: "Total Jobs",       value: jobs.length,                                              icon: <Calendar className="h-5 w-5 text-violet-500" /> },
              { label: "Completed Jobs",   value: jobs.filter((j) => j.status === "COMPLETED").length,     icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">{s.icon}</div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">{s.value}</p>
                </div>
              </div>
            ))}

            {/* Contact details */}
            <div className="md:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Contact Information</h3>
              <dl className="grid sm:grid-cols-2 gap-4 text-sm">
                {[
                  { label: "Contact Person", value: client.contact_person },
                  { label: "Email",          value: client.email },
                  { label: "Phone",          value: client.phone },
                  { label: "Address",        value: client.address },
                  { label: "Company Type",   value: client.company_type },
                  { label: "Client Since",   value: fmt(client.created_at) },
                ].map((f) => (
                  <div key={f.label}>
                    <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{f.label}</dt>
                    <dd className="mt-0.5 text-slate-900">{f.value ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Recent jobs teaser */}
            {jobs.slice(0, 3).length > 0 && (
              <div className="md:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Recent Jobs</h3>
                  <button onClick={() => setTab("jobs")} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                    View all <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="divide-y divide-slate-50">
                  {jobs.slice(0, 3).map((j) => (
                    <div key={j.id} className="px-5 py-3.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{j.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{fmt(j.scheduled_at)}</p>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${JOB_STATUS_CFG[j.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {humanize(j.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ASSETS ── */}
        {tab === "assets" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Escalator Units</h2>
                <p className="text-sm text-slate-400 mt-0.5">All registered units for {client.name}</p>
              </div>
              <button
                onClick={() => setAssetModal({ open: true, asset: null })}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Unit
              </button>
            </div>

            {assets.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <Package className="h-10 w-10 opacity-30" />
                <p className="text-sm">No escalator units registered yet</p>
                <button
                  onClick={() => setAssetModal({ open: true, asset: null })}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Add the first unit
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {assets.map((asset) => (
                  <div key={asset.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <RefreshCw className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex gap-1 ml-auto">
                        <button
                          onClick={() => setAssetModal({ open: true, asset })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteAsset(asset.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{asset.unit_number}</p>
                      {asset.location && <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" />{asset.location}</p>}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      {[
                        { label: "Model",         value: asset.model },
                        { label: "Serial No.",    value: asset.serial_number },
                        { label: "Installed",     value: asset.install_date ? fmt(asset.install_date) : null },
                      ].map((f) => f.value && (
                        <div key={f.label}>
                          <dt className="text-slate-400">{f.label}</dt>
                          <dd className="font-medium text-slate-700 mt-0.5">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                    {asset.notes && <p className="text-xs text-slate-400 italic border-t border-slate-100 pt-2">{asset.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── JOBS ── */}
        {tab === "jobs" && (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-900">Job History</h2>
            {jobs.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                <Clock className="h-8 w-8 opacity-30" />
                <p className="text-sm">No jobs for this client yet</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      <th className="px-5 py-3 text-left">Job</th>
                      <th className="px-5 py-3 text-left">Site</th>
                      <th className="px-5 py-3 text-left">Date</th>
                      <th className="px-5 py-3 text-left">Assigned To</th>
                      <th className="px-5 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {jobs.map((j) => (
                      <tr key={j.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{j.title}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">{j.site_name ?? "—"}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">{fmt(j.scheduled_at)}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">{j.assigned_to_name ?? "Unassigned"}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${JOB_STATUS_CFG[j.status] ?? "bg-slate-100 text-slate-600"}`}>
                            {humanize(j.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── INVOICES ── */}
        {tab === "invoices" && (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-900">Invoices</h2>
            {invoices.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                <FileText className="h-8 w-8 opacity-30" />
                <p className="text-sm">No invoices for this client yet</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      <th className="px-5 py-3 text-left">Invoice #</th>
                      <th className="px-5 py-3 text-left">Issued</th>
                      <th className="px-5 py-3 text-left">Due</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                      <th className="px-5 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-sm font-semibold text-slate-900">{inv.invoice_number}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">{fmt(inv.issued_at)}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">{inv.due_at ? fmt(inv.due_at) : "—"}</td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-900 text-right">{money(inv.amount)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${INV_STATUS_CFG[inv.status] ?? "bg-slate-100 text-slate-600"}`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Asset modal */}
      {assetModal.open && (
        <AssetModal
          clientId={client.id}
          asset={assetModal.asset}
          onClose={() => setAssetModal({ open: false, asset: null })}
          onSaved={fetchAssets}
        />
      )}
    </div>
  );
}
