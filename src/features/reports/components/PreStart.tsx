import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import type { ReportFormData } from "./types";

// ── Equipment options ─────────────────────────────────────────────────────────
const EQUIPMENT_OPTIONS = ["TK Elevator", "Otis", "Liftronic", "Other"] as const;

// ── Step labels ───────────────────────────────────────────────────────────────
const STEPS = ["Cover", "Prestart Audit", "Safety Audit"];

// ── Props ─────────────────────────────────────────────────────────────────────
type Props = {
  formData: ReportFormData;
  onChange: (patch: Partial<ReportFormData>) => void;
};

// ── Shared input ──────────────────────────────────────────────────────────────
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${props.className ?? ""}`}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none ${props.className ?? ""}`}
    />
  );
}

// ── Yes / No / N/A tri-state row ─────────────────────────────────────────────
function YesNoNa({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (next: boolean | null) => void;
}) {
  const btn = (label: string, active: boolean, color: string) => (
    <button
      type="button"
      onClick={() => onChange(label === "Yes" ? true : label === "No" ? false : null)}
      className={`min-w-[48px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
        active ? color : "bg-slate-100 text-slate-500 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="flex-1 text-sm font-medium text-slate-800 leading-5">{label}</p>
      <div className="flex gap-1.5 shrink-0">
        {btn("Yes", value === true,  "bg-emerald-500 text-white shadow-sm")}
        {btn("No",  value === false, "bg-rose-500 text-white shadow-sm")}
        {btn("N/A", value === null,  "bg-slate-500 text-white shadow-sm")}
      </div>
    </div>
  );
}

// Damage question: No = green (no damage is good), Yes = red
function DamageRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (next: boolean | null) => void;
}) {
  const btn = (lbl: string, active: boolean, color: string) => (
    <button
      type="button"
      onClick={() => onChange(lbl === "Yes" ? true : lbl === "No" ? false : null)}
      className={`min-w-[48px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
        active ? color : "bg-slate-100 text-slate-500 hover:bg-slate-200"
      }`}
    >
      {lbl}
    </button>
  );

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="flex-1 text-sm font-medium text-slate-800 leading-5">{label}</p>
      <div className="flex gap-1.5 shrink-0">
        {btn("Yes", value === true,  "bg-rose-500 text-white shadow-sm")}
        {btn("No",  value === false, "bg-emerald-500 text-white shadow-sm")}
        {btn("N/A", value === null,  "bg-slate-500 text-white shadow-sm")}
      </div>
    </div>
  );
}

// ── Signature pad ─────────────────────────────────────────────────────────────
function SignaturePad({
  value,
  onChange,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // If value is provided externally (e.g. loaded from saved state), draw it
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = value;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    lastPos.current = getPos(e, canvas);
    e.preventDefault();
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || !lastPos.current) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    e.preventDefault();
  }

  function endDraw() {
    if (!drawing.current) return;
    drawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL());
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Signature</span>
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition"
        >
          <RotateCcw className="h-3 w-3" />
          Clear
        </button>
      </div>
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full h-32 cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      {!value && (
        <p className="text-xs text-slate-400 text-center">Draw your signature above</p>
      )}
    </div>
  );
}

// ── Step progress indicator ───────────────────────────────────────────────────
function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-0">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
              i < step
                ? "bg-blue-600 text-white"
                : i === step
                ? "bg-blue-600 text-white ring-4 ring-blue-100"
                : "bg-slate-200 text-slate-400"
            }`}
          >
            {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`h-0.5 w-8 sm:w-12 transition-all ${i < step ? "bg-blue-600" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 1 — Cover
// ═════════════════════════════════════════════════════════════════════════════
function CoverStep({ formData, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Site Location</label>
          <Input
            value={formData.preStartSiteLocation}
            onChange={(e) => onChange({ preStartSiteLocation: e.target.value })}
            placeholder="e.g. Emerald Square"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Date</label>
          <Input
            type="date"
            value={formData.documentDate}
            onChange={(e) => onChange({ documentDate: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Prepared By</label>
          <Input
            value={formData.preparedBy}
            readOnly
            className="bg-slate-50 text-slate-500 cursor-default"
          />
          <p className="mt-1 text-xs text-slate-400">Auto-filled from your profile</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Start Time (AEST)</label>
          <Input
            type="time"
            value={formData.startTime}
            onChange={(e) => onChange({ startTime: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 2 — Prestart Audit
// ═════════════════════════════════════════════════════════════════════════════
function PrestartAuditStep({ formData, onChange }: Props) {
  return (
    <div className="space-y-4">
      {/* Work type */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          What type of work are you performing?
        </label>
        <Input
          value={formData.preStartWorkType}
          onChange={(e) => onChange({ preStartWorkType: e.target.value })}
          placeholder="e.g. Escalator Cleaning, Tactile replacement"
        />
      </div>

      {/* Work area */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          What area will you be working on?
        </label>
        <Input
          value={formData.preStartArea}
          onChange={(e) => onChange({ preStartArea: e.target.value })}
          placeholder="e.g. Level 1, Ground Floor"
        />
      </div>

      {/* Equipment type */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          What type of equipment are you working on?
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {EQUIPMENT_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange({ preStartEquipmentType: opt })}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                formData.preStartEquipmentType === opt
                  ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {formData.preStartEquipmentType === "Other" && (
          <div className="mt-2">
            <Input
              value={formData.preStartEquipmentOther}
              onChange={(e) => onChange({ preStartEquipmentOther: e.target.value })}
              placeholder="Specify equipment type"
            />
          </div>
        )}
      </div>

      {/* Visual inspection */}
      <YesNoNa
        label="Have you completed the visual inspection prior to any works being carried out?"
        value={formData.preStartVisualInspection}
        onChange={(v) => onChange({ preStartVisualInspection: v })}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 3 — Safety Audit + Sign-off
// ═════════════════════════════════════════════════════════════════════════════
function SafetyAuditStep({ formData, onChange }: Props) {
  return (
    <div className="space-y-3">
      <YesNoNa
        label="Do you have the appropriate PPE to undertake the works?"
        value={formData.preStartPpeAppropriate}
        onChange={(v) => onChange({ preStartPpeAppropriate: v })}
      />
      <YesNoNa
        label="Have you received a site induction?"
        value={formData.preStartSiteInduction}
        onChange={(v) => onChange({ preStartSiteInduction: v })}
      />
      <YesNoNa
        label="Have you checked if our machinery is in good working order?"
        value={formData.preStartMachineryGoodOrder}
        onChange={(v) => onChange({ preStartMachineryGoodOrder: v })}
      />
      <YesNoNa
        label="Have you completed your checks before mounting the machines on the escalator/travelator?"
        value={formData.preStartPreMountChecks}
        onChange={(v) => onChange({ preStartPreMountChecks: v })}
      />
      <YesNoNa
        label="Have you checked if the escalator/travelator drives in reverse prior to starting works?"
        value={formData.preStartReverseCheck}
        onChange={(v) => onChange({ preStartReverseCheck: v })}
      />
      <DamageRow
        label="Is there any damage or concerns on the escalator/travelator?"
        value={formData.preStartConcernsDamage}
        onChange={(v) => onChange({ preStartConcernsDamage: v })}
      />
      <YesNoNa
        label="Have you used maintenance barricades to block off the escalator/travelator?"
        value={formData.preStartBarricades}
        onChange={(v) => onChange({ preStartBarricades: v })}
      />

      {/* Comments */}
      <div className="pt-2">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Do you have any concerns or comments?
          <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>
        </label>
        <Textarea
          rows={3}
          value={formData.preStartAnyConcerns}
          onChange={(e) => onChange({ preStartAnyConcerns: e.target.value })}
          placeholder="Describe any concerns, damage, or additional notes..."
        />
      </div>

      {/* Signature */}
      <div className="pt-2">
        <SignaturePad
          value={formData.preStartSignature}
          onChange={(v) => onChange({ preStartSignature: v })}
        />
      </div>

      {/* Name (auto-filled, read-only) */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
        <Input
          value={formData.preparedBy}
          readOnly
          className="bg-slate-50 text-slate-500 cursor-default"
        />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function PreStart({ formData, onChange }: Props) {
  const [step, setStep] = useState(0);
  const totalSteps = STEPS.length;

  const stepContent = [
    <CoverStep key="cover" formData={formData} onChange={onChange} />,
    <PrestartAuditStep key="audit" formData={formData} onChange={onChange} />,
    <SafetyAuditStep key="safety" formData={formData} onChange={onChange} />,
  ];

  return (
    <div className="space-y-6">
      {/* ── Step header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3 pb-2">
        <StepIndicator step={step} total={totalSteps} />
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Step {step + 1} of {totalSteps}
          </p>
          <h3 className="mt-0.5 text-base font-bold text-slate-800">{STEPS[step]}</h3>
        </div>
      </div>

      {/* ── Step content ────────────────────────────────────────────────── */}
      <div>{stepContent[step]}</div>

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        {step < totalSteps - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <span className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            <Check className="h-4 w-4" />
            Ready to submit
          </span>
        )}
      </div>
    </div>
  );
}
