import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import { AlertTriangle, ArrowDownCircle, Package, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useRole } from "../../../hooks/useRole";

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  min_quantity: number;
  location: string | null;
  notes: string | null;
  last_restocked: string | null;
  created_at: string;
};

type Job = { id: string; title: string; client_name: string };

type ItemForm = {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  min_quantity: number;
  location: string;
  notes: string;
};

const DEFAULT_FORM: ItemForm = {
  name: "",
  category: "Cleaning Supplies",
  quantity: 0,
  unit: "units",
  min_quantity: 5,
  location: "",
  notes: "",
};

const CATEGORIES = ["Cleaning Supplies", "PPE", "Equipment", "Chemicals", "Consumables", "Other"];

function stockStatus(item: InventoryItem): { label: string; cls: string; dot: string } {
  if (item.quantity === 0) return { label: "Out of Stock", cls: "bg-red-50 text-red-700 border-red-100", dot: "bg-red-500" };
  if (item.quantity <= item.min_quantity) return { label: "Low Stock", cls: "bg-amber-50 text-amber-700 border-amber-100", dot: "bg-amber-500" };
  return { label: "In Stock", cls: "bg-green-50 text-green-700 border-green-100", dot: "bg-green-500" };
}

// ── Add / Edit Item Modal ─────────────────────────────────────────────────────
type ModalProps = { open: boolean; onClose: () => void; onSaved: () => void; editing?: InventoryItem | null };

