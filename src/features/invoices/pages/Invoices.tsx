import { useEffect, useState, useMemo } from "react";
import {
  AlertCircle, CheckCircle2, Clock, Download,
  FileText, Plus, Search, XCircle,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import jsPDF from "jspdf";

/* ── Types ──────────────────────────────────────────────────── */
type InvoiceStatus = "UNPAID" | "PAID" | "OVERDUE";

type Invoice = {
  id: string;
  invoice_number: string;
  job_id: string | null;
  client_id: string | null;
  client_name: string;
  job_title: string;
  amount: number;
  status: InvoiceStatus;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  notes: string | null;
};

type Job = {
  id: string;
  title: string;
  client_name: string;
  client_id: string | null;
  flat_rate: number | null;
  status: string;
  scheduled_at: string;
};

/* ── Helpers ─────────────────────────────────────────────────── */
const STATUS_CFG: Record<InvoiceStatus, { label: string; badge: string; icon: React.ReactNode }> = {
  UNPAID:  { label: "Unpaid",  badge: "bg-amber-50 text-amber-700 border-amber-200",   icon: <Clock className="h-3 w-3" /> },
  PAID:    { label: "Paid",    badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  OVERDUE: { label: "Overdue", badge: "bg-rose-50 text-rose-700 border-rose-200",      icon: <AlertCircle className="h-3 w-3" /> },
};

function fmt(iso: string) {
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}
function money(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

/* ── PDF generator ───────────────────────────────────────────── */
function downloadInvoicePDF(inv: Invoice) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 20;

  // Header bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", M, 22);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Statewide Escalator Operations", M, 32);

  // Invoice number + status (top right)
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(inv.invoice_number, W - M, 18, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 210, 230);
  doc.text(`Status: ${inv.status}`, W - M, 26, { align: "right" });
  doc.text(`Issued: ${fmt(inv.issued_at)}`, W - M, 33, { align: "right" });

  // Body
  doc.setTextColor(15, 23, 42);
  let y = 56;

  // Bill To
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("BILL TO", M, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(inv.client_name, M, y);
  y += 6;

  // Job details box
  y += 4;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(M, y, W - M * 2, 28, 3, 3, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("JOB DESCRIPTION", M + 6, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(inv.job_title || "Escalator Service", M + 6, y + 16);
  if (inv.due_at) {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Due: ${fmt(inv.due_at)}`, M + 6, y + 23);
  }
  y += 36;

  // Line items table header
  doc.setFillColor(226, 232, 240);
  doc.rect(M, y, W - M * 2, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("DESCRIPTION", M + 4, y + 5.5);
  doc.text("AMOUNT", W - M - 4, y + 5.5, { align: "right" });
  y += 8;

  // Line item
  doc.setFillColor(255, 255, 255);
  doc.rect(M, y, W - M * 2, 10, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(inv.job_title || "Service", M + 4, y + 7);
  doc.text(money(inv.amount), W - M - 4, y + 7, { align: "right" });
  y += 10;

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(M, y, W - M, y);
  y += 8;

  // Total
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(W - M - 60, y, 60, 14, 2, 2, "F");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", W - M - 56, y + 6);
  doc.setFontSize(11);
  doc.text(money(inv.amount), W - M - 4, y + 9.5, { align: "right" });
  y += 22;

  // Notes
  if (inv.notes) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("NOTES", M, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(inv.notes, M, y, { maxWidth: W - M * 2 });
    y += 10;
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.text("Thank you for your business. Payment due within 30 days of issue.", W / 2, 280, { align: "center" });
  doc.text("Statewide Escalator Operations  ·  ABN 00 000 000 000", W / 2, 285, { align: "center" });

  doc.save(`${inv.invoice_number}.pdf`);
}

/* ── Create Invoice Modal ────────────────────────────────────── */
function CreateInvoiceModal({
  jobs, onClose, onCreated,
}: {
  jobs: Job[];
  onClose: () => void;
  onCreated: () => void;
}) {
  // Show ALL completed jobs — not just those with a flat_rate
  const completedJobs = jobs.filter((j) => j.status === "COMPLETED");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedJob = completedJobs.find((j) => j.id === selectedJobId);

  // Pre-fill amount from flat_rate when job changes
  const handleJobSelect = (id: string) => {
    setSelectedJobId(id);
    const job = completedJobs.find((j) => j.id === id);
    if (job?.flat_rate) setAmount(String(job.flat_rate));
    else setAmount("");
  };

  const handleCreate = async () => {
    if (!selectedJob) return toast.error("Select a job");
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) return toast.error("Enter a valid amount");
    setSaving(true);

    // Get next invoice number from DB function
    const { data: numData, error: numErr } = await supabase.rpc("next_invoice_number");
    if (numErr) { toast.error("Could not generate invoice number"); setSaving(false); return; }

    const { error } = await supabase.from("invoices").insert({
      invoice_number: numData as string,
      job_id: selectedJob.id,
      client_id: selectedJob.client_id,
      client_name: selectedJob.client_name,
      job_title: selectedJob.title,
      amount: parsedAmount,
      status: "UNPAID",
      issued_at: new Date().toISOString(),
      due_at: dueDate ? new Date(dueDate).toISOString() : null,
      notes: notes || null,
    });

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Invoice created");
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Create Invoice</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Completed Job</label>
            <select
              value={selectedJobId}
              onChange={(e) => handleJobSelect(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select a completed job —</option>
              {completedJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} · {j.client_name}{j.flat_rate ? ` · ${money(j.flat_rate)}` : ""}
                </option>
              ))}
            </select>
            {completedJobs.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">No completed jobs found.</p>
            )}
          </div>

          {selectedJob && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm space-y-1">
              <p className="font-medium text-slate-900">{selectedJob.title}</p>
              <p className="text-slate-500">{selectedJob.client_name}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount (AUD) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {selectedJob?.flat_rate && parseFloat(amount) !== selectedJob.flat_rate && (
              <p className="mt-1 text-xs text-amber-600">Job flat rate is {money(selectedJob.flat_rate)} — you've changed the amount.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Payment instructions, account details…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 border border-slate-200">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !selectedJobId || !amount || isNaN(parseFloat(amount))}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────── */
export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | InvoiceStatus>("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [invRes, jobsRes] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("jobs").select("id, title, client_name, client_id, flat_rate, status, scheduled_at"),
    ]);
    setLoading(false);
    if (invRes.data) setInvoices(invRes.data as Invoice[]);
    if (jobsRes.data) setJobs(jobsRes.data as Job[]);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => invoices.filter((inv) => {
    const matchStatus = statusFilter === "ALL" || inv.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || inv.invoice_number.toLowerCase().includes(q) || inv.client_name.toLowerCase().includes(q) || inv.job_title.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  }), [invoices, statusFilter, search]);

  const totals = useMemo(() => ({
    unpaid: invoices.filter((i) => i.status === "UNPAID").reduce((s, i) => s + i.amount, 0),
    paid:   invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amount, 0),
    overdue: invoices.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + i.amount, 0),
    count:  { unpaid: invoices.filter((i) => i.status === "UNPAID").length, paid: invoices.filter((i) => i.status === "PAID").length, overdue: invoices.filter((i) => i.status === "OVERDUE").length },
  }), [invoices]);

  const markPaid = async (id: string) => {
    setMarkingPaid(id);
    const { error } = await supabase.from("invoices").update({ status: "PAID", paid_at: new Date().toISOString() }).eq("id", id);
    setMarkingPaid(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as paid");
    fetchAll();
  };

  const markOverdue = async (id: string) => {
    const { error } = await supabase.from("invoices").update({ status: "OVERDUE" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as overdue");
    fetchAll();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 xl:p-8 space-y-6">

      {/* Header */}
      <section className="rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 p-6 md:p-8 text-white shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-slate-300">Finance</p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Invoices</h1>
            <p className="mt-2 text-sm text-slate-300">Track billing and payment status for all completed jobs.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 bg-white text-slate-900 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-blue-50 shadow-md transition-all"
          >
            <Plus className="h-4 w-4" /> New Invoice
          </button>
        </div>

        {/* Summary cards */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { label: "Outstanding", amount: totals.unpaid, count: totals.count.unpaid, color: "border-amber-400/40 bg-amber-400/10" },
            { label: "Paid",        amount: totals.paid,   count: totals.count.paid,   color: "border-emerald-400/40 bg-emerald-400/10" },
            { label: "Overdue",     amount: totals.overdue,count: totals.count.overdue, color: "border-rose-400/40 bg-rose-400/10" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border px-4 py-3 backdrop-blur-sm ${s.color}`}>
              <p className="text-xs text-slate-300 uppercase tracking-wide">{s.label}</p>
              <p className="mt-1 text-xl font-bold text-white">{money(s.amount)}</p>
              <p className="text-xs text-slate-400">{s.count} invoice{s.count !== 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Filters */}
      <div className="flex flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice #, client, job…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          {(["ALL", "UNPAID", "PAID", "OVERDUE"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                statusFilter === s
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {s === "ALL" ? "All" : STATUS_CFG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
            <div className="h-4 w-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
            Loading invoices…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-sm">No invoices found</p>
            <button onClick={() => setShowCreate(true)} className="text-sm text-blue-600 hover:underline">
              Create your first invoice
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Invoice #</th>
                  <th className="px-5 py-3 text-left">Client / Job</th>
                  <th className="hidden md:table-cell px-5 py-3 text-left">Issued</th>
                  <th className="hidden md:table-cell px-5 py-3 text-left">Due</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((inv) => {
                  const cfg = STATUS_CFG[inv.status];
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-mono text-sm font-semibold text-slate-900">{inv.invoice_number}</span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-900 truncate max-w-45">{inv.client_name}</p>
                        <p className="text-xs text-slate-400 truncate max-w-45">{inv.job_title}</p>
                        {/* Dates inline on mobile */}
                        <p className="md:hidden text-xs text-slate-400 mt-0.5">{fmt(inv.issued_at)}{inv.due_at ? ` → ${fmt(inv.due_at)}` : ""}</p>
                      </td>
                      <td className="hidden md:table-cell px-5 py-4 text-sm text-slate-600">{fmt(inv.issued_at)}</td>
                      <td className="hidden md:table-cell px-5 py-4 text-sm text-slate-600">{inv.due_at ? fmt(inv.due_at) : "—"}</td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">{money(inv.amount)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.badge}`}>
                          {cfg.icon}{cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {(inv.status === "UNPAID" || inv.status === "OVERDUE") && (
                            <>
                              <button
                                onClick={() => markPaid(inv.id)}
                                disabled={markingPaid === inv.id}
                                className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {markingPaid === inv.id ? "…" : "Mark Paid"}
                              </button>
                              {inv.status === "UNPAID" && (
                                <button
                                  onClick={() => markOverdue(inv.id)}
                                  className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg transition-colors"
                                >
                                  Overdue
                                </button>
                              )}
                            </>
                          )}
                          <button
                            onClick={() => downloadInvoicePDF(inv)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateInvoiceModal
          jobs={jobs}
          onClose={() => setShowCreate(false)}
          onCreated={fetchAll}
        />
      )}
    </div>
  );
}
