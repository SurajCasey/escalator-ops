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

function YesNoRow({
  label,
  value,
  onChange,
  flagOnYes = true,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  flagOnYes?: boolean;
}) {
  const isYes = value;
  const isNo = !value;
  const yesBg = flagOnYes ? (isYes ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600") : (isYes ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600");
  void isNo; // used implicitly by the No button below

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="flex-1 text-sm font-medium text-slate-800 leading-5">{label}</p>
      <div className="flex gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`min-w-12 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${yesBg}`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`min-w-12 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${isNo ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          No
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ label, score }: { label: string; score: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-800 px-4 py-2.5">
      <span className="text-sm font-bold uppercase tracking-wide text-white">{label}</span>
      <span className="text-xs font-semibold text-slate-300">{score}</span>
    </div>
  );
}

export default function PreStart({ formData, onChange }: Props) {
  return (
    <div className="space-y-6">

      {/* ── Cover / Summary ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Cover Details</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Site Location</label>
            <Input
              value={formData.preStartSiteLocation}
              onChange={(e) => onChange({ preStartSiteLocation: e.target.value })}
              placeholder="e.g. Chatswood RSL"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
            <Input
              type="date"
              value={formData.documentDate}
              onChange={(e) => onChange({ documentDate: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Prepared By</label>
            <Input
              value={formData.preparedBy}
              onChange={(e) => onChange({ preparedBy: e.target.value })}
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Start Time (AEST)</label>
            <Input
              type="time"
              value={formData.startTime}
              onChange={(e) => onChange({ startTime: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* ── Prestart Audit ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeader label="Prestart Audit" score="1 / 1 (100%)" />

        <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="flex-1 text-sm font-medium text-slate-800 leading-5">What type(s) of works are you performing?</p>
          <Input
            value={formData.preStartWorkType}
            onChange={(e) => onChange({ preStartWorkType: e.target.value })}
            placeholder="Escalator Cleaning"
            className="max-w-[200px]"
          />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="flex-1 text-sm font-medium text-slate-800 leading-5">What area will you be working?</p>
          <Input
            value={formData.preStartArea}
            onChange={(e) => onChange({ preStartArea: e.target.value })}
            placeholder="Level 1"
            className="max-w-[200px]"
          />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="flex-1 text-sm font-medium text-slate-800 leading-5">What type of equipment are you working on?</p>
          <Input
            value={formData.preStartEquipmentType}
            onChange={(e) => onChange({ preStartEquipmentType: e.target.value })}
            placeholder="e.g. Liftronic, Schindler"
            className="max-w-[200px]"
          />
        </div>

        <YesNoRow
          label="Have you completed a visual safety inspection prior to any works being carried out?"
          value={formData.preStartVisualInspection}
          onChange={(next) => onChange({ preStartVisualInspection: next })}
        />
      </div>

      {/* ── Safety Audit ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeader label="Safety Audit" score="8 / 8 (100%)" />

        <YesNoRow
          label="Do you have the appropriate PPE to undertake the works?"
          value={formData.preStartPpeAppropriate}
          onChange={(next) => onChange({ preStartPpeAppropriate: next })}
        />
        <YesNoRow
          label="Have you received a site induction?"
          value={formData.preStartSiteInduction}
          onChange={(next) => onChange({ preStartSiteInduction: next })}
        />
        <YesNoRow
          label="Have you checked if our machinery is in good working order?"
          value={formData.preStartMachineryGoodOrder}
          onChange={(next) => onChange({ preStartMachineryGoodOrder: next })}
        />
        <YesNoRow
          label="Have you completed your checks before mounting the machines on the escalator/travelator?"
          value={formData.preStartPreMountChecks}
          onChange={(next) => onChange({ preStartPreMountChecks: next })}
        />
        <YesNoRow
          label="Have you checked if the escalator/travelator drives in reverse prior to starting works?"
          value={formData.preStartReverseCheck}
          onChange={(next) => onChange({ preStartReverseCheck: next })}
        />

        {/* This one: Yes = concern = flagged (bad), No = good */}
        <YesNoRow
          label="Is there any concerns or damaged on the escalator/travelator?"
          value={formData.preStartConcernsDamage}
          onChange={(next) => onChange({ preStartConcernsDamage: next })}
          flagOnYes={false}
        />

        <YesNoRow
          label="Do you have any photos on the equipment you are working on?"
          value={formData.preStartPhotos}
          onChange={(next) => onChange({ preStartPhotos: next })}
        />
        <YesNoRow
          label="Have you used the maintenance barricades to ensure the escalator/travelator is blocked off?"
          value={formData.preStartBarricades}
          onChange={(next) => onChange({ preStartBarricades: next })}
        />

        {/* This one: Yes = concern = flagged (bad), No = good */}
        <YesNoRow
          label="Do you have any concerns or comments?"
          value={formData.preStartAnyConcerns}
          onChange={(next) => onChange({ preStartAnyConcerns: next })}
          flagOnYes={false}
        />
      </div>

      {/* ── Sign-off ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Sign-off</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name of Workers</label>
            <Input
              value={formData.preStartWorkerNames}
              onChange={(e) => onChange({ preStartWorkerNames: e.target.value })}
              placeholder="e.g. Suraj and Bishal"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Supervisor to Sign</label>
            <Input
              value={formData.preStartSupervisorName}
              onChange={(e) => onChange({ preStartSupervisorName: e.target.value })}
              placeholder="Supervisor full name"
            />
          </div>
        </div>
      </div>

    </div>
  );
}
