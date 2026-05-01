/**
 * Reports.tsx  —  SafetyCulture-style inspection hub
 *
 * Replaced the old hardcoded report_documents system with:
 *   inspection_templates  →  versioned JSON schemas (PRESTART, SWMS, GENERAL)
 *   inspection_instances  →  one row per filled form
 *
 * The dynamic InspectionForm renders any template schema without code changes.
 * Adding a new template type only requires inserting a row in inspection_templates.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  ClipboardCheck, Download, Eye, FileCheck2, FilePenLine,
  Loader2, Plus, RefreshCw, Search, SendHorizonal, ShieldCheck,
  Trash2, X,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import InspectionForm from "../../inspections/components/InspectionForm";
import { generateAndSaveSwms } from "../../reports/lib/swmsFillPdf";
import type {
  AnswerMap, InspectionInstance, InspectionMeta, InspectionStatus,
  InspectionTemplate, InspectionType, InstanceRow, TemplateRow, WorkerRow,
} from "../../inspections/types";
import {
  defaultAnswers, humanizeType, STATUS_STYLES,
} from "../../inspections/types";

// ─────────────────────────────────────────────────────────────────────────────
// Local types
// ─────────────────────────────────────────────────────────────────────────────

type Role = "ADMIN" | "EMPLOYEE";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
}

interface JobLite {
  id: string;
  title: string;
  client_name: string;
  site_name: string | null;
}

const BUCKET = "report-files"; // reuse existing bucket — inspection-files not required
const TYPE_ICONS: Record<InspectionType, React.ReactNode> = {
  PRESTART: <ClipboardCheck className="h-4 w-4" />,
  SWMS:     <ShieldCheck className="h-4 w-4" />,
  GENERAL:  <FilePenLine className="h-4 w-4" />,
};

// ─────────────────────────────────────────────────────────────────────────────
// Row mappers
// ─────────────────────────────────────────────────────────────────────────────

function mapTemplate(row: TemplateRow): InspectionTemplate {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    version: row.version,
    isActive: row.is_active,
    schema: row.schema,
    createdAt: row.created_at,
  };
}

function mapInstance(
  row: InstanceRow,
  templates: InspectionTemplate[],
  profile: Profile,
  jobs: JobLite[],
): InspectionInstance {
  const tpl = templates.find((t) => t.id === row.template_id);
  const job = jobs.find((j) => j.id === row.job_id);
  return {
    id: row.id,
    templateId: row.template_id,
    templateVersion: row.template_version,
    templateName: tpl?.name ?? "Unknown template",
    templateType: tpl?.type ?? "GENERAL",
    jobId: row.job_id,
    userId: row.user_id,
    createdByName:
      row.user_id === profile.id
        ? profile.full_name?.trim() || profile.email || "You"
        : "Team Member",
    status: row.status,
    answers: row.answers ?? {},
    meta: {
      title:       row.metadata?.title       ?? humanizeType(tpl?.type ?? "GENERAL"),
      clientName:  row.metadata?.clientName  ?? job?.client_name ?? "",
      siteName:    row.metadata?.siteName    ?? job?.site_name   ?? "",
      preparedBy:  row.metadata?.preparedBy  ?? profile.full_name?.trim() ?? "",
    },
    pdfPath: row.pdf_path,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function Reports() {
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [pdfBusy, setPdfBusy]           = useState(false);
  const [profile, setProfile]           = useState<Profile | null>(null);
  const [jobs, setJobs]                 = useState<JobLite[]>([]);
  const [templates, setTemplates]       = useState<InspectionTemplate[]>([]);
  const [instances, setInstances]       = useState<InspectionInstance[]>([]);
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [editorOpen, setEditorOpen]     = useState(false);
  const [pickerOpen, setPickerOpen]     = useState(false);
  const [search, setSearch]             = useState("");
  const [typeFilter, setTypeFilter]     = useState<"ALL" | InspectionType>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | InspectionStatus>("ALL");

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid) { setLoading(false); return; }

    const [profileRes, jobsRes, templatesRes] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,role").eq("id", uid).single<Profile>(),
      supabase.from("jobs").select("id,title,client_name,site_name").order("scheduled_at"),
      supabase.from("inspection_templates").select("*").eq("is_active", true).order("name"),
    ]);

    if (profileRes.error || !profileRes.data) {
      toast.error("Unable to load profile.");
      setLoading(false);
      return;
    }

    const prof       = profileRes.data;
    const jobList    = (jobsRes.data ?? []) as JobLite[];
    const tplList    = ((templatesRes.data ?? []) as TemplateRow[]).map(mapTemplate);

    const instancesQuery =
      prof.role === "ADMIN"
        ? supabase.from("inspection_instances").select("*").order("updated_at", { ascending: false })
        : supabase.from("inspection_instances").select("*").eq("user_id", uid).order("updated_at", { ascending: false });

    const { data: instData, error: instErr } = await instancesQuery;
    if (instErr) toast.error("Inspection table not ready — run migration v7.");

    const instList = ((instData ?? []) as InstanceRow[]).map((r) => mapInstance(r, tplList, prof, jobList));

    setProfile(prof);
    setJobs(jobList);
    setTemplates(tplList);
    setInstances(instList);
    setSelectedId((cur) => (cur && instList.some((i) => i.id === cur) ? cur : instList[0]?.id ?? null));
    setLoading(false);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // ── Selected instance ──────────────────────────────────────────────────────
  const selected = instances.find((i) => i.id === selectedId) ?? null;
  const selectedTemplate = templates.find((t) => t.id === selected?.templateId) ?? null;

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return instances.filter((inst) => {
      if (typeFilter !== "ALL" && inst.templateType !== typeFilter) return false;
      if (statusFilter !== "ALL" && inst.status !== statusFilter) return false;
      if (q) {
        const hay = [inst.meta.title, inst.templateName, inst.meta.clientName,
                     inst.meta.siteName, inst.createdByName].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [instances, search, typeFilter, statusFilter]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:      instances.length,
    preStarts:  instances.filter((i) => i.templateType === "PRESTART").length,
    swms:       instances.filter((i) => i.templateType === "SWMS").length,
    submitted:  instances.filter((i) => i.status === "SUBMITTED" || i.status === "APPROVED").length,
  }), [instances]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  function patchInstance(patch: Partial<InspectionInstance>) {
    if (!selectedId) return;
    setInstances((all) =>
      all.map((i) => i.id === selectedId ? { ...i, ...patch } : i),
    );
  }

  function patchAnswers(patch: Partial<AnswerMap>) {
    if (!selected) return;
    patchInstance({ answers: { ...selected.answers, ...patch } as AnswerMap });
  }

  function patchMeta(patch: Partial<InspectionMeta>) {
    if (!selected) return;
    patchInstance({ meta: { ...selected.meta, ...patch } });
  }

  async function createInstance(template: InspectionTemplate) {
    if (!profile) return;
    setPickerOpen(false);

    const job = jobs[0];
    const answers = defaultAnswers(template.schema);

    // Pre-populate PRESTART sign-off fields from job + current user
    if (template.type === "PRESTART") {
      Object.assign(answers, {
        site_location:   job?.site_name ?? "",
        supervisor_name: profile.full_name?.trim() || profile.email || "",
      });
    }

    const payload = {
      template_id:      template.id,
      template_version: template.version,
      user_id:          profile.id,
      job_id:           job?.id ?? null,
      status:           "DRAFT" as InspectionStatus,
      answers,
      metadata: {
        title:      `${template.name}${job ? " — " + job.title : ""}`,
        clientName: job?.client_name ?? "",
        siteName:   job?.site_name ?? "",
        preparedBy: profile.full_name?.trim() || profile.email || "",
      } satisfies InspectionMeta,
    };

    const { data, error } = await supabase
      .from("inspection_instances")
      .insert(payload)
      .select("*")
      .single<InstanceRow>();

    if (error || !data) { toast.error(error?.message ?? "Failed to create."); return; }

    const mapped = mapInstance(data, templates, profile, jobs);
    setInstances((all) => [mapped, ...all]);
    setSelectedId(mapped.id);
    setEditorOpen(true);
    toast.success(`${template.name} draft created.`);
  }

  async function saveSelected() {
    if (!selected) return;
    setSaving(true);

    const { error } = await supabase
      .from("inspection_instances")
      .update({
        answers:  selected.answers,
        metadata: selected.meta,
        job_id:   selected.jobId,
      })
      .eq("id", selected.id);

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved.");
  }

  async function submitSelected() {
    if (!selected) return;
    setSubmitting(true);

    const { error } = await supabase
      .from("inspection_instances")
      .update({
        answers:      selected.answers,
        metadata:     selected.meta,
        status:       "SUBMITTED",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", selected.id);

    setSubmitting(false);
    if (error) { toast.error(error.message); return; }

    patchInstance({ status: "SUBMITTED", submittedAt: new Date().toISOString() });
    toast.success("Inspection submitted.");
  }

  async function generatePdf() {
    if (!selected || !profile || !selectedTemplate) return;
    setPdfBusy(true);

    try {
      // ── SWMS: pdf-lib overlay on the official template ─────────────────────
      if (selected.templateType === "SWMS") {
        const a = selected.answers;
        const workers = (Array.isArray(a.workers) ? a.workers : []) as WorkerRow[];
        const result = await generateAndSaveSwms(
          {
            clientName:     String(a.client_name     ?? selected.meta.clientName ?? ""),
            jobSiteAddress: String(a.job_site_address ?? selected.meta.siteName  ?? ""),
            contactName:    String(a.contact_name    ?? ""),
            contactTitle:   String(a.contact_title   ?? ""),
            contactPhone:   String(a.contact_phone   ?? ""),
            contactMobile:  String(a.contact_mobile  ?? ""),
            contactEmail:   String(a.contact_email   ?? ""),
            initiatedBy:    String(a.initiated_by    ?? selected.meta.preparedBy ?? ""),
            initiatedDate:  String(a.document_date   ?? ""),
            workLocations:  String(a.work_locations  ?? ""),
            supervisorName: String(a.supervisor_review ?? ""),
            supervisorDate: String(a.document_date   ?? ""),
            managementName: String(a.management_review ?? ""),
            managementDate: String(a.document_date   ?? ""),
            workers,
          },
          selected.jobId ?? undefined,
        );
        await supabase.from("inspection_instances").update({ pdf_path: result.path }).eq("id", selected.id);
        patchInstance({ pdfPath: result.path });
        window.open(result.publicUrl, "_blank", "noopener,noreferrer");
        toast.success("SWMS PDF generated.");
        return;
      }

      // ── PRESTART / GENERAL: build jsPDF, download immediately ─────────────
      const { buildReportPdf } = await import("../../reports/lib/pdf");
      const { createDefaultFormData } = await import("../../reports/components/types");

      const a  = selected.answers;
      const fd = createDefaultFormData(selected.meta.preparedBy);

      // Map inspection answers → legacy formData shape for buildPreStartPdf
      if (selected.templateType === "PRESTART") {
        Object.assign(fd, {
          documentDate:               String(a.document_date   ?? ""),
          startTime:                  String(a.start_time      ?? ""),
          preparedBy:                 selected.meta.preparedBy,
          preStartSiteLocation:       String(a.site_location   ?? ""),
          preStartWorkType:           String(a.work_type       ?? "Escalator Cleaning"),
          preStartArea:               String(a.area            ?? ""),
          preStartEquipmentType:      String(a.equipment_type  ?? "Escalator"),
          preStartWorkerNames:        String(a.worker_names    ?? ""),
          preStartSupervisorName:     String(a.supervisor_name ?? selected.meta.preparedBy),
          preStartVisualInspection:   a.visual_inspection  === true,
          preStartPpeAppropriate:     a.ppe_appropriate    === true,
          preStartSiteInduction:      a.site_induction     === true,
          preStartMachineryGoodOrder: a.machinery_order    === true,
          preStartPreMountChecks:     a.pre_mount_checks   === true,
          preStartReverseCheck:       a.reverse_check      === true,
          preStartConcernsDamage:     a.concerns_damage    === true,
          preStartBarricades:         a.barricades         === true,
          preStartAnyConcerns:        a.any_concerns       === true,
        });
      }

      const blob = buildReportPdf({
        id:            selected.id,
        userId:        selected.userId,
        createdByName: selected.createdByName,
        type:          selected.templateType === "PRESTART" ? "PRESTART" : "REPORT",
        title:         selected.meta.title,
        status:        selected.status,
        jobId:         selected.jobId,
        jobTitle:      jobs.find((j) => j.id === selected.jobId)?.title ?? "",
        clientName:    selected.meta.clientName,
        siteName:      selected.meta.siteName,
        pdfPath:       null,
        generatedAt:   null,
        createdAt:     selected.createdAt,
        updatedAt:     selected.updatedAt,
        formData:      fd,
      });

      // Step 1: immediate download — never fails due to storage issues
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${selected.meta.title.replace(/\s+/g, "-")}.pdf`;
      link.click();
      URL.revokeObjectURL(blobUrl);
      toast.success("PDF downloaded.");

      // Step 2: best-effort upload to Supabase Storage (for record-keeping)
      const filePath = `${profile.id}/${selected.id}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, blob, { upsert: true, contentType: "application/pdf" });

      if (!uploadErr) {
        await supabase.from("inspection_instances").update({ pdf_path: filePath }).eq("id", selected.id);
        patchInstance({ pdfPath: filePath });
      }
      // If upload fails we still got the download — just don't update pdf_path

    } catch (err) {
      console.error("generatePdf error:", err);
      toast.error(`PDF failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPdfBusy(false);
    }
  }

  async function downloadPdf(inst: InspectionInstance) {
    if (!inst.pdfPath) { toast.error("Generate the PDF first."); return; }

    // SWMS PDFs are in the swms-documents bucket (public)
    if (inst.templateType === "SWMS") {
      window.open(inst.pdfPath, "_blank", "noopener,noreferrer");
      return;
    }

    const { data, error } = await supabase.storage.from(BUCKET).download(inst.pdfPath);
    if (error || !data) { toast.error(error?.message ?? "Download failed."); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = `${inst.meta.title.replace(/\s+/g, "-")}.pdf`; a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteInstance(inst: InspectionInstance) {
    if (!confirm(`Delete "${inst.meta.title}"?`)) return;
    if (inst.pdfPath && inst.templateType !== "SWMS") {
      await supabase.storage.from(BUCKET).remove([inst.pdfPath]);
    }
    const { error } = await supabase.from("inspection_instances").delete().eq("id", inst.id);
    if (error) { toast.error(error.message); return; }
    setInstances((all) => all.filter((i) => i.id !== inst.id));
    if (selectedId === inst.id) setSelectedId(null);
    toast.success("Deleted.");
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="animate-pulse space-y-5">
          <div className="h-10 w-64 rounded-2xl bg-slate-200" />
          <div className="h-64 rounded-3xl bg-white" />
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="rounded-3xl bg-linear-to-r from-slate-950 via-slate-900 to-blue-900 p-6 text-white shadow-xl md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.2em] text-sky-200/80">Compliance Records</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Inspections & Forms</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Template-driven inspections — Pre-starts, SWMS, and any custom form.
                Each inspection is versioned and linked to the exact template it was created from.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total" value={stats.total}     icon={<FilePenLine className="h-4 w-4" />} />
              <Stat label="Pre-starts" value={stats.preStarts} icon={<ClipboardCheck className="h-4 w-4" />} />
              <Stat label="SWMS" value={stats.swms}       icon={<ShieldCheck className="h-4 w-4" />} />
              <Stat label="Submitted" value={stats.submitted} icon={<FileCheck2 className="h-4 w-4" />} />
            </div>
          </div>
        </section>

        {/* ── Table ─────────────────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">All Inspections</h2>
                <p className="mt-1 text-sm text-slate-500">Drafts auto-save. Submit to lock the form.</p>
              </div>
              <button
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700"
              >
                <Plus className="h-4 w-4" /> New Inspection
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, client, site, creator…"
                  className="w-full rounded-2xl border border-slate-200 py-3 pl-9 pr-3 text-sm outline-none focus:border-sky-500"
                />
              </div>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-sky-500">
                <option value="ALL">All Types</option>
                <option value="PRESTART">Pre-start</option>
                <option value="SWMS">SWMS</option>
                <option value="GENERAL">General</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-sky-500">
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="APPROVED">Approved</option>
              </select>
              <button onClick={() => void loadData()}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-3 py-3 text-slate-600 hover:bg-slate-50">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Title", "Type", "Client / Site", "Status", "PDF", "Updated", ""].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 last:text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">No inspections yet.</td></tr>
                )}
                {filtered.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 align-top">
                      <p className="font-medium text-slate-900 max-w-xs truncate">{inst.meta.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">By {inst.createdByName}</p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        {TYPE_ICONS[inst.templateType]}
                        {humanizeType(inst.templateType)}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">v{inst.templateVersion}</p>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-slate-600">
                      <p>{inst.meta.clientName || "—"}</p>
                      <p className="text-xs text-slate-400">{inst.meta.siteName || ""}</p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[inst.status]}`}>
                        {inst.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-slate-500">
                      {inst.pdfPath ? "✓ Ready" : "—"}
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-slate-500">{fmtDate(inst.updatedAt)}</td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setSelectedId(inst.id); setEditorOpen(true); }}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          {inst.status === "DRAFT" ? "Edit" : "View"}
                        </button>
                        <button onClick={() => void downloadPdf(inst)} disabled={!inst.pdfPath}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => void deleteInstance(inst)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ── Template picker modal ──────────────────────────────────────────── */}
      {pickerOpen && (
        <Overlay onClose={() => setPickerOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">New Inspection</h2>
              <button onClick={() => setPickerOpen(false)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            {templates.length === 0 ? (
              <p className="text-sm text-slate-500">No active templates. Run supabase_migration_v7.sql first.</p>
            ) : (
              <div className="space-y-2">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => void createInstance(tpl)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left hover:border-sky-400 hover:bg-sky-50 transition"
                  >
                    <span className="text-sky-600">{TYPE_ICONS[tpl.type]}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{tpl.name}</p>
                      <p className="text-xs text-slate-400">{humanizeType(tpl.type)} · v{tpl.version}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Overlay>
      )}

      {/* ── Editor modal ───────────────────────────────────────────────────── */}
      {editorOpen && selected && selectedTemplate && (
        <Overlay onClose={() => setEditorOpen(false)}>
          <section className="relative flex h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">

            {/* Header */}
            <div className="border-b border-slate-100 px-5 pt-5 pb-4 md:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    {humanizeType(selected.templateType)} · v{selected.templateVersion}
                  </p>
                  <input
                    value={selected.meta.title}
                    onChange={(e) => patchMeta({ title: e.target.value })}
                    disabled={selected.status !== "DRAFT"}
                    className="mt-1 w-full border-0 p-0 text-xl font-bold text-slate-900 outline-none disabled:bg-transparent"
                  />
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <MetaChip label="By" value={selected.createdByName} />
                    <MetaChip label="Status" value={selected.status} />
                    <MetaChip label="Updated" value={fmtDate(selected.updatedAt)} />
                    {selected.pdfPath && <MetaChip label="PDF" value="Generated" />}
                  </div>
                </div>
                <button onClick={() => setEditorOpen(false)}
                  className="shrink-0 rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Meta fields */}
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Client</label>
                  <input value={selected.meta.clientName} onChange={(e) => patchMeta({ clientName: e.target.value })}
                    disabled={selected.status !== "DRAFT"}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500 disabled:bg-slate-50" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Site</label>
                  <input value={selected.meta.siteName} onChange={(e) => patchMeta({ siteName: e.target.value })}
                    disabled={selected.status !== "DRAFT"}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500 disabled:bg-slate-50" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Linked Job</label>
                  <select value={selected.jobId ?? ""} disabled={selected.status !== "DRAFT"}
                    onChange={(e) => {
                      const job = jobs.find((j) => j.id === e.target.value);
                      patchInstance({ jobId: e.target.value || null });
                      if (job) {
                        patchMeta({ clientName: job.client_name, siteName: job.site_name ?? "" });
                        // Sync site_location answer for PRESTART
                        if (selected.templateType === "PRESTART") {
                          patchAnswers({ site_location: job.site_name ?? "" });
                        }
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 disabled:bg-slate-50">
                    <option value="">No linked job</option>
                    {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                  </select>
                </div>
              </div>

              {/* Action bar */}
              <div className="mt-4 flex flex-wrap gap-2">
                {selected.status === "DRAFT" && (
                  <>
                    <ActionBtn onClick={() => void saveSelected()} loading={saving} icon={<FilePenLine className="h-4 w-4" />} label="Save Draft" variant="primary" />
                    <ActionBtn onClick={() => void submitSelected()} loading={submitting} icon={<SendHorizonal className="h-4 w-4" />} label="Submit" variant="success" />
                  </>
                )}
                <ActionBtn onClick={() => void generatePdf()} loading={pdfBusy} icon={<FileCheck2 className="h-4 w-4" />} label={selected.templateType === "SWMS" ? "Generate SWMS PDF" : "Generate PDF"} variant="outline" />
                {selected.pdfPath && (
                  <ActionBtn onClick={() => void downloadPdf(selected)} icon={<Download className="h-4 w-4" />} label="Download" variant="outline" />
                )}
              </div>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6">
              <InspectionForm
                schema={selectedTemplate.schema}
                answers={selected.answers}
                onChange={patchAnswers}
                readOnly={selected.status !== "DRAFT"}
              />
            </div>
          </section>
        </Overlay>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small UI components
// ─────────────────────────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/60" />
      <div ref={ref} className="relative z-10 flex w-full justify-center">
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-slate-200">{icon}<span className="text-xs uppercase tracking-wide">{label}</span></div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
      <span className="font-medium text-slate-400">{label}:</span> {value}
    </span>
  );
}

function ActionBtn({
  onClick, loading = false, icon, label, variant,
}: {
  onClick: () => void;
  loading?: boolean;
  icon: React.ReactNode;
  label: string;
  variant: "primary" | "success" | "outline";
}) {
  const cls = {
    primary: "bg-sky-600 text-white hover:bg-sky-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    outline: "border border-slate-200 text-slate-700 hover:bg-slate-50",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${cls}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
