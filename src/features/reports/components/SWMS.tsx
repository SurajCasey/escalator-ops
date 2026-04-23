import type { ReportFormData } from "./types";

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

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-500 ${props.className ?? ""}`}
    />
  );
}

export default function SWMS({ formData, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Document Date</label>
          <Input type="date" value={formData.documentDate} onChange={(event) => onChange({ documentDate: event.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Prepared By</label>
          <Input value={formData.preparedBy} onChange={(event) => onChange({ preparedBy: event.target.value })} placeholder="Person preparing SWMS" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Scope Of Work</label>
        <Textarea
          rows={4}
          value={formData.swmsScope}
          onChange={(event) => onChange({ swmsScope: event.target.value })}
          placeholder="Escalator clean-down, handrail polish, signage setup, shutdown coordination..."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Hazards</label>
          <Textarea
            rows={8}
            value={formData.swmsHazards}
            onChange={(event) => onChange({ swmsHazards: event.target.value })}
            placeholder="Public interaction&#10;Slip risk&#10;Manual handling&#10;Electrical isolation"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Control Measures</label>
          <Textarea
            rows={8}
            value={formData.swmsControls}
            onChange={(event) => onChange({ swmsControls: event.target.value })}
            placeholder="Barricades and spotter&#10;PPE and signage&#10;Safe lift techniques&#10;Isolation permit verification"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Residual Risk / Monitoring</label>
        <Textarea
          rows={4}
          value={formData.swmsResidualRisk}
          onChange={(event) => onChange({ swmsResidualRisk: event.target.value })}
          placeholder="Residual risk after controls and how the crew will monitor it onsite."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Review Notes</label>
        <Textarea
          rows={5}
          value={formData.swmsReviewNotes}
          onChange={(event) => onChange({ swmsReviewNotes: event.target.value })}
          placeholder="Changes since previous SWMS, client notes, revised hazards..."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Reviewed By</label>
          <Input value={formData.reviewedBy} onChange={(event) => onChange({ reviewedBy: event.target.value })} placeholder="Supervisor or manager" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Acknowledged By</label>
          <Input
            value={formData.signatures}
            onChange={(event) => onChange({ signatures: event.target.value })}
            placeholder="Crew leader, site supervisor, operations manager"
          />
        </div>
      </div>
    </div>
  );
}
