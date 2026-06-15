
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Download, FileCheck2, Loader2, Plus, RotateCcw, SendHorizonal, Trash2 } from "lucide-react";
import type {
  AnswerMap,
  AnswerValue,
  TemplateQuestion,
  TemplateSchema,
  WorkerRow,
} from "../types";

interface Props {
  schema: TemplateSchema;
  answers: AnswerMap;
  onChange: (patch: Partial<AnswerMap>) => void;
  /** Disable all inputs (e.g. when status = SUBMITTED) */
  readOnly?: boolean;
  /** Render one section at a time with Next/Back navigation */
  stepMode?: boolean;
  /** Called when user taps Submit on last step */
  onSubmit?: () => void;
  /** Called when user taps Save on last step */
  onSave?: () => void;
  /** Called when user taps Generate PDF on last step */
  onGeneratePdf?: () => void;
  saving?: boolean;
  submitting?: boolean;
  pdfBusy?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400";

function Label({ q }: { q: TemplateQuestion }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      {q.label}
      {q.required && <span className="ml-1 text-rose-500">*</span>}
    </label>
  );
}

function Description({ text }: { text: string }) {
  return <p className="mt-1 text-xs text-slate-400 leading-5">{text}</p>;
}

function FlagBadge() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      <AlertTriangle className="h-3 w-3" /> Flagged
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Question renderers
// ─────────────────────────────────────────────────────────────────────────────

function TextQuestion({ q, value, onChange, readOnly }: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <div>
      <Label q={q} />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={q.placeholder ?? ""} disabled={readOnly} className={inputCls} />
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function TextareaQuestion({ q, value, onChange, readOnly }: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <div>
      <Label q={q} />
      <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={q.placeholder ?? ""} disabled={readOnly} className={inputCls + " resize-y"} />
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function NumberQuestion({ q, value, onChange, readOnly }: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <div>
      <Label q={q} />
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={q.placeholder ?? ""} disabled={readOnly} className={inputCls} />
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function DateQuestion({ q, value, onChange, readOnly }: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <div>
      <Label q={q} />
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} disabled={readOnly} className={inputCls} />
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function TimeQuestion({ q, value, onChange, readOnly }: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <div>
      <Label q={q} />
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} disabled={readOnly} className={inputCls} />
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function DateTimeQuestion({ q, value, onChange, readOnly }: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <div>
      <Label q={q} />
      <input type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} disabled={readOnly} className={inputCls} />
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function YesNoQuestion({ q, value, onChange, readOnly }: { q: TemplateQuestion; value: boolean | null | "N/A"; onChange: (v: AnswerValue) => void; readOnly: boolean }) {
  const isFlagged = q.flagIf !== undefined && value === q.flagIf;
  const invertColors = q.flagIf === true; // Yes = bad answer

  const yesCls = value === true
    ? invertColors ? "border-rose-400 bg-rose-500 text-white" : "border-emerald-500 bg-emerald-500 text-white"
    : "border-slate-200 text-slate-600 hover:bg-slate-50";

  const noCls = value === false
    ? invertColors ? "border-emerald-500 bg-emerald-500 text-white" : "border-rose-400 bg-rose-500 text-white"
    : "border-slate-200 text-slate-600 hover:bg-slate-50";

  const naCls = value === "N/A"
    ? "border-slate-400 bg-slate-500 text-white"
    : "border-slate-200 text-slate-500 hover:bg-slate-50";

  return (
    <div>
      <div className="flex items-center gap-2">
        <Label q={q} />
        {isFlagged && <FlagBadge />}
      </div>
      <div className="mt-1 flex gap-2">
        <button type="button" disabled={readOnly} onClick={() => onChange(true)} className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${yesCls} disabled:cursor-not-allowed`}>Yes</button>
        <button type="button" disabled={readOnly} onClick={() => onChange(false)} className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${noCls} disabled:cursor-not-allowed`}>No</button>
        <button type="button" disabled={readOnly} onClick={() => onChange("N/A")} className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${naCls} disabled:cursor-not-allowed`}>N/A</button>
      </div>
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function CheckboxQuestion({ q, value, onChange, readOnly }: { q: TemplateQuestion; value: boolean; onChange: (v: boolean) => void; readOnly: boolean }) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer ${readOnly ? "cursor-not-allowed" : ""}`}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} disabled={readOnly} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-blue-600" />
      <span className="text-sm text-slate-700">{q.label}{q.required && <span className="ml-1 text-rose-500">*</span>}</span>
    </label>
  );
}

