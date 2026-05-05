import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Package, Plus, Search, X, XCircle,
} from "lucide-react";

/* ── Types ───────────────────────────────────────────────── */
type Urgency = "LOW" | "MEDIUM" | "HIGH";
type PRStatus = "PENDING" | "ORDERED" | "RECEIVED" | "REJECTED";

type PurchaseRequest = {
  id: string;
  requested_by: string;
  requester_name: string;
  item_name: string;
  inventory_item_id: string | null;
  quantity: number;
  unit: string;
  urgency: Urgency;
  notes: string | null;
  status: PRStatus;
  admin_comment: string | null;
  created_at: string;
};

type InventoryItem = { id: string; name: string; unit: string };

/* ── Constants ───────────────────────────────────────────── */
const URGENCY_STYLES: Record<Urgency, string> = {
  LOW:    "bg-slate-50 text-slate-600 border-slate-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-100",
  HIGH:   "bg-red-50 text-red-700 border-red-100",
};

const STATUS_STYLES: Record<PRStatus, string> = {
  PENDING:  "bg-amber-50 text-amber-700 border-amber-100",
  ORDERED:  "bg-blue-50 text-blue-700 border-blue-100",
  RECEIVED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-100",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

/* ── Submit Modal (employee) ─────────────────────────────── */
type SubmitModalProps = {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
};

function SubmitModal({ open, userId, onClose, onSaved }: SubmitModalProps) {
  const [itemName, setItemName] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("units");
  const [urgency, setUrgency] = useState<Urgency>("MEDIUM");
  const [notes, setNotes] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItemName(""); setInventoryItemId(""); setQuantity("1");
    setUnit("units"); setUrgency("MEDIUM"); setNotes("");
    supabase.from("inventory").select("id, name, unit").order("name").then(({ data }) => setInventory(data ?? []));
  }, [open]);

  if (!open) return null;

  // When user picks an existing inventory item, auto-fill name + unit
  const handleInventorySelect = (id: string) => {
    setInventoryItemId(id);
    const item = inventory.find((i) => i.id === id);
    if (item) { setItemName(item.name); setUnit(item.unit); }
    else { setUnit("units"); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (!itemName.trim()) { toast.error("Item name is required."); return; }
    if (!quantity || isNaN(qty) || qty <= 0) { toast.error("Enter a valid quantity."); return; }
    setSaving(true);
    const { error } = await supabase.from("purchase_requests").insert({
      requested_by: userId,
      item_name: itemName.trim(),
      inventory_item_id: inventoryItemId || null,
      quantity: qty,
      unit: unit.trim() || "units",
      urgency,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Purchase request submitted.");
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-slate-900">Request an Item</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Link to Inventory Item (optional)</label>
            <select value={inventoryItemId} onChange={(e) => handleInventorySelect(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— New / unlisted item —</option>
              {inventory.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <p className="text-xs text-slate-400 mt-1">Linking auto-updates stock when admin marks received.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Item Name *</label>
            <input value={itemName} onChange={(e) => setItemName(e.target.value)} required
              placeholder="e.g. Heavy Duty Degreaser" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
              <input type="number" min="0.01" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="units, litres, kg…"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Urgency</label>
            <div className="flex gap-2">
              {(["LOW", "MEDIUM", "HIGH"] as Urgency[]).map((u) => (
                <button key={u} type="button" onClick={() => setUrgency(u)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    urgency === u ? URGENCY_STYLES[u] + " ring-2 ring-offset-1 ring-current" : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}>
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Supplier, brand, reason needed…" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Admin Review Modal ───────────────────────────────────── */
type ReviewModalProps = {
  request: PurchaseRequest;
  adminId: string;
  onClose: () => void;
  onDone: () => void;
};

function ReviewModal({ request, adminId, onClose, onDone }: ReviewModalProps) {
  const [action, setAction] = useState<PRStatus | "">("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!action) return;
    setSaving(true);

    const update: Record<string, unknown> = {
      status: action,
      admin_comment: comment.trim() || null,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("purchase_requests").update(update).eq("id", request.id);
    if (error) { toast.error(error.message); setSaving(false); return; }

    // Auto-update inventory when marked RECEIVED and linked to an item
    if (action === "RECEIVED" && request.inventory_item_id) {
      const { data: invItem } = await supabase.from("inventory").select("quantity").eq("id", request.inventory_item_id).single();
      if (invItem) {
        await supabase.from("inventory").update({
          quantity: invItem.quantity + request.quantity,
          last_restocked: new Date().toISOString(),
        }).eq("id", request.inventory_item_id);
        toast.success(`Inventory updated: +${request.quantity} ${request.unit} added.`);
      }
    }

    toast.success(`Request marked as ${action.toLowerCase()}.`);
    setSaving(false);
    onDone(); onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl p-6">
        <h3 className="font-semibold text-slate-900 text-lg">{request.item_name}</h3>
        <p className="text-sm text-slate-500 mt-0.5 mb-4">
          {request.quantity} {request.unit} — requested by {request.requester_name}
        </p>

        {/* Step-by-step workflow guide */}
        <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 leading-relaxed">
          <p className="font-semibold text-slate-700 mb-1">How it works:</p>
          <p>1. Tap <strong>Mark Ordered</strong> once you've placed the order with the supplier.</p>
          <p>2. When the goods arrive, tap <strong>Mark Received</strong> — stock auto-updates if linked to inventory.</p>
          <p>3. Tap <strong>Reject</strong> if the request is invalid or not approved.</p>
        </div>

        <div className="space-y-2 mb-4">
          {([
            { value: "ORDERED",  label: "Mark Ordered",  desc: "You've placed the order" },
            { value: "RECEIVED", label: "Mark Received", desc: "Goods have arrived" },
            { value: "REJECTED", label: "Reject",        desc: "Not approved" },
          ] as { value: PRStatus; label: string; desc: string }[]).map((s) => (
            <button key={s.value} type="button" onClick={() => setAction(s.value)}
              className={`w-full px-4 py-3 rounded-xl text-sm font-semibold border text-left transition-all flex items-center justify-between ${
                action === s.value ? STATUS_STYLES[s.value] + " ring-2 ring-offset-1 ring-current" : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}>
              <span>{s.label}</span>
              <span className={`text-xs font-normal ${action === s.value ? "opacity-80" : "text-slate-400"}`}>{s.desc}</span>
            </button>
          ))}
        </div>

        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
          placeholder="Comment (optional)…" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={!action || saving}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40">
            {saving ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */
export default function PurchaseRequests() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [reviewing, setReviewing] = useState<PurchaseRequest | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PRStatus>("ALL");
  const [urgencySort, setUrgencySort] = useState<"asc" | "desc">("desc");

  const URGENCY_ORDER: Record<Urgency, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

  const load = useCallback(async (uid: string, admin: boolean) => {
    setLoading(true);
    let query = supabase.from("purchase_requests").select("*").order("created_at", { ascending: false });
    if (!admin) query = query.eq("requested_by", uid);
    const { data: prData, error } = await query;
    if (error) { toast.error(error.message); setLoading(false); return; }

    let nameMap: Record<string, string> = {};
    if (admin && prData && prData.length > 0) {
      const ids = [...new Set(prData.map((r) => r.requested_by))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]));
    }

    setRequests((prData ?? []).map((r) => ({ ...r, requester_name: nameMap[r.requested_by] ?? "Me" })));
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return requests
      .filter((r) => {
        const matchSearch = !q || r.item_name.toLowerCase().includes(q) || r.requester_name.toLowerCase().includes(q);
        const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        const urgA = URGENCY_ORDER[a.urgency] ?? 0;
        const urgB = URGENCY_ORDER[b.urgency] ?? 0;
        return urgencySort === "desc" ? urgB - urgA : urgA - urgB;
      });
  }, [requests, search, statusFilter, urgencySort]);

  const stats = useMemo(() => ({
    pending: requests.filter((r) => r.status === "PENDING").length,
    ordered: requests.filter((r) => r.status === "ORDERED").length,
    received: requests.filter((r) => r.status === "RECEIVED").length,
    highUrgency: requests.filter((r) => r.urgency === "HIGH" && r.status === "PENDING").length,
  }), [requests]);

  const reload = () => { if (userId) load(userId, isAdmin); };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 xl:p-8 space-y-6">

      {/* Header */}
      <section className="rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 text-white p-6 md:p-8 shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-slate-300">{isAdmin ? "Procurement" : "My Requests"}</p>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold">Purchase Requests</h1>
            <p className="mt-2 text-sm text-slate-200">
              {isAdmin ? "Manage inventory purchase requests from your team." : "Request supplies and equipment for your jobs."}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Pending",   value: stats.pending,    color: "text-amber-300" },
              { label: "Ordered",   value: stats.ordered,    color: "text-blue-300" },
              { label: "Received",  value: stats.received,   color: "text-emerald-300" },
              { label: "Urgent",    value: stats.highUrgency, color: "text-red-300" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className={`text-xs uppercase tracking-wide ${s.color}`}>{s.label}</p>
                <p className="mt-1 text-2xl font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* High urgency banner */}
      {stats.highUrgency > 0 && isAdmin && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-5 py-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-700">
            {stats.highUrgency} high-urgency {stats.highUrgency === 1 ? "request requires" : "requests require"} attention.
          </p>
        </div>
      )}

      {/* Table */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">{isAdmin ? "All Requests" : "My Requests"}</h2>
              <p className="text-sm text-slate-500">{requests.length} total</p>
            </div>
            <div className="flex flex-row gap-2 flex-wrap">
              <label className="relative flex-1 min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-500" />
              </label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 bg-white">
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="ORDERED">Ordered</option>
                <option value="RECEIVED">Received</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <button onClick={() => setUrgencySort((s) => s === "desc" ? "asc" : "desc")}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Urgency {urgencySort === "desc" ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                <Plus className="h-4 w-4" /> New Request
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                {isAdmin && <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</th>}
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Item</th>
                <th className="hidden md:table-cell px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Quantity</th>
                <th className="hidden md:table-cell px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Urgency</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="hidden md:table-cell px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{isAdmin ? "Actions" : "Comment"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                  {requests.length === 0 ? "No purchase requests yet." : "No requests match the current filters."}
                </td></tr>
              )}
              {!loading && filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  {isAdmin && <td className="px-5 py-4 text-sm font-medium text-slate-900">{r.requester_name}</td>}
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-slate-900">{r.item_name}</p>
                    {r.inventory_item_id && <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Package className="h-3 w-3" />Linked to inventory</p>}
                    {r.notes && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-48">{r.notes}</p>}
                    {/* Qty + urgency shown inline on mobile */}
                    <div className="md:hidden flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">{r.quantity} {r.unit}</span>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${URGENCY_STYLES[r.urgency]}`}>{r.urgency}</span>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-5 py-4 text-sm text-slate-700">{r.quantity} {r.unit}</td>
                  <td className="hidden md:table-cell px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${URGENCY_STYLES[r.urgency]}`}>{r.urgency}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                      {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                    </span>
                    <p className="md:hidden text-xs text-slate-400 mt-0.5">{fmtDate(r.created_at)}</p>
                  </td>
                  <td className="hidden md:table-cell px-5 py-4 text-sm text-slate-600">{fmtDate(r.created_at)}</td>
                  {isAdmin ? (
                    <td className="px-5 py-4">
                      {r.status === "PENDING" || r.status === "ORDERED" ? (
                        <button onClick={() => setReviewing(r)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors">
                          Review
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          {r.status === "RECEIVED" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-rose-400" />}
                          {r.admin_comment ?? r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                        </div>
                      )}
                    </td>
                  ) : (
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {r.admin_comment ?? (r.status === "PENDING" ? <span className="text-amber-600">Awaiting review</span> : "—")}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modals */}
      {userId && (
        <SubmitModal open={showModal} userId={userId} onClose={() => setShowModal(false)} onSaved={reload} />
      )}
      {reviewing && userId && (
        <ReviewModal request={reviewing} adminId={userId} onClose={() => setReviewing(null)} onDone={reload} />
      )}
    </div>
  );
}
