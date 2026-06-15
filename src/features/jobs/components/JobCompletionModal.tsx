import { useEffect, useRef, useState } from "react";
import {
  Camera, CheckCircle2, ChevronLeft, ChevronRight,
  Pen, Trash2, Upload, X,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";

/* ── Types ───────────────────────────────────────────────────── */
type PhotoType = "BEFORE" | "AFTER" | "FAULT" | "GENERAL";

type PhotoEntry = {
  id: string;          // local temp id
  data: string;        // base64 JPEG
  type: PhotoType;
  caption: string;
};

type Props = {
  jobId: string;
  visitId?: string;   // optional: if provided, this specific visit is also marked COMPLETED
  jobTitle: string;
  onClose: () => void;
  onCompleted: () => void;
};

/* ── Image resize helper ─────────────────────────────────────── */
async function resizeToBase64(file: File, maxPx = 900): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  BEFORE: "Before", AFTER: "After", FAULT: "Fault", GENERAL: "General",
};
const PHOTO_TYPE_COLORS: Record<PhotoType, string> = {
  BEFORE:  "bg-blue-100 text-blue-700",
  AFTER:   "bg-emerald-100 text-emerald-700",
  FAULT:   "bg-rose-100 text-rose-700",
  GENERAL: "bg-slate-100 text-slate-600",
};

/* ── Signature Pad ───────────────────────────────────────────── */
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);
  const hasStrokes = useRef(false);

  const getPos = (e: MouseEvent | Touch, rect: DOMRect) => ({
    x: (e.clientX - rect.left) * (canvasRef.current!.width  / rect.width),
    y: (e.clientY - rect.top)  * (canvasRef.current!.height / rect.height),
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      drawing.current = true;
      const rect = canvas.getBoundingClientRect();
      const pos  = getPos("touches" in e ? e.touches[0] : e, rect);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const pos  = getPos("touches" in e ? e.touches[0] : e, rect);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      hasStrokes.current = true;
    };
    const end = () => {
      if (!drawing.current) return;
      drawing.current = false;
      if (hasStrokes.current) onChange(canvas.toDataURL("image/png"));
    };

    canvas.addEventListener("mousedown",  start as EventListener);
    canvas.addEventListener("mousemove",  move  as EventListener);
    canvas.addEventListener("mouseup",    end);
    canvas.addEventListener("touchstart", start as EventListener, { passive: false });
    canvas.addEventListener("touchmove",  move  as EventListener, { passive: false });
    canvas.addEventListener("touchend",   end);
    return () => {
      canvas.removeEventListener("mousedown",  start as EventListener);
      canvas.removeEventListener("mousemove",  move  as EventListener);
      canvas.removeEventListener("mouseup",    end);
      canvas.removeEventListener("touchstart", start as EventListener);
      canvas.removeEventListener("touchmove",  move  as EventListener);
      canvas.removeEventListener("touchend",   end);
    };
  }, [onChange]);

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokes.current = false;
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={560}
          height={180}
          className="w-full touch-none cursor-crosshair"
          style={{ height: 180 }}
        />
        <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-slate-300 pointer-events-none select-none">
          Sign here
        </p>
      </div>
      <button
        type="button"
        onClick={clear}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" /> Clear signature
      </button>
    </div>
  );
}

/* ── Main Modal ──────────────────────────────────────────────── */
const STEPS = ["Photos", "Notes", "Sign-off"] as const;
type Step = 0 | 1 | 2;

