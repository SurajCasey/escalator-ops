import { Plus, Trash2 } from "lucide-react";
import type { ReportFormData, SwmsWorker } from "./types";

type Props = {
  formData: ReportFormData;
  onChange: (patch: Partial<ReportFormData>) => void;
};

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-500 ${props.className ?? ""}`}
    />
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</label>;
}

export default function SWMS({ formData, onChange }: Props) {
  const workers = formData.swmsWorkers ?? [];

  function updateWorker(index: number, patch: Partial<SwmsWorker>) {
    const next = workers.map((w, i) => (i === index ? { ...w, ...patch } : w));
    onChange({ swmsWorkers: next });
  }

  function addWorker() {
    if (workers.length >= 10) return;
    onChange({
      swmsWorkers: [
        ...workers,
        { name: "", classification: "Operator", employedBy: "SEC", date: formData.documentDate },
      ],
    });
  }

  function removeWorker(index: number) {
    onChange({ swmsWorkers: workers.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-6">

      {/* ── Part 1: Project & Task Identification ─────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-white">Part 1</span>
          <h3 className="text-sm font-semibold text-slate-800">Project and Task Identification</h3>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <FieldLabel>Client</FieldLabel>
            <Input
              value={formData.swmsClientName}
              onChange={(e) => onChange({ swmsClientName: e.target.value })}
              placeholder="e.g. Dee Why Gran"
            />
          </div>
          <div>
            <FieldLabel>Job Site / Address</FieldLabel>
            <Input
              value={formData.swmsJobSiteAddress}
              onChange={(e) => onChange({ swmsJobSiteAddress: e.target.value })}
              placeholder="e.g. 834 Pittwater Road, Dee Why"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact Details</p>
          <div className="grid gap-3 lg:grid-cols-3">
            <div>
              <FieldLabel>Contact Name</FieldLabel>
              <Input
                value={formData.swmsContactName}
                onChange={(e) => onChange({ swmsContactName: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <FieldLabel>Job Title</FieldLabel>
              <Input
                value={formData.swmsContactTitle}
                onChange={(e) => onChange({ swmsContactTitle: e.target.value })}
                placeholder="Operator"
              />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <Input
                value={formData.swmsContactPhone}
                onChange={(e) => onChange({ swmsContactPhone: e.target.value })}
                placeholder="Landline"
              />
            </div>
            <div>
              <FieldLabel>Mobile</FieldLabel>
              <Input
                value={formData.swmsContactMobile}
                onChange={(e) => onChange({ swmsContactMobile: e.target.value })}
                placeholder="0450 000 000"
              />
            </div>
            <div className="lg:col-span-2">
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                value={formData.swmsContactEmail}
                onChange={(e) => onChange({ swmsContactEmail: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <div>
            <FieldLabel>SWMS Initiated By</FieldLabel>
            <Input
              value={formData.swmsInitiatedBy}
              onChange={(e) => onChange({ swmsInitiatedBy: e.target.value })}
              placeholder="Your full name"
            />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <Input
              type="date"
              value={formData.documentDate}
              onChange={(e) => onChange({ documentDate: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel>SWMS No.</FieldLabel>
            <Input
              value={formData.swmsNumber}
              onChange={(e) => onChange({ swmsNumber: e.target.value })}
              placeholder="1"
            />
          </div>
          <div>
            <FieldLabel>Rev</FieldLabel>
            <Input
              value={formData.swmsRev}
              onChange={(e) => onChange({ swmsRev: e.target.value })}
              placeholder="1"
            />
          </div>
          <div>
            <FieldLabel>Rev Date</FieldLabel>
            <Input
              value={formData.swmsRevDate}
              onChange={(e) => onChange({ swmsRevDate: e.target.value })}
              placeholder="26.11.2025"
            />
          </div>
          <div className="lg:col-span-2 xl:col-span-3">
            <FieldLabel>Work Locations / Areas</FieldLabel>
            <Input
              value={formData.swmsWorkLocations}
              onChange={(e) => onChange({ swmsWorkLocations: e.target.value })}
              placeholder="e.g. Ground Floor, Level 1 Escalator"
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <FieldLabel>Supervisor Review (name)</FieldLabel>
            <Input
              value={formData.swmsSupervisorReview}
              onChange={(e) => onChange({ swmsSupervisorReview: e.target.value })}
              placeholder="Supervisor name"
            />
          </div>
          <div>
            <FieldLabel>Management Review (name)</FieldLabel>
            <Input
              value={formData.swmsManagementReview}
              onChange={(e) => onChange({ swmsManagementReview: e.target.value })}
              placeholder="Manager name"
            />
          </div>
        </div>
      </div>

      {/* ── Part 2: Worker Sign-off Table ─────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-white">Part 2</span>
            <h3 className="text-sm font-semibold text-slate-800">Worker Qualifications & SWMS Sign-Off</h3>
          </div>
          {workers.length < 10 && (
            <button
              type="button"
              onClick={addWorker}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Worker
            </button>
          )}
        </div>

        <p className="text-xs text-slate-500 leading-5">
          Your signature below indicates you have been consulted in development of the SWMS and accept and will implement the requirements of the SWMS and control measures.
        </p>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 w-8">No.</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Name</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Classification</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Employed By</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Date</th>
                <th className="px-3 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workers.map((worker, index) => (
                <tr key={index}>
                  <td className="px-3 py-2 text-xs text-slate-500 font-medium">{index + 1}</td>
                  <td className="px-3 py-2">
                    <input
                      value={worker.name}
                      onChange={(e) => updateWorker(index, { name: e.target.value })}
                      placeholder="Full name"
                      className="w-full min-w-[120px] rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-sky-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={worker.classification}
                      onChange={(e) => updateWorker(index, { classification: e.target.value })}
                      placeholder="Operator"
                      className="w-full min-w-[100px] rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-sky-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={worker.employedBy}
                      onChange={(e) => updateWorker(index, { employedBy: e.target.value })}
                      placeholder="SEC"
                      className="w-full min-w-[80px] rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-sky-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={worker.date}
                      onChange={(e) => updateWorker(index, { date: e.target.value })}
                      className="w-full min-w-[130px] rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-sky-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeWorker(index)}
                      disabled={workers.length <= 1}
                      className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 3 - workers.length) }).map((_, index) => (
                <tr key={`empty-${index}`} className="bg-slate-50/50">
                  <td className="px-3 py-2 text-xs text-slate-400">{workers.length + index + 1}</td>
                  <td colSpan={5} className="px-3 py-2 text-xs text-slate-300 italic">Empty row</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Static info note ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
        <p className="text-xs text-sky-800 leading-5">
          <span className="font-semibold">Note:</span> The SWMS PDF will include the full pre-filled Hazard Analysis table (Parts 3 & 4), Hierarchy of Controls, Risk Calculator, Equipment list, and PPE section — exactly as per the Statewide Escalator Cleaning JSEA&SWMS template. Only the fields above are editable per job.
        </p>
      </div>

    </div>
  );
}
