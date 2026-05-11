/**
 * Supply Kits — admin manages preset bundles of inventory items.
 * Employees use kits from the ClockIn page to log all standard
 * items for a job in one action.
 */

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import {
  Box, ChevronDown, ChevronUp, Package,
  Pencil, Plus, Trash2, X,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────── */
type InventoryItem = { id: string; name: string; unit: string; quantity: number };

type KitItem = {
  id: string;
  item_id: string;
  item_name: string;
  unit: string;
  quantity: number;
};

type Kit = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  items: KitItem[];
};

/* ── Kit Form Modal ─────────────────────────────────────────── */
type KitFormLine = { item_id: string; quantity: string };

type KitModalProps = {
  open: boolean;
  editing: Kit | null;
  inventory: InventoryItem[];
  onClose: () => void;
  onSaved: () => void;
};

function KitModal({ open, editing, inventory, onClose, onSaved }: KitModalProps) {
  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [lines,       setLines]       = useState<KitFormLine[]>([{ item_id: "", quantity: "1" }]);
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setLines(
        editing.items.length > 0
          ? editing.items.map(i => ({ item_id: i.item_id, quantity: String(i.quantity) }))
          : [{ item_id: "", quantity: "1" }]
      );
    } else {
      setName(""); setDescription("");
      setLines([{ item_id: "", quantity: "1" }]);
    }
  }, [open, editing]);

  if (!open) return null;

  const addLine    = () => setLines(prev => [...prev, { item_id: "", quantity: "1" }]);
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));
  const setLine    = (idx: number, key: keyof KitFormLine, val: string) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l));

  const handleSave = async () => {
    if (!name.trim())           { toast.error("Kit name is required."); return; }
    const validLines = lines.filter(l => l.item_id);
    if (validLines.length === 0){ toast.error("Add at least one item."); return; }

    setSaving(true);
    try {
      let kitId: string;

      if (editing) {
        const { error } = await supabase.from("supply_kits")
          .update({ name: name.trim(), description: description.trim() || null })
          .eq("id", editing.id);
        if (error) throw new Error(error.message);
        kitId = editing.id;

        // Replace all items
        const { error: delErr } = await supabase.from("supply_kit_items")
          .delete().eq("kit_id", kitId);
        if (delErr) throw new Error(delErr.message);
      } else {
        const { data, error } = await supabase.from("supply_kits")
          .insert({ name: name.trim(), description: description.trim() || null })
          .select("id").single();
        if (error) throw new Error(error.message);
        kitId = (data as { id: string }).id;
      }

      const itemRows = validLines.map(l => ({
        kit_id:   kitId,
        item_id:  l.item_id,
        quantity: parseFloat(l.quantity) || 1,
      }));
      const { error: insErr } = await supabase.from("supply_kit_items").insert(itemRows);
      if (insErr) throw new Error(insErr.message);

      toast.success(editing ? "Kit updated." : "Kit created.");
      onSaved(); onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  // Prevent duplicate item selections in the same kit
  const selectedIds = lines.map(l => l.item_id).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-slate-900">{editing ? "Edit Kit" : "New Kit"}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kit Name *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Standard Escalator Clean"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Items used for a standard single-escalator clean"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Items in this Kit</label>
              <button type="button" onClick={addLine}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                <Plus className="h-3.5 w-3.5" /> Add row
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select value={line.item_id} onChange={e => setLine(idx, "item_id", e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select item —</option>
                    {inventory.map(i => (
                      <option key={i.id} value={i.id}
                        disabled={selectedIds.includes(i.id) && i.id !== line.item_id}>
                        {i.name} ({i.unit})
                      </option>
                    ))}
                  </select>
                  <input type="number" min={0.01} step="any" value={line.quantity}
                    onChange={e => setLine(idx, "quantity", e.target.value)}
                    placeholder="Qty"
                    className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={() => removeLine(idx)} disabled={lines.length === 1}
                    className="p-1.5 text-slate-400 hover:text-red-500 disabled:opacity-30">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Saving…" : editing ? "Update Kit" : "Create Kit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Main SupplyKits Page
   ════════════════════════════════════════════════════════════ */
export default function SupplyKits() {
  const [kits,      setKits]      = useState<Kit[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState<Record<string, boolean>>({});
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState<Kit | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);

    const [kitsRes, kitItemsRes, invRes] = await Promise.all([
      supabase.from("supply_kits").select("*").order("name"),
      supabase.from("supply_kit_items").select("id, kit_id, item_id, quantity"),
      supabase.from("inventory").select("id, name, unit, quantity").order("name"),
    ]);

    const invData = (invRes.data ?? []) as InventoryItem[];
    setInventory(invData);

    const invMap = Object.fromEntries(invData.map(i => [i.id, i]));

    type RawKit  = { id: string; name: string; description: string | null; created_at: string };
    type RawItem = { id: string; kit_id: string; item_id: string; quantity: number };

    const rawKits  = (kitsRes.data     ?? []) as RawKit[];
    const rawItems = (kitItemsRes.data ?? []) as RawItem[];

    setKits(rawKits.map(k => ({
      ...k,
      items: rawItems
        .filter(i => i.kit_id === k.id)
        .map(i => ({
          id:        i.id,
          item_id:   i.item_id,
          item_name: invMap[i.item_id]?.name ?? "Unknown",
          unit:      invMap[i.item_id]?.unit ?? "",
          quantity:  i.quantity,
        })),
    })));

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleExpand = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("supply_kits").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Kit deleted.");
    setKits(prev => prev.filter(k => k.id !== id));
    setDeleting(null);
  };

  const openEdit = (kit: Kit) => { setEditing(kit); setShowModal(true); };
  const openNew  = () =>          { setEditing(null); setShowModal(true); };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <section className="bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 text-white px-6 py-8 md:px-10">
        <div className="max-w-5xl mx-auto flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-slate-400">Operations · Inventory</p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Supply Kits</h1>
            <p className="mt-2 text-sm text-slate-300">
              Define preset bundles of supplies used on a standard job. Employees can apply a kit with one tap to log all items at once.
            </p>
          </div>
          <button onClick={openNew}
            className="self-start md:self-auto inline-flex items-center gap-2 bg-white text-slate-900 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-blue-50 shadow-md transition-all">
            <Plus className="h-4 w-4" /> New Kit
          </button>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-4">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm">Loading kits…</div>
        ) : kits.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 py-20 flex flex-col items-center gap-3 text-slate-400">
            <Box className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">No supply kits yet</p>
            <button onClick={openNew}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Create your first kit
            </button>
          </div>
        ) : kits.map(kit => (
          <div key={kit.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Kit header */}
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900">{kit.name}</h3>
                {kit.description && <p className="text-xs text-slate-400 mt-0.5">{kit.description}</p>}
                <p className="text-xs text-slate-400 mt-0.5">{kit.items.length} item{kit.items.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openEdit(kit)}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => setDeleting(kit.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
                <button onClick={() => toggleExpand(kit.id)}
                  className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                  {expanded[kit.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Expanded items */}
            {expanded[kit.id] && (
              <div className="border-t border-slate-100 divide-y divide-slate-100">
                {kit.items.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400">No items in this kit.</p>
                ) : kit.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3">
                    <p className="text-sm text-slate-800 font-medium">{item.item_name}</p>
                    <span className="text-sm text-slate-500">{item.quantity} {item.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <KitModal
        open={showModal}
        editing={editing}
        inventory={inventory}
        onClose={() => setShowModal(false)}
        onSaved={fetchData}
      />

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setDeleting(null)} />
          <div className="relative z-10 rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-slate-900 text-lg">Delete kit?</h3>
            <p className="text-sm text-slate-500 mt-1">This will permanently remove the kit. Usage history is unaffected.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setDeleting(null)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => handleDelete(deleting)}
                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
