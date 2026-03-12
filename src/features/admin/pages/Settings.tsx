import { useState } from "react";
import toast from "react-hot-toast";
import {
  Building2,
  Bell,
  Briefcase,
  Mail,
  AlertTriangle,
  ChevronRight,
  Upload,
  Plus,
  X,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = "company" | "notifications" | "jobs" | "email" | "danger";

interface Toggle {
  id: string;
  label: string;
  description: string;
  value: boolean;
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode; description: string }[] = [
  {
    key: "company",
    label: "Company Profile",
    icon: <Building2 className="h-4 w-4" />,
    description: "Name, logo, address & registration",
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: <Bell className="h-4 w-4" />,
    description: "Email alert preferences",
  },
  {
    key: "jobs",
    label: "Job Settings",
    icon: <Briefcase className="h-4 w-4" />,
    description: "Job types, materials & defaults",
  },
  {
    key: "email",
    label: "Email Configuration",
    icon: <Mail className="h-4 w-4" />,
    description: "Sender details & API keys",
  },
  {
    key: "danger",
    label: "Danger Zone",
    icon: <AlertTriangle className="h-4 w-4" />,
    description: "Export data & account actions",
  },
];

// ─── Reusable components ──────────────────────────────────────────────────────

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-6 items-start">
      <div className="pt-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${props.className ?? ""}`}
    />
  );
}

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        enabled ? "bg-blue-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SaveButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-end pt-2 border-t border-gray-100 mt-2">
      <button
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
      >
        <Save className="h-4 w-4" />
        {loading ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function CompanySection() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "EscalatorPro Services",
    address: "",
    phone: "",
    abn: "",
    website: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    toast.success("Company profile saved.");
  };

  return (
    <SectionCard title="Company Profile" description="Basic information about your company shown across the platform.">
      <Field label="Company Name" hint="Displayed in emails and reports">
        <Input value={form.name} onChange={set("name")} placeholder="Your company name" />
      </Field>

      <Field label="Logo">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 text-gray-400">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <label className="cursor-pointer inline-flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
              <Upload className="h-4 w-4" />
              Upload Logo
              <input type="file" accept="image/*" className="hidden" />
            </label>
            <p className="text-xs text-gray-400 mt-1">PNG or JPG, max 2MB</p>
          </div>
        </div>
      </Field>

      <div className="border-t border-gray-100 pt-4">
        <Field label="Business Address">
          <Input value={form.address} onChange={set("address")} placeholder="123 Main St, Sydney NSW 2000" />
        </Field>
      </div>

      <Field label="Phone Number">
        <Input value={form.phone} onChange={set("phone")} placeholder="+61 2 0000 0000" type="tel" />
      </Field>

      <Field label="ABN" hint="Australian Business Number">
        <Input value={form.abn} onChange={set("abn")} placeholder="XX XXX XXX XXX" />
      </Field>

      <Field label="Website" hint="Optional">
        <Input value={form.website} onChange={set("website")} placeholder="https://yourcompany.com.au" type="url" />
      </Field>

      <SaveButton loading={saving} onClick={save} />
    </SectionCard>
  );
}

function NotificationsSection() {
  const [saving, setSaving] = useState(false);
  const [toggles, setToggles] = useState<Toggle[]>([
    { id: "new_signup", label: "New user sign-up", description: "Email admin when a new user registers and is pending approval.", value: true },
    { id: "job_assigned", label: "Job assigned to employee", description: "Email employees when they are assigned to a new job.", value: true },
    { id: "job_rescheduled", label: "Job rescheduled", description: "Email assigned employees when a job date or time changes.", value: true },
    { id: "account_approved", label: "Account approved", description: "Email the employee when their account is approved by an admin.", value: true },
    { id: "job_completed", label: "Job completed", description: "Email admin when an employee marks a job as completed.", value: false },
  ]);

  const toggle = (id: string) =>
    setToggles((prev) => prev.map((t) => (t.id === id ? { ...t, value: !t.value } : t)));

  const save = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    toast.success("Notification preferences saved.");
  };

  return (
    <SectionCard title="Notifications" description="Control which automated emails are sent and to whom.">
      <div className="space-y-1">
        {toggles.map((t, i) => (
          <div key={t.id}>
            <div className="flex items-center justify-between py-3">
              <div className="flex-1 pr-8">
                <p className="text-sm font-medium text-gray-800">{t.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
              </div>
              <ToggleSwitch enabled={t.value} onChange={() => toggle(t.id)} />
            </div>
            {i < toggles.length - 1 && <div className="border-t border-gray-100" />}
          </div>
        ))}
      </div>
      <SaveButton loading={saving} onClick={save} />
    </SectionCard>
  );
}

