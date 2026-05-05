import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Download, Plus, RefreshCw, Trash2, Users, X } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import type { Job, JobInput, JobStatus, JobType } from "../../../hooks/Usejobs";
import { frequencyLabel } from "../../../hooks/Usejobs";
import { sendJobEmails } from "../../../lib/jobEmails";

type Employee = { id: string; full_name: string | null; email: string; avatar_url?: string | null };
type Client   = { id: string; name: string; address: string | null };
type EscRow   = { unit_number: string; location: string };
type Template = { unit_number: string; location: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: Job | null;
};

const FREQUENCY_OPTIONS = [
  { label: "Weekly",         days: 7   },
  { label: "Fortnightly",    days: 14  },
  { label: "Monthly",        days: 30  },
  { label: "Every 2 months", days: 60  },
  { label: "Quarterly",      days: 90  },
  { label: "Every 6 months", days: 180 },
  { label: "Annually",       days: 365 },
  { label: "Custom…",        days: 0   },
];

const DEFAULT: JobInput = {
  title: "",
  client_id: null,
  client_name: "",
  site_name: "",
  assigned_to: null,
  assigned_to_name: "",
  status: "SCHEDULED",
  scheduled_at: "",
  flat_rate: null,
  notes: "",
  job_type: "ADHOC",
  frequency_days: null,
};

