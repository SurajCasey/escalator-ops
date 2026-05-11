import { useEffect, useState } from "react";
import {
  Calendar, Check, CheckCircle2, Clock, FileText,
  Image, MapPin, Pen, Pencil, RefreshCw, Save, Trash2, User, Users, X,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";

/* ── Types ───────────────────────────────────────────────────── */
type Photo = {
  id: string;
  photo_data: string;
  photo_type: "BEFORE" | "AFTER" | "FAULT" | "GENERAL";
  caption: string | null;
  created_at: string;
};

type Completion = {
  id: string;
  signed_by_name: string | null;
  signed_by_role: string | null;
  completion_notes: string | null;
  signature_data: string | null;
  completed_at: string;
};

type Escalator = {
  id: string;
  unit_number: string;
  location: string | null;
  completed: boolean;
  sort_order: number;
};

type JobDetail = {
  id: string;
  title: string;
  client_name: string;
  site_name: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  visit_count: number;
  status: string;
  notes: string | null;
  job_type: string;
  cancellation_reason: string | null;
};

type Visit = {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
};

type VisitEdit = {
  scheduled_at: string; // datetime-local string
  status: string;
};

type TeamMember = {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
};

/* ── Helpers ─────────────────────────────────────────────────── */
const STATUS_STYLE: Record<string, string> = {
  SCHEDULED:   "bg-blue-50 text-blue-700 border-blue-100",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-100",
  COMPLETED:   "bg-emerald-50 text-emerald-700 border-emerald-100",
  OVERDUE:     "bg-rose-50 text-rose-700 border-rose-100",
  CANCELLED:   "bg-slate-100 text-slate-500 border-slate-200",
  DRAFT:       "bg-slate-50 text-slate-500 border-slate-200",
};

const PHOTO_TYPE_COLORS: Record<string, string> = {
  BEFORE:  "bg-blue-100 text-blue-700",
  AFTER:   "bg-emerald-100 text-emerald-700",
  FAULT:   "bg-rose-100 text-rose-700",
  GENERAL: "bg-slate-100 text-slate-600",
};

const AVATAR_PALETTE = [
  "bg-blue-500","bg-violet-500","bg-pink-500",
  "bg-teal-500","bg-orange-500","bg-indigo-500","bg-emerald-500",
];
function avatarBg(name: string | null) {
  return name ? AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length] : AVATAR_PALETTE[0];
}
function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function fmt(iso: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short", day: "numeric", month: "short",
  }).format(new Date(iso));
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function humanize(s: string) {
  return s.toLowerCase().split("_").map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
}

function toLocalDatetime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const VISIT_STATUSES = ["SCHEDULED","IN_PROGRESS","COMPLETED","OVERDUE","CANCELLED"] as const;

