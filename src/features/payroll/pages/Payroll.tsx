import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import {
  Banknote, ChevronLeft, ChevronRight,
  Download, ExternalLink, FileText, Plus, RefreshCw,
  Upload, X,
} from "lucide-react";

/* ── Types ───────────────────────────────────────────────── */
type PayStatus = "DRAFT" | "ISSUED" | "PAID";

type PaymentRecord = {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  period_start: string;
  period_end: string;
  net_pay: number;
  notes: string | null;
  status: PayStatus;
  paid_at: string | null;
  payslip_url: string | null;
  created_at: string;
};

type Employee = { id: string; full_name: string | null; email: string };

/* ── Constants ───────────────────────────────────────────── */
const STATUS_STYLES: Record<PayStatus, string> = {
  DRAFT:  "bg-slate-50 text-slate-600 border-slate-200",
  ISSUED: "bg-blue-50 text-blue-700 border-blue-100",
  PAID:   "bg-emerald-50 text-emerald-700 border-emerald-100",
};

/* ── Helpers ─────────────────────────────────────────────── */
function fmtDate(d: string | Date) {
  return new Date(d instanceof Date ? d : d + "T00:00:00").toLocaleDateString("en-AU", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function fmtAUD(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

/** Monday of the ISO week containing date d */
function isoWeekStart(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=Sun…6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
/** Sunday of the ISO week */
function isoWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addWeeks(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n * 7);
  return copy;
}

/** ISO week number */
function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function weekLabel(weekStart: Date): string {
  const end = isoWeekEnd(weekStart);
  const wn = isoWeekNumber(weekStart);
  const startStr = weekStart.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  const endStr   = end.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  return `Week ${wn} · ${startStr} – ${endStr}`;
}

/* ── Create Pay Run Modal ─────────────────────────────────── */
type CreateModalProps = {
  open: boolean;
  adminId: string;
  onClose: () => void;
  onSaved: () => void;
};

function CreatePayRunModal({ open, adminId, onClose, onSaved }: CreateModalProps) {
  const [employees,    setEmployees]   = useState<Employee[]>([]);
  const [selectedEmp,  setSelectedEmp] = useState("");
  /* Default to current ISO week start */
  const [weekStart,    setWeekStart]   = useState(() => isoDate(isoWeekStart(new Date())));
  const [amount,       setAmount]      = useState("");
  const [notes,        setNotes]       = useState("");
  const [file,         setFile]        = useState<File | null>(null);
  const [saving,       setSaving]      = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedEmp(""); setAmount(""); setNotes(""); setFile(null);
    setWeekStart(isoDate(isoWeekStart(new Date())));
    supabase.from("profiles").select("id, full_name, email")
      .eq("status", "ACTIVE").eq("role", "EMPLOYEE").order("full_name")
      .then(({ data }) => setEmployees((data ?? []) as Employee[]));
  }, [open]);

  if (!open) return null;

  /* Snap weekStart input to the Monday of whichever week the user picks */
  const handleWeekInput = (val: string) => {
    if (!val) return;
    const d = new Date(val + "T00:00:00");
    setWeekStart(isoDate(isoWeekStart(d)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) { toast.error("Select an employee."); return; }

    setSaving(true);

    const wStart = new Date(weekStart + "T00:00:00");
    const wEnd   = isoWeekEnd(wStart);
    const netPay = parseFloat(amount) || 0;

    let payslipUrl: string | null = null;

    /* Upload PDF if provided */
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${adminId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from("payslips").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (upErr) { toast.error("PDF upload failed: " + upErr.message); setSaving(false); return; }
      const { data: urlData } = supabase.storage.from("payslips").getPublicUrl(path);
      payslipUrl = urlData?.publicUrl ?? null;
    }

    const { error } = await supabase.from("employee_payments").insert({
      employee_id:  selectedEmp,
      period_start: isoDate(wStart),
      period_end:   isoDate(wEnd),
      hours_worked: 0,
      hourly_rate:  0,
      gross_pay:    netPay,
      deductions:   0,
      net_pay:      netPay,
      notes:        notes.trim() || null,
      status:       "DRAFT",
      created_by:   adminId,
      payslip_url:  payslipUrl,
    });

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pay run created.");
    onSaved(); onClose();
  };

  const previewWeek = weekStart
    ? weekLabel(new Date(weekStart + "T00:00:00"))
    : "Select a date to see the week";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Create Pay Run</h2>
            <p className="text-xs text-slate-500 mt-0.5">Upload the payslip PDF and record the amount</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Employee */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
            <select value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)} required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.full_name ?? emp.email}</option>
              ))}
            </select>
          </div>

          {/* Week picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pay Week *</label>
            <input type="date" value={weekStart} onChange={(e) => handleWeekInput(e.target.value)} required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {weekStart && (
              <p className="text-xs text-indigo-600 font-medium mt-1.5 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {previewWeek}
              </p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Net Pay Amount (AUD) <span className="text-xs font-normal text-slate-400">— optional</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" min="0" step="0.01" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* PDF upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Payslip PDF <span className="text-xs font-normal text-slate-400">— optional</span>
            </label>
            {file ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50">
                <FileText className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-sm font-medium text-emerald-800 truncate flex-1">{file.name}</span>
                <button type="button" onClick={() => setFile(null)}
                  className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
                <Upload className="h-6 w-6 text-slate-400" />
                <span className="text-sm text-slate-500">Click to upload PDF</span>
                <span className="text-xs text-slate-400">PDF only — max 10 MB</span>
                <input type="file" accept="application/pdf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
              </label>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes <span className="text-xs font-normal text-slate-400">— optional</span>
            </label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Bonus included, leave payout…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Saving…" : "Create Pay Run"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */
export default function Payroll() {
  const [payments,    setPayments]   = useState<PaymentRecord[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [isAdmin,     setIsAdmin]    = useState(false);
  const [userId,      setUserId]     = useState<string | null>(null);
  const [showCreate,  setShowCreate] = useState(false);

  /* ISO week navigation — default to current week */
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => isoWeekStart(new Date()));
  const currentWeekEnd = isoWeekEnd(currentWeekStart);

  const load = useCallback(async (uid: string, admin: boolean) => {
    setLoading(true);
    const query = admin
      ? supabase.from("employee_payments").select("*").order("period_start", { ascending: false })
      : supabase.from("employee_payments").select("*").eq("employee_id", uid).in("status", ["ISSUED", "PAID"]).order("period_start", { ascending: false });

    const { data: pData, error } = await query;
    if (error) { toast.error(error.message); setLoading(false); return; }

    let nameMap: Record<string, { name: string; email: string }> = {};
    if (pData && pData.length > 0) {
      const ids = [...new Set(pData.map((p) => p.employee_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, { name: p.full_name ?? p.email, email: p.email }]));
    }

    setPayments((pData ?? []).map((p) => ({
      ...p,
      employee_name:  nameMap[p.employee_id]?.name  ?? "Unknown",
      employee_email: nameMap[p.employee_id]?.email ?? "",
    })));
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) return;
      setUserId(uid);
      supabase.from("profiles").select("role").eq("id", uid).single().then(({ data: p }) => {
        const admin = p?.role === "ADMIN";
        setIsAdmin(admin);
        load(uid, admin);
      });
    });
  }, [load]);

  /* Filter to the current ISO week */
  const filtered = useMemo(() => {
    const startKey = isoDate(currentWeekStart);
    const endKey   = isoDate(currentWeekEnd);
    return payments.filter((p) => p.period_start >= startKey && p.period_start <= endKey);
  }, [payments, currentWeekStart, currentWeekEnd]);

  const stats = useMemo(() => ({
    draft:     payments.filter((p) => p.status === "DRAFT").length,
    issued:    payments.filter((p) => p.status === "ISSUED").length,
    paid:      payments.filter((p) => p.status === "PAID").length,
    totalPaid: payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.net_pay, 0),
  }), [payments]);

  const handleStatusChange = async (id: string, newStatus: PayStatus) => {
    const update: Record<string, unknown> = { status: newStatus };
    if (newStatus === "PAID") update.paid_at = new Date().toISOString();
    const { error } = await supabase.from("employee_payments").update(update).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Pay run marked as ${newStatus.toLowerCase()}.`);
    setPayments((prev) => prev.map((p) =>
      p.id === id ? { ...p, status: newStatus, paid_at: newStatus === "PAID" ? new Date().toISOString() : p.paid_at } : p
    ));
  };

  const handleDownload = async (p: PaymentRecord) => {
    if (!p.payslip_url) { toast.error("No payslip PDF attached."); return; }
    window.open(p.payslip_url, "_blank");
  };

  const reload = () => { if (userId) load(userId, isAdmin); };

  const isCurrentWeek = isoDate(currentWeekStart) === isoDate(isoWeekStart(new Date()));

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 xl:p-8 space-y-6">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 text-white shadow-xl p-6 md:p-8">
        <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-24 h-40 w-40 rounded-full bg-indigo-500/15 blur-2xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
              {isAdmin ? "Payroll Management" : "My Pay"}
            </p>
            <h1 className="mt-2 text-2xl md:text-3xl font-extrabold flex items-center gap-3">
              <Banknote className="h-7 w-7" />
              {isAdmin ? "Payroll" : "My Pay History"}
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              {isAdmin
                ? "Upload payslips, issue weekly pay runs, and track payments."
                : "View and download your issued payslips."}
            </p>
          </div>
          <div className={`grid gap-2 ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}>
            {isAdmin ? (
              <>
                {[
                  { label: "Draft",      value: stats.draft,             color: "text-slate-300" },
                  { label: "Issued",     value: stats.issued,            color: "text-blue-300" },
                  { label: "Paid",       value: stats.paid,              color: "text-emerald-300" },
                  { label: "Total Paid", value: fmtAUD(stats.totalPaid), color: "text-emerald-300", small: true },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/15 bg-white/10 px-2 py-2 md:px-4 md:py-3 backdrop-blur-sm text-center">
                    <p className={`text-[10px] md:text-xs uppercase tracking-wide ${s.color}`}>{s.label}</p>
                    <p className={`mt-1 font-bold text-white ${s.small ? "text-xs md:text-sm" : "text-lg md:text-2xl"}`}>{s.value}</p>
                  </div>
                ))}
              </>
            ) : (
              <>
                {[
                  { label: "Issued",    value: stats.issued,             color: "text-blue-300" },
                  { label: "Paid",      value: stats.paid,               color: "text-emerald-300" },
                  { label: "Total",     value: fmtAUD(stats.totalPaid),  color: "text-emerald-300", small: true },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/15 bg-white/10 px-2 py-2 md:px-4 md:py-3 backdrop-blur-sm text-center">
                    <p className={`text-[10px] md:text-xs uppercase tracking-wide ${s.color}`}>{s.label}</p>
                    <p className={`mt-1 font-bold text-white ${s.small ? "text-xs md:text-sm" : "text-lg md:text-2xl"}`}>{s.value}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3 justify-between">

        {/* Week navigator */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
          <button
            onClick={() => setCurrentWeekStart((d) => addWeeks(d, -1))}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-600">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-slate-900 min-w-64 text-center">
            {weekLabel(currentWeekStart)}
          </span>
          <button
            onClick={() => setCurrentWeekStart((d) => addWeeks(d, 1))}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-600">
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isCurrentWeek && (
            <button
              onClick={() => setCurrentWeekStart(isoWeekStart(new Date()))}
              className="text-xs text-blue-600 font-medium hover:underline ml-1">
              This week
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={reload} disabled={loading}
            className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-xl text-sm font-medium shadow-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {isAdmin && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition-colors">
              <Plus className="h-4 w-4" /> Create Pay Run
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">
            {filtered.length} pay {filtered.length === 1 ? "run" : "runs"} — {weekLabel(currentWeekStart)}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                {isAdmin && (
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</th>
                )}
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Pay Week</th>
                <th className="hidden md:table-cell px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                <th className="hidden md:table-cell px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Payslip</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">Loading payroll…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Banknote className="h-8 w-8 opacity-30" />
                      <p className="text-sm">
                        {payments.length === 0
                          ? "No pay runs yet — create the first one."
                          : `No pay runs for ${weekLabel(currentWeekStart)}.`}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  {isAdmin && (
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-slate-900">{p.employee_name}</p>
                      <p className="text-xs text-slate-400">{p.employee_email}</p>
                    </td>
                  )}
                  <td className="px-5 py-4 text-sm text-slate-700">
                    <p className="font-medium">{fmtDate(p.period_start)}</p>
                    <p className="text-slate-400 text-xs">→ {fmtDate(p.period_end)}</p>
                    {/* Amount shown inline on mobile only */}
                    {p.net_pay > 0 && (
                      <p className="md:hidden text-xs font-bold text-emerald-700 mt-0.5">{fmtAUD(p.net_pay)}</p>
                    )}
                  </td>
                  <td className="hidden md:table-cell px-5 py-4">
                    {p.net_pay > 0
                      ? <span className="text-sm font-bold text-emerald-700">{fmtAUD(p.net_pay)}</span>
                      : <span className="text-xs text-slate-400">—</span>
                    }
                    {p.notes && <p className="text-xs text-slate-400 mt-0.5 max-w-[180px] truncate">{p.notes}</p>}
                  </td>
                  <td className="hidden md:table-cell px-5 py-4">
                    {p.payslip_url ? (
                      <button
                        onClick={() => handleDownload(p)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-100 px-2.5 py-1.5 rounded-lg transition-colors">
                        <Download className="h-3.5 w-3.5" /> PDF
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">No PDF</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status]}`}>
                      {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                    </span>
                    {p.status === "PAID" && p.paid_at && (
                      <p className="text-xs text-slate-400 mt-0.5">{fmtDate(p.paid_at)}</p>
                    )}
                    {/* PDF button shown inline on mobile only */}
                    {p.payslip_url && (
                      <button
                        onClick={() => handleDownload(p)}
                        className="md:hidden mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800">
                        <Download className="h-3 w-3" /> PDF
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        {p.status === "DRAFT" && (
                          <button
                            onClick={() => handleStatusChange(p.id, "ISSUED")}
                            title="Issue to employee"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-colors">
                            Issue
                          </button>
                        )}
                        {p.status === "ISSUED" && (
                          <button
                            onClick={() => handleStatusChange(p.id, "PAID")}
                            title="Mark as paid"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition-colors">
                            <Banknote className="h-3.5 w-3.5" /> Paid
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Create Modal ── */}
      {userId && isAdmin && (
        <CreatePayRunModal
          open={showCreate}
          adminId={userId}
          onClose={() => setShowCreate(false)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
