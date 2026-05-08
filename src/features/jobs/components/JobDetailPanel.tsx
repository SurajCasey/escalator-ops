import { useEffect, useState } from "react";
import {
  Calendar, Check, CheckCircle2, FileText,
  Image, MapPin, Pen, RefreshCw, User, Users, X,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";

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
  scheduled_at: string;
  status: string;
  assigned_to_name: string | null;
  notes: string | null;
  job_type: string;
  cancellation_reason: string | null;
};

/* ── Helpers ─────────────────────────────────────────────────── */
const STATUS_STYLE: Record<string, string> = {
  SCHEDULED:   "bg-blue-50 text-blue-700 border-blue-100",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-100",
  COMPLETED:   "bg-emerald-50 text-emerald-700 border-emerald-100",
  OVERDUE:     "bg-rose-50 text-rose-700 border-rose-100",
  CANCELLED:   "bg-slate-100 text-slate-500 border-slate-200",
};

const PHOTO_TYPE_COLORS: Record<string, string> = {
  BEFORE:  "bg-blue-100 text-blue-700",
  AFTER:   "bg-emerald-100 text-emerald-700",
  FAULT:   "bg-rose-100 text-rose-700",
  GENERAL: "bg-slate-100 text-slate-600",
};

function fmt(iso: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function humanize(s: string) {
  return s.toLowerCase().split("_").map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
}

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
  const [job, setJob]             = useState<JobDetail | null>(null);
  const [photos, setPhotos]       = useState<Photo[]>([]);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [escalators, setEscalators] = useState<Escalator[]>([]);
  const [loading, setLoading]     = useState(true);
  const [lightbox, setLightbox]   = useState<Photo | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [jobRes, photosRes, compRes, escRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, title, client_name, site_name, scheduled_at, status, assigned_to_name, notes, job_type, cancellation_reason")
          .eq("id", jobId)
          .single(),
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
      setLoading(false);
    };
    fetch();
  }, [jobId]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

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
                  <div className="flex items-start gap-2 text-slate-600">
                    <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Scheduled</p>
                      <p className="font-medium text-slate-900">{fmt(job.scheduled_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-slate-600">
                    <Users className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Assigned to</p>
                      <p className="font-medium text-slate-900">{job.assigned_to_name ?? "Unassigned"}</p>
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
                    {/* Group by type */}
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
                    {/* Completion notes */}
                    {completion.completion_notes && (
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                        <p className="text-xs text-slate-400 mb-1 font-medium">Completion Notes</p>
                        <p className="text-sm text-slate-700">{completion.completion_notes}</p>
                      </div>
                    )}

                    {/* Signed by */}
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

                    {/* Signature image */}
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
