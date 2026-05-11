import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import {
  AlertTriangle, ArrowDownCircle, Building2, Calendar,
  ClipboardList, DollarSign, Hash, Package, Pencil,
  Phone, Plus, RefreshCw, RotateCcw, Search,
  ShoppingCart, Trash2, User, X,
} from "lucide-react";
import { useRole } from "../../../hooks/useRole";

/* ── Types ─────────────────────────────────────────────────── */
type InventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  min_quantity: number;
  unit_cost: number | null;
  supplier_name: string | null;
  supplier_contact: string | null;
  supplier_code: string | null;
  expiry_date: string | null;
  location: string | null;
  notes: string | null;
  last_restocked: string | null;
  created_at: string;
};

type UsageRow = {
  id: string;
  item_id: string;
  item_name: string;
  quantity_used: number;
  unit: string;
  cost_per_unit: number | null;
  job_id: string | null;
  job_title: string | null;
  client_name: string | null;
  user_name: string | null;
  notes: string | null;
  created_at: string;
};

type Job = { id: string; title: string; client_name: string };

type ItemForm = {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  min_quantity: number;
  unit_cost: string;
  supplier_name: string;
  supplier_contact: string;
  supplier_code: string;
  expiry_date: string;
  location: string;
  notes: string;
};

/* ── Constants ─────────────────────────────────────────────── */
const DEFAULT_FORM: ItemForm = {
  name: "", category: "Cleaning Chemicals", quantity: 0,
  unit: "litres", min_quantity: 5, unit_cost: "",
  supplier_name: "", supplier_contact: "", supplier_code: "",
  expiry_date: "", location: "", notes: "",
};

const CATEGORIES = [
  "Cleaning Chemicals", "Degreasers", "Lubricants",
  "PPE", "Safety Equipment", "Tools",
  "Consumables", "Equipment", "Other",
];

