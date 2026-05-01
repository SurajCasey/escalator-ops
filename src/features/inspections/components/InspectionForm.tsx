/**
 * InspectionForm.tsx
 *
 * Fully dynamic form renderer.  Accepts any TemplateSchema and an AnswerMap,
 * calls onChange on every keystroke / toggle.
 *
 * Supported question types:
 *   text · textarea · number · date · time
 *   yes_no · checkbox · select · multi_select
 *   photo · worker_table · heading · instruction
 */

import { useRef } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-500 disabled:bg-slate-50 disabled:text-slate-400";

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

function TextQuestion({
  q, value, onChange, readOnly,
}: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <div>
      <Label q={q} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={q.placeholder ?? ""}
        disabled={readOnly}
        className={inputCls}
      />
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function TextareaQuestion({
  q, value, onChange, readOnly,
}: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <div>
      <Label q={q} />
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={q.placeholder ?? ""}
        disabled={readOnly}
        className={inputCls + " resize-y"}
      />
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function NumberQuestion({
  q, value, onChange, readOnly,
}: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <div>
      <Label q={q} />
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={q.placeholder ?? ""}
        disabled={readOnly}
        className={inputCls}
      />
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function DateQuestion({
  q, value, onChange, readOnly,
}: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <div>
      <Label q={q} />
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} disabled={readOnly} className={inputCls} />
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function TimeQuestion({
  q, value, onChange, readOnly,
}: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <div>
      <Label q={q} />
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} disabled={readOnly} className={inputCls} />
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function YesNoQuestion({
  q, value, onChange, readOnly,
}: { q: TemplateQuestion; value: boolean | null | "N/A"; onChange: (v: AnswerValue) => void; readOnly: boolean }) {
  const isFlagged = q.flagIf !== undefined && value === q.flagIf;
  // When flagIf === true, "Yes" is the bad answer → invert colours
  const invertColors = q.flagIf === true;

  const yesCls = value === true
    ? invertColors
      ? "border-rose-400 bg-rose-50 text-rose-700"
      : "border-emerald-500 bg-emerald-50 text-emerald-700"
    : "border-slate-200 text-slate-600 hover:bg-slate-50";

  const noCls = value === false
    ? invertColors
      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
      : "border-rose-400 bg-rose-50 text-rose-700"
    : "border-slate-200 text-slate-600 hover:bg-slate-50";

  const naCls = value === "N/A"
    ? "border-slate-400 bg-slate-100 text-slate-600"
    : "border-slate-200 text-slate-500 hover:bg-slate-50";

  return (
    <div>
      <div className="flex items-center gap-2">
        <Label q={q} />
        {isFlagged && <FlagBadge />}
      </div>
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onChange(true)}
          className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition ${yesCls} disabled:cursor-not-allowed`}
        >
          Yes
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onChange(false)}
          className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition ${noCls} disabled:cursor-not-allowed`}
        >
          No
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onChange("N/A")}
          className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition ${naCls} disabled:cursor-not-allowed`}
        >
          N/A
        </button>
      </div>
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function DateTimeQuestion({
  q, value, onChange, readOnly,
}: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <div>
      <Label q={q} />
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
        className={inputCls}
      />
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function CheckboxQuestion({
  q, value, onChange, readOnly,
}: { q: TemplateQuestion; value: boolean; onChange: (v: boolean) => void; readOnly: boolean }) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer ${readOnly ? "cursor-not-allowed" : ""}`}>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        disabled={readOnly}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-sky-600"
      />
      <span className="text-sm text-slate-700">
        {q.label}
        {q.required && <span className="ml-1 text-rose-500">*</span>}
      </span>
    </label>
  );
}

function SelectQuestion({
  q, value, onChange, readOnly,
}: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <div>
      <Label q={q} />
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={readOnly} className={inputCls}>
        <option value="">— select —</option>
        {(q.options ?? []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function MultiSelectQuestion({
  q, value, onChange, readOnly,
}: { q: TemplateQuestion; value: string[]; onChange: (v: string[]) => void; readOnly: boolean }) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };
  return (
    <div>
      <Label q={q} />
      <div className="mt-1 flex flex-wrap gap-2">
        {(q.options ?? []).map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={readOnly}
            onClick={() => toggle(opt)}
            className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
              value.includes(opt)
                ? "border-sky-500 bg-sky-50 text-sky-700"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            } disabled:cursor-not-allowed`}
          >
            {opt}
          </button>
        ))}
      </div>
      {q.description && <Description text={q.description} />}
    </div>
  );
}

function PhotoQuestion({
  q, value, onChange, readOnly,
}: { q: TemplateQuestion; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const hasFile = value && value.startsWith("data:");

  return (
    <div>
      <Label q={q} />
      {hasFile ? (
        <div className="relative inline-block">
          <img src={value} alt="Captured" className="h-32 w-auto rounded-xl border border-slate-200 object-cover" />
          {!readOnly && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={readOnly}
          onClick={() => ref.current?.click()}
          className="flex h-24 w-full items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-400 hover:border-sky-400 hover:text-sky-500 disabled:cursor-not-allowed"
        >
          Tap to add photo
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => onChange(ev.target?.result as string ?? "");
          reader.readAsDataURL(file);
        }}
      />
      {q.description && <Description text={q.description} />}
    </div>
  );
}

// ── Worker table (SWMS Part 2) ────────────────────────────────────────────────

function WorkerTableQuestion({
  q, value, onChange, readOnly,
}: { q: TemplateQuestion; value: WorkerRow[]; onChange: (v: WorkerRow[]) => void; readOnly: boolean }) {
  const update = (index: number, patch: Partial<WorkerRow>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const add = () => {
    if (value.length >= 10) return;
    onChange([...value, { name: "", classification: "Operator", employedBy: "SEC", date: "" }]);
  };
  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const cellCls = "rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-sky-500 disabled:bg-slate-50 w-full";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label q={q} />
        {!readOnly && value.length < 10 && (
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
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

function Question({
  q, answers, onChange, readOnly,
}: { q: TemplateQuestion; answers: AnswerMap; onChange: (patch: Partial<AnswerMap>) => void; readOnly: boolean }) {
  // Conditional show/hide
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

    case "multi_select":
      return <MultiSelectQuestion q={q} value={(raw as string[]) ?? []} onChange={(v) => set(v)} readOnly={readOnly} />;

    case "photo":
      return <PhotoQuestion q={q} value={(raw as string) ?? ""} onChange={set} readOnly={readOnly} />;

    case "worker_table": {
      const rows = Array.isArray(raw) ? (raw as WorkerRow[]) : [{ name: "", classification: "Operator", employedBy: "SEC", date: "" }];
      return <WorkerTableQuestion q={q} value={rows} onChange={set} readOnly={readOnly} />;
    }

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export default function InspectionForm({ schema, answers, onChange, readOnly = false }: Props) {
  return (
    <div className="space-y-8">
      {schema.sections.map((section) => (
        <section key={section.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{section.title}</h3>
            {section.description && (
              <p className="mt-1 text-xs text-slate-500 leading-5">{section.description}</p>
            )}
          </div>
          {section.questions.map((q) => (
            <Question key={q.id} q={q} answers={answers} onChange={onChange} readOnly={readOnly} />
          ))}
        </section>
      ))}
    </div>
  );
}