function SelectQuestion({ q, value, onChange, readOnly }: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <div>
      <Label q={q} />
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={readOnly} className={inputCls}>
        <option value="">— select —</option>
        {(q.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      {q.description && <Description text={q.description} />}
    </div>
  );
}

/** Radio — styled tile buttons, single selection */
function RadioQuestion({ q, value, onChange, readOnly }: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  const opts = q.options ?? [];
  return (
    <div>
      <Label q={q} />
      <div className={`mt-1 grid gap-2 ${opts.length <= 2 ? "grid-cols-2" : opts.length <= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
        {opts.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={readOnly}
            onClick={() => onChange(opt)}
            className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed ${
              value === opt
                ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function MultiSelectQuestion({ q, value, onChange, readOnly }: { q: TemplateQuestion; value: string[]; onChange: (v: string[]) => void; readOnly: boolean }) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };
  return (
    <div>
      <Label q={q} />
      <div className="mt-1 flex flex-wrap gap-2">
        {(q.options ?? []).map((opt) => (
          <button key={opt} type="button" disabled={readOnly} onClick={() => toggle(opt)}
            className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${value.includes(opt) ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"} disabled:cursor-not-allowed`}>
            {opt}
          </button>
        ))}
      </div>
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function PhotoQuestion({ q, value, onChange, readOnly }: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const hasFile = value && value.startsWith("data:");
  return (
    <div>
      <Label q={q} />
      {hasFile ? (
        <div className="relative inline-block">
          <img src={value} alt="Captured" className="h-32 w-auto rounded-xl border border-slate-200 object-cover" />
          {!readOnly && (
            <button type="button" onClick={() => onChange("")} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <button type="button" disabled={readOnly} onClick={() => ref.current?.click()}
          className="flex h-24 w-full items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-400 hover:border-blue-400 hover:text-blue-500 disabled:cursor-not-allowed">
          Tap to add photo
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => onChange(ev.target?.result as string ?? "");
          reader.readAsDataURL(file);
        }} />
      {q.description && <Description text={q.description} />}
    </div>
  );
}

/** Signature — canvas drawing pad */
function SignatureQuestion({ q, value, onChange, readOnly }: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (value) {
      const img = new Image();
      img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
      img.src = value;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy };
    }
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    if (readOnly) return;
    const canvas = canvasRef.current; if (!canvas) return;
    drawing.current = true; lastPos.current = getPos(e, canvas); e.preventDefault();
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx || !lastPos.current) return;
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    lastPos.current = pos; e.preventDefault();
  }

  function endDraw() {
    if (!drawing.current) return;
    drawing.current = false; lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL());
  }

  function clear() {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label q={q} />
        {!readOnly && (
          <button type="button" onClick={clear} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition">
            <RotateCcw className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
      <div className={`rounded-2xl border-2 border-dashed overflow-hidden touch-none ${readOnly ? "border-slate-100 bg-slate-50" : "border-slate-300 bg-white"}`}>
        <canvas ref={canvasRef} width={600} height={160} className={`w-full h-32 ${readOnly ? "cursor-default" : "cursor-crosshair"}`}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
      </div>
      {!value && !readOnly && <p className="text-xs text-slate-400 text-center">Draw your signature above</p>}
      {q.description && <Description text={q.description} />}
    </div>
  );
}

// ── Worker table (SWMS Part 2) ────────────────────────────────────────────────

function WorkerTableQuestion({ q, value, onChange, readOnly }: { q: TemplateQuestion; value: WorkerRow[]; onChange: (v: WorkerRow[]) => void; readOnly: boolean }) {
  const update = (index: number, patch: Partial<WorkerRow>) => onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const add = () => { if (value.length >= 10) return; onChange([...value, { name: "", classification: "Operator", employedBy: "SEC", date: "" }]); };
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));
  const cellCls = "rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500 disabled:bg-slate-50 w-full";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label q={q} />
        {!readOnly && value.length < 10 && (
          <button type="button" onClick={add} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
            <Plus className="h-3.5 w-3.5" /> Add Worker
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 w-8">No.</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Name</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Classification</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Employed By</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Date</th>
              {!readOnly && <th className="px-3 py-2.5 w-8" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {value.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-2 text-xs font-medium text-slate-400">{i + 1}</td>
                <td className="px-3 py-2"><input value={row.name} onChange={(e) => update(i, { name: e.target.value })} disabled={readOnly} className={cellCls} placeholder="Full name" /></td>
                <td className="px-3 py-2"><input value={row.classification} onChange={(e) => update(i, { classification: e.target.value })} disabled={readOnly} className={cellCls} placeholder="Operator" /></td>
                <td className="px-3 py-2"><input value={row.employedBy} onChange={(e) => update(i, { employedBy: e.target.value })} disabled={readOnly} className={cellCls} placeholder="SEC" /></td>
                <td className="px-3 py-2"><input type="date" value={row.date} onChange={(e) => update(i, { date: e.target.value })} disabled={readOnly} className={cellCls} /></td>
                {!readOnly && (
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => remove(i)} disabled={value.length <= 1} className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-50 disabled:opacity-30">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {q.description && <Description text={q.description} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single question dispatcher
// ─────────────────────────────────────────────────────────────────────────────

function Question({ q, answers, onChange, readOnly }: { q: TemplateQuestion; answers: AnswerMap; onChange: (patch: Partial<AnswerMap>) => void; readOnly: boolean }) {
  if (q.conditionalShow) {
    const { questionId, value } = q.conditionalShow;
    if (answers[questionId] !== value) return null;
  }

  const raw = answers[q.id];
  const set = (v: AnswerValue) => onChange({ [q.id]: v });

  switch (q.type) {
    case "heading":
      return <h4 className="border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{q.label}</h4>;
    case "instruction":
      return <p className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-800 leading-6">{q.label}</p>;
    case "text":
      return <TextQuestion q={q} value={(raw as string) ?? ""} onChange={set} readOnly={readOnly} />;
    case "textarea":
      return <TextareaQuestion q={q} value={(raw as string) ?? ""} onChange={set} readOnly={readOnly} />;
    case "number":
      return <NumberQuestion q={q} value={String(raw ?? "")} onChange={set} readOnly={readOnly} />;
    case "date":
      return <DateQuestion q={q} value={(raw as string) ?? ""} onChange={set} readOnly={readOnly} />;
    case "time":
      return <TimeQuestion q={q} value={(raw as string) ?? ""} onChange={set} readOnly={readOnly} />;
    case "datetime":
      return <DateTimeQuestion q={q} value={(raw as string) ?? ""} onChange={set} readOnly={readOnly} />;
    case "yes_no":
      return <YesNoQuestion q={q} value={raw as boolean | null | "N/A"} onChange={set} readOnly={readOnly} />;
    case "checkbox":
      return <CheckboxQuestion q={q} value={(raw as boolean) ?? false} onChange={set} readOnly={readOnly} />;
    case "select":
      return <SelectQuestion q={q} value={(raw as string) ?? ""} onChange={set} readOnly={readOnly} />;
    case "radio":
      return <RadioQuestion q={q} value={(raw as string) ?? ""} onChange={set} readOnly={readOnly} />;
    case "multi_select":
      return <MultiSelectQuestion q={q} value={(raw as string[]) ?? []} onChange={(v) => set(v)} readOnly={readOnly} />;
    case "photo":
      return <PhotoQuestion q={q} value={(raw as string) ?? ""} onChange={set} readOnly={readOnly} />;
    case "signature":
      return <SignatureQuestion q={q} value={(raw as string) ?? ""} onChange={set} readOnly={readOnly} />;
    case "worker_table": {
      const rows = Array.isArray(raw) ? (raw as WorkerRow[]) : [{ name: "", classification: "Operator", employedBy: "SEC", date: "" }];
      return <WorkerTableQuestion q={q} value={rows} onChange={set} readOnly={readOnly} />;
    }
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step indicator (for stepMode)
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ step, total, labels }: { step: number; total: number; labels: string[] }) {
  return (
    <div className="flex flex-col items-center gap-2 pb-4 border-b border-slate-200">
      <div className="flex items-center gap-0">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex items-center">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
              i < step ? "bg-blue-600 text-white" : i === step ? "bg-blue-600 text-white ring-4 ring-blue-100" : "bg-slate-200 text-slate-400"
            }`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            {i < total - 1 && <div className={`h-0.5 w-8 sm:w-12 transition-all ${i < step ? "bg-blue-600" : "bg-slate-200"}`} />}
          </div>
        ))}
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Step {step + 1} of {total}</p>
        <h3 className="mt-0.5 text-sm font-bold text-slate-800">{labels[step]}</h3>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export default function InspectionForm({
  schema, answers, onChange, readOnly = false, stepMode = false,
  onSubmit, onSave, onGeneratePdf, saving = false, submitting = false, pdfBusy = false,
}: Props) {
  const [step, setStep] = useState(0);
  const sections = schema.sections;
  const totalSteps = sections.length;

  if (!stepMode) {
    // Classic all-sections view
    return (
      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{section.title}</h3>
              {section.description && <p className="mt-1 text-xs text-slate-500 leading-5">{section.description}</p>}
            </div>
            {section.questions.map((q) => (
              <Question key={q.id} q={q} answers={answers} onChange={onChange} readOnly={readOnly} />
            ))}
          </section>
        ))}
      </div>
    );
  }

  // ── Step-by-step mode ──
  const currentSection = sections[step];
  const labels = sections.map((s) => s.title);

  return (
    <div className="space-y-6">
      <StepIndicator step={step} total={totalSteps} labels={labels} />

      {/* Section content */}
      <div className="space-y-5">
        {currentSection.description && (
          <p className="text-xs text-slate-500 leading-5">{currentSection.description}</p>
        )}
        {currentSection.questions.map((q) => (
          <Question key={q.id} q={q} answers={answers} onChange={onChange} readOnly={readOnly} />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        {step < totalSteps - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          /* Last step — show action buttons */
          <div className="flex flex-wrap gap-2">
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Save Draft
              </button>
            )}
            {onGeneratePdf && (
              <button
                type="button"
                onClick={onGeneratePdf}
                disabled={pdfBusy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-60"
              >
                {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
                Generate PDF
              </button>
            )}
            {onSubmit && (
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                Submit
              </button>
            )}
            {!onSubmit && !onSave && (
              <span className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                <Check className="h-4 w-4" /> Completed
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