function toLocalDatetime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function nextDueLabel(scheduledAt: string, frequencyDays: number | null): string | null {
  if (!frequencyDays || !scheduledAt) return null;
  const base = new Date(scheduledAt);
  if (isNaN(base.getTime())) return null;
  const next = new Date(base);
  next.setDate(next.getDate() + frequencyDays);
  return next.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

const PALETTE = ["bg-blue-500","bg-violet-500","bg-pink-500","bg-teal-500","bg-orange-500","bg-indigo-500","bg-emerald-500"];
function avatarBg(name: string | null) { return name ? PALETTE[name.charCodeAt(0) % PALETTE.length] : PALETTE[0]; }
function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

/* ════════════════════════════════════════════════════════════ */
export default function AddJobModal({ open, onClose, onSaved, editing }: Props) {
  const [form, setForm]             = useState<JobInput>(DEFAULT);
  const [saving, setSaving]         = useState(false);
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [clients, setClients]       = useState<Client[]>([]);
  const [customDays, setCustomDays] = useState<string>("");
  const [useCustom, setUseCustom]   = useState(false);

  /* multi-assign */
  const [assignedEmployees, setAssignedEmployees] = useState<string[]>([]);

  /* unavailability: set of employee_ids unavailable on selected date */
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());

  /* escalators */
  const [escalators, setEscalators]         = useState<EscRow[]>([]);
  const [escInput, setEscInput]             = useState("");
  const [locInput, setLocInput]             = useState("");
  const [clientTemplates, setClientTemplates] = useState<Template[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const escInputRef = useRef<HTMLInputElement>(null);

  /* load employees + clients */
  useEffect(() => {
    if (!open) return;
    supabase.from("profiles").select("id, full_name, email, avatar_url").eq("status", "ACTIVE")
      .then(({ data }) => setEmployees((data ?? []) as Employee[]));
    supabase.from("clients").select("id, name, address").eq("status", "ACTIVE").order("name")
      .then(({ data }) => setClients(data ?? []));
  }, [open]);

  /* fetch unavailability when scheduled date changes */
  useEffect(() => {
    if (!open || !form.scheduled_at) { setUnavailableIds(new Set()); return; }
    const dateStr = new Date(form.scheduled_at).toISOString().split("T")[0];
    supabase
      .from("employee_unavailability")
      .select("employee_id")
      .eq("status", "APPROVED")
      .lte("start_date", dateStr)
      .gte("end_date", dateStr)
      .then(({ data }) => {
        setUnavailableIds(new Set((data ?? []).map((r: { employee_id: string }) => r.employee_id)));
      });
  }, [open, form.scheduled_at]);

  /* populate form when editing */
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const fd = editing.frequency_days;
      const isCustom = fd !== null && !FREQUENCY_OPTIONS.some(o => o.days === fd && o.days !== 0);
      setUseCustom(isCustom);
      setCustomDays(isCustom ? String(fd) : "");
      setForm({
        title:            editing.title,
        client_id:        editing.client_id,
        client_name:      editing.client_name,
        site_name:        editing.site_name ?? "",
        assigned_to:      null,
        assigned_to_name: "",
        status:           editing.status,
        scheduled_at:     toLocalDatetime(editing.scheduled_at),
        flat_rate:        editing.flat_rate,
        notes:            editing.notes ?? "",
        job_type:         editing.job_type ?? "ADHOC",
        frequency_days:   editing.frequency_days,
      });
      /* load assignments */
      supabase.from("job_assignments").select("employee_id").eq("job_id", editing.id)
        .then(({ data }) => setAssignedEmployees((data ?? []).map(r => r.employee_id)));
      /* load escalators */
      supabase.from("job_escalators").select("unit_number, location").eq("job_id", editing.id).order("sort_order")
        .then(({ data }) => setEscalators((data ?? []).map(r => ({ unit_number: r.unit_number, location: r.location ?? "" }))));
      /* load client templates */
      if (editing.client_id) {
        supabase.from("client_escalator_templates").select("unit_number, location").eq("client_id", editing.client_id).order("sort_order")
          .then(({ data }) => setClientTemplates(data ?? []));
      }
    } else {
      setForm(DEFAULT);
      setUseCustom(false);
      setCustomDays("");
      setAssignedEmployees([]);
      setEscalators([]);
      setClientTemplates([]);
      setEscInput("");
      setLocInput("");
      setSaveAsTemplate(false);
    }
  }, [editing, open]);

  if (!open) return null;

  const set = <K extends keyof JobInput>(key: K, value: JobInput[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleClientChange = async (id: string) => {
    const client = clients.find(c => c.id === id);
    set("client_id", id || null);
    set("client_name", client?.name ?? "");
    if (client?.address && !form.site_name) set("site_name", client.address);
    if (id) {
      const { data } = await supabase.from("client_escalator_templates")
        .select("unit_number, location").eq("client_id", id).order("sort_order");
      setClientTemplates(data ?? []);
    } else {
      setClientTemplates([]);
    }
  };

  const handleJobType = (type: JobType) => {
    set("job_type", type);
    if (type === "ADHOC") { set("frequency_days", null); setUseCustom(false); setCustomDays(""); }
  };

  const handleFrequencySelect = (days: number) => {
    if (days === 0) { setUseCustom(true); set("frequency_days", customDays ? Number(customDays) : null); }
    else { setUseCustom(false); setCustomDays(""); set("frequency_days", days); }
  };

  const handleCustomDays = (val: string) => {
    setCustomDays(val);
    const n = parseInt(val, 10);
    set("frequency_days", n > 0 ? n : null);
  };

  const toggleEmployee = (id: string) =>
    setAssignedEmployees(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);

  const addEscalator = () => {
    const u = escInput.trim();
    if (!u) return;
    if (!escalators.some(e => e.unit_number.toLowerCase() === u.toLowerCase())) {
      setEscalators(prev => [...prev, { unit_number: u, location: locInput.trim() }]);
    }
    setEscInput("");
    setLocInput("");
    escInputRef.current?.focus();
  };

  const loadFromTemplate = () => {
    const newOnes = clientTemplates.filter(t =>
      !escalators.some(e => e.unit_number.toLowerCase() === t.unit_number.toLowerCase())
    );
    if (!newOnes.length) return;
    setEscalators(prev => [...prev, ...newOnes.map(t => ({ unit_number: t.unit_number, location: t.location ?? "" }))]);
  };

  const removeEscalator = (i: number) => setEscalators(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.client_name.trim() || !form.scheduled_at) return;
    if (form.job_type === "CONTRACT" && !form.frequency_days) {
      alert("Please set a recurrence frequency for this contract job."); return;
    }
    setSaving(true);

    const payload: JobInput = {
      ...form,
      scheduled_at:   new Date(form.scheduled_at).toISOString(),
      site_name:      form.site_name    || undefined,
      notes:          form.notes        || undefined,
      flat_rate:      form.flat_rate    ?? null,
      frequency_days: form.job_type === "CONTRACT" ? form.frequency_days : null,
      assigned_to:    null,
      assigned_to_name: "",
    };

    let jobId: string;
    if (editing) {
      const { error } = await supabase.from("jobs").update(payload).eq("id", editing.id);
      if (error) { alert(error.message); setSaving(false); return; }
      jobId = editing.id;
      await Promise.all([
        supabase.from("job_assignments").delete().eq("job_id", jobId),
        supabase.from("job_escalators").delete().eq("job_id", jobId),
      ]);
    } else {
      const { data, error } = await supabase.from("jobs").insert(payload).select("id").single();
      if (error) { alert(error.message); setSaving(false); return; }
      jobId = (data as { id: string }).id;
    }

    const ops: PromiseLike<unknown>[] = [];

    if (assignedEmployees.length > 0) {
      ops.push(supabase.from("job_assignments").insert(
        assignedEmployees.map(emp_id => ({ job_id: jobId, employee_id: emp_id }))
      ));
    }
    if (escalators.length > 0) {
      ops.push(supabase.from("job_escalators").insert(
        escalators.map((esc, i) => ({
          job_id:      jobId,
          unit_number: esc.unit_number,
          location:    esc.location || null,
          sort_order:  i,
        }))
      ));
    }
    if (saveAsTemplate && form.client_id && escalators.length > 0) {
      ops.push(supabase.from("client_escalator_templates").upsert(
        escalators.map((esc, i) => ({
          client_id:   form.client_id!,
          unit_number: esc.unit_number,
          location:    esc.location || null,
          sort_order:  i,
        })),
        { onConflict: "client_id,unit_number" }
      ));
    }
    await Promise.all(ops);

    try {
      const recipients = employees
        .filter((employee) => assignedEmployees.includes(employee.id) && employee.email)
        .map((employee) => ({
          email: employee.email,
          name: employee.full_name ?? undefined,
        }));

      await sendJobEmails({
        recipients,
        type: "booked",
        job: {
          title: payload.title,
          clientName: payload.client_name,
          siteName: payload.site_name,
          scheduledAt: payload.scheduled_at,
          status: payload.status,
          notes: payload.notes,
        },
      });
    } catch (emailError) {
      console.error("Failed to send job booking email", emailError);
      alert(emailError instanceof Error ? emailError.message : "Failed to send job booking email.");
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const isContract   = form.job_type === "CONTRACT";
  const nextDue      = isContract ? nextDueLabel(form.scheduled_at, form.frequency_days ?? null) : null;
  const selectedFreq = useCustom ? 0 : (form.frequency_days ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{editing ? "Edit Job" : "New Job"}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Fill in the details below</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* ── Job Type ── */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Job Type</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              {(["ADHOC", "CONTRACT"] as JobType[]).map((type) => (
                <button key={type} type="button" onClick={() => handleJobType(type)}
                  className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    form.job_type === type
                      ? type === "CONTRACT" ? "bg-violet-600 text-white shadow-sm" : "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}>
                  {type === "ADHOC" ? "Ad-hoc (One-off)" : "Contract (Recurring)"}
                </button>
              ))}
            </div>
          </div>

          {/* ── Frequency (contract only) ── */}
          {isContract && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-3">
              <label className="block text-sm font-semibold text-violet-800">Recurrence Frequency *</label>
              <div className="flex flex-wrap gap-2">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button key={opt.days} type="button" onClick={() => handleFrequencySelect(opt.days)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      (opt.days === 0 && useCustom) || (opt.days !== 0 && selectedFreq === opt.days)
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white text-slate-700 border-slate-200 hover:border-violet-300"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {useCustom && (
                <div className="flex items-center gap-2">
                  <input type="number" min={1} value={customDays} onChange={e => handleCustomDays(e.target.value)}
                    placeholder="e.g. 45"
                    className="w-28 px-3 py-2 border border-violet-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  <span className="text-sm text-violet-700 font-medium">days between jobs</span>
                </div>
              )}
              {nextDue && (
                <div className="flex items-center gap-2 rounded-lg bg-violet-100 px-3 py-2 text-sm text-violet-800">
                  <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                  Next after first completion: <strong className="ml-1">{nextDue}</strong>
                  <span className="text-violet-500 ml-1">({frequencyLabel(form.frequency_days)})</span>
                </div>
              )}
            </div>
          )}

          {/* ── Core fields ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Job Title *</label>
              <input value={form.title} onChange={e => set("title", e.target.value)} required
                placeholder="Westfield CBD – Morning Escalator Clean"
                className="w-full px-3 py-2 border text-black border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client *</label>
              <select value={form.client_id ?? ""} onChange={e => handleClientChange(e.target.value)} required
                className="w-full px-3 py-2 border text-black border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Select client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {clients.length === 0 && <p className="text-xs text-amber-600 mt-1">No active clients found.</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Job Site / Location</label>
              <input value={form.site_name ?? ""} onChange={e => set("site_name", e.target.value)}
                placeholder="Level 3 – Escalator Bay A"
                className="w-full px-3 py-2 border text-black border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {isContract ? "First Date & Time *" : "Scheduled Date & Time *"}
              </label>
              <input type="datetime-local" value={form.scheduled_at} onChange={e => set("scheduled_at", e.target.value)} required
                className="w-full px-3 py-2 border text-black border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value as JobStatus)}
                className="w-full px-3 py-2 border text-black border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Flat Rate (AUD) <span className="text-xs font-normal text-slate-400">– leave blank for hourly</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" min={0} step={0.01} value={form.flat_rate ?? ""}
                  onChange={e => set("flat_rate", e.target.value ? Number(e.target.value) : null)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 border text-black border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* ── Assign Team Members ── */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-800">Assign Team Members</span>
              </div>
              <div className="flex items-center gap-2">
                {unavailableIds.size > 0 && form.scheduled_at && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {unavailableIds.size} unavailable
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  {assignedEmployees.length > 0
                    ? `${assignedEmployees.length} selected`
                    : "None — all crew visible to job"}
                </span>
              </div>
            </div>
            <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
              {employees.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-400">No active employees found.</p>
              ) : employees.map(emp => {
                const selected    = assignedEmployees.includes(emp.id);
                const unavailable = unavailableIds.has(emp.id);
                return (
                  <button key={emp.id} type="button" onClick={() => toggleEmployee(emp.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      selected ? "bg-blue-50" : unavailable ? "bg-amber-50/50" : "hover:bg-slate-50"
                    }`}>
                    <div className={`h-8 w-8 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0 ${emp.avatar_url ? "" : avatarBg(emp.full_name)}`}>
                      {emp.avatar_url
                        ? <img src={emp.avatar_url} className="h-full w-full object-cover" alt="" />
                        : initials(emp.full_name)
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate">{emp.full_name ?? emp.email}</p>
                        {unavailable && (
                          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
                            <AlertCircle className="h-2.5 w-2.5" /> Unavailable
                          </span>
                        )}
                      </div>
                      {emp.full_name && <p className="text-xs text-slate-400 truncate">{emp.email}</p>}
                    </div>
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selected ? "border-blue-600 bg-blue-600" : "border-slate-300"}`}>
                      {selected && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Escalator Plan ── */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div>
                <p className="text-sm font-semibold text-slate-800">Escalator Plan</p>
                <p className="text-xs text-slate-500 mt-0.5">Units assigned to this shift</p>
              </div>
              <div className="flex items-center gap-2">
                {escalators.length > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                    {escalators.length} units
                  </span>
                )}
                {clientTemplates.length > 0 && (
                  <button type="button" onClick={loadFromTemplate}
                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                    <Download className="h-3.5 w-3.5" />
                    Load template ({clientTemplates.length})
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Add row */}
              <div className="flex gap-2">
                <input
                  ref={escInputRef}
                  value={escInput}
                  onChange={e => setEscInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEscalator(); } }}
                  placeholder="Unit no. (e.g. ESC-01)"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={locInput}
                  onChange={e => setLocInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEscalator(); } }}
                  placeholder="Location (optional)"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={addEscalator}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shrink-0">
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>

              {/* Escalator list */}
              {escalators.length > 0 ? (
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {escalators.map((esc, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <span className="text-xs font-bold text-slate-400 w-6 shrink-0 tabular-nums">#{i + 1}</span>
                      <span className="text-sm font-semibold text-slate-900">{esc.unit_number}</span>
                      {esc.location && <span className="text-xs text-slate-400">· {esc.location}</span>}
                      <button type="button" onClick={() => removeEscalator(i)}
                        className="ml-auto text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">
                  No escalators added yet.{clientTemplates.length > 0 ? " Load from template or type above." : " Type a unit number and press Add."}
                </p>
              )}

              {/* Save as template */}
              {escalators.length > 0 && form.client_id && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={saveAsTemplate} onChange={e => setSaveAsTemplate(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-xs text-slate-600">Save these as the standard escalator template for this client</span>
                </label>
              )}
            </div>
          </div>

          {/* ── Notes ── */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} rows={3}
              placeholder="Access codes, special instructions, equipment needed…"
              className="w-full px-3 py-2 border text-black border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* ── Buttons ── */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Saving…" : editing ? "Update Job" : "Create Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
