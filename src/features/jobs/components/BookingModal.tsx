import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, CalendarDays, Check,
  ChevronLeft, ChevronRight, Layers, Plus,
  Trash2, Users, X,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";

/* ── Types ───────────────────────────────────────────────── */
type Asset    = { id: string; unit_number: string; location: string | null; model: string | null };
type Employee = { id: string; full_name: string | null; email: string; avatar_url?: string | null };
type Client   = { id: string; name: string; address: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultDate?: string; // "YYYY-MM-DD"
};

/* ── Helpers ─────────────────────────────────────────────── */
const PALETTE = ["bg-blue-500","bg-violet-500","bg-pink-500","bg-teal-500","bg-orange-500","bg-indigo-500","bg-emerald-500"];
const SHIFT_COLORS = [
  { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-800",   dot: "bg-blue-500"   },
  { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-800", dot: "bg-violet-500" },
  { bg: "bg-emerald-50",border: "border-emerald-200",text: "text-emerald-800",dot: "bg-emerald-500"},
  { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-800",  dot: "bg-amber-500"  },
  { bg: "bg-rose-50",   border: "border-rose-200",   text: "text-rose-800",   dot: "bg-rose-500"   },
];

function avatarBg(name: string | null) { return name ? PALETTE[name.charCodeAt(0) % PALETTE.length] : PALETTE[0]; }
function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}
function toDateKey(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtShort(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "short",
  });
}
function fmtLong(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "long",
  });
}

const WEEK = ["Su","Mo","Tu","We","Th","Fr","Sa"];

