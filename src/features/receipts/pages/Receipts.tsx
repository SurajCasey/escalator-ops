import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import {
  Banknote, CheckCircle2, Eye, ImageOff,
  Pencil, Plus, Receipt, Search, Trash2, User, X, XCircle,
} from "lucide-react";

/* ── Types ───────────────────────────────────────────────── */
type ReceiptStatus = "PENDING" | "APPROVED" | "PAID" | "REJECTED";
type ReceiptCategory = "FUEL" | "TOLLS" | "EQUIPMENT" | "FOOD" | "OTHER";

type ReceiptRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  job_id: string | null;
  job_title: string | null;
  category: ReceiptCategory;
  amount: number;
  receipt_date: string;
  photo_data: string | null;
  notes: string | null;
  status: ReceiptStatus;
  admin_comment: string | null;
  created_at: string;
};

type EmployeeSummary = {
  id: string;
  name: string;
  pending: number;
  pendingAmt: number;
  approved: number;
  approvedAmt: number;
  paid: number;
  paidAmt: number;
};

type Job = { id: string; title: string };

/* ── Constants ───────────────────────────────────────────── */
const CATEGORIES: { value: ReceiptCategory; label: string }[] = [
  { value: "FUEL",      label: "Fuel" },
  { value: "TOLLS",     label: "Tolls / Parking" },
  { value: "EQUIPMENT", label: "Equipment" },
  { value: "FOOD",      label: "Food / Meals" },
  { value: "OTHER",     label: "Other" },
];

const CAT_STYLES: Record<ReceiptCategory, string> = {
  FUEL:      "bg-blue-50 text-blue-700 border-blue-100",
  TOLLS:     "bg-purple-50 text-purple-700 border-purple-100",
  EQUIPMENT: "bg-orange-50 text-orange-700 border-orange-100",
  FOOD:      "bg-green-50 text-green-700 border-green-100",
  OTHER:     "bg-slate-50 text-slate-600 border-slate-200",
};

const STATUS_STYLES: Record<ReceiptStatus, string> = {
  PENDING:  "bg-amber-50 text-amber-700 border-amber-100",
  APPROVED: "bg-blue-50 text-blue-700 border-blue-100",
  PAID:     "bg-emerald-50 text-emerald-700 border-emerald-100",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-100",
};

/* ── Helpers ─────────────────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtAUD(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}
function resizeToBase64(file: File, maxPx = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = ev.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ── Submit / Edit Modal (employee) ─────────────────────── */
type SubmitModalProps = {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
  editing?: ReceiptRow | null;
};

