import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../../../lib/supabase";
import { X } from "lucide-react";

type ClientStatus = "ACTIVE" | "INACTIVE" | "PENDING";

export type ClientRecord = {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  unit: string | null;
  status: ClientStatus;
  created_at: string;
  company_type?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Pass a client to open in edit mode; omit / null for add mode */
  editClient?: ClientRecord | null;
};

type ClientForm = {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  unit: string;
  status: ClientStatus;
};

const BLANK: ClientForm = {
  name: "", contactPerson: "", email: "",
  phone: "", address: "", unit: "", status: "ACTIVE",
};

function toNull(v: string) { const t = v.trim(); return t === "" ? null : t; }

export default function AddClientModal({ open, onClose, onSaved, editClient }: Props) {
  const [form, setForm] = useState<ClientForm>(BLANK);
  const [saving, setSaving] = useState(false);

  const isEdit = !!editClient;

  // Populate form when editing
  useEffect(() => {
    if (editClient) {
      setForm({
        name:          editClient.name ?? "",
        contactPerson: editClient.contact_person ?? "",
        email:         editClient.email ?? "",
        phone:         editClient.phone ?? "",
        address:       editClient.address ?? "",
        unit:          editClient.unit ?? "",
        status:        editClient.status ?? "ACTIVE",
      });
    } else {
      setForm(BLANK);
    }
  }, [editClient, open]);

  if (!open) return null;

  const set = <K extends keyof ClientForm>(k: K, v: ClientForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Client name is required."); return; }

    setSaving(true);

    const payload = {
      name:           form.name.trim(),
      contact_person: toNull(form.contactPerson),
      email:          toNull(form.email),
      phone:          toNull(form.phone),
      address:        toNull(form.address),
      unit:           toNull(form.unit),
      status:         form.status,
    };

    const { error } = isEdit
      ? await supabase.from("clients").update(payload).eq("id", editClient!.id)
      : await supabase.from("clients").insert(payload);

    setSaving(false);

    if (error) { toast.error(error.message); return; }

    toast.success(isEdit ? "Client updated." : "Client created.");
    setForm(BLANK);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isEdit ? "Edit Client" : "Add New Client"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit ? "Update client details." : "Add a new client to your database."}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Client Name <span className="text-red-500">*</span></label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Emerald Square Pty Ltd"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            />
          </div>

          {/* Contact + Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
              <input
                value={form.contactPerson}
                onChange={(e) => set("contactPerson", e.target.value)}
                placeholder="John Smith"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as ClientStatus)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              >
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="client@email.com"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+61 4XX XXX XXX"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
            </div>
          </div>

          {/* Unit + Address */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit / Suite</label>
              <input
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="e.g. U 7"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Street Address</label>
              <input
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="32 Morwick St, Strathmore VIC"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