function ItemModal({ open, onClose, onSaved, editing }: ModalProps) {
  const [form, setForm] = useState<ItemForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({ name: editing.name, category: editing.category, quantity: editing.quantity, unit: editing.unit, min_quantity: editing.min_quantity, location: editing.location ?? "", notes: editing.notes ?? "" });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [editing, open]);

  if (!open) return null;

  const set = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) => setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    const payload = { name: form.name.trim(), category: form.category, quantity: form.quantity, unit: form.unit, min_quantity: form.min_quantity, location: form.location.trim() || null, notes: form.notes.trim() || null, last_restocked: new Date().toISOString() };
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
      <div className="relative z-10 w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-slate-900">{editing ? "Edit Item" : "Add Item"}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Item Name *</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="Heavy Duty Degreaser" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Warehouse Shelf B3" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
              <input type="number" min={0} value={form.quantity} onChange={(e) => set("quantity", Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
              <input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="litres, pcs, kg…" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Min Stock Level</label>
              <input type="number" min={0} value={form.min_quantity} onChange={(e) => set("min_quantity", Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Supplier, expiry, hazmat info…" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Saving…" : editing ? "Update" : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Use Item Modal ────────────────────────────────────────────────────────────
type UseItemModalProps = { item: InventoryItem | null; onClose: () => void; onUsed: () => void };

function UseItemModal({ item, onClose, onUsed }: UseItemModalProps) {
  const [qty, setQty] = useState(1);
  const [jobId, setJobId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qty <= 0) { toast.error("Quantity must be > 0"); return; }
    if (qty > item.quantity) { toast.error(`Only ${item.quantity} ${item.unit} available.`); return; }
    setSaving(true);

    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) { toast.error("Not logged in."); setSaving(false); return; }

    // Log usage
    const { error: usageErr } = await supabase.from("inventory_usage").insert({
      user_id: userId,
      job_id: jobId || null,
      item_id: item.id,
      quantity_used: qty,
      notes: notes.trim() || null,
    });
    if (usageErr) { toast.error(usageErr.message); setSaving(false); return; }

    // Deduct from inventory
    const { error: invErr } = await supabase
      .from("inventory")
      .update({ quantity: item.quantity - qty })
      .eq("id", item.id);
    if (invErr) { toast.error(invErr.message); setSaving(false); return; }

    toast.success(`Used ${qty} ${item.unit} of ${item.name}.`);
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
            <p className="text-xs text-slate-500 mt-0.5">{item.name} — {item.quantity} {item.unit} available</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity to Use *</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg border border-slate-200 text-lg font-bold text-slate-600 hover:bg-slate-50">−</button>
              <input type="number" min={1} max={item.quantity} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="flex-1 text-center px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setQty((q) => Math.min(item.quantity, q + 1))} className="w-9 h-9 rounded-lg border border-slate-200 text-lg font-bold text-slate-600 hover:bg-slate-50">+</button>
              <span className="text-sm text-slate-500 min-w-12">{item.unit}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Link to Job (optional)</label>
            <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— No job —</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} ({j.client_name})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why / where used…" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60">
              {saving ? "Logging…" : "Confirm Use"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Inventory Page ───────────────────────────────────────────────────────
export default function Inventory() {
  const { isAdmin } = useRole();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [usingItem, setUsingItem] = useState<InventoryItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("inventory").select("*").order("name");
    if (error) toast.error(error.message);
    else setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const q = search.toLowerCase();
      const matchSearch = !q || item.name.toLowerCase().includes(q) || (item.location ?? "").toLowerCase().includes(q);
      const matchCat = categoryFilter === "All" || item.category === categoryFilter;
      const ss = stockStatus(item).label;
      const matchStock = stockFilter === "All" || (stockFilter === "Low" && ss === "Low Stock") || (stockFilter === "Out" && ss === "Out of Stock") || (stockFilter === "OK" && ss === "In Stock");
      return matchSearch && matchCat && matchStock;
    });
  }, [items, search, categoryFilter, stockFilter]);

  const stats = useMemo(() => ({
    total: items.length,
    low: items.filter((i) => i.quantity > 0 && i.quantity <= i.min_quantity).length,
    out: items.filter((i) => i.quantity === 0).length,
    categories: new Set(items.map((i) => i.category)).size,
  }), [items]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("inventory").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Item removed.");
    setItems((prev) => prev.filter((i) => i.id !== id));
    setConfirmDelete(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 text-white px-6 py-8 md:px-10">
        <div className="max-w-7xl mx-auto flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-slate-400">Operations</p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Equipment & Inventory</h1>
            <p className="mt-2 text-sm text-slate-300">Track stock levels, locations, and log usage per job.</p>
          </div>
          <div className="flex gap-2 self-start md:self-auto">
            <button onClick={fetchItems} disabled={loading} className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white text-sm px-3 py-2.5 rounded-xl hover:bg-white/20 transition-all">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            {isAdmin && (
              <button onClick={() => { setEditing(null); setShowModal(true); }} className="inline-flex items-center gap-2 bg-white text-slate-900 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-blue-50 shadow-md transition-all">
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
            { label: "Total", value: stats.total, fullLabel: "Total Items", icon: <Package className="h-3.5 w-3.5 md:h-5 md:w-5 text-blue-500" />, bg: "bg-blue-50" },
            { label: "Categories", value: stats.categories, fullLabel: "Categories", icon: <Package className="h-3.5 w-3.5 md:h-5 md:w-5 text-purple-500" />, bg: "bg-purple-50" },
            { label: "Low Stock", value: stats.low, fullLabel: "Low Stock", icon: <AlertTriangle className="h-3.5 w-3.5 md:h-5 md:w-5 text-amber-500" />, bg: "bg-amber-50" },
            { label: "Out", value: stats.out, fullLabel: "Out of Stock", icon: <AlertTriangle className="h-3.5 w-3.5 md:h-5 md:w-5 text-red-500" />, bg: "bg-red-50" },
          ].map((s) => (
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

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-row flex-wrap gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="All">All Stock Levels</option>
            <option value="OK">In Stock</option>
            <option value="Low">Low Stock</option>
            <option value="Out">Out of Stock</option>
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
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Item</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Category</th>
                  <th className="hidden md:table-cell text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Location</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Quantity</th>
                  <th className="hidden md:table-cell text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Min Level</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Status</th>
                  <th className="hidden md:table-cell text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Last Restocked</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-16 text-slate-400 text-sm">No items found.</td></tr>
                ) : filtered.map((item) => {
                  const ss = stockStatus(item);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                        {item.notes && <p className="text-xs text-slate-400 truncate max-w-50">{item.notes}</p>}
                        {/* Location shown inline on mobile */}
                        {item.location && (
                          <p className="md:hidden text-xs text-slate-400 mt-0.5">{item.location}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{item.category}</td>
                      <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-600">{item.location ?? "—"}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {item.quantity} <span className="text-slate-400 font-normal text-xs">{item.unit}</span>
                        {/* Min level shown inline on mobile */}
                        <p className="md:hidden text-xs text-slate-400 font-normal mt-0.5">min {item.min_quantity}</p>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-600">{item.min_quantity} {item.unit}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${ss.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />{ss.label}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-600">
                        {item.last_restocked ? new Date(item.last_restocked).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Use Item — available to all, prominent labeled button */}
                          <button
                            onClick={() => setUsingItem(item)}
                            disabled={item.quantity === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                          >
                            <ArrowDownCircle className="h-3.5 w-3.5" />
                            Use Item
                          </button>
                          {/* Edit / Delete — admin only */}
                          {isAdmin && (
                            <>
                              <button onClick={() => { setEditing(item); setShowModal(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"><Pencil className="h-4 w-4" /></button>
                              <button onClick={() => setConfirmDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 className="h-4 w-4" /></button>
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
      </div>

      {isAdmin && <ItemModal open={showModal} onClose={() => setShowModal(false)} onSaved={fetchItems} editing={editing} />}
      <UseItemModal item={usingItem} onClose={() => setUsingItem(null)} onUsed={fetchItems} />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative z-10 rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-slate-900 text-lg">Remove item?</h3>
            <p className="text-sm text-slate-500 mt-1">This cannot be undone.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