function SubmitModal({ open, userId, onClose, onSaved, editing = null }: SubmitModalProps) {
  const isEdit = !!editing;
  const [category, setCategory] = useState<ReceiptCategory>("FUEL");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [jobId, setJobId] = useState("");
  const [notes, setNotes] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Pre-populate from editing receipt or reset for new
    if (editing) {
      setCategory(editing.category);
      setAmount(String(editing.amount));
      setDate(editing.receipt_date);
      setJobId(editing.job_id ?? "");
      setNotes(editing.notes ?? "");
      setPhotoPreview(editing.photo_data);
      setPhotoData(editing.photo_data);
    } else {
      setCategory("FUEL"); setAmount(""); setDate(new Date().toISOString().slice(0, 10));
      setJobId(""); setNotes(""); setPhotoPreview(null); setPhotoData(null);
    }
    supabase.from("jobs").select("id, title")
      .in("status", ["SCHEDULED", "IN_PROGRESS", "COMPLETED"])
      .order("scheduled_at", { ascending: false }).limit(50)
      .then(({ data }) => setJobs(data ?? []));
  }, [open, editing]);

  if (!open) return null;

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const b64 = await resizeToBase64(file); setPhotoData(b64); setPhotoPreview(b64); }
    catch { toast.error("Failed to process photo."); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount."); return; }
    setSaving(true);

    if (isEdit && editing) {
      const { error } = await supabase.from("receipts").update({
        category, amount: amt, receipt_date: date,
        job_id: jobId || null, notes: notes.trim() || null, photo_data: photoData,
      }).eq("id", editing.id);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Receipt updated.");
    } else {
      const { error } = await supabase.from("receipts").insert({
        employee_id: userId, job_id: jobId || null, category,
        amount: amt, receipt_date: date, photo_data: photoData, notes: notes.trim() || null,
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Receipt submitted.");
    }

    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-slate-900">{isEdit ? "Edit Receipt" : "Submit Receipt"}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as ReceiptCategory)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount (AUD) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00" className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Link to Job (optional)</label>
              <select value={jobId} onChange={(e) => setJobId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— No job —</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Photo (optional)</label>
            {photoPreview ? (
              <div className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-200">
                <img src={photoPreview} alt="Receipt" className="w-full h-full object-contain bg-slate-50" />
                <button type="button" onClick={() => { setPhotoPreview(null); setPhotoData(null); }}
                  className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow flex items-center justify-center text-slate-500 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
                <Receipt className="h-8 w-8 text-slate-300 mb-2" />
                <span className="text-sm text-slate-500">Tap to add photo</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
              </label>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="What was this for?" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? (isEdit ? "Saving…" : "Submitting…") : (isEdit ? "Save Changes" : "Submit Receipt")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Reject Modal ────────────────────────────────────────── */
function RejectModal({ receiptId, adminId, onClose, onDone }: { receiptId: string; adminId: string; onClose: () => void; onDone: () => void }) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const handleReject = async () => {
    setSaving(true);
    const { error } = await supabase.from("receipts").update({
      status: "REJECTED", admin_comment: comment.trim() || null,
      reviewed_by: adminId, reviewed_at: new Date().toISOString(),
    }).eq("id", receiptId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Receipt rejected."); onDone(); onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl p-6">
        <h3 className="font-semibold text-slate-900 text-lg mb-1">Reject Receipt</h3>
        <p className="text-sm text-slate-500 mb-4">Add an optional reason for the employee.</p>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
          placeholder="Reason for rejection…" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500" />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={handleReject} disabled={saving} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60">
            {saving ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Photo Lightbox ──────────────────────────────────────── */
function PhotoLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/90" onClick={onClose}>
      <img src={src} alt="Receipt" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */
export default function Receipts() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptRow | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ReceiptStatus>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | ReceiptCategory>("ALL");
  const [employeeFilter, setEmployeeFilter] = useState<"ALL" | string>("ALL");

  /* ── Data loading ──────────────────────────────────────── */
  const load = useCallback(async (uid: string, admin: boolean) => {
    setLoading(true);
    let query = supabase.from("receipts").select("*").order("created_at", { ascending: false });
    if (!admin) query = query.eq("employee_id", uid);
    const { data: rData, error } = await query;
    if (error) { toast.error(error.message); setLoading(false); return; }

    // Enrich with employee names
    let nameMap: Record<string, string> = {};
    if (admin && rData && rData.length > 0) {
      const ids = [...new Set(rData.map((r) => r.employee_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]));
    }

    // Enrich with job titles
    let jobMap: Record<string, string> = {};
    if (rData && rData.length > 0) {
      const jobIds = [...new Set(rData.filter((r) => r.job_id).map((r) => r.job_id!))];
      if (jobIds.length > 0) {
        const { data: jobs } = await supabase.from("jobs").select("id, title").in("id", jobIds);
        jobMap = Object.fromEntries((jobs ?? []).map((j) => [j.id, j.title]));
      }
    }

    setReceipts((rData ?? []).map((r) => ({
      ...r,
      employee_name: nameMap[r.employee_id] ?? "Me",
      job_title: r.job_id ? (jobMap[r.job_id] ?? null) : null,
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

  /* ── Derived data ──────────────────────────────────────── */

  // Per-employee summaries (admin only)
  const employeeSummaries = useMemo((): EmployeeSummary[] => {
    const map: Record<string, EmployeeSummary> = {};
    receipts.forEach((r) => {
      if (!map[r.employee_id]) {
        map[r.employee_id] = { id: r.employee_id, name: r.employee_name, pending: 0, pendingAmt: 0, approved: 0, approvedAmt: 0, paid: 0, paidAmt: 0 };
      }
      const s = map[r.employee_id];
      if (r.status === "PENDING")  { s.pending++;  s.pendingAmt  += r.amount; }
      if (r.status === "APPROVED") { s.approved++; s.approvedAmt += r.amount; }
      if (r.status === "PAID")     { s.paid++;     s.paidAmt     += r.amount; }
    });
    return Object.values(map).sort((a, b) => b.approvedAmt - a.approvedAmt);
  }, [receipts]);

  // Unique employees list for filter dropdown
  const employees = useMemo(() =>
    employeeSummaries.map((e) => ({ id: e.id, name: e.name })),
    [employeeSummaries]
  );

  // Filtered table rows
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return receipts.filter((r) => {
      const matchSearch = !q || r.employee_name.toLowerCase().includes(q) || (r.job_title ?? "").toLowerCase().includes(q) || (r.notes ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
      const matchCat = categoryFilter === "ALL" || r.category === categoryFilter;
      const matchEmp = employeeFilter === "ALL" || r.employee_id === employeeFilter;
      return matchSearch && matchStatus && matchCat && matchEmp;
    });
  }, [receipts, search, statusFilter, categoryFilter, employeeFilter]);

  // Header stats
  const stats = useMemo(() => ({
    pending:     receipts.filter((r) => r.status === "PENDING").length,
    pendingAmt:  receipts.filter((r) => r.status === "PENDING").reduce((s, r) => s + r.amount, 0),
    approved:    receipts.filter((r) => r.status === "APPROVED").length,
    approvedAmt: receipts.filter((r) => r.status === "APPROVED").reduce((s, r) => s + r.amount, 0),
    paid:        receipts.filter((r) => r.status === "PAID").length,
    paidAmt:     receipts.filter((r) => r.status === "PAID").reduce((s, r) => s + r.amount, 0),
  }), [receipts]);

  /* ── Actions ───────────────────────────────────────────── */
  const handleApprove = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase.from("receipts").update({
      status: "APPROVED", reviewed_by: userId, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Receipt approved.");
    setReceipts((prev) => prev.map((r) => r.id === id ? { ...r, status: "APPROVED" } : r));
  };

  const handleMarkPaid = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase.from("receipts").update({
      status: "PAID", reviewed_by: userId, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Receipt marked as paid.");
    setReceipts((prev) => prev.map((r) => r.id === id ? { ...r, status: "PAID" } : r));
  };

  // Pay all APPROVED receipts for a given employee at once
  const handlePayAllForEmployee = async (empId: string) => {
    if (!userId) return;
    const ids = receipts.filter((r) => r.employee_id === empId && r.status === "APPROVED").map((r) => r.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from("receipts").update({
      status: "PAID", reviewed_by: userId, reviewed_at: new Date().toISOString(),
    }).in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${ids.length} receipt${ids.length > 1 ? "s" : ""} as paid.`);
    setReceipts((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status: "PAID" } : r));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this receipt? This cannot be undone.")) return;
    const { error } = await supabase.from("receipts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Receipt deleted.");
    setReceipts((prev) => prev.filter((r) => r.id !== id));
  };

  const reload = () => { if (userId) load(userId, isAdmin); };

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 xl:p-8 space-y-6">

      {/* ── Header ───────────────────────────────────────── */}
      <section className="rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 text-white p-6 md:p-8 shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-slate-300">{isAdmin ? "Expense Management" : "My Expenses"}</p>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold">Receipts</h1>
            <p className="mt-2 text-sm text-slate-200">
              {isAdmin
                ? "Review receipts, approve valid claims, then mark as paid once reimbursed."
                : "Submit fuel, toll, and equipment receipts for reimbursement."}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Pending review", value: stats.pending,  sub: fmtAUD(stats.pendingAmt),  color: "text-amber-300" },
              { label: "Approved / owed", value: stats.approved, sub: fmtAUD(stats.approvedAmt), color: "text-blue-300" },
              { label: "Paid out",        value: stats.paid,     sub: fmtAUD(stats.paidAmt),     color: "text-emerald-300" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className={`text-xs uppercase tracking-wide leading-tight ${s.color}`}>{s.label}</p>
                <p className="mt-1 text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-slate-300 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Per-employee payment summary (admin only) ─────── */}
      {isAdmin && employeeSummaries.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Employee Expense Summary</h2>
            <p className="text-sm text-slate-500">Approve receipts first, then pay out when ready.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {employeeSummaries.map((emp) => (
              <div key={emp.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{emp.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                      {emp.pending > 0 && (
                        <span className="text-amber-600">{emp.pending} pending review</span>
                      )}
                      {emp.approved > 0 && (
                        <span className="text-blue-600 font-medium">{emp.approved} approved — {fmtAUD(emp.approvedAmt)} owed</span>
                      )}
                      {emp.paid > 0 && (
                        <span className="text-emerald-600">{fmtAUD(emp.paidAmt)} paid</span>
                      )}
                      {emp.pending === 0 && emp.approved === 0 && emp.paid > 0 && (
                        <span className="text-slate-400">All settled ✓</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {emp.approved > 0 && (
                    <button
                      onClick={() => handlePayAllForEmployee(emp.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
                    >
                      <Banknote className="h-4 w-4" />
                      Pay {fmtAUD(emp.approvedAmt)}
                    </button>
                  )}
                  <button
                    onClick={() => { setEmployeeFilter(emp.id); setStatusFilter("ALL"); }}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    View receipts
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Receipts table ───────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 space-y-3">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                {isAdmin
                  ? employeeFilter !== "ALL"
                    ? `${employees.find((e) => e.id === employeeFilter)?.name ?? ""}'s Receipts`
                    : "All Receipts"
                  : "My Receipts"}
              </h2>
              <p className="text-sm text-slate-500">{filtered.length} of {receipts.length} total</p>
            </div>
            {!isAdmin && (
              <button onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                <Plus className="h-4 w-4" /><span className="hidden sm:inline">New Receipt</span>
              </button>
            )}
          </div>
          {/* Filter row — always one horizontal line */}
          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-0.5">
            {isAdmin && (
              <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}
                className="shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-500 bg-white">
                <option value="ALL">All Employees</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            )}
            <div className="relative shrink-0 w-32">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-sm text-slate-700 outline-none focus:border-blue-500" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-500 bg-white">
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
              className="shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-500 bg-white">
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                {isAdmin && employeeFilter === "ALL" && (
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</th>
                )}
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Category</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                <th className="hidden md:table-cell px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                <th className="hidden md:table-cell px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Notes / Job</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{isAdmin ? "Actions" : "Detail"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">Loading receipts…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                  {receipts.length === 0 ? "No receipts yet." : "No receipts match the current filters."}
                </td></tr>
              )}
              {!loading && filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  {/* Employee name (admin all-employees view) */}
                  {isAdmin && employeeFilter === "ALL" && (
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-slate-900">{r.employee_name}</p>
                    </td>
                  )}
                  {/* Category */}
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${CAT_STYLES[r.category]}`}>
                      {CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category}
                    </span>
                  </td>
                  {/* Amount */}
                  <td className="px-5 py-4">
                    <p className="text-sm font-bold text-slate-900">{fmtAUD(r.amount)}</p>
                    {/* Date shown inline on mobile */}
                    <p className="md:hidden text-xs text-slate-400 mt-0.5">{fmtDate(r.receipt_date)}</p>
                    {/* Notes/job shown inline on mobile */}
                    {(r.job_title || r.notes) && (
                      <p className="md:hidden text-xs text-slate-400 mt-0.5 truncate max-w-[140px]">
                        {r.job_title ?? r.notes}
                      </p>
                    )}
                  </td>
                  {/* Date — desktop only */}
                  <td className="hidden md:table-cell px-5 py-4 text-sm text-slate-600 whitespace-nowrap">{fmtDate(r.receipt_date)}</td>
                  {/* Notes / Job — desktop only */}
                  <td className="hidden md:table-cell px-5 py-4 text-sm text-slate-600 max-w-44">
                    {r.job_title && <p className="text-xs text-blue-600 font-medium truncate">{r.job_title}</p>}
                    {r.notes && <p className="text-xs text-slate-400 truncate">{r.notes}</p>}
                    {!r.job_title && !r.notes && <span className="text-slate-300 italic text-xs">—</span>}
                  </td>
                  {/* Status badge */}
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                      {r.status === "PENDING" ? "Pending" : r.status === "APPROVED" ? "Approved" : r.status === "PAID" ? "Paid" : "Rejected"}
                    </span>
                  </td>
                  {/* Actions (admin) / Status detail (employee) */}
                  {isAdmin ? (
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-2">
                        {/* Photo link */}
                        {r.photo_data ? (
                          <button onClick={() => setLightboxSrc(r.photo_data)}
                            className="flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:underline w-fit">
                            <Eye className="h-3.5 w-3.5" /> View photo
                          </button>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-slate-300">
                            <ImageOff className="h-3.5 w-3.5" /> No photo
                          </span>
                        )}
                        {/* PENDING: Approve + Reject */}
                        {r.status === "PENDING" && (
                          <div className="flex gap-1.5 flex-wrap">
                            <button onClick={() => handleApprove(r.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button onClick={() => setRejectingId(r.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-semibold hover:bg-red-100 transition-colors">
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        )}
                        {/* APPROVED: Mark Paid */}
                        {r.status === "APPROVED" && (
                          <button onClick={() => handleMarkPaid(r.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors w-fit">
                            <Banknote className="h-3.5 w-3.5" /> Mark Paid
                          </button>
                        )}
                        {/* PAID / REJECTED: done */}
                        {r.status === "PAID" && (
                          <span className="text-xs text-emerald-600 font-medium">✓ Paid out</span>
                        )}
                        {r.status === "REJECTED" && (
                          <span className="text-xs text-rose-500 italic">{r.admin_comment ?? "Rejected"}</span>
                        )}
                      </div>
                    </td>
                  ) : (
                    <td className="px-5 py-4 text-xs max-w-40">
                      <div className="flex items-center gap-3">
                        <span>
                          {r.status === "PENDING"  && <span className="text-amber-600">Awaiting review</span>}
                          {r.status === "APPROVED" && <span className="text-blue-600">Approved — payment pending</span>}
                          {r.status === "PAID"     && <span className="text-emerald-600 font-medium">✓ Paid out</span>}
                          {r.status === "REJECTED" && <span className="text-rose-500">{r.admin_comment ?? "Rejected"}</span>}
                        </span>
                        {r.status === "PENDING" && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingReceipt(r)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                              title="Edit receipt"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                              title="Delete receipt"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Modals ───────────────────────────────────────── */}
      {userId && (
        <SubmitModal
          open={showModal || !!editingReceipt}
          userId={userId}
          editing={editingReceipt}
          onClose={() => { setShowModal(false); setEditingReceipt(null); }}
          onSaved={reload}
        />
      )}
      {rejectingId && userId && (
        <RejectModal receiptId={rejectingId} adminId={userId} onClose={() => setRejectingId(null)} onDone={reload} />
      )}
      {lightboxSrc && <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
