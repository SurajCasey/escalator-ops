import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import { jsPDF } from "jspdf";
import {
  Banknote, CheckCircle2, ChevronLeft, ChevronRight,
  Download, Plus, RefreshCw, X,
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
  hours_worked: number;
  hourly_rate: number;
  gross_pay: number;
  deductions: number;
  net_pay: number;
  notes: string | null;
  status: PayStatus;
  paid_at: string | null;
  created_at: string;
};

type Employee = { id: string; full_name: string | null; email: string; hourly_rate: number };

/* ── Constants ───────────────────────────────────────────── */
const STATUS_STYLES: Record<PayStatus, string> = {
  DRAFT:  "bg-slate-50 text-slate-600 border-slate-200",
  ISSUED: "bg-blue-50 text-blue-700 border-blue-100",
  PAID:   "bg-emerald-50 text-emerald-700 border-emerald-100",
};

/* ── Helpers ─────────────────────────────────────────────── */
function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtAUD(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}
function fmtMins(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

/* ── PDF Generator ───────────────────────────────────────── */
function downloadPayslip(p: PaymentRecord) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 20;
  const BLUE: [number, number, number] = [37, 99, 235];
  const DARK: [number, number, number] = [30, 41, 59];
  const MID:  [number, number, number] = [100, 116, 139];
  const LIGHT:[number, number, number] = [241, 245, 249];
  const WHITE:[number, number, number] = [255, 255, 255];
  const GREEN:[number, number, number] = [34, 197, 94];

  // Header band
  pdf.setFillColor(DARK[0], DARK[1], DARK[2]);
  pdf.rect(0, 0, W, 44, "F");
  pdf.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("PAY SLIP", M, 20);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(MID[0] + 40, MID[1] + 40, MID[2] + 40);
  pdf.text("Statewide Escalator Cleaning Pty Ltd", W - M, 12, { align: "right" });
  pdf.text(`Issued ${fmtDate(new Date())}`, W - M, 20, { align: "right" });
  pdf.text(`Status: ${p.status}`, W - M, 28, { align: "right" });

  let y = 58;

  // Employee details
  pdf.setTextColor(DARK[0], DARK[1], DARK[2]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(p.employee_name, M, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(MID[0], MID[1], MID[2]);
  y += 6;
  pdf.text(p.employee_email, M, y);
  y += 5;
  pdf.text(`Pay Period:  ${fmtDate(p.period_start)}  –  ${fmtDate(p.period_end)}`, M, y);

  y += 16;

  // Summary boxes
  const boxes = [
    { label: "Hours Worked", value: `${p.hours_worked.toFixed(2)}h` },
    { label: "Hourly Rate",  value: p.hourly_rate > 0 ? fmtAUD(p.hourly_rate) + "/hr" : "Flat" },
    { label: "Gross Pay",    value: fmtAUD(p.gross_pay) },
    { label: "Deductions",   value: fmtAUD(p.deductions) },
  ];
  const bW = (W - M * 2 - 9) / 4;
  boxes.forEach((b, i) => {
    const bx = M + i * (bW + 3);
    pdf.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2]);
    pdf.roundedRect(bx, y, bW, 20, 2, 2, "F");
    pdf.setTextColor(MID[0], MID[1], MID[2]);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(b.label, bx + 3, y + 6);
    pdf.setTextColor(DARK[0], DARK[1], DARK[2]);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(b.value, bx + 3, y + 15);
  });

  y += 28;

  // Net pay highlight
  pdf.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  pdf.roundedRect(M, y, W - M * 2, 18, 3, 3, "F");
  pdf.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("NET PAY", M + 5, y + 12);
  pdf.setFontSize(14);
  pdf.text(fmtAUD(p.net_pay), W - M - 5, y + 12, { align: "right" });

  y += 28;

  if (p.notes) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.setTextColor(MID[0], MID[1], MID[2]);
    pdf.text(`Note: ${p.notes}`, M, y);
    y += 10;
  }

  // Paid stamp
  if (p.status === "PAID" && p.paid_at) {
    y += 4;
    pdf.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
    pdf.roundedRect(M, y, 60, 10, 2, 2, "F");
    pdf.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(`PAID  ${fmtDate(p.paid_at)}`, M + 4, y + 7);
    y += 16;
  }

  y += 14;

  // Signature lines
  pdf.setDrawColor(MID[0], MID[1], MID[2]);
  pdf.setLineWidth(0.3);
  pdf.line(M, y, M + 70, y);
  pdf.line(M + 100, y, M + 170, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(MID[0], MID[1], MID[2]);
  pdf.text("Employee Signature", M, y + 5);
  pdf.text("Employer Signature", M + 100, y + 5);

  // Footer
  pdf.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2]);
  pdf.rect(0, 284, W, 14, "F");
  pdf.setFontSize(6.5);
  pdf.text("Statewide Escalator Cleaning Pty Ltd  –  Confidential Payroll Document", W / 2, 291, { align: "center" });

  pdf.save(`Payslip_${p.employee_name.replace(/ /g, "_")}_${p.period_start}.pdf`);
}

