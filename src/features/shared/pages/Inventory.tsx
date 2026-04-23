import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import { AlertTriangle, Package, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";

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

type ModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: InventoryItem | null;
};

function ItemModal({ open, onClose, onSaved, editing }: ModalProps) {
  const [form, setForm] = useState<ItemForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        category: editing.category,
        quantity: editing.quantity,
        unit: editing.unit,
        min_quantity: editing.min_quantity,
        location: editing.location ?? "",
        notes: editing.notes ?? "",
      });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [editing, open]);

  if (!open) return null;

  const set = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

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
    onSaved();
    onClose();
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

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("inventory").select("*").order("name");
    if (error) toast.error(error.message);
    else setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const q = search.toLowerCase();
      const matchSearch = !q || item.name.toLowerCase().includes(q) || (item.location ?? "").toLowerCase().includes(q);
      const matchCat = categoryFilter === "All" || item.category === categoryFilter;
      const ss = stockStatus(item).label;
      const matchStock =
        stockFilter === "All" ||
        (stockFilter === "Low" && ss === "Low Stock") ||
        (stockFilter === "Out" && ss === "Out of Stock") ||
        (stockFilter === "OK" && ss === "In Stock");
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

  const openEdit = (item: InventoryItem) => { setEditing(item); setShowModal(true); };
  const openCreate = () => { setEditing(null); setShowModal(true); };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex justify-between items-start max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Equipment & Inventory</h1>
            <p className="text-gray-500 text-sm mt-1">Track stock levels, locations, and restock needs.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetch} disabled={loading} className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Items", value: stats.total, icon: <Package className="h-5 w-5 text-blue-500" />, bg: "bg-blue-50" },
            { label: "Categories", value: stats.categories, icon: <Package className="h-5 w-5 text-purple-500" />, bg: "bg-purple-50" },
            { label: "Low Stock", value: stats.low, icon: <AlertTriangle className="h-5 w-5 text-amber-500" />, bg: "bg-amber-50" },
            { label: "Out of Stock", value: stats.out, icon: <AlertTriangle className="h-5 w-5 text-red-500" />, bg: "bg-red-50" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${s.bg} flex items-center justify-center flex-shrink-0`}>{s.icon}</div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="All">All Stock Levels</option>
            <option value="OK">In Stock</option>
            <option value="Low">Low Stock</option>
            <option value="Out">Out of Stock</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              <RefreshCw className="animate-spin h-5 w-5 mr-2" /> Loading inventory…
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Item", "Category", "Location", "Quantity", "Min Level", "Status", "Last Restocked", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-16 text-gray-400 text-sm">No items found.</td></tr>
                ) : filtered.map((item) => {
                  const ss = stockStatus(item);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                        {item.notes && <p className="text-xs text-gray-400 truncate max-w-[200px]">{item.notes}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.category}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.location ?? "—"}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{item.quantity} <span className="text-gray-400 font-normal text-xs">{item.unit}</span></td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.min_quantity} {item.unit}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${ss.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />{ss.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.last_restocked ? new Date(item.last_restocked).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => setConfirmDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 className="h-4 w-4" /></button>
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

      <ItemModal open={showModal} onClose={() => setShowModal(false)} onSaved={fetch} editing={editing} />

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