export default function JobCompletionModal({ jobId, visitId, jobTitle, onClose, onCompleted }: Props) {
  const [step, setStep]               = useState<Step>(0);
  const [photos, setPhotos]           = useState<PhotoEntry[]>([]);
  const [notes, setNotes]             = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signedByName, setSignedByName]   = useState("");
  const [signedByRole, setSignedByRole]   = useState("");
  const [saving, setSaving]           = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addPhotos = async (files: FileList) => {
    if (photos.length + files.length > 8) { toast.error("Maximum 8 photos"); return; }
    const toastId = toast.loading("Processing photos…");
    const entries: PhotoEntry[] = [];
    for (const file of Array.from(files)) {
      const data = await resizeToBase64(file);
      entries.push({ id: crypto.randomUUID(), data, type: "GENERAL", caption: "" });
    }
    toast.dismiss(toastId);
    setPhotos((p) => [...p, ...entries]);
  };

  const removePhoto = (id: string) => setPhotos((p) => p.filter((ph) => ph.id !== id));
  const updatePhoto = (id: string, patch: Partial<PhotoEntry>) =>
    setPhotos((p) => p.map((ph) => (ph.id === id ? { ...ph, ...patch } : ph)));

  const updateVisitCompleted = async (id: string, completedAt: string) => {
    const primary = await supabase
      .from("visits")
      .update({ status: "COMPLETED", completed_at: completedAt })
      .eq("id", id);

    if (!primary.error) return;

    const fallback = await supabase
      .from("visits")
      .update({ status: "COMPLETED" })
      .eq("id", id);

    if (fallback.error) throw new Error(fallback.error.message);
  };

  const updateJobCompleted = async (id: string, completedAt: string) => {
    const primary = await supabase
      .from("jobs")
      .update({ status: "COMPLETED", completed_at: completedAt })
      .eq("id", id);

    if (!primary.error) return;

    const fallback = await supabase
      .from("jobs")
      .update({ status: "COMPLETED" })
      .eq("id", id);

    if (fallback.error) throw new Error(fallback.error.message);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user.id;

      // 1. Save completion record — upsert so re-completing an undone job works
      const { error: compErr } = await supabase.from("job_completions").upsert(
        {
          job_id:           jobId,
          signature_data:   signatureData,
          signed_by_name:   signedByName || null,
          signed_by_role:   signedByRole || null,
          completion_notes: notes || null,
          completed_at:     new Date().toISOString(),
        },
        { onConflict: "job_id" }
      );
      if (compErr) throw new Error(compErr.message);

      // 2. Save photos
      if (photos.length > 0) {
        const photoRows = photos.map((ph) => ({
          job_id:      jobId,
          photo_data:  ph.data,
          photo_type:  ph.type,
          caption:     ph.caption || null,
          uploaded_by: uid ?? null,
        }));
        const { error: photoErr } = await supabase.from("job_photos").insert(photoRows);
        if (photoErr) throw new Error(photoErr.message);
      }

      const completedAt = new Date().toISOString();

      // 3. Mark the specific visit as COMPLETED (if visitId supplied)
      if (visitId) {
        await updateVisitCompleted(visitId, completedAt);

        // Check if all visits for this job are now completed/cancelled
        const { data: remainingVisits, error: remainingErr } = await supabase
          .from("visits")
          .select("id, status")
          .eq("job_id", jobId)
          .neq("status", "COMPLETED")
          .neq("status", "CANCELLED");
        if (remainingErr) throw new Error(remainingErr.message);

        // Only mark the whole job COMPLETED if no remaining active visits
        if (!remainingVisits || remainingVisits.length === 0) {
          await updateJobCompleted(jobId, completedAt);
        }
      } else {
        // No visitId — mark the whole job and all its active visits COMPLETED
        await updateJobCompleted(jobId, completedAt);

        // Also mark all non-cancelled visits complete
        const { error: allVisitsErr } = await supabase
          .from("visits")
          .update({ status: "COMPLETED", completed_at: completedAt })
          .eq("job_id", jobId)
          .neq("status", "CANCELLED");
        if (allVisitsErr) {
          const fallbackVisits = await supabase
            .from("visits")
            .update({ status: "COMPLETED" })
            .eq("job_id", jobId)
            .neq("status", "CANCELLED");
          if (fallbackVisits.error) throw new Error(fallbackVisits.error.message);
        }
      }

      toast.success("Job completed & signed off");
      onCompleted();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const canAdvance = () => {
    if (step === 2) return signedByName.trim().length > 0 && !!signatureData;
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-lg bg-white sm:rounded-2xl border border-slate-200 shadow-2xl flex flex-col max-h-[92vh] rounded-t-2xl">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <h2 className="font-semibold text-slate-900">Complete Job</h2>
              <p className="text-sm text-slate-400 mt-0.5 truncate">{jobTitle}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  i === step ? "text-blue-600" : i < step ? "text-emerald-600" : "text-slate-400"
                }`}>
                  <span className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i < step ? "bg-emerald-500 text-white" : i === step ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"
                  }`}>
                    {i < step ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-emerald-300" : "bg-slate-200"}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">

          {/* Step 0 — Photos */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-slate-900">Job Photos</h3>
                <p className="text-sm text-slate-400 mt-0.5">Add before, after, or fault photos (up to 8)</p>
              </div>

              {/* Upload zone */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/50 transition-colors py-8 flex flex-col items-center gap-2 text-slate-400 hover:text-blue-600"
              >
                <Upload className="h-6 w-6" />
                <span className="text-sm font-medium">Tap to add photos</span>
                <span className="text-xs">{photos.length}/8 added</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addPhotos(e.target.files)}
              />

              {/* Photo grid */}
              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {photos.map((ph) => (
                    <div key={ph.id} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                      <div className="relative aspect-video bg-slate-100">
                        <img src={ph.data} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => removePhoto(ph.id)}
                          className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-slate-900/70 text-white flex items-center justify-center hover:bg-rose-600 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="p-2 space-y-1.5">
                        <select
                          value={ph.type}
                          onChange={(e) => updatePhoto(ph.id, { type: e.target.value as PhotoType })}
                          className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {(Object.keys(PHOTO_TYPE_LABELS) as PhotoType[]).map((t) => (
                            <option key={t} value={t}>{PHOTO_TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={ph.caption}
                          onChange={(e) => updatePhoto(ph.id, { caption: e.target.value })}
                          placeholder="Caption (optional)"
                          className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className={`inline-block text-xs px-1.5 py-0.5 rounded-full font-medium ${PHOTO_TYPE_COLORS[ph.type]}`}>
                          {PHOTO_TYPE_LABELS[ph.type]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {photos.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-2">
                  Photos are optional but recommended for documentation
                </p>
              )}
            </div>
          )}

          {/* Step 1 — Notes */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-slate-900">Completion Notes</h3>
                <p className="text-sm text-slate-400 mt-0.5">Describe the work completed, any issues found, or follow-up required.</p>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={8}
                placeholder="e.g. Replaced worn handrail drive belt on ESC-02. Tested operation — running smoothly. ESC-04 has a minor oil leak on lower drive; recommend follow-up inspection within 2 weeks."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                autoFocus
              />
              <p className="text-xs text-slate-400">Optional but helpful for service history and client sign-off.</p>
            </div>
          )}

          {/* Step 2 — Sign-off */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-medium text-slate-900">Client Sign-off</h3>
                <p className="text-sm text-slate-400 mt-0.5">Have the site supervisor or client representative sign below to confirm work completion.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Signed by (name) *</label>
                  <input
                    type="text"
                    value={signedByName}
                    onChange={(e) => setSignedByName(e.target.value)}
                    placeholder="Full name"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Title / Role</label>
                  <input
                    type="text"
                    value={signedByRole}
                    onChange={(e) => setSignedByRole(e.target.value)}
                    placeholder="e.g. Site Manager"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                  <Pen className="h-3.5 w-3.5" /> Signature *
                </label>
                <SignaturePad onChange={setSignatureData} />
                {!signatureData && (
                  <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                    <Camera className="h-3.5 w-3.5" /> Please draw a signature above
                  </p>
                )}
              </div>

              {/* Summary */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm space-y-1.5">
                <p className="font-medium text-slate-700 text-xs uppercase tracking-wide mb-2">Completion Summary</p>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Photos added</span>
                  <span className="font-medium text-slate-700">{photos.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Notes</span>
                  <span className="font-medium text-slate-700">{notes ? "Yes" : "None"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Signature</span>
                  <span className={`font-medium ${signatureData ? "text-emerald-600" : "text-rose-500"}`}>
                    {signatureData ? "Captured" : "Required"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => step > 0 ? setStep((s) => (s - 1) as Step) : onClose()}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 0 ? "Cancel" : "Back"}
          </button>

          {step < 2 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as Step)}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !canAdvance()}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {saving ? "Saving…" : "Complete Job"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
