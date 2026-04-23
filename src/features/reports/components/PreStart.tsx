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

function CheckRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
    </label>
  );
}

export default function PreStart({ formData, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Document Date</label>
          <Input type="date" value={formData.documentDate} onChange={(event) => onChange({ documentDate: event.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Crew Names</label>
          <Input value={formData.crewNames} onChange={(event) => onChange({ crewNames: event.target.value })} placeholder="A. Patel, S. Brown" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Prepared By</label>
          <Input value={formData.preparedBy} onChange={(event) => onChange({ preparedBy: event.target.value })} placeholder="Crew leader name" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Supervisor</label>
          <Input value={formData.supervisorName} onChange={(event) => onChange({ supervisorName: event.target.value })} placeholder="Site or operations supervisor" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Start Time</label>
          <Input type="time" value={formData.startTime} onChange={(event) => onChange({ startTime: event.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Finish Time</label>
          <Input type="time" value={formData.finishTime} onChange={(event) => onChange({ finishTime: event.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Weather</label>
          <Input value={formData.weather} onChange={(event) => onChange({ weather: event.target.value })} placeholder="Clear, mild wind" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Emergency Contact</label>
          <Input value={formData.emergencyContact} onChange={(event) => onChange({ emergencyContact: event.target.value })} placeholder="Site control room / supervisor" />
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Equipment Used</label>
          <Input value={formData.equipmentUsed} onChange={(event) => onChange({ equipmentUsed: event.target.value })} placeholder="Cones, wet floor signs, PPE kits, cleaning tools" />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <CheckRow
          label="Site Access Confirmed"
          hint="Keys, permits, or security access are ready before work starts."
          checked={formData.siteAccessConfirmed}
          onChange={(next) => onChange({ siteAccessConfirmed: next })}
        />
        <CheckRow
          label="Isolation Required"
          hint="Confirm whether lockout or site isolation is required."
          checked={formData.isolationRequired}
          onChange={(next) => onChange({ isolationRequired: next })}
        />
        <CheckRow
          label="PPE Checked"
          hint="Crew has correct PPE for the site and task."
          checked={formData.ppeChecked}
          onChange={(next) => onChange({ ppeChecked: next })}
        />
        <CheckRow
          label="Tools Checked"
          hint="Tools and cleaning gear inspected before use."
          checked={formData.toolsChecked}
          onChange={(next) => onChange({ toolsChecked: next })}
        />
        <CheckRow
          label="Permits Confirmed"
          hint="Required permits or approvals have been checked before work starts."
          checked={formData.permitsConfirmed}
          onChange={(next) => onChange({ permitsConfirmed: next })}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Hazards Identified</label>
        <Textarea
          rows={4}
          value={formData.hazardsIdentified}
          onChange={(event) => onChange({ hazardsIdentified: event.target.value })}
          placeholder="Wet floors, public traffic, restricted access, moving machinery..."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Controls In Place</label>
        <Textarea
          rows={4}
          value={formData.controlsInPlace}
          onChange={(event) => onChange({ controlsInPlace: event.target.value })}
          placeholder="Safety cones, signage, isolation procedure, spotter assigned..."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Pre-start Notes</label>
        <Textarea
          rows={5}
          value={formData.preStartNotes}
          onChange={(event) => onChange({ preStartNotes: event.target.value })}
          placeholder="Site-specific notes, access delays, supervisor instructions..."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Reviewed By</label>
        <Input value={formData.reviewedBy} onChange={(event) => onChange({ reviewedBy: event.target.value })} placeholder="Supervisor or site representative" />
      </div>
    </div>
  );
}
