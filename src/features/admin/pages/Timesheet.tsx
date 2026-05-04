import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import { jsPDF } from "jspdf";
import { ChevronLeft, ChevronRight, Download, RefreshCw } from "lucide-react";

type Employee = {
  id: string;
  full_name: string | null;
  email: string;
  hourly_rate: number;
};

type TimeEntry = {
  id: string;
  user_id: string;
  job_id: string | null;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
};

type EmployeeSummary = {
  employee: Employee;
  entries: TimeEntry[];
  totalMinutes: number;
  daysWorked: number;
  grossPay: number;
};

// Week helpers
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// ── PDF Generator ─────────────────────────────────────────────────────────────
function generateTimesheetPdf(summaries: EmployeeSummary[], weekStart: Date, weekEnd: Date) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;
  const margin = 14;
  const colW = W - margin * 2;
  const BLUE: [number, number, number] = [0, 84, 166];
  const DARK: [number, number, number] = [30, 41, 59];
  const MID: [number, number, number] = [100, 116, 139];
  const LIGHT: [number, number, number] = [241, 245, 249];
  const WHITE: [number, number, number] = [255, 255, 255];
  const GREEN: [number, number, number] = [34, 197, 94];

  let isFirstPage = true;

  const addPageHeader = (title: string) => {
    pdf.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
    pdf.rect(0, 0, W, 16, "F");
    pdf.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("Statewide Escalator Cleaning Pty Ltd", margin, 10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`WEEKLY TIMESHEET  |  ${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`, W - margin, 10, { align: "right" });

    pdf.setTextColor(DARK[0], DARK[1], DARK[2]);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(title, margin, 30);

    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.3);
    pdf.line(margin, 34, margin + colW, 34);
  };

  summaries.forEach((s, si) => {
    if (!isFirstPage) pdf.addPage();
    isFirstPage = false;

    addPageHeader(`${s.employee.full_name ?? s.employee.email} — Weekly Timesheet`);

    let y = 40;

    // Summary boxes
    const boxes = [
      { label: "Days Worked", value: String(s.daysWorked) },
      { label: "Total Hours", value: fmtMins(s.totalMinutes) },
      { label: "Hourly Rate", value: s.employee.hourly_rate > 0 ? `$${s.employee.hourly_rate.toFixed(2)}/hr` : "Flat rate" },
      { label: "Gross Pay", value: `$${s.grossPay.toFixed(2)}` },
    ];

    const boxW = (colW - 9) / 4;
    boxes.forEach((box, i) => {
      const bx = margin + i * (boxW + 3);
      pdf.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2]);
      pdf.roundedRect(bx, y, boxW, 18, 2, 2, "F");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(MID[0], MID[1], MID[2]);
      pdf.text(box.label, bx + 3, y + 6);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(DARK[0], DARK[1], DARK[2]);
      pdf.text(box.value, bx + 3, y + 14);
    });
    y += 24;

    // Table header
    const cols = [
      { label: "Date", w: 30 },
      { label: "Clock In", w: 28 },
      { label: "Clock Out", w: 28 },
      { label: "Duration", w: 28 },
      { label: "Job", w: colW - 30 - 28 - 28 - 28 - 20 },
      { label: "Pay", w: 20 },
    ];

    let hx = margin;
    cols.forEach((col) => {
      pdf.setFillColor(DARK[0], DARK[1], DARK[2]);
      pdf.rect(hx, y, col.w, 8, "F");
      pdf.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.text(col.label, hx + 2, y + 5.5);
      hx += col.w;
    });
    y += 8;

    // Table rows
    const dayEntries = new Map<string, TimeEntry[]>();
    s.entries.forEach((e) => {
      const dateKey = new Date(e.clock_in).toDateString();
      if (!dayEntries.has(dateKey)) dayEntries.set(dateKey, []);
      dayEntries.get(dateKey)!.push(e);
    });

    s.entries.forEach((entry, i) => {
      const rowH = 8;
      const isEven = i % 2 === 0;
      pdf.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      pdf.rect(margin, y, colW, rowH, "F");
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.1);
      pdf.line(margin, y + rowH, margin + colW, y + rowH);

      const mins = entry.duration_minutes ?? 0;
      const pay = s.employee.hourly_rate > 0 ? (mins / 60) * s.employee.hourly_rate : 0;

      const rowData = [
        fmtDate(new Date(entry.clock_in)),
        fmtTime(entry.clock_in),
        entry.clock_out ? fmtTime(entry.clock_out) : "—",
        fmtMins(mins),
        "", // job - skip for now
        pay > 0 ? `$${pay.toFixed(2)}` : "—",
      ];

      let rx = margin;
      cols.forEach((col, ci) => {
        pdf.setTextColor(DARK[0], DARK[1], DARK[2]);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        if (rowData[ci]) pdf.text(rowData[ci], rx + 2, y + 5.5);
        rx += col.w;
      });

      y += rowH;
      if (y > 185) { pdf.addPage(); addPageHeader(`${s.employee.full_name ?? s.employee.email} (cont.)`); y = 40; }
    });

    // Totals row
    y += 2;
    pdf.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
    pdf.rect(margin, y, colW, 9, "F");
    pdf.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("TOTAL", margin + 2, y + 6);
    pdf.text(fmtMins(s.totalMinutes), margin + 30 + 28 + 28 + 2, y + 6);
    pdf.text(`$${s.grossPay.toFixed(2)}`, margin + colW - 18, y + 6);

    // Signature line
    y += 16;
    pdf.setDrawColor(MID[0], MID[1], MID[2]);
    pdf.setLineWidth(0.3);
    pdf.line(margin, y, margin + 70, y);
    pdf.setTextColor(MID[0], MID[1], MID[2]);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text("Employee Signature", margin, y + 4);
    pdf.line(margin + 100, y, margin + 170, y);
    pdf.text("Supervisor Signature", margin + 100, y + 4);
    pdf.line(margin + 200, y, margin + 250, y);
    pdf.text("Date", margin + 200, y + 4);

    // Footer
    pdf.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2]);
    pdf.rect(0, 203, W, 7, "F");
    pdf.setTextColor(MID[0], MID[1], MID[2]);
    pdf.setFontSize(6.5);
    pdf.text("Statewide Escalator Cleaning Pty Ltd  –  Confidential Payroll Document", W / 2, 207, { align: "center" });
    pdf.text(`Page ${si + 1} of ${summaries.length}`, W - margin, 207, { align: "right" });

    void GREEN;
  });

  pdf.save(`Timesheet_${fmtDate(weekStart).replace(/ /g, "_")}.pdf`);
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Timesheet() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [selectedEmp, setSelectedEmp] = useState<string>("ALL");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const load = useCallback(async () => {
    setLoading(true);

    const [empRes, entryRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, hourly_rate")
        .eq("status", "ACTIVE")
        .order("full_name"),
      supabase
        .from("time_entries")
        .select("*")
        .gte("clock_in", weekStart.toISOString())
        .lte("clock_in", addDays(weekEnd, 1).toISOString())
        .order("clock_in"),
    ]);

    if (empRes.error) toast.error(empRes.error.message);
    if (entryRes.error) toast.error(entryRes.error.message);

    setEmployees((empRes.data ?? []) as Employee[]);
    setEntries((entryRes.data ?? []) as TimeEntry[]);
    setLoading(false);
  }, [weekStart, weekEnd]);

  useEffect(() => { load(); }, [load]);

  const summaries: EmployeeSummary[] = useMemo(() => {
    return employees
      .map((emp) => {
        const empEntries = entries.filter((e) => e.user_id === emp.id);
        const totalMins = empEntries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
        const days = new Set(empEntries.map((e) => new Date(e.clock_in).toDateString())).size;
        const pay = emp.hourly_rate > 0 ? (totalMins / 60) * emp.hourly_rate : 0;
        return { employee: emp, entries: empEntries, totalMinutes: totalMins, daysWorked: days, grossPay: pay };
      })
      .filter((s) => selectedEmp === "ALL" || s.employee.id === selectedEmp);
  }, [employees, entries, selectedEmp]);

  const totals = useMemo(() => ({
    days: summaries.reduce((s, e) => s + e.daysWorked, 0),
    hours: summaries.reduce((s, e) => s + e.totalMinutes, 0),
    pay: summaries.reduce((s, e) => s + e.grossPay, 0),
  }), [summaries]);

  const handleExportPdf = () => {
    setGeneratingPdf(true);
    try {
      const toExport = summaries.filter((s) => s.entries.length > 0);
      if (toExport.length === 0) { toast.error("No entries to export."); setGeneratingPdf(false); return; }
      generateTimesheetPdf(toExport, weekStart, weekEnd);
      toast.success("PDF downloaded.");
    } catch {
      toast.error("Failed to generate PDF.");
    }
    setGeneratingPdf(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 text-white px-6 py-8 md:px-10">
        <div className="max-w-7xl mx-auto flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-slate-400">Admin</p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Timesheets & Pay</h1>
            <p className="mt-2 text-sm text-slate-300">Weekly hours, days worked and gross pay — admin only.</p>
          </div>
          <div className="flex gap-2 self-start md:self-auto">
            <button onClick={() => load()} disabled={loading} className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white text-sm px-3 py-2.5 rounded-xl hover:bg-white/20 transition-all">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={handleExportPdf} disabled={generatingPdf} className="inline-flex items-center gap-2 bg-white text-slate-900 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-blue-50 shadow-md transition-all disabled:opacity-60">
              <Download className="h-4 w-4" />
              {generatingPdf ? "Generating…" : "Export PDF"}
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-5">

        {/* Week picker + filter */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekStart((d) => addDays(d, -7))} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"><ChevronLeft className="h-4 w-4" /></button>
            <div className="text-center min-w-48">
              <p className="text-sm font-semibold text-slate-900">{fmtDate(weekStart)} – {fmtDate(weekEnd)}</p>
              <p className="text-xs text-slate-400">Week {Math.ceil(weekStart.getDate() / 7)}</p>
            </div>
            <button onClick={() => setWeekStart((d) => addDays(d, 7))} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="text-xs text-blue-600 font-medium hover:underline">This week</button>

          <div className="ml-auto">
            <select value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="ALL">All Employees</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name ?? e.email}</option>)}
            </select>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Employee-Days", value: totals.days.toString() },
            { label: "Total Hours", value: fmtMins(totals.hours) },
            { label: "Total Gross Pay", value: `$${totals.pay.toFixed(2)}` },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Per-employee table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
              <RefreshCw className="animate-spin h-5 w-5 mr-2" /> Loading…
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Employee</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Days Worked</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Total Hours</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Hourly Rate</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Gross Pay</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Entries</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summaries.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-16 text-slate-400 text-sm">No data for this period.</td></tr>
                  ) : summaries.map((s) => (
                    <tr key={s.employee.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900 text-sm">{s.employee.full_name ?? "—"}</p>
                        <p className="text-xs text-slate-400">{s.employee.email}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 font-medium">{s.daysWorked}</td>
                      <td className="px-6 py-4 text-sm text-slate-700 font-medium">{fmtMins(s.totalMinutes)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {s.employee.hourly_rate > 0 ? `$${s.employee.hourly_rate.toFixed(2)}/hr` : <span className="text-amber-600 text-xs">Not set</span>}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-700">${s.grossPay.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{s.entries.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Expanded entries per employee */}
              {summaries.filter((s) => s.entries.length > 0).map((s) => (
                <details key={s.employee.id} className="border-t border-slate-100">
                  <summary className="px-6 py-3 text-sm font-medium text-blue-600 cursor-pointer hover:bg-blue-50 select-none">
                    View {s.entries.length} entries for {s.employee.full_name ?? s.employee.email}
                  </summary>
                  <table className="w-full text-sm bg-slate-50">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left px-8 py-2 text-xs font-semibold text-slate-500">Date</th>
                        <th className="text-left px-6 py-2 text-xs font-semibold text-slate-500">Clock In</th>
                        <th className="text-left px-6 py-2 text-xs font-semibold text-slate-500">Clock Out</th>
                        <th className="text-left px-6 py-2 text-xs font-semibold text-slate-500">Duration</th>
                        <th className="text-left px-6 py-2 text-xs font-semibold text-slate-500">Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.entries.map((e) => {
                        const mins = e.duration_minutes ?? 0;
                        const pay = s.employee.hourly_rate > 0 ? (mins / 60) * s.employee.hourly_rate : 0;
                        return (
                          <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-100">
                            <td className="px-8 py-2 text-slate-700">{fmtDate(new Date(e.clock_in))}</td>
                            <td className="px-6 py-2 text-slate-700">{fmtTime(e.clock_in)}</td>
                            <td className="px-6 py-2 text-slate-600">{e.clock_out ? fmtTime(e.clock_out) : <span className="text-emerald-600 font-semibold">Active</span>}</td>
                            <td className="px-6 py-2 text-slate-600">{fmtMins(mins)}</td>
                            <td className="px-6 py-2 text-emerald-700 font-medium">{pay > 0 ? `$${pay.toFixed(2)}` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </details>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