const DEFAULT_JOB_TYPES = [
  "Escalator Cleaning",
  "Travelator Cleaning",
  "Anti-slip Treatment",
  "Tactile Replacement",
  "Demarcation",
  "Other",
];

const DEFAULT_MATERIALS = ["Safety Cones", "Wet Floor Signs", "Cleaning Solution", "Microfibre Cloths", "PPE Kit"];

function JobsSection() {
  const [saving, setSaving] = useState(false);
  const [jobTypes, setJobTypes] = useState<string[]>(DEFAULT_JOB_TYPES);
  const [newJobType, setNewJobType] = useState("");
  const [materials, setMaterials] = useState<string[]>(DEFAULT_MATERIALS);
  const [newMaterial, setNewMaterial] = useState("");
  const [defaultInduction, setDefaultInduction] = useState(false);

  const addJobType = () => {
    const v = newJobType.trim();
    if (!v || jobTypes.includes(v)) return;
    setJobTypes((p) => [...p, v]);
    setNewJobType("");
  };

  const addMaterial = () => {
    const v = newMaterial.trim();
    if (!v || materials.includes(v)) return;
    setMaterials((p) => [...p, v]);
    setNewMaterial("");
  };

  const save = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    toast.success("Job settings saved.");
  };

  return (
    <SectionCard title="Job Settings" description="Manage job types, default materials, and job creation defaults.">
      <Field label="Job Types" hint="Add or remove job categories">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {jobTypes.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full text-xs font-medium">
                {t}
                {!DEFAULT_JOB_TYPES.slice(0, 5).includes(t) && (
                  <button onClick={() => setJobTypes((p) => p.filter((x) => x !== t))} className="hover:text-blue-900 transition-colors ml-0.5">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Input
              value={newJobType}
              onChange={(e) => setNewJobType(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addJobType()}
              placeholder="Add custom job type..."
            />
            <button
              onClick={addJobType}
              className="flex items-center gap-1 border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>
      </Field>

      <div className="border-t border-gray-100 pt-4">
        <Field label="Material Presets" hint="Default materials shown when creating a job">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {materials.map((m) => (
                <span key={m} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 border border-gray-200 px-2.5 py-1 rounded-full text-xs font-medium">
                  {m}
                  <button onClick={() => setMaterials((p) => p.filter((x) => x !== m))} className="hover:text-red-500 transition-colors ml-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                value={newMaterial}
                onChange={(e) => setNewMaterial(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMaterial()}
                placeholder="Add preset material..."
              />
              <button
                onClick={addMaterial}
                className="flex items-center gap-1 border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>
        </Field>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Default Induction Required</p>
            <p className="text-xs text-gray-500 mt-0.5">Pre-check the induction toggle when creating a new job.</p>
          </div>
          <ToggleSwitch enabled={defaultInduction} onChange={setDefaultInduction} />
        </div>
      </div>

      <SaveButton loading={saving} onClick={save} />
    </SectionCard>
  );
}

function EmailSection() {
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState({
    senderName: "EscalatorPro Ops",
    replyTo: "ops@yourcompany.com.au",
    apiKey: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    toast.success("Email configuration saved.");
  };

  return (
    <SectionCard title="Email Configuration" description="Configure how outgoing emails are sent from the platform.">
      <Field label="Sender Name" hint="Shown as the 'From' name in emails">
        <Input value={form.senderName} onChange={set("senderName")} placeholder="Your Company Ops" />
      </Field>

      <Field label="Reply-To Address" hint="Employees reply to this address">
        <Input value={form.replyTo} onChange={set("replyTo")} placeholder="ops@yourcompany.com" type="email" />
      </Field>

      <div className="border-t border-gray-100 pt-4">
        <Field label="Resend API Key" hint="Get your key at resend.com">
          <div className="relative">
            <Input
              value={form.apiKey}
              onChange={set("apiKey")}
              type={showKey ? "text" : "password"}
              placeholder="re_xxxxxxxxxxxxxxxxxxxx"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Stored securely. Never exposed to employees.</p>
        </Field>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={() => toast.success("Test email sent to your admin address.")}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5 transition-colors"
        >
          <Mail className="h-4 w-4" />
          Send a test email
        </button>
      </div>

      <SaveButton loading={saving} onClick={save} />
    </SectionCard>
  );
}

function DangerSection() {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleExport = () => {
    toast.success("Export started. You'll receive a download link shortly.");
  };

  return (
    <div className="space-y-4">
      {/* Export */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Export Data</h2>
          <p className="text-sm text-gray-500 mt-0.5">Download a full CSV export of your company data.</p>
        </div>
        <div className="px-6 py-5">
          <div className="grid grid-cols-3 gap-4 mb-5">
            {["Clients", "Jobs", "Employees"].map((item) => (
              <div key={item} className="border border-gray-200 rounded-lg p-3 text-center hover:bg-gray-50 transition-colors">
                <p className="text-sm font-medium text-gray-700">{item}</p>
                <p className="text-xs text-gray-400 mt-0.5">Export as CSV</p>
              </div>
            ))}
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Upload className="h-4 w-4" />
            Export All Data
          </button>
        </div>
      </div>

      {/* Danger */}
      <div className="bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-red-100 bg-red-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="text-base font-semibold text-red-700">Danger Zone</h2>
          </div>
          <p className="text-sm text-red-500 mt-0.5">These actions are irreversible. Proceed with caution.</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between p-4 border border-red-100 rounded-lg bg-red-50/50">
            <div>
              <p className="text-sm font-medium text-gray-800">Delete Company Account</p>
              <p className="text-xs text-gray-500 mt-0.5">Permanently removes all data. Cannot be undone.</p>
            </div>
            <button
              onClick={() => setConfirming(true)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Delete Account
            </button>
          </div>

          {confirming && (
            <div className="border border-red-200 rounded-lg p-4 bg-red-50 space-y-3 animate-in">
              <p className="text-sm text-red-700 font-medium">
                Type <span className="font-mono bg-red-100 px-1 rounded">DELETE</span> to confirm
              </p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <div className="flex gap-2">
                <button
                  disabled={confirmText !== "DELETE"}
                  onClick={() => toast.error("Account deletion is disabled in this environment.")}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  Permanently Delete
                </button>
                <button
                  onClick={() => { setConfirming(false); setConfirmText(""); }}
                  className="border border-gray-200 hover:bg-gray-50 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Settings() {
  const [active, setActive] = useState<Section>("company");

  const current = NAV_ITEMS.find((n) => n.key === active)!;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage your company profile, notifications, and platform configuration.
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-6">
        <div className="flex gap-6 items-start">
          {/* Sidebar Nav */}
          <aside className="w-64 flex-shrink-0 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden sticky top-6">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Configuration</p>
            </div>
            <nav className="p-2 space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActive(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${
                    active === item.key
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <span className={`flex-shrink-0 transition-colors ${
                    active === item.key ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                  }`}>
                    {item.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                  </div>
                  <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 transition-all ${
                    active === item.key ? "text-blue-400 opacity-100" : "opacity-0 group-hover:opacity-50"
                  }`} />
                </button>
              ))}
            </nav>
          </aside>

          {/* Content Panel */}
          <div className="flex-1 min-w-0 space-y-1">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
              <span>Settings</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-gray-900 font-medium">{current.label}</span>
            </div>

            {active === "company" && <CompanySection />}
            {active === "notifications" && <NotificationsSection />}
            {active === "jobs" && <JobsSection />}
            {active === "email" && <EmailSection />}
            {active === "danger" && <DangerSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
