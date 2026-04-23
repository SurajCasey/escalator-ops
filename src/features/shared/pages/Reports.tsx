import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ClipboardCheck,
  Eye,
  Download,
  FileCheck2,
  FilePenLine,
  X,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import PreStart from "../../reports/components/PreStart";
import SWMS from "../../reports/components/SWMS";
import { buildReportPdf } from "../../reports/lib/pdf";
import type { ReportDocument, ReportFileType, ReportFormData, ReportStatus } from "../../reports/components/types";
import { createDefaultFormData } from "../../reports/components/types";

type Role = "ADMIN" | "EMPLOYEE";

type JobLite = {
  id: string;
  title: string;
  client_name: string;
  site_name: string | null;
};

type ProfileLite = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
};

type ReportRow = {
  id: string;
  user_id: string;
  type: ReportFileType;
  title: string;
  status: ReportStatus;
  job_id: string | null;
  client_name: string;
  site_name: string;
  pdf_path: string | null;
  generated_at: string | null;
  form_data: ReportFormData | null;
  created_at: string;
  updated_at: string;
};

const REPORT_BUCKET = "report-files";

const STATUS_STYLES: Record<ReportStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-sky-100 text-sky-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
};

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [jobs, setJobs] = useState<JobLite[]>([]);
  const [documents, setDocuments] = useState<ReportDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ReportFileType>("ALL");

  useEffect(() => {
    void loadData();
  }, []);

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((document) => {
      const matchesType = typeFilter === "ALL" || document.type === typeFilter;
      const matchesSearch =
        q.length === 0 ||
        document.title.toLowerCase().includes(q) ||
        document.jobTitle.toLowerCase().includes(q) ||
        document.clientName.toLowerCase().includes(q) ||
        document.siteName.toLowerCase().includes(q) ||
        document.createdByName.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [documents, search, typeFilter]);

  const selectedDocument = documents.find((document) => document.id === selectedId) ?? null;

  const stats = useMemo(
    () => ({
      total: documents.length,
      reports: documents.filter((document) => document.type === "REPORT").length,
      preStarts: documents.filter((document) => document.type === "PRESTART").length,
      swms: documents.filter((document) => document.type === "SWMS").length,
    }),
    [documents],
  );

  async function loadData() {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session) {
      toast.error("Session expired. Please log in again.");
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", session.user.id)
      .single<ProfileLite>();

    if (profileError || !profileData) {
      toast.error("Unable to load your profile.");
      setLoading(false);
      return;
    }

    const jobsQuery = supabase
      .from("jobs")
      .select("id, title, client_name, site_name")
      .order("scheduled_at", { ascending: true });

    const reportsQuery =
      profileData.role === "ADMIN"
        ? supabase.from("report_documents").select("*").order("updated_at", { ascending: false })
        : supabase.from("report_documents").select("*").eq("user_id", profileData.id).order("updated_at", { ascending: false });

    const [{ data: jobsData, error: jobsError }, { data: reportsData, error: reportsError }] = await Promise.all([jobsQuery, reportsQuery]);

    if (jobsError) toast.error(jobsError.message);
    if (reportsError) toast.error("Report table is not ready. Run the SQL setup first.");

    const jobList = (jobsData ?? []) as JobLite[];
    const docs = ((reportsData ?? []) as ReportRow[]).map((row) => mapRowToDocument(row, profileData, jobList));

    setProfile(profileData);
    setJobs(jobList);
    setDocuments(docs);
    setSelectedId((current) => (current && docs.some((doc) => doc.id === current) ? current : docs[0]?.id ?? null));
    setLoading(false);
  }

  function updateSelected(patch: Partial<ReportDocument>) {
    if (!selectedDocument) return;
    setDocuments((current) =>
      current.map((document) =>
        document.id === selectedDocument.id
          ? { ...document, ...patch, updatedAt: new Date().toISOString() }
          : document,
      ),
    );
  }

  function updateFormData(patch: Partial<ReportFormData>) {
    if (!selectedDocument) return;
    updateSelected({ formData: { ...selectedDocument.formData, ...patch } });
  }

  async function createDocument(type: ReportFileType) {
    if (!profile) return;
    const fallbackJob = jobs[0];
    const insert = buildInsertPayload(type, profile, fallbackJob);

    const { data, error } = await supabase.from("report_documents").insert(insert).select("*").single<ReportRow>();
    if (error || !data) {
      toast.error(error?.message ?? "Unable to create document.");
      return;
    }

    const mapped = mapRowToDocument(data, profile, jobs);
    setDocuments((current) => [mapped, ...current]);
    setSelectedId(mapped.id);
    setEditorOpen(true);
    toast.success(`${humanizeType(type)} draft created in Supabase.`);
  }

  async function saveSelected() {
    if (!selectedDocument) return;
    setSaving(true);

    const payload = {
      title: selectedDocument.title,
      status: selectedDocument.status,
      job_id: selectedDocument.jobId,
      client_name: selectedDocument.clientName,
      site_name: selectedDocument.siteName,
      form_data: selectedDocument.formData,
    };

    const { error } = await supabase.from("report_documents").update(payload).eq("id", selectedDocument.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Report saved.");
    await loadData();
  }

  async function generatePdfForSelected() {
    if (!selectedDocument || !profile) return;
    setPdfBusy(true);

    const pdfBlob = buildReportPdf(selectedDocument);
    const safeName = slugify(selectedDocument.title || humanizeType(selectedDocument.type));
    const filePath = `${profile.id}/${selectedDocument.id}-${safeName}.pdf`;

    const upload = await supabase.storage.from(REPORT_BUCKET).upload(filePath, pdfBlob, {
      upsert: true,
      contentType: "application/pdf",
    });

    if (upload.error) {
      toast.error(upload.error.message);
      setPdfBusy(false);
      return;
    }

    const { error } = await supabase
      .from("report_documents")
      .update({
        title: selectedDocument.title,
        status: selectedDocument.status,
        job_id: selectedDocument.jobId,
        client_name: selectedDocument.clientName,
        site_name: selectedDocument.siteName,
        form_data: selectedDocument.formData,
        pdf_path: filePath,
        generated_at: new Date().toISOString(),
      })
      .eq("id", selectedDocument.id);

    setPdfBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("PDF generated and stored.");
    await loadData();
  }

  async function downloadPdf(document: ReportDocument) {
    if (!document.pdfPath) {
      toast.error("Generate the PDF first.");
      return;
    }

    const { data, error } = await supabase.storage.from(REPORT_BUCKET).download(document.pdfPath);
    if (error || !data) {
      toast.error(error?.message ?? "Unable to download PDF.");
      return;
    }

    const url = URL.createObjectURL(data);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${slugify(document.title || "report")}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function viewPdf(document: ReportDocument) {
    if (!document.pdfPath) {
      toast.error("Generate the PDF first.");
      return;
    }

    const { data, error } = await supabase.storage.from(REPORT_BUCKET).createSignedUrl(document.pdfPath, 60);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Unable to open PDF.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteDocument(document: ReportDocument) {
    const confirmed = window.confirm(`Delete "${document.title}"? This will remove the saved document record${document.pdfPath ? " and its generated PDF" : ""}.`);
    if (!confirmed) return;

    if (document.pdfPath) {
      const storageDelete = await supabase.storage.from(REPORT_BUCKET).remove([document.pdfPath]);
      if (storageDelete.error) {
        toast.error(storageDelete.error.message);
        return;
      }
    }

    const { error } = await supabase.from("report_documents").delete().eq("id", document.id);
    if (error) {
      toast.error(error.message);
      return;
    }

    setDocuments((current) => current.filter((item) => item.id !== document.id));
    setSelectedId((current) => (current === document.id ? null : current));
    toast.success("Document deleted.");
  }

  function openEditor(documentId: string) {
    setSelectedId(documentId);
    setEditorOpen(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="animate-pulse space-y-5">
          <div className="h-12 w-72 rounded-2xl bg-slate-200" />
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="h-176 rounded-3xl bg-white" />
            <div className="h-176 rounded-3xl bg-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-linear-to-r from-slate-950 via-slate-900 to-blue-900 p-6 text-white shadow-xl md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.2em] text-sky-200/80">Compliance Records</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Reports, Pre-starts & SWMS</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200 md:text-base">
                Real report records from Supabase. Fill in the form, save the document, generate a PDF, and keep the generated file in Supabase Storage.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <TopStat label="All Files" value={stats.total} icon={<FilePenLine className="h-4 w-4" />} />
              <TopStat label="Reports" value={stats.reports} icon={<FileCheck2 className="h-4 w-4" />} />
              <TopStat label="Pre-starts" value={stats.preStarts} icon={<ClipboardCheck className="h-4 w-4" />} />
              <TopStat label="SWMS" value={stats.swms} icon={<ShieldCheck className="h-4 w-4" />} />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-sky-200 bg-sky-50 px-5 py-4 text-sky-900 shadow-sm">
          <p className="text-sm leading-6">
            `New Report`, `New Pre-start`, and `New SWMS` create a draft row immediately in the `report_documents` Supabase table.
            The PDF file is not created at that point. It is only generated and stored in the private `report-files` Storage bucket when you click `Generate PDF`.
          </p>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">Reports Table</h2>
                <p className="mt-1 text-sm text-slate-500">
                  View all saved documents first, then create a new pre-start, SWMS, or report from the action bar.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void createDocument("REPORT")} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700">
                  <Plus className="h-4 w-4" />
                  New Report
                </button>
                <button onClick={() => void createDocument("PRESTART")} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Plus className="h-4 w-4" />
                  New Pre-start
                </button>
                <button onClick={() => void createDocument("SWMS")} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Plus className="h-4 w-4" />
                  New SWMS
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title, site, creator"
                  className="w-full rounded-2xl border border-slate-200 py-3 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-sky-500"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as "ALL" | ReportFileType)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
              >
                <option value="ALL">All File Types</option>
                <option value="REPORT">Reports</option>
                <option value="PRESTART">Pre-starts</option>
                <option value="SWMS">SWMS</option>
              </select>
              <button
                onClick={() => void loadData()}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-3 py-3 text-slate-600 hover:bg-slate-50"
                aria-label="Refresh reports"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="border-b border-slate-100 px-5 py-4">
            <p className="text-sm text-slate-500">
              Click `Edit` to open the report editor modal. Newly created documents now open directly in that modal.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Title</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Client / Site</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">PDF</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Updated</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocuments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                      No documents available.
                    </td>
                  </tr>
                )}
                {filteredDocuments.map((document) => (
                  <tr key={document.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 align-top">
                      <div className="max-w-xs">
                        <p className="wrap-break-word font-medium text-slate-900">{document.title}</p>
                        <p className="mt-1 text-xs text-slate-400">By {document.createdByName || "Unknown user"}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-slate-600">{humanizeType(document.type)}</td>
                    <td className="px-5 py-4 align-top">
                      <div className="max-w-xs text-sm text-slate-600">
                        <p className="wrap-break-word">{document.clientName || "-"}</p>
                        <p className="mt-1 wrap-break-word text-xs text-slate-400">{document.siteName || "No site"}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[document.status]}`}>
                        {document.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-slate-600">{document.pdfPath ? "Generated" : "Not generated"}</td>
                    <td className="px-5 py-4 align-top text-sm text-slate-600">{formatDate(document.updatedAt)}</td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditor(document.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => void viewPdf(document)}
                          disabled={!document.pdfPath}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View PDF
                        </button>
                        <button
                          onClick={() => void deleteDocument(document)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
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

      {editorOpen && selectedDocument && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close editor overlay"
            onClick={() => setEditorOpen(false)}
            className="absolute inset-0 bg-slate-950/60"
          />

          <section className="relative z-10 flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="absolute right-4 top-4 inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 hover:bg-slate-50 md:right-5 md:top-5"
              aria-label="Close editor"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="border-b border-slate-100 p-5 pr-20 pt-16 md:p-6 md:pr-24 md:pt-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{humanizeType(selectedDocument.type)}</p>
                  <input
                    value={selectedDocument.title}
                    onChange={(event) => updateSelected({ title: event.target.value })}
                    className="mt-2 w-full border-0 p-0 text-2xl font-bold text-slate-900 outline-none md:text-3xl"
                  />
                  <div className="mt-3 hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
                    <MetaPill label="Created By" value={selectedDocument.createdByName} />
                    <MetaPill label="Updated" value={formatDate(selectedDocument.updatedAt)} />
                    <MetaPill label="PDF" value={selectedDocument.pdfPath ? "Generated" : "Not generated"} />
                    <MetaPill label="Job" value={selectedDocument.jobTitle || "Unlinked"} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedDocument.status}
                    onChange={(event) => updateSelected({ status: event.target.value as ReportStatus })}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="SUBMITTED">Submitted</option>
                    <option value="APPROVED">Approved</option>
                  </select>
                  <button
                    onClick={() => void saveSelected()}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => void generatePdfForSelected()}
                    disabled={pdfBusy}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <FileCheck2 className="h-4 w-4" />
                    {pdfBusy ? "Generating..." : "Generate PDF"}
                  </button>
                  <button
                    onClick={() => void downloadPdf(selectedDocument)}
                    disabled={!selectedDocument.pdfPath}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="space-y-8 p-5 md:p-6">
                <SectionCard
                  title="Document Setup"
                  description="Link the report to a job and set the core site metadata that will appear in the stored record and PDF."
                >
                  <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                    <Field label="Related Job">
                      <select
                        value={selectedDocument.jobId ?? ""}
                        onChange={(event) => {
                          const job = jobs.find((item) => item.id === event.target.value);
                          updateSelected({
                            jobId: job?.id ?? null,
                            jobTitle: job?.title ?? "",
                            clientName: job?.client_name ?? "",
                            siteName: job?.site_name ?? "",
                          });
                        }}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
                      >
                        <option value="">No linked job</option>
                        {jobs.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.title}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Client">
                      <input
                        value={selectedDocument.clientName}
                        onChange={(event) => updateSelected({ clientName: event.target.value })}
                        className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
                      />
                    </Field>
                    <Field label="Site">
                      <input
                        value={selectedDocument.siteName}
                        onChange={(event) => updateSelected({ siteName: event.target.value })}
                        className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
                      />
                    </Field>
                    <Field label="Prepared By">
                      <input
                        value={selectedDocument.formData.preparedBy}
                        onChange={(event) => updateFormData({ preparedBy: event.target.value })}
                        className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
                      />
                    </Field>
                  </div>
                </SectionCard>

                {selectedDocument.type === "REPORT" && (
                  <SectionCard title="Service Report" description="Use this for completed work summaries, materials used, and client-facing completion notes.">
                    <GeneralReportEditor formData={selectedDocument.formData} onChange={updateFormData} />
                  </SectionCard>
                )}

                {selectedDocument.type === "PRESTART" && (
                  <SectionCard title="Pre-start Checklist" description="This form captures site readiness, safety checks, hazards, and operational controls before work begins.">
                    <PreStart formData={selectedDocument.formData} onChange={updateFormData} />
                  </SectionCard>
                )}

                {selectedDocument.type === "SWMS" && (
                  <SectionCard title="SWMS / JSEA" description="Capture work scope, hazards, controls, residual risk, and sign-off details for the job.">
                    <SWMS formData={selectedDocument.formData} onChange={updateFormData} />
                  </SectionCard>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function GeneralReportEditor({
  formData,
  onChange,
}: {
  formData: ReportFormData;
  onChange: (patch: Partial<ReportFormData>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Field label="Document Date">
          <input
            type="date"
            value={formData.documentDate}
            onChange={(event) => onChange({ documentDate: event.target.value })}
            className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
          />
        </Field>
        <Field label="Crew Names">
          <input
            value={formData.crewNames}
            onChange={(event) => onChange({ crewNames: event.target.value })}
            className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
          />
        </Field>
        <Field label="Start Time">
          <input
            type="time"
            value={formData.startTime}
            onChange={(event) => onChange({ startTime: event.target.value })}
            className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
          />
        </Field>
        <Field label="Finish Time">
          <input
            type="time"
            value={formData.finishTime}
            onChange={(event) => onChange({ finishTime: event.target.value })}
            className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
          />
        </Field>
      </div>

      <TextAreaField
        label="Summary"
        value={formData.reportSummary}
        onChange={(value) => onChange({ reportSummary: value })}
        placeholder="Overview of the completed work, site condition, and outcome."
      />
      <TextAreaField
        label="Work Completed"
        value={formData.workCompleted}
        onChange={(value) => onChange({ workCompleted: value })}
        placeholder="Cleaning completed, handrail polish applied, signage removed..."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <TextAreaField
          label="Incidents / Variations"
          value={formData.incidents}
          onChange={(value) => onChange({ incidents: value })}
          placeholder="Access delays, obstructions, client instructions..."
        />
        <TextAreaField
          label="Materials Used"
          value={formData.materialsUsed}
          onChange={(value) => onChange({ materialsUsed: value })}
          placeholder="Cleaning solution, microfiber cloths, cones, PPE..."
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TextAreaField
          label="Equipment Used"
          value={formData.equipmentUsed}
          onChange={(value) => onChange({ equipmentUsed: value })}
          placeholder="Scrubber, safety barricades, signage, access gear..."
        />
        <TextAreaField
          label="Customer Notes"
          value={formData.customerNotes}
          onChange={(value) => onChange({ customerNotes: value })}
          placeholder="Client follow-up notes, observations, requests..."
        />
      </div>
    </div>
  );
}

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5 md:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Field label={label}>
      <textarea
        rows={5}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-sky-500"
      />
    </Field>
  );
}

function TopStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-slate-200">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 wrap-break-word text-sm text-slate-700">{value || "-"}</p>
    </div>
  );
}

function buildInsertPayload(type: ReportFileType, profile: ProfileLite, job?: JobLite) {
  const title = defaultTitle(type, job);
  return {
    user_id: profile.id,
    type,
    title,
    status: "DRAFT" as ReportStatus,
    job_id: job?.id ?? null,
    client_name: job?.client_name ?? "",
    site_name: job?.site_name ?? "",
    form_data: createDefaultFormData(profile.full_name?.trim() || profile.email || "User"),
  };
}

function mapRowToDocument(row: ReportRow, profile: ProfileLite, jobs: JobLite[]): ReportDocument {
  const relatedJob = jobs.find((job) => job.id === row.job_id);
  return {
    id: row.id,
    userId: row.user_id,
    createdByName: row.user_id === profile.id ? profile.full_name?.trim() || profile.email || "You" : "Team Member",
    type: row.type,
    title: row.title,
    status: row.status,
    jobId: row.job_id,
    jobTitle: relatedJob?.title ?? "",
    clientName: row.client_name ?? relatedJob?.client_name ?? "",
    siteName: row.site_name ?? relatedJob?.site_name ?? "",
    pdfPath: row.pdf_path,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    formData: { ...createDefaultFormData(profile.full_name?.trim() || profile.email || "User"), ...(row.form_data ?? {}) },
  };
}

function defaultTitle(type: ReportFileType, job?: JobLite) {
  const base = type === "REPORT" ? "Service Report" : type === "PRESTART" ? "Pre-start Checklist" : "SWMS / JSEA";
  return job ? `${base} - ${job.title}` : base;
}

function humanizeType(type: ReportFileType) {
  if (type === "PRESTART") return "Pre-start";
  if (type === "SWMS") return "SWMS";
  return "Report";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