/* ── Step bar ────────────────────────────────────────────── */
const STEPS = ["Site & Units", "Shift Plan", "Days & Team"];
function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((label, i) => {
        const done = i < step, current = i === step;
        return (
          <div key={i} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done ? "bg-blue-600 text-white" : current ? "bg-blue-600 text-white ring-4 ring-blue-100" : "bg-slate-100 text-slate-400"
              }`}>
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium mt-1 whitespace-nowrap ${current ? "text-blue-600" : done ? "text-slate-500" : "text-slate-400"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1.5 mb-4 rounded ${done ? "bg-blue-600" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Mini calendar (multi-select) ────────────────────────── */
function DatePicker({
  selected, onChange,
}: {
  selected: string[];
  onChange: (dates: string[]) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const year  = cursor.getFullYear();
  const month = cursor.getMonth();
  const label = cursor.toLocaleDateString("en-AU", { month: "long", year: "numeric" });

  const cells = useMemo(() => {
    const first = new Date(year, month, 1).getDay();
    const days  = new Date(year, month + 1, 0).getDate();
    const out: (string | null)[] = Array(first).fill(null);
    for (let d = 1; d <= days; d++) {
      const pad = (n: number) => String(n).padStart(2,"0");
      out.push(`${year}-${pad(month+1)}-${pad(d)}`);
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  const toggle = (key: string) => {
    onChange(selected.includes(key) ? selected.filter(d => d !== key) : [...selected, key].sort());
  };

  const today = toDateKey(new Date());

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <button type="button" onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        <button type="button" onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 bg-slate-50">
        {WEEK.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1.5">{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px bg-slate-100">
        {cells.map((key, i) => {
          if (!key) return <div key={i} className="bg-white h-9" />;
          const sel = selected.includes(key);
          const isToday = key === today;
          return (
            <button key={key} type="button" onClick={() => toggle(key)}
              className={`h-9 flex items-center justify-center text-sm font-medium transition-all ${
                sel
                  ? "bg-blue-600 text-white"
                  : isToday
                  ? "bg-white text-teal-600 font-bold ring-1 ring-inset ring-teal-400"
                  : "bg-white text-slate-700 hover:bg-blue-50"
              }`}>
              {parseInt(key.slice(-2))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
export default function BookingModal({ open, onClose, onSaved, defaultDate }: Props) {
  const [step, setStep]   = useState(0);
  const [saving, setSaving] = useState(false);

  /* ── Step 1 state ─── */
  const [clients, setClients]         = useState<Client[]>([]);
  const [clientId, setClientId]       = useState("");
  const [siteName, setSiteName]       = useState("");
  const [assets, setAssets]           = useState<Asset[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingAssets, setLoadingAssets] = useState(false);

  /* ── Step 2 state: assetShifts[assetId] = shiftNumber (1-based) ─── */
  const [assetShifts, setAssetShifts] = useState<Record<string, number>>({});
  const [numShifts, setNumShifts]     = useState(1);

  /* ── Step 3 state ─── */
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  // per-date reschedule: override the stored date with another date
  const [dateOverrides, setDateOverrides] = useState<Record<string, string>>({});
  const [shiftTime, setShiftTime]     = useState("07:00");
  const [employees, setEmployees]     = useState<Employee[]>([]);
  const [assignedEmployees, setAssignedEmployees] = useState<string[]>([]);
  const [flatRatePerDay, setFlatRatePerDay] = useState("");
  const [notes, setNotes]             = useState("");

  /* ── Load on open ─── */
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setClientId(""); setSiteName(""); setAssets([]); setSelectedIds(new Set());
    setAssetShifts({}); setNumShifts(1);
    setSelectedDates(defaultDate ? [defaultDate] : []);
    setDateOverrides({});
    setShiftTime("07:00");
    setAssignedEmployees([]); setFlatRatePerDay(""); setNotes("");

    supabase.from("clients").select("id, name, address").eq("status", "ACTIVE").order("name")
      .then(({ data }) => setClients(data ?? []));
    supabase.from("profiles").select("id, full_name, email, avatar_url").eq("status", "ACTIVE").order("full_name")
      .then(({ data }) => setEmployees((data ?? []) as Employee[]));
  }, [open, defaultDate]);

  useEffect(() => {
    if (defaultDate && open) setSelectedDates(prev => prev.length === 0 ? [defaultDate] : prev);
  }, [defaultDate, open]);

  /* ── Client change ─── */
  const handleClientChange = async (id: string) => {
    setClientId(id);
    setSelectedIds(new Set());
    setAssets([]);
    setAssetShifts({});
    const client = clients.find(c => c.id === id);
    if (client?.address && !siteName) setSiteName(client.address);
    if (!id) return;
    setLoadingAssets(true);
    const { data } = await supabase.from("client_assets")
      .select("id, unit_number, location, model").eq("client_id", id).order("unit_number");
    const loaded = (data ?? []) as Asset[];
    setAssets(loaded);
    if (loaded.length > 0 && loaded.length <= 12) {
      setSelectedIds(new Set(loaded.map(a => a.id)));
    }
    setLoadingAssets(false);
  };

  const toggleAsset = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  /* ── Derived ─── */
  const selectedAssets = assets.filter(a => selectedIds.has(a.id));
  const client = clients.find(c => c.id === clientId);

  /* When moving to step 2 — auto-distribute assets across shifts equally */
  const initShiftPlan = () => {
    const perShift = Math.ceil(selectedAssets.length / numShifts);
    const map: Record<string, number> = {};
    selectedAssets.forEach((a, i) => { map[a.id] = Math.floor(i / perShift) + 1; });
    setAssetShifts(map);
  };

  /* Shift groups for display */
  const shiftGroups = useMemo(() => {
    const groups: Record<number, Asset[]> = {};
    for (let s = 1; s <= numShifts; s++) groups[s] = [];
    selectedAssets.forEach(a => {
      const s = assetShifts[a.id] ?? 1;
      if (!groups[s]) groups[s] = [];
      groups[s].push(a);
    });
    return groups;
  }, [selectedAssets, assetShifts, numShifts]);

  const unassigned = selectedAssets.filter(a => !assetShifts[a.id]);

  /* ── Actions ─── */
  const assignToShift = (assetId: string, shift: number) =>
    setAssetShifts(prev => ({ ...prev, [assetId]: shift }));

  const addShift = () => setNumShifts(n => n + 1);
  const removeShift = (s: number) => {
    // unassign assets from this shift
    const reassigned: Record<string, number> = {};
    Object.entries(assetShifts).forEach(([id, sh]) => {
      if (sh === s) reassigned[id] = 1;         // move back to shift 1
      else if (sh > s) reassigned[id] = sh - 1; // close gap
      else reassigned[id] = sh;
    });
    setAssetShifts(prev => ({ ...prev, ...reassigned }));
    setNumShifts(n => Math.max(1, n - 1));
  };

  const toggleEmployee = (id: string) =>
    setAssignedEmployees(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);

  const removeDate = (d: string) => {
    setSelectedDates(prev => prev.filter(x => x !== d));
    setDateOverrides(prev => { const next = { ...prev }; delete next[d]; return next; });
  };

  const overrideDate = (original: string, newDate: string) => {
    if (!newDate) return;
    setDateOverrides(prev => ({ ...prev, [original]: newDate }));
  };

  /* ── Submit ─── */
  const handleSubmit = async () => {
    if (!clientId || selectedIds.size === 0 || selectedDates.length === 0) return;
    setSaving(true);
    const bookingId   = crypto.randomUUID();
    const clientName  = client?.name ?? "";
    const rate        = flatRatePerDay ? parseFloat(flatRatePerDay) : null;
    const totalDays   = selectedDates.length;

    try {
      for (let dayIdx = 0; dayIdx < selectedDates.length; dayIdx++) {
        const origDate = selectedDates[dayIdx];
        const dateStr  = dateOverrides[origDate] ?? origDate;
        const isoAt    = `${dateStr}T${shiftTime}:00`;
        const dayLabel = totalDays > 1
          ? ` – Day ${dayIdx + 1} (${fmtShort(dateStr)})`
          : ` (${fmtShort(dateStr)})`;

        const { data: jobData, error: jobErr } = await supabase.from("jobs").insert({
          title:         `${clientName}${dayLabel}`,
          client_id:     clientId,
          client_name:   clientName,
          site_name:     siteName || null,
          status:        "SCHEDULED",
          scheduled_at:  new Date(isoAt).toISOString(),
          flat_rate:     rate,
          notes:         notes.trim() || null,
          job_type:      "ADHOC",
          frequency_days: null,
          booking_id:    bookingId,
          assigned_to:   null,
          assigned_to_name: "",
        }).select("id").single();
        if (jobErr) throw jobErr;
        const jobId = (jobData as { id: string }).id;

        // Escalator assignments with shift numbers
        await supabase.from("job_escalators").insert(
          selectedAssets.map((a, i) => ({
            job_id:       jobId,
            unit_number:  a.unit_number,
            location:     a.location ?? null,
            sort_order:   i,
            shift_number: assetShifts[a.id] ?? 1,
          }))
        );

        if (assignedEmployees.length > 0) {
          await supabase.from("job_assignments").insert(
            assignedEmployees.map(emp_id => ({ job_id: jobId, employee_id: emp_id }))
          );
        }
      }

      toast.success(
        totalDays === 1 ? "Job created." : `${totalDays}-day booking created (${totalDays} jobs).`
      );
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const step1Valid = !!clientId && selectedIds.size > 0;
  const step2Valid = selectedAssets.every(a => !!assetShifts[a.id]);
  const step3Valid = selectedDates.length > 0;

  const goNext = () => {
    if (step === 0) { initShiftPlan(); setStep(1); }
    else setStep(s => s + 1);
  };

  /* ──────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">New Booking</h2>
            <p className="text-xs text-slate-500 mt-0.5">Plan a multi-day escalator service</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <StepBar step={step} />

          {/* ══ Step 1: Site & Units ══ */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Client *</label>
                <select value={clientId} onChange={e => handleClientChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Select client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Site / Location</label>
                <input value={siteName} onChange={e => setSiteName(e.target.value)}
                  placeholder="e.g. Westfield Sydney – Ground Floor"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {clientId && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700">Escalator Units *</label>
                    {assets.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{selectedIds.size} / {assets.length}</span>
                        <button type="button"
                          onClick={() => setSelectedIds(selectedIds.size === assets.length ? new Set() : new Set(assets.map(a => a.id)))}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800">
                          {selectedIds.size === assets.length ? "Deselect all" : "Select all"}
                        </button>
                      </div>
                    )}
                  </div>
                  {loadingAssets ? (
                    <div className="py-6 text-center text-sm text-slate-400">Loading units…</div>
                  ) : assets.length === 0 ? (
                    <div className="py-6 text-center rounded-xl border-2 border-dashed border-slate-200">
                      <p className="text-sm text-slate-500">No escalator units registered for this client.</p>
                      <p className="text-xs text-slate-400 mt-1">Add assets in the Client detail page first.</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden max-h-56 overflow-y-auto">
                      {assets.map(a => {
                        const sel = selectedIds.has(a.id);
                        return (
                          <button key={a.id} type="button" onClick={() => toggleAsset(a.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${sel ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                            <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${sel ? "border-blue-600 bg-blue-600" : "border-slate-300"}`}>
                              {sel && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <span className="text-sm font-semibold text-slate-900">{a.unit_number}</span>
                            {a.location && <span className="text-xs text-slate-400 truncate">· {a.location}</span>}
                            {a.model && <span className="text-xs text-slate-300 ml-auto shrink-0">{a.model}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Number of shifts */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Number of shifts per day</p>
                    <p className="text-xs text-slate-400 mt-0.5">You'll assign units to each shift in the next step</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setNumShifts(n => Math.max(1, n - 1))}
                      className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-100 text-slate-600 font-bold text-lg transition-colors">−</button>
                    <span className="w-6 text-center text-base font-bold text-slate-900">{numShifts}</span>
                    <button type="button" onClick={() => setNumShifts(n => Math.min(selectedIds.size, n + 1))}
                      className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-100 text-slate-600 font-bold text-lg transition-colors">+</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ Step 2: Shift Plan ══ */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Assign each escalator unit to a shift. Drag or tap the shift buttons to move units.
              </p>

              {/* Unassigned pool */}
              {unassigned.length > 0 && (
                <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-2">Unassigned — tap a shift button to assign</p>
                  <div className="flex flex-wrap gap-2">
                    {unassigned.map(a => (
                      <div key={a.id} className="flex items-center gap-1 bg-white border border-amber-200 rounded-lg px-2.5 py-1.5">
                        <span className="text-xs font-semibold text-slate-800">{a.unit_number}</span>
                        <div className="flex items-center gap-1 ml-1.5">
                          {Array.from({ length: numShifts }, (_, i) => i + 1).map(s => (
                            <button key={s} type="button" onClick={() => assignToShift(a.id, s)}
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${SHIFT_COLORS[(s-1) % SHIFT_COLORS.length].bg} ${SHIFT_COLORS[(s-1) % SHIFT_COLORS.length].text} border ${SHIFT_COLORS[(s-1) % SHIFT_COLORS.length].border}`}>
                              S{s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shift cards */}
              {Array.from({ length: numShifts }, (_, i) => i + 1).map(s => {
                const col = SHIFT_COLORS[(s - 1) % SHIFT_COLORS.length];
                const units = shiftGroups[s] ?? [];
                return (
                  <div key={s} className={`rounded-xl border ${col.border} overflow-hidden`}>
                    <div className={`flex items-center justify-between px-4 py-2.5 ${col.bg} border-b ${col.border}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                        <span className={`text-sm font-semibold ${col.text}`}>Shift {s}</span>
                        <span className={`text-xs ${col.text} opacity-70`}>
                          {units.length} unit{units.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {numShifts > 1 && (
                        <button type="button" onClick={() => removeShift(s)}
                          className="text-xs text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1">
                          <Trash2 className="h-3 w-3" /> Remove
                        </button>
                      )}
                    </div>
                    <div className="p-3">
                      {units.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-2">No units assigned yet</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {units.map(a => (
                            <div key={a.id} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 group">
                              <span className="text-xs font-semibold text-slate-900">{a.unit_number}</span>
                              {a.location && <span className="text-[10px] text-slate-400">· {a.location}</span>}
                              {/* Move to other shift */}
                              <div className="flex items-center gap-0.5 ml-1">
                                {Array.from({ length: numShifts }, (_, i) => i + 1).filter(x => x !== s).map(other => (
                                  <button key={other} type="button" onClick={() => assignToShift(a.id, other)}
                                    className={`text-[10px] font-bold px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${SHIFT_COLORS[(other-1) % SHIFT_COLORS.length].bg} ${SHIFT_COLORS[(other-1) % SHIFT_COLORS.length].text}`}
                                    title={`Move to Shift ${other}`}>
                                    →S{other}
                                  </button>
                                ))}
                                <button type="button" onClick={() => setAssetShifts(prev => { const n = {...prev}; delete n[a.id]; return n; })}
                                  className="ml-0.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Quick-add from other shifts */}
                      {selectedAssets.filter(a => (assetShifts[a.id] ?? 0) !== s && assetShifts[a.id]).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5 items-center">
                          <span className="text-[10px] text-slate-400 font-medium">Move here:</span>
                          {selectedAssets.filter(a => (assetShifts[a.id] ?? 0) !== s && assetShifts[a.id]).map(a => (
                            <button key={a.id} type="button" onClick={() => assignToShift(a.id, s)}
                              className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded transition-colors">
                              + {a.unit_number}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <button type="button" onClick={addShift}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                <Plus className="h-4 w-4" /> Add another shift
              </button>
            </div>
          )}

          {/* ══ Step 3: Days & Team ══ */}
          {step === 2 && (
            <div className="space-y-5">

              {/* Summary pill */}
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                <span className="font-semibold text-blue-900">{client?.name}</span>
                <span className="text-blue-400">·</span>
                <span className="text-blue-700">{selectedIds.size} units</span>
                <span className="text-blue-400">·</span>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: numShifts }, (_, i) => i + 1).map(s => {
                    const col = SHIFT_COLORS[(s-1) % SHIFT_COLORS.length];
                    return (
                      <span key={s} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.bg} ${col.text}`}>
                        S{s}: {(shiftGroups[s] ?? []).length} units
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Shift time */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <CalendarDays className="h-4 w-4 inline mr-1.5 text-slate-400" />Shift Start Time
                </label>
                <input type="time" value={shiftTime} onChange={e => setShiftTime(e.target.value)}
                  className="w-40 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Date picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Select Job Days *</label>
                  {selectedDates.length > 0 && (
                    <span className="text-xs text-slate-500">{selectedDates.length} day{selectedDates.length !== 1 ? "s" : ""} selected</span>
                  )}
                </div>
                <DatePicker selected={selectedDates} onChange={setSelectedDates} />
              </div>

              {/* Selected dates list with reschedule */}
              {selectedDates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Scheduled Days</p>
                  {selectedDates.map((orig, i) => {
                    const effective = dateOverrides[orig] ?? orig;
                    const changed = !!dateOverrides[orig];
                    return (
                      <div key={orig} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${changed ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white ${SHIFT_COLORS[i % SHIFT_COLORS.length].dot}`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${changed ? "text-amber-900" : "text-slate-900"}`}>
                            {fmtLong(effective)}
                            {changed && <span className="ml-2 text-xs text-amber-600">(rescheduled)</span>}
                          </p>
                        </div>
                        <input type="date" defaultValue={effective}
                          onChange={e => overrideDate(orig, e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                          title="Change date" />
                        <button type="button" onClick={() => removeDate(orig)}
                          className="text-slate-300 hover:text-rose-500 transition-colors shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Team */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-800">Assign Team</span>
                  <span className="ml-auto text-xs text-slate-500">
                    {assignedEmployees.length > 0 ? `${assignedEmployees.length} selected` : "Optional"}
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                  {employees.map(emp => {
                    const selected = assignedEmployees.includes(emp.id);
                    return (
                      <button key={emp.id} type="button" onClick={() => toggleEmployee(emp.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${selected ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                        <div className={`h-8 w-8 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0 ${emp.avatar_url ? "" : avatarBg(emp.full_name)}`}>
                          {emp.avatar_url ? <img src={emp.avatar_url} className="h-full w-full object-cover" alt="" /> : initials(emp.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{emp.full_name ?? emp.email}</p>
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

              {/* Rate + Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Rate per Day (AUD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input type="number" min={0} step={0.01} value={flatRatePerDay}
                      onChange={e => setFlatRatePerDay(e.target.value)} placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {flatRatePerDay && selectedDates.length > 1 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Total: ${(parseFloat(flatRatePerDay) * selectedDates.length).toFixed(2)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <Layers className="h-4 w-4 inline mr-1 text-slate-400" />Shifts/day
                  </label>
                  <div className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-500 bg-slate-50">
                    {numShifts} shift{numShifts !== 1 ? "s" : ""} · {selectedIds.size} units
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Access codes, special instructions, equipment needed…"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0">
          <button type="button"
            onClick={() => step === 0 ? onClose() : setStep(s => s - 1)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50">
            {step === 0 ? <X className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            {step === 0 ? "Cancel" : "Back"}
          </button>

          {step < 2 ? (
            <button type="button" onClick={goNext}
              disabled={step === 0 ? !step1Valid : !step2Valid}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit}
              disabled={saving || !step3Valid}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors">
              {saving ? "Creating…" : `Create ${selectedDates.length === 1 ? "Job" : `${selectedDates.length} Jobs`}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