/* ── Helpers ───────────────────────────────────────────────── */
function stockStatus(item: InventoryItem) {
  if (item.quantity === 0)
    return { label: "Out of Stock", cls: "bg-red-50 text-red-700 border-red-100", dot: "bg-red-500" };
  if (item.quantity <= item.min_quantity)
    return { label: "Low Stock",    cls: "bg-amber-50 text-amber-700 border-amber-100", dot: "bg-amber-500" };
  return { label: "In Stock",       cls: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500" };
}

function isExpiringSoon(expiry: string | null): boolean {
  if (!expiry) return false;
  const exp = new Date(expiry);
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  return exp <= soon;
}

function isExpired(expiry: string | null): boolean {
  if (!expiry) return false;
  return new Date(expiry) < new Date();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

/* ════════════════════════════════════════════════════════════
   Add / Edit Item Modal
   ════════════════════════════════════════════════════════════ */
type ModalProps = { open: boolean; onClose: () => void; onSaved: () => void; editing?: InventoryItem | null };

function ItemModal({ open, onClose, onSaved, editing }: ModalProps) {
  const [form, setForm] = useState<ItemForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name, category: editing.category,
        quantity: editing.quantity, unit: editing.unit,
        min_quantity: editing.min_quantity,
        unit_cost: editing.unit_cost != null ? String(editing.unit_cost) : "",
        supplier_name: editing.supplier_name ?? "",
        supplier_contact: editing.supplier_contact ?? "",
        supplier_code: editing.supplier_code ?? "",
        expiry_date: editing.expiry_date ?? "",
        location: editing.location ?? "",
        notes: editing.notes ?? "",
      });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [editing, open]);

  if (!open) return null;

  const set = <K extends keyof ItemForm>(key: K, val: ItemForm[K]) =>
    setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      quantity: form.quantity,
      unit: form.unit,
      min_quantity: form.min_quantity,
      unit_cost: form.unit_cost ? parseFloat(form.unit_cost) : null,
      supplier_name: form.supplier_name.trim() || null,
      supplier_contact: form.supplier_contact.trim() || null,
      supplier_code: form.supplier_code.trim() || null,
      expiry_date: form.expiry_date || null,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      last_restocked: new Date().toISOString(),
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("inventory").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("inventory").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Item updated." : "Item added.");
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-slate-900">{editing ? "Edit Item" : "Add Item"}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Stock details */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Stock Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Item Name *</label>
                <input value={form.name} onChange={e => set("name", e.target.value)} required
                  placeholder="Heavy Duty Degreaser"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select value={form.category} onChange={e => set("category", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Storage Location</label>
                <input value={form.location} onChange={e => set("location", e.target.value)}
                  placeholder="Van shelf 2 / Warehouse B3"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <input type="number" min={0} value={form.quantity} onChange={e => set("quantity", Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                <input value={form.unit} onChange={e => set("unit", e.target.value)}
                  placeholder="litres, pcs, kg…"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Stock Level</label>
                <input type="number" min={0} value={form.min_quantity} onChange={e => set("min_quantity", Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit Cost (AUD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input type="number" min={0} step={0.01} value={form.unit_cost}
                    onChange={e => set("unit_cost", e.target.value)} placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Expiry / Replace By Date</label>
                <input type="date" value={form.expiry_date} onChange={e => set("expiry_date", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Supplier details */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Supplier Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Name</label>
                <input value={form.supplier_name} onChange={e => set("supplier_name", e.target.value)}
                  placeholder="CleanTech Supplies Pty Ltd"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Contact</label>
                <input value={form.supplier_contact} onChange={e => set("supplier_contact", e.target.value)}
                  placeholder="02 9000 0000 / orders@supplier.com.au"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product / Part Code</label>
                <input value={form.supplier_code} onChange={e => set("supplier_code", e.target.value)}
                  placeholder="CT-DGR-5L"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input value={form.notes} onChange={e => set("notes", e.target.value)}
                  placeholder="Hazmat info, storage conditions…"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Saving…" : editing ? "Update Item" : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Use Item Modal
   ════════════════════════════════════════════════════════════ */
type UseItemModalProps = { item: InventoryItem | null; onClose: () => void; onUsed: () => void };

function UseItemModal({ item, onClose, onUsed }: UseItemModalProps) {
  const [qty, setQty]       = useState(1);
  const [jobId, setJobId]   = useState("");
  const [notes, setNotes]   = useState("");
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs]     = useState<Job[]>([]);

  useEffect(() => {
    if (!item) return;
    setQty(1); setJobId(""); setNotes("");
    supabase
      .from("jobs")
      .select("id, title, client_name")
      .in("status", ["SCHEDULED", "IN_PROGRESS"])
      .order("scheduled_at")
      .then(({ data }) => setJobs(data ?? []));
  }, [item]);

  if (!item) return null;

  const totalCost = item.unit_cost != null ? (item.unit_cost * qty).toFixed(2) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qty <= 0)           { toast.error("Quantity must be > 0"); return; }
    if (qty > item.quantity){ toast.error(`Only ${item.quantity} ${item.unit} available.`); return; }
    setSaving(true);

    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) { toast.error("Not logged in."); setSaving(false); return; }

    // Log usage with cost snapshot
    const { error: usageErr } = await supabase.from("inventory_usage").insert({
      user_id: userId,
      job_id: jobId || null,
      item_id: item.id,
      quantity_used: qty,
      cost_per_unit: item.unit_cost ?? null,
      notes: notes.trim() || null,
    });
    if (usageErr) { toast.error(usageErr.message); setSaving(false); return; }

    const newQty = item.quantity - qty;

    // Deduct from inventory
    const { error: invErr } = await supabase
      .from("inventory")
      .update({ quantity: newQty })
      .eq("id", item.id);
    if (invErr) { toast.error(invErr.message); setSaving(false); return; }

    toast.success(`Used ${qty} ${item.unit} of ${item.name}.`);

    // Auto-generate a purchase request if stock dropped to or below minimum
    if (newQty <= item.min_quantity) {
      const prPayload = {
        requested_by: userId,
        item_name: item.name,
        inventory_item_id: item.id,
        quantity: item.min_quantity * 2, // sensible restock amount
        unit: item.unit,
        urgency: newQty === 0 ? "HIGH" : "MEDIUM",
        notes: `Auto-generated: stock dropped to ${newQty} ${item.unit} (min: ${item.min_quantity}).${
          item.supplier_name ? ` Supplier: ${item.supplier_name}` : ""
        }${item.supplier_code ? ` — Code: ${item.supplier_code}` : ""}`,
      };
      const { error: prErr } = await supabase.from("purchase_requests").insert(prPayload);
      if (!prErr) {
        toast(`📦 Low stock alert: restock request auto-created for ${item.name}.`, { duration: 4000 });
      }
    }

    setSaving(false);
    onUsed();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Use Item</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {item.name} — {item.quantity} {item.unit} available
              {item.unit_cost != null && ` · $${item.unit_cost.toFixed(2)}/${item.unit}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity to Use *</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-lg border border-slate-200 text-lg font-bold text-slate-600 hover:bg-slate-50">−</button>
              <input type="number" min={1} max={item.quantity} value={qty}
                onChange={e => setQty(Number(e.target.value))}
                className="flex-1 text-center px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setQty(q => Math.min(item.quantity, q + 1))}
                className="w-9 h-9 rounded-lg border border-slate-200 text-lg font-bold text-slate-600 hover:bg-slate-50">+</button>
              <span className="text-sm text-slate-500 min-w-12">{item.unit}</span>
            </div>
            {totalCost && (
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Estimated cost: <strong>${totalCost}</strong>
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Link to Job (optional)</label>
            <select value={jobId} onChange={e => setJobId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— No job —</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title} ({j.client_name})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Why / where used…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {item.quantity <= item.min_quantity && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
              Stock is already at or below minimum. A restock request will be auto-created.
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60">
              {saving ? "Logging…" : "Confirm Use"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Quick Restock Modal
   ════════════════════════════════════════════════════════════ */
type RestockModalProps = { item: InventoryItem | null; userId: string; onClose: () => void; onDone: () => void };

function RestockModal({ item, userId, onClose, onDone }: RestockModalProps) {
  const [qty,     setQty]     = useState("");
  const [urgency, setUrgency] = useState<"LOW"|"MEDIUM"|"HIGH">("MEDIUM");
  const [notes,   setNotes]   = useState("");
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (!item) return;
    setQty(String(item.min_quantity * 2));
    setNotes(
      [
        item.supplier_name   ? `Supplier: ${item.supplier_name}` : "",
        item.supplier_contact ? `Contact: ${item.supplier_contact}` : "",
        item.supplier_code   ? `Code: ${item.supplier_code}` : "",
      ].filter(Boolean).join(" | ") || ""
    );
    setUrgency(item.quantity === 0 ? "HIGH" : "MEDIUM");
  }, [item]);

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseFloat(qty);
    if (!q || q <= 0) { toast.error("Enter a valid quantity."); return; }
    setSaving(true);
    const { error } = await supabase.from("purchase_requests").insert({
      requested_by: userId,
      item_name: item.name,
      inventory_item_id: item.id,
      quantity: q,
      unit: item.unit,
      urgency,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Restock request submitted.");
    onDone(); onClose();
  };

  const URGENCY_STYLES: Record<string, string> = {
    LOW:    "bg-slate-50 text-slate-600 border-slate-200",
    MEDIUM: "bg-amber-50 text-amber-700 border-amber-100",
    HIGH:   "bg-red-50 text-red-700 border-red-100",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Quick Restock</h2>
            <p className="text-xs text-slate-500 mt-0.5">{item.name} — currently {item.quantity} {item.unit}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Supplier info preview */}
          {(item.supplier_name || item.supplier_contact || item.supplier_code) && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 space-y-1 text-xs text-blue-800">
              {item.supplier_name    && <p className="flex items-center gap-1.5"><Building2 className="h-3 w-3" />{item.supplier_name}</p>}
              {item.supplier_contact && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{item.supplier_contact}</p>}
              {item.supplier_code    && <p className="flex items-center gap-1.5"><Hash className="h-3 w-3" />Code: {item.supplier_code}</p>}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity to Order ({item.unit})</label>
            <input type="number" min="0.01" step="any" value={qty} onChange={e => setQty(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {item.unit_cost && qty && (
              <p className="text-xs text-slate-400 mt-1">
                Est. cost: ${(item.unit_cost * parseFloat(qty || "0")).toFixed(2)}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Urgency</label>
            <div className="flex gap-2">
              {(["LOW","MEDIUM","HIGH"] as const).map(u => (
                <button key={u} type="button" onClick={() => setUrgency(u)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    urgency === u
                      ? URGENCY_STYLES[u] + " ring-2 ring-offset-1 ring-current"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              <ShoppingCart className="h-4 w-4" />
              {saving ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Usage History Tab
   ════════════════════════════════════════════════════════════ */
function UsageHistory() {
  const [rows,       setRows]       = useState<UsageRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");

  useEffect(() => {
    const fetchUsage = async () => {
      setLoading(true);
      // Pull usage + join inventory name
      const { data: usageData, error } = await supabase
        .from("inventory_usage")
        .select("id, item_id, quantity_used, cost_per_unit, job_id, notes, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) { toast.error(error.message); setLoading(false); return; }

      const usage = usageData ?? [];

      // Fetch inventory names
      const itemIds = [...new Set(usage.map((r: { item_id: string }) => r.item_id))];
      const jobIds  = [...new Set(usage.map((r: { job_id: string|null }) => r.job_id).filter(Boolean))] as string[];
      const userIds = [...new Set(usage.map((r: { user_id: string }) => r.user_id))];

      const [itemsRes, jobsRes, profilesRes] = await Promise.all([
        itemIds.length  ? supabase.from("inventory").select("id, name, unit").in("id", itemIds) : { data: [] },
        jobIds.length   ? supabase.from("jobs").select("id, title, client_name").in("id", jobIds) : { data: [] },
        userIds.length  ? supabase.from("profiles").select("id, full_name").in("id", userIds) : { data: [] },
      ]);

      type ItemMap  = { id: string; name: string; unit: string };
      type JobMap   = { id: string; title: string; client_name: string };
      type ProfMap  = { id: string; full_name: string | null };

      const itemMap:  Record<string, ItemMap>  = Object.fromEntries(((itemsRes.data    ?? []) as ItemMap[]).map(i => [i.id, i]));
      const jobMap:   Record<string, JobMap>   = Object.fromEntries(((jobsRes.data     ?? []) as JobMap[]).map(j => [j.id, j]));
      const profMap:  Record<string, ProfMap>  = Object.fromEntries(((profilesRes.data ?? []) as ProfMap[]).map(p => [p.id, p]));

      setRows(usage.map((r: { id: string; item_id: string; quantity_used: number; cost_per_unit: number | null; job_id: string | null; notes: string | null; created_at: string; user_id: string }) => ({
        id:           r.id,
        item_id:      r.item_id,
        item_name:    itemMap[r.item_id]?.name  ?? "Unknown item",
        quantity_used: r.quantity_used,
        unit:          itemMap[r.item_id]?.unit  ?? "",
        cost_per_unit: r.cost_per_unit,
        job_id:        r.job_id,
        job_title:     r.job_id ? (jobMap[r.job_id]?.title ?? null) : null,
        client_name:   r.job_id ? (jobMap[r.job_id]?.client_name ?? null) : null,
        user_name:     profMap[r.user_id]?.full_name ?? "Unknown",
        notes:         r.notes,
        created_at:    r.created_at,
      })));
      setLoading(false);
    };
    fetchUsage();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => {
      const matchSearch = !q ||
        r.item_name.toLowerCase().includes(q) ||
        (r.job_title ?? "").toLowerCase().includes(q) ||
        (r.user_name ?? "").toLowerCase().includes(q);
      const matchFrom = !dateFrom || new Date(r.created_at) >= new Date(dateFrom);
      const matchTo   = !dateTo   || new Date(r.created_at) <= new Date(dateTo + "T23:59:59");
      return matchSearch && matchFrom && matchTo;
    });
  }, [rows, search, dateFrom, dateTo]);

  const totalCost = filtered.reduce((acc, r) =>
    acc + (r.cost_per_unit != null ? r.cost_per_unit * r.quantity_used : 0), 0);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input placeholder="Search item, job, employee…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="text-xs text-slate-400">From</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-xs text-slate-400">To</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {totalCost > 0 && (
          <div className="ml-auto text-sm font-semibold text-slate-700">
            Total cost: <span className="text-emerald-700">${totalCost.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            <RefreshCw className="animate-spin h-5 w-5 mr-2" /> Loading history…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No usage records found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Date</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Item</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Qty Used</th>
                <th className="hidden md:table-cell text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Cost</th>
                <th className="hidden md:table-cell text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Job</th>
                <th className="hidden md:table-cell text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Employee</th>
                <th className="hidden md:table-cell text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">{r.item_name}</td>
                  <td className="px-5 py-3 text-sm text-slate-700">{r.quantity_used} {r.unit}</td>
                  <td className="hidden md:table-cell px-5 py-3 text-sm text-slate-700">
                    {r.cost_per_unit != null
                      ? <span className="text-emerald-700 font-medium">${(r.cost_per_unit * r.quantity_used).toFixed(2)}</span>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="hidden md:table-cell px-5 py-3 text-sm text-slate-600">
                    {r.job_title
                      ? <><p className="font-medium">{r.job_title}</p><p className="text-xs text-slate-400">{r.client_name}</p></>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="hidden md:table-cell px-5 py-3 text-sm text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-400" />{r.user_name}
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-5 py-3 text-xs text-slate-400 max-w-40 truncate">{r.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Main Inventory Page
   ════════════════════════════════════════════════════════════ */
export default function Inventory() {
  const { isAdmin }    = useRole();
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems]   = useState<InventoryItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");
  const [activeTab, setActiveTab]     = useState<"stock"|"history">("stock");
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState<InventoryItem | null>(null);
  const [usingItem, setUsingItem]     = useState<InventoryItem | null>(null);
  const [restocking, setRestocking]   = useState<InventoryItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("inventory").select("*").order("name");
    if (error) toast.error(error.message);
    else setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const filtered = useMemo(() => items.filter(item => {
    const q = search.toLowerCase();
    const matchSearch = !q || item.name.toLowerCase().includes(q) ||
      (item.location ?? "").toLowerCase().includes(q) ||
      (item.supplier_name ?? "").toLowerCase().includes(q);
    const matchCat   = categoryFilter === "All" || item.category === categoryFilter;
    const ss         = stockStatus(item).label;
    const matchStock = stockFilter === "All" ||
      (stockFilter === "Low"  && ss === "Low Stock") ||
      (stockFilter === "Out"  && ss === "Out of Stock") ||
      (stockFilter === "OK"   && ss === "In Stock") ||
      (stockFilter === "Expiry" && isExpiringSoon(item.expiry_date));
    return matchSearch && matchCat && matchStock;
  }), [items, search, categoryFilter, stockFilter]);

  const stats = useMemo(() => ({
    total:      items.length,
    low:        items.filter(i => i.quantity > 0 && i.quantity <= i.min_quantity).length,
    out:        items.filter(i => i.quantity === 0).length,
    expiring:   items.filter(i => isExpiringSoon(i.expiry_date)).length,
  }), [items]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("inventory").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Item removed.");
    setItems(prev => prev.filter(i => i.id !== id));
    setConfirmDelete(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <section className="bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 text-white px-6 py-8 md:px-10">
        <div className="max-w-7xl mx-auto flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-slate-400">Operations</p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Equipment & Inventory</h1>
            <p className="mt-2 text-sm text-slate-300">Track stock, costs, suppliers and log usage per job.</p>
          </div>
          <div className="flex gap-2 self-start md:self-auto">
            <button onClick={fetchItems} disabled={loading}
              className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white text-sm px-3 py-2.5 rounded-xl hover:bg-white/20 transition-all">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            {isAdmin && (
              <button onClick={() => { setEditing(null); setShowModal(true); }}
                className="inline-flex items-center gap-2 bg-white text-slate-900 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-blue-50 shadow-md transition-all">
                <Plus className="h-4 w-4" /> Add Item
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 md:gap-4">
          {[
            { label: "Total",       fullLabel: "Total Items",    value: stats.total,    icon: <Package className="h-3.5 w-3.5 md:h-5 md:w-5 text-blue-500" />,    bg: "bg-blue-50" },
            { label: "Low",         fullLabel: "Low Stock",      value: stats.low,      icon: <AlertTriangle className="h-3.5 w-3.5 md:h-5 md:w-5 text-amber-500" />, bg: "bg-amber-50" },
            { label: "Out",         fullLabel: "Out of Stock",   value: stats.out,      icon: <AlertTriangle className="h-3.5 w-3.5 md:h-5 md:w-5 text-red-500" />,   bg: "bg-red-50" },
            { label: "Expiring",    fullLabel: "Expiring Soon",  value: stats.expiring, icon: <Calendar className="h-3.5 w-3.5 md:h-5 md:w-5 text-rose-500" />,      bg: "bg-rose-50" },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-2 md:p-4 shadow-sm flex flex-col items-center md:flex-row md:items-center gap-1 md:gap-3 text-center md:text-left">
              <div className={`w-7 h-7 md:w-10 md:h-10 rounded-full ${s.bg} flex items-center justify-center shrink-0`}>{s.icon}</div>
              <div>
                <p className="text-[10px] md:text-xs text-slate-500 leading-tight">
                  <span className="md:hidden">{s.label}</span>
                  <span className="hidden md:inline">{s.fullLabel}</span>
                </p>
                <p className="text-lg md:text-2xl font-bold text-slate-900">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Expiry / out-of-stock banners */}
        {stats.out > 0 && (
          <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-5 py-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm font-medium text-red-700">
              {stats.out} item{stats.out > 1 ? "s are" : " is"} completely out of stock.
            </p>
            <button onClick={() => setStockFilter("Out")}
              className="ml-auto text-xs font-semibold text-red-700 underline">View</button>
          </div>
        )}
        {stats.expiring > 0 && (
          <div className="flex items-center gap-3 rounded-xl bg-rose-50 border border-rose-200 px-5 py-3">
            <Calendar className="h-5 w-5 text-rose-500 shrink-0" />
            <p className="text-sm font-medium text-rose-700">
              {stats.expiring} item{stats.expiring > 1 ? "s are" : " is"} expiring within 30 days.
            </p>
            <button onClick={() => setStockFilter("Expiry")}
              className="ml-auto text-xs font-semibold text-rose-700 underline">View</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {([
            { key: "stock",   label: "Stock",         icon: <Package className="h-4 w-4" /> },
            { key: "history", label: "Usage History",  icon: <ClipboardList className="h-4 w-4" /> },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {activeTab === "history" ? <UsageHistory /> : (
          <>
            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-row flex-wrap gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" placeholder="Search items, supplier…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="All">All Categories</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={stockFilter} onChange={e => setStockFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="All">All Stock Levels</option>
                <option value="OK">In Stock</option>
                <option value="Low">Low Stock</option>
                <option value="Out">Out of Stock</option>
                <option value="Expiry">Expiring Soon</option>
              </select>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
                  <RefreshCw className="animate-spin h-5 w-5 mr-2" /> Loading inventory…
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Item</th>
                      <th className="hidden md:table-cell text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Category</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Stock</th>
                      <th className="hidden md:table-cell text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Unit Cost</th>
                      <th className="hidden md:table-cell text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Supplier</th>
                      <th className="hidden md:table-cell text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Expiry</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Status</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-16 text-slate-400 text-sm">No items found.</td></tr>
                    ) : filtered.map(item => {
                      const ss  = stockStatus(item);
                      const exp = isExpired(item.expiry_date);
                      const expSoon = isExpiringSoon(item.expiry_date);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-4">
                            <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                            {item.location && <p className="text-xs text-slate-400 mt-0.5">{item.location}</p>}
                            {item.notes    && <p className="text-xs text-slate-400 truncate max-w-40">{item.notes}</p>}
                          </td>
                          <td className="hidden md:table-cell px-5 py-4 text-sm text-slate-600">{item.category}</td>
                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold text-slate-900">
                              {item.quantity} <span className="text-slate-400 font-normal text-xs">{item.unit}</span>
                            </p>
                            <p className="text-xs text-slate-400">min {item.min_quantity}</p>
                          </td>
                          <td className="hidden md:table-cell px-5 py-4 text-sm text-slate-700">
                            {item.unit_cost != null
                              ? <span className="font-medium">${item.unit_cost.toFixed(2)}<span className="text-slate-400 font-normal text-xs">/{item.unit}</span></span>
                              : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="hidden md:table-cell px-5 py-4">
                            {item.supplier_name ? (
                              <div>
                                <p className="text-sm text-slate-700 font-medium">{item.supplier_name}</p>
                                {item.supplier_contact && <p className="text-xs text-slate-400">{item.supplier_contact}</p>}
                                {item.supplier_code    && <p className="text-xs text-slate-400">Code: {item.supplier_code}</p>}
                              </div>
                            ) : <span className="text-slate-400 text-sm">—</span>}
                          </td>
                          <td className="hidden md:table-cell px-5 py-4 text-sm">
                            {item.expiry_date ? (
                              <span className={exp ? "text-red-600 font-semibold" : expSoon ? "text-amber-600 font-medium" : "text-slate-600"}>
                                {new Date(item.expiry_date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
                                {exp && <span className="block text-xs">EXPIRED</span>}
                                {!exp && expSoon && <span className="block text-xs">Soon</span>}
                              </span>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${ss.cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />{ss.label}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button onClick={() => setUsingItem(item)} disabled={item.quantity === 0}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
                                <ArrowDownCircle className="h-3.5 w-3.5" /> Use
                              </button>
                              {isAdmin && (
                                <button onClick={() => setRestocking(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold hover:bg-blue-100 transition-colors whitespace-nowrap">
                                  <RotateCcw className="h-3.5 w-3.5" /> Restock
                                </button>
                              )}
                              {isAdmin && (
                                <>
                                  <button onClick={() => { setEditing(item); setShowModal(true); }}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"><Pencil className="h-4 w-4" /></button>
                                  <button onClick={() => setConfirmDelete(item.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 className="h-4 w-4" /></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {isAdmin && <ItemModal open={showModal} onClose={() => setShowModal(false)} onSaved={fetchItems} editing={editing} />}
      <UseItemModal item={usingItem} onClose={() => setUsingItem(null)} onUsed={fetchItems} />
      {userId && <RestockModal item={restocking} userId={userId} onClose={() => setRestocking(null)} onDone={() => {}} />}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative z-10 rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-slate-900 text-lg">Remove item?</h3>
            <p className="text-sm text-slate-500 mt-1">This cannot be undone.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