/* ── Create Pay Run Modal (admin) ────────────────────────── */
type CreateModalProps = {
  open: boolean;
  adminId: string;
  onClose: () => void;
  onSaved: () => void;
};

function CreatePayRunModal({ open, adminId, onClose, onSaved }: CreateModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState("");
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date(); d.setDate(1); return isoDate(d);
  });
  const [periodEnd, setPeriodEnd] = useState(() => isoDate(new Date()));
  const [hoursWorked, setHoursWorked] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [deductions, setDeductions] = useState("0");
  const [notes, setNotes] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedEmp(""); setHoursWorked(""); setDeductions("0"); setNotes("");
    const d = new Date(); d.setDate(1);
    setPeriodStart(isoDate(d));
    setPeriodEnd(isoDate(new Date()));
    supabase.from("profiles").select("id, full_name, email, hourly_rate").eq("status", "ACTIVE").order("full_name")
      .then(({ data }) => {
        setEmployees((data ?? []) as Employee[]);
      });
  }, [open]);

  if (!open) return null;

  const selectedEmployee = employees.find((e) => e.id === selectedEmp);

  // Auto-calculate hours from time_entries
  const handleCalculate = async () => {
    if (!selectedEmp || !periodStart || !periodEnd) { toast.error("Select employee and period first."); return; }
    setCalculating(true);
    const { data } = await supabase
      .from("time_entries")
      .select("duration_minutes")
      .eq("user_id", selectedEmp)
      .gte("clock_in", periodStart + "T00:00:00")
      .lte("clock_in", periodEnd + "T23:59:59");
    const totalMins = (data ?? []).reduce((s: number, e: { duration_minutes: number | null }) => s + (e.duration_minutes ?? 0), 0);
    setHoursWorked((totalMins / 60).toFixed(2));
    if (selectedEmployee?.hourly_rate) setHourlyRate(String(selectedEmployee.hourly_rate));
    setCalculating(false);
    toast.success(`Found ${fmtMins(totalMins)} of clock-in time.`);
  };

  const grossPay = (parseFloat(hoursWorked) || 0) * (parseFloat(hourlyRate) || 0);
  const netPay = grossPay - (parseFloat(deductions) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) { toast.error("Select an employee."); return; }
    const hrs = parseFloat(hoursWorked);
    const rate = parseFloat(hourlyRate);
    if (isNaN(hrs) || hrs < 0) { toast.error("Enter valid hours."); return; }
    if (isNaN(rate) || rate < 0) { toast.error("Enter valid hourly rate."); return; }

    setSaving(true);
    const gross = hrs * rate;
    const ded = parseFloat(deductions) || 0;
    const net = gross - ded;

    const { error } = await supabase.from("employee_payments").insert({
      employee_id: selectedEmp,
      period_start: periodStart,
      period_end: periodEnd,
      hours_worked: hrs,
      hourly_rate: rate,
      gross_pay: gross,
      deductions: ded,
      net_pay: net,
      notes: notes.trim() || null,
      status: "DRAFT",
      created_by: adminId,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pay run created.");
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-slate-900">Create Pay Run</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
            <select value={selectedEmp} onChange={(e) => { setSelectedEmp(e.target.value); const emp = employees.find((em) => em.id === e.target.value); if (emp?.hourly_rate) setHourlyRate(String(emp.hourly_rate)); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select employee…</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name ?? emp.email}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Period Start *</label>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Period End *</label>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <button type="button" onClick={handleCalculate} disabled={calculating || !selectedEmp}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-50 transition-colors">
            <RefreshCw className={`h-4 w-4 ${calculating ? "animate-spin" : ""}`} />
            {calculating ? "Calculating…" : "Auto-calculate hours from timesheets"}
          </button>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hours Worked *</label>
              <input type="number" min="0" step="0.01" value={hoursWorked} onChange={(e) => setHoursWorked(e.target.value)}
                placeholder="0.00" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hourly Rate (AUD) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="0.00" className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Pay preview */}
          {(parseFloat(hoursWorked) > 0 && parseFloat(hourlyRate) > 0) && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Gross Pay</span>
                <span className="font-semibold text-slate-900">{fmtAUD(grossPay)}</span>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Deductions</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                  <input type="number" min="0" step="0.01" value={deductions} onChange={(e) => setDeductions(e.target.value)}
                    className="w-full pl-6 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                </div>
              </div>
              <div className="flex justify-between text-sm pt-1 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Net Pay</span>
                <span className="font-bold text-emerald-600 text-base">{fmtAUD(netPay)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bonus, adjustment notes…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Creating…" : "Create Pay Run"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */
export default function Payroll() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<Date>(new Date());

  // Month navigation helpers
  const monthStart = useMemo(() => {
    const d = new Date(periodFilter); d.setDate(1); return d;
  }, [periodFilter]);
  const monthEnd = useMemo(() => {
    const d = new Date(periodFilter); d.setMonth(d.getMonth() + 1); d.setDate(0); return d;
  }, [periodFilter]);

  const load = useCallback(async (uid: string, admin: boolean) => {
    setLoading(true);
    const query = admin
      ? supabase.from("employee_payments").select("*").order("created_at", { ascending: false })
      : supabase.from("employee_payments").select("*").eq("employee_id", uid).in("status", ["ISSUED", "PAID"]).order("created_at", { ascending: false });

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
      employee_name: nameMap[p.employee_id]?.name ?? "Unknown",
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
        const admin = p?.role === "admin";
        setIsAdmin(admin);
        load(uid, admin);
      });
    });
  }, [load]);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const start = new Date(p.period_start);
      return start >= monthStart && start <= monthEnd;
    });
  }, [payments, monthStart, monthEnd]);

  const stats = useMemo(() => ({
    draft:  payments.filter((p) => p.status === "DRAFT").length,
    issued: payments.filter((p) => p.status === "ISSUED").length,
    paid:   payments.filter((p) => p.status === "PAID").length,
    totalPaid: payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.net_pay, 0),
  }), [payments]);

  const handleStatusChange = async (id: string, newStatus: PayStatus) => {
    const update: Record<string, unknown> = { status: newStatus };
    if (newStatus === "PAID") update.paid_at = new Date().toISOString();
    const { error } = await supabase.from("employee_payments").update(update).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Pay run marked as ${newStatus.toLowerCase()}.`);
    setPayments((prev) => prev.map((p) => p.id === id ? { ...p, status: newStatus, paid_at: newStatus === "PAID" ? new Date().toISOString() : p.paid_at } : p));
  };

  const reload = () => { if (userId) load(userId, isAdmin); };

  const monthLabel = periodFilter.toLocaleDateString("en-AU", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 xl:p-8 space-y-6">

      {/* Header */}
      <section className="rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 text-white p-6 md:p-8 shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-slate-300">{isAdmin ? "Payroll Management" : "My Pay"}</p>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold flex items-center gap-3">
              <Banknote className="h-7 w-7" />
              {isAdmin ? "Payroll" : "My Pay History"}
            </h1>
            <p className="mt-2 text-sm text-slate-200">
              {isAdmin ? "Create pay runs, issue payslips, and track payments." : "View your payslips and download pay records."}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {isAdmin ? (
              <>
                {[
                  { label: "Draft",  value: stats.draft,  color: "text-slate-300" },
                  { label: "Issued", value: stats.issued, color: "text-blue-300" },
                  { label: "Paid",   value: stats.paid,   color: "text-emerald-300" },
                  { label: "Total Paid", value: fmtAUD(stats.totalPaid), color: "text-emerald-300", small: true },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                    <p className={`text-xs uppercase tracking-wide ${s.color}`}>{s.label}</p>
                    <p className={`mt-1 font-bold text-white ${s.small ? "text-sm mt-2" : "text-2xl"}`}>{s.value}</p>
                  </div>
                ))}
              </>
            ) : (
              <>
                {[
                  { label: "Issued",  value: stats.issued, color: "text-blue-300" },
                  { label: "Paid",    value: stats.paid,   color: "text-emerald-300" },
                  { label: "Total Received", value: fmtAUD(stats.totalPaid), color: "text-emerald-300", small: true },
                ].map((s) => (
                  <div key={s.label} className="col-span-1 rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                    <p className={`text-xs uppercase tracking-wide ${s.color}`}>{s.label}</p>
                    <p className={`mt-1 font-bold text-white ${s.small ? "text-sm mt-2" : "text-2xl"}`}>{s.value}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
          <button onClick={() => setPeriodFilter((d) => addDays(new Date(d.getFullYear(), d.getMonth() - 1, 1), 0))}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-semibold text-slate-900 min-w-36 text-center">{monthLabel}</span>
          <button onClick={() => setPeriodFilter((d) => addDays(new Date(d.getFullYear(), d.getMonth() + 1, 1), 0))}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => setPeriodFilter(new Date())} className="text-xs text-blue-600 font-medium hover:underline ml-1">This month</button>
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

      {/* Table */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">
            {filtered.length} pay {filtered.length === 1 ? "run" : "runs"} in {monthLabel}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                {[
                  isAdmin ? "Employee" : null,
                  "Period", "Hours", "Rate", "Gross", "Deductions", "Net Pay", "Status", "Actions",
                ].filter(Boolean).map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-slate-500">Loading payroll…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-slate-500">
                  {payments.length === 0 ? "No pay runs created yet." : `No pay runs for ${monthLabel}.`}
                </td></tr>
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
                    <p>{fmtDate(p.period_start)}</p>
                    <p className="text-slate-400">→ {fmtDate(p.period_end)}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-700">{p.hours_worked.toFixed(1)}h</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{fmtAUD(p.hourly_rate)}/h</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{fmtAUD(p.gross_pay)}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">({fmtAUD(p.deductions)})</td>
                  <td className="px-5 py-4 text-sm font-bold text-emerald-700">{fmtAUD(p.net_pay)}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status]}`}>
                      {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                    </span>
                    {p.status === "PAID" && p.paid_at && (
                      <p className="text-xs text-slate-400 mt-0.5">{fmtDate(p.paid_at)}</p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => downloadPayslip(p)} title="Download payslip"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                        <Download className="h-4 w-4" />
                      </button>
                      {isAdmin && p.status === "DRAFT" && (
                        <button onClick={() => handleStatusChange(p.id, "ISSUED")} title="Issue to employee"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                      {isAdmin && p.status === "ISSUED" && (
                        <button onClick={() => handleStatusChange(p.id, "PAID")} title="Mark paid"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition-colors">
                          <Banknote className="h-3.5 w-3.5" /> Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal */}
      {userId && isAdmin && (
        <CreatePayRunModal open={showCreate} adminId={userId} onClose={() => setShowCreate(false)} onSaved={reload} />
      )}
    </div>
  );
}