/* ── Lightbox ────────────────────────────────────────────────── */
function Lightbox({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
        <img
          src={photo.photo_data}
          alt={photo.caption ?? ""}
          className="w-full rounded-2xl object-contain max-h-[80vh]"
        />
        <div className="mt-3 flex items-center gap-3">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${PHOTO_TYPE_COLORS[photo.photo_type]}`}>
            {humanize(photo.photo_type)}
          </span>
          {photo.caption && (
            <span className="text-sm text-white/80">{photo.caption}</span>
          )}
          <span className="text-xs text-white/40 ml-auto">{fmt(photo.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Panel ──────────────────────────────────────────────── */
export default function JobDetailPanel({
  jobId,
  onClose,
}: {
  jobId: string;
  onClose: () => void;
}) {
  const [job, setJob]               = useState<JobDetail | null>(null);
  const [visits, setVisits]         = useState<Visit[]>([]);
  const [team, setTeam]             = useState<TeamMember[]>([]);
  const [photos, setPhotos]         = useState<Photo[]>([]);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [escalators, setEscalators] = useState<Escalator[]>([]);
  const [loading, setLoading]       = useState(true);
  const [lightbox, setLightbox]     = useState<Photo | null>(null);

  // Visit inline editing
  const [editingVisitId, setEditingVisitId]   = useState<string | null>(null);
  const [editForm, setEditForm]               = useState<VisitEdit>({ scheduled_at: "", status: "SCHEDULED" });
  const [savingVisit, setSavingVisit]         = useState(false);
  const [deletingVisitId, setDeletingVisitId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      const [jobRes, visitsRes, photosRes, compRes, escRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, title, client_name, site_name, scheduled_start, scheduled_end, visit_count, status, notes, job_type, cancellation_reason")
          .eq("id", jobId)
          .single(),
        supabase
          .from("visits")
          .select("id, scheduled_at, status, notes")
          .eq("job_id", jobId)
          .neq("status", "CANCELLED")
          .order("scheduled_at"),
        supabase
          .from("job_photos")
          .select("id, photo_data, photo_type, caption, created_at")
          .eq("job_id", jobId)
          .order("created_at"),
        supabase
          .from("job_completions")
          .select("id, signed_by_name, signed_by_role, completion_notes, signature_data, completed_at")
          .eq("job_id", jobId)
          .maybeSingle(),
        supabase
          .from("job_escalators")
          .select("id, unit_number, location, completed, sort_order")
          .eq("job_id", jobId)
          .order("sort_order"),
      ]);

      if (jobRes.data)    setJob(jobRes.data as JobDetail);
      if (photosRes.data) setPhotos(photosRes.data as Photo[]);
      if (compRes.data)   setCompletion(compRes.data as Completion);
      if (escRes.data)    setEscalators(escRes.data as Escalator[]);

      const visitList = (visitsRes.data ?? []) as Visit[];
      setVisits(visitList);

      // Load team from visit_assignments → profiles (deduped across all visits)
      const visitIds = visitList.map(v => v.id);
      if (visitIds.length > 0) {
        const { data: vaRows } = await supabase
          .from("visit_assignments")
          .select("employee_id")
          .in("visit_id", visitIds);

        const empIds = [...new Set((vaRows ?? []).map((r: { employee_id: string }) => r.employee_id))];
        if (empIds.length > 0) {
          const { data: profileRows } = await supabase
            .from("profiles")
            .select("id, full_name, email, avatar_url")
            .in("id", empIds);
          setTeam((profileRows ?? []) as TeamMember[]);
        } else {
          setTeam([]);
        }
      } else {
        setTeam([]);
      }

      setLoading(false);
    };

    fetchAll();
  }, [jobId]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  /* ── Visit inline edit ─────────────────────────────────── */
  const startEditVisit = (v: Visit) => {
    setEditingVisitId(v.id);
    setEditForm({ scheduled_at: toLocalDatetime(v.scheduled_at), status: v.status });
  };

  const cancelEditVisit = () => { setEditingVisitId(null); };

  const saveVisit = async (visitId: string) => {
    setSavingVisit(true);
    const now = new Date();
    const newDate = new Date(editForm.scheduled_at);
    // Auto-reset OVERDUE to SCHEDULED if rescheduled to future
    const resolvedStatus = editForm.status === "OVERDUE" && newDate > now ? "SCHEDULED" : editForm.status;

    const { error } = await supabase.from("visits").update({
      scheduled_at: newDate.toISOString(),
      status: resolvedStatus,
    }).eq("id", visitId);

    if (error) { toast.error(error.message); setSavingVisit(false); return; }
    toast.success("Visit updated.");
    setVisits(prev => prev.map(v =>
      v.id === visitId
        ? { ...v, scheduled_at: newDate.toISOString(), status: resolvedStatus }
        : v
    ));
    setEditingVisitId(null);
    setSavingVisit(false);
  };

  const deleteVisit = async (visitId: string) => {
    setDeletingVisitId(visitId);
    const { error } = await supabase.from("visits").delete().eq("id", visitId);
    if (error) { toast.error(error.message); setDeletingVisitId(null); return; }
    toast.success("Visit removed.");
    setVisits(prev => prev.filter(v => v.id !== visitId));
    setDeletingVisitId(null);
  };

  const escDone  = escalators.filter((e) => e.completed).length;
  const escTotal = escalators.length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            {loading ? (
              <div className="h-5 w-48 bg-slate-200 animate-pulse rounded" />
            ) : (
              <>
                <h2 className="font-semibold text-slate-900 truncate">{job?.title}</h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  {job?.client_name}{job?.site_name ? ` · ${job.site_name}` : ""}
                </p>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 shrink-0 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-5 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : !job ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
              Job not found
            </div>
          ) : (
            <div className="divide-y divide-slate-100">

              {/* ── Job Info ── */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[job.status] ?? "bg-slate-100 text-slate-600"}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                    {humanize(job.status)}
                  </span>
                  {job.job_type === "CONTRACT" && (
                    <span className="inline-flex items-center gap-1 text-xs text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-0.5 rounded-full font-medium">
                      <RefreshCw className="h-3 w-3" /> Contract
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2 text-slate-600 col-span-2">
                    <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Scheduled</p>
                      {job.scheduled_start ? (
                        <p className="font-medium text-slate-900">{fmt(job.scheduled_start)}</p>
                      ) : (
                        <p className="text-slate-400 text-sm">No date set</p>
                      )}
                      {job.visit_count > 1 && (
                        <p className="text-xs text-slate-400 mt-0.5">{job.visit_count} visits total</p>
                      )}
                    </div>
                  </div>
                  {job.site_name && (
                    <div className="flex items-start gap-2 text-slate-600 col-span-2">
                      <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Site</p>
                        <p className="font-medium text-slate-900">{job.site_name}</p>
                      </div>
                    </div>
                  )}
                </div>

                {job.status === "CANCELLED" && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm flex gap-2">
                    <X className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-rose-600 mb-0.5">Cancellation Reason</p>
                      <p className="text-rose-800">{job.cancellation_reason ?? "No reason provided"}</p>
                    </div>
                  </div>
                )}

                {job.notes && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-600 flex gap-2">
                    <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <p>{job.notes}</p>
                  </div>
                )}
              </div>

              {/* ── Visit Schedule ── */}
              {visits.length > 0 && (
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-700">
                      Visit Schedule ({visits.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {visits.map((v, idx) => (
                      <div key={v.id}>
                        {editingVisitId === v.id ? (
                          /* ── Inline edit form ── */
                          <div className="rounded-xl border-2 border-blue-300 bg-blue-50 px-3 py-3 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <input
                                type="datetime-local"
                                value={editForm.scheduled_at}
                                onChange={e => setEditForm(f => ({ ...f, scheduled_at: e.target.value }))}
                                className="flex-1 min-w-0 px-2.5 py-1.5 border border-blue-200 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <select
                                value={editForm.status}
                                onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                                className="px-2 py-1.5 border border-blue-200 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                {VISIT_STATUSES.map(s => (
                                  <option key={s} value={s}>{humanize(s)}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={cancelEditVisit}
                                className="px-3 py-1 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveVisit(v.id)}
                                disabled={savingVisit}
                                className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                              >
                                <Save className="h-3 w-3" />
                                {savingVisit ? "Saving…" : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* ── Normal row ── */
                          <div
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm group ${
                              STATUS_STYLE[v.status] ?? "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <span className="text-xs font-bold w-5 h-5 rounded-full bg-current/10 flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-xs">{fmtDate(v.scheduled_at)}</p>
                              <p className="text-xs opacity-70">{fmtTime(v.scheduled_at)}</p>
                            </div>
                            <span className="text-xs font-semibold shrink-0">{humanize(v.status)}</span>
                            {/* Edit / Delete actions */}
                            <div className="flex items-center gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={() => startEditVisit(v)}
                                title="Edit visit"
                                className="p-1 rounded-md hover:bg-white/60 text-current transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => deleteVisit(v.id)}
                                disabled={deletingVisitId === v.id}
                                title="Delete visit"
                                className="p-1 rounded-md hover:bg-rose-100 text-rose-500 transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Team ── */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700">
                    Assigned Team {team.length > 0 ? `(${team.length})` : ""}
                  </h3>
                </div>
                {team.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 py-6 flex flex-col items-center gap-2 text-slate-400">
                    <User className="h-6 w-6 opacity-30" />
                    <p className="text-xs">No team members assigned</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {team.map(member => (
                      <div key={member.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <div className={`h-8 w-8 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0 ${member.avatar_url ? "" : avatarBg(member.full_name)}`}>
                          {member.avatar_url
                            ? <img src={member.avatar_url} className="h-full w-full object-cover" alt="" />
                            : initials(member.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{member.full_name ?? member.email}</p>
                          {member.full_name && <p className="text-xs text-slate-400 truncate">{member.email}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Escalators ── */}
              {escTotal > 0 && (
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700">Escalators</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${escDone === escTotal ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {escDone}/{escTotal} done
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {escalators.map((esc) => (
                      <div
                        key={esc.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
                          esc.completed
                            ? "bg-emerald-50 border-emerald-200"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          esc.completed ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white"
                        }`}>
                          {esc.completed && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className={`font-semibold text-xs ${esc.completed ? "text-emerald-700 line-through" : "text-slate-800"}`}>
                            {esc.unit_number}
                          </p>
                          {esc.location && (
                            <p className="text-xs text-slate-400 truncate">{esc.location}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Photos ── */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <Image className="h-4 w-4 text-slate-400" /> Photos
                  </h3>
                  <span className="text-xs text-slate-400">{photos.length} attached</span>
                </div>

                {photos.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 py-8 flex flex-col items-center gap-2 text-slate-400">
                    <Image className="h-7 w-7 opacity-30" />
                    <p className="text-xs">No photos attached to this job</p>
                  </div>
                ) : (
                  <>
                    {(["BEFORE", "AFTER", "FAULT", "GENERAL"] as const).map((type) => {
                      const group = photos.filter((p) => p.photo_type === type);
                      if (group.length === 0) return null;
                      return (
                        <div key={type} className="mb-4">
                          <p className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2 ${PHOTO_TYPE_COLORS[type]}`}>
                            {humanize(type)} ({group.length})
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {group.map((photo) => (
                              <button
                                key={photo.id}
                                onClick={() => setLightbox(photo)}
                                className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 hover:ring-2 hover:ring-blue-500 transition-all group"
                              >
                                <img
                                  src={photo.photo_data}
                                  alt={photo.caption ?? ""}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                />
                                {photo.caption && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/80 to-transparent px-2 py-1">
                                    <p className="text-white text-xs truncate">{photo.caption}</p>
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* ── Completion / Sign-off ── */}
              <div className="p-5">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-3">
                  <Pen className="h-4 w-4 text-slate-400" /> Sign-off
                </h3>

                {!completion ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 py-8 flex flex-col items-center gap-2 text-slate-400">
                    <CheckCircle2 className="h-7 w-7 opacity-30" />
                    <p className="text-xs">No completion sign-off recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {completion.completion_notes && (
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                        <p className="text-xs text-slate-400 mb-1 font-medium">Completion Notes</p>
                        <p className="text-sm text-slate-700">{completion.completion_notes}</p>
                      </div>
                    )}
                    {completion.signed_by_name && (
                      <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                        <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-emerald-700" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-emerald-900">{completion.signed_by_name}</p>
                          <p className="text-xs text-emerald-600">
                            {completion.signed_by_role ?? "Site representative"} · {fmt(completion.completed_at)}
                          </p>
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 ml-auto shrink-0" />
                      </div>
                    )}
                    {completion.signature_data && (
                      <div>
                        <p className="text-xs text-slate-400 mb-1.5 font-medium">Signature</p>
                        <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-center">
                          <img
                            src={completion.signature_data}
                            alt="Signature"
                            className="max-h-24 max-w-full object-contain"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && <Lightbox photo={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}
