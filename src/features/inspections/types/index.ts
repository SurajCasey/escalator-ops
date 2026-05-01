// ─────────────────────────────────────────────────────────────────────────────
// Inspection Template System — TypeScript types
//
// Architecture summary:
//   inspection_templates  →  versioned JSON schema (never mutated after publish)
//   inspection_instances  →  one per filled form, frozen to template_id + version
//   inspection_attachments→  photos / signatures keyed to a question_id
// ─────────────────────────────────────────────────────────────────────────────

// ── Question types ────────────────────────────────────────────────────────────

export type QuestionType =
  | "text"          // single-line text
  | "textarea"      // multi-line text
  | "number"        // numeric input
  | "date"          // date picker
  | "time"          // time picker
  | "datetime"      // date + time picker (datetime-local input)
  | "yes_no"        // boolean Yes / No / N/A toggle
  | "checkbox"      // single boolean checkbox
  | "select"        // single choice dropdown
  | "multi_select"  // multiple choice checkboxes
  | "photo"         // photo upload
  | "signature"     // signature capture (name + storage path)
  | "worker_table"  // SWMS-style worker sign-off rows
  | "heading"       // non-input section divider
  | "instruction";  // informational text block

// ── Conditional visibility ────────────────────────────────────────────────────

export interface ConditionalShow {
  /** The question whose answer controls visibility */
  questionId: string;
  /** Show this question only when the referenced question equals this value */
  value: AnswerValue;
}

// ── Template question ─────────────────────────────────────────────────────────

export interface TemplateQuestion {
  id: string;
  type: QuestionType;
  label: string;
  description?: string;         // helper text rendered below the input
  required?: boolean;
  defaultValue?: AnswerValue;
  placeholder?: string;
  options?: string[];           // for select / multi_select
  /** Flag the answer as a concern when it equals this value (yes_no only) */
  flagIf?: boolean | string;
  /** Only show this question when another question has a specific value */
  conditionalShow?: ConditionalShow;
}

// ── Template section ──────────────────────────────────────────────────────────

export interface TemplateSection {
  id: string;
  title: string;
  description?: string;
  questions: TemplateQuestion[];
}

// ── Full template schema (stored as JSONB in inspection_templates.schema) ─────

export interface TemplateSchema {
  sections: TemplateSection[];
}

// ── Template record ───────────────────────────────────────────────────────────

export type InspectionType = "PRESTART" | "SWMS" | "GENERAL";

export interface InspectionTemplate {
  id: string;
  name: string;
  type: InspectionType;
  version: number;
  isActive: boolean;
  schema: TemplateSchema;
  createdAt: string;
}

// ── Answers ───────────────────────────────────────────────────────────────────

/** A single answer value — polymorphic over all question types. */
export type AnswerValue = string | number | boolean | string[] | WorkerRow[] | null;

/**
 * Keyed by question id.  Examples:
 *   { "work_type": "Escalator Cleaning", "visual_inspection": true, "workers": [...] }
 */
export type AnswerMap = Record<string, AnswerValue>;

// ── Worker row (for worker_table question type) ────────────────────────────────

export interface WorkerRow {
  name: string;
  classification: string;
  employedBy: string;
  date: string;
}

// ── Inspection metadata (separate from answers — always present) ──────────────

export interface InspectionMeta {
  title: string;
  clientName: string;
  siteName: string;
  preparedBy: string;
}

// ── Status ────────────────────────────────────────────────────────────────────

export type InspectionStatus = "DRAFT" | "SUBMITTED" | "APPROVED";

// ── Instance ──────────────────────────────────────────────────────────────────

/** A completed or in-progress inspection, linked to a frozen template version. */
export interface InspectionInstance {
  id: string;
  templateId: string;
  templateVersion: number;
  templateName: string;
  templateType: InspectionType;
  jobId: string | null;
  userId: string;
  createdByName: string;
  status: InspectionStatus;
  answers: AnswerMap;
  meta: InspectionMeta;
  pdfPath: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── DB row shapes (raw from Supabase) ─────────────────────────────────────────

export interface TemplateRow {
  id: string;
  name: string;
  type: InspectionType;
  version: number;
  is_active: boolean;
  schema: TemplateSchema;
  created_at: string;
}

export interface InstanceRow {
  id: string;
  template_id: string;
  template_version: number;
  job_id: string | null;
  user_id: string;
  status: InspectionStatus;
  answers: AnswerMap;
  metadata: InspectionMeta;
  pdf_path: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function defaultAnswers(schema: TemplateSchema): AnswerMap {
  const map: AnswerMap = {};
  for (const section of schema.sections) {
    for (const q of section.questions) {
      if (q.type === "heading" || q.type === "instruction") continue;
      if (q.defaultValue !== undefined) {
        map[q.id] = q.defaultValue;
      } else if (q.type === "yes_no" || q.type === "checkbox") {
        map[q.id] = null;
      } else if (q.type === "multi_select") {
        map[q.id] = [];
      } else if (q.type === "worker_table") {
        map[q.id] = [{ name: "", classification: "Operator", employedBy: "SEC", date: "" }];
      } else {
        map[q.id] = "";
      }
    }
  }
  return map;
}

export function humanizeType(type: InspectionType): string {
  if (type === "PRESTART") return "Pre-start";
  if (type === "SWMS")     return "SWMS";
  return "Inspection";
}

export const STATUS_STYLES: Record<InspectionStatus, string> = {
  DRAFT:     "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-sky-100 text-sky-700",
  APPROVED:  "bg-emerald-100 text-emerald-700",
};
