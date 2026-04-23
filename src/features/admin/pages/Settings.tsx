import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Bell,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Globe2,
  Lock,
  Monitor,
  MoonStar,
  Palette,
  Save,
  ShieldCheck,
  Sun,
  Upload,
  UserCircle2,
  Users,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";

type Role = "ADMIN" | "EMPLOYEE";
type Section = "profile" | "appearance" | "notifications" | "operations" | "security" | "legal";
type ThemeOption = "system" | "ocean" | "forest" | "midnight";

type ProfileRecord = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  status: string | null;
};

type StoredSettings = {
  avatarDataUrl: string;
  phone: string;
  jobTitle: string;
  bio: string;
  theme: ThemeOption;
  compactMode: boolean;
  emailDigest: boolean;
  pushAlerts: boolean;
  smsAlerts: boolean;
  reportReminder: boolean;
  defaultShift: "Morning" | "Midday" | "Night";
  preStartChecklist: boolean;
  travelBufferMinutes: number;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  safetyAccepted: boolean;
  senderName: string;
  replyTo: string;
};

const DEFAULT_SETTINGS: StoredSettings = {
  avatarDataUrl: "",
  phone: "",
  jobTitle: "",
  bio: "",
  theme: "system",
  compactMode: false,
  emailDigest: true,
  pushAlerts: true,
  smsAlerts: false,
  reportReminder: true,
  defaultShift: "Morning",
  preStartChecklist: true,
  travelBufferMinutes: 20,
  termsAccepted: true,
  privacyAccepted: true,
  safetyAccepted: true,
  senderName: "Statewide Escalator Cleaning",
  replyTo: "ops@statewide.example",
};

const NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode; description: string }[] = [
  { key: "profile", label: "Profile", icon: <UserCircle2 className="h-4 w-4" />, description: "Personal details and profile photo" },
  { key: "appearance", label: "Appearance", icon: <Palette className="h-4 w-4" />, description: "Theme and interface preferences" },
  { key: "notifications", label: "Notifications", icon: <Bell className="h-4 w-4" />, description: "Alerts, reminders, and digests" },
  { key: "operations", label: "Operations", icon: <Briefcase className="h-4 w-4" />, description: "Field defaults and workflow rules" },
  { key: "security", label: "Security", icon: <Lock className="h-4 w-4" />, description: "Password and account protection" },
  { key: "legal", label: "Legal", icon: <FileText className="h-4 w-4" />, description: "Terms, privacy, and compliance" },
];

const THEME_OPTIONS: { key: ThemeOption; label: string; description: string; icon: React.ReactNode; swatch: string }[] = [
  { key: "system", label: "System", description: "Match the device preference.", icon: <Monitor className="h-4 w-4" />, swatch: "from-slate-100 via-slate-200 to-slate-300" },
  { key: "ocean", label: "Ocean", description: "Cool blue workspace for dispatch-heavy days.", icon: <Sun className="h-4 w-4" />, swatch: "from-cyan-100 via-sky-200 to-blue-300" },
  { key: "forest", label: "Forest", description: "Soft green surfaces with calmer contrast.", icon: <Globe2 className="h-4 w-4" />, swatch: "from-emerald-100 via-lime-200 to-green-300" },
  { key: "midnight", label: "Midnight", description: "Dark shell for low-light operation rooms.", icon: <MoonStar className="h-4 w-4" />, swatch: "from-slate-700 via-slate-800 to-slate-950" },
];

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
      <div className="space-y-5 px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
      <div className="pt-1">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

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

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-500 ${props.className ?? ""}`}
    />
  );
}

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${enabled ? "bg-sky-600" : "bg-slate-200"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${enabled ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function SaveButton({ loading, onClick, label = "Save Changes" }: { loading: boolean; onClick: () => void; label?: string }) {
  return (
    <div className="mt-2 flex justify-end border-t border-slate-100 pt-4">
      <button
        onClick={onClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {loading ? "Saving..." : label}
      </button>
    </div>
  );
}

export default function Settings() {
  const [active, setActive] = useState<Section>("profile");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [settings, setSettings] = useState<StoredSettings>(DEFAULT_SETTINGS);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingSection, setSavingSection] = useState<Section | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        toast.error("Session expired. Please log in again.");
        setLoading(false);
        return;
      }

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, status")
        .eq("id", session.user.id)
        .single<ProfileRecord>();

      if (error || !profileData) {
        toast.error("Unable to load settings.");
        setLoading(false);
        return;
      }

      const stored = readStoredSettings(profileData.id);
      setProfile(profileData);
      setSettings(stored);
      setFullName(profileData.full_name?.trim() || "");
      setEmail(profileData.email?.trim() || session.user.email || "");
      applyTheme(stored.theme);
      setLoading(false);
    };

    load();
  }, []);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  const currentNav = NAV_ITEMS.find((item) => item.key === active) ?? NAV_ITEMS[0];
  const isAdmin = profile?.role === "ADMIN";
  const profileCompletion = useMemo(() => {
    const checks = [fullName.trim().length > 0, email.trim().length > 0, settings.phone.trim().length > 0, settings.avatarDataUrl.length > 0];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [email, fullName, settings.avatarDataUrl, settings.phone]);

  const updateSettings = (patch: Partial<StoredSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  };

  const saveStoredSettings = (section: Section, successMessage: string) => {
    if (!profile) return;
    setSavingSection(section);
    const next = { ...settings };
    persistStoredSettings(profile.id, next);
    if (section === "appearance") {
      applyTheme(next.theme);
    }
    toast.success(successMessage);
    setSavingSection(null);
  };

  const saveProfile = async () => {
    if (!profile) return;
    if (!fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }

    setSavingSection("profile");

    const { error } = await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", profile.id);
    if (error) {
      toast.error(error.message);
      setSavingSection(null);
      return;
    }

    persistStoredSettings(profile.id, settings);
    setProfile((current) => (current ? { ...current, full_name: fullName.trim() } : current));
    toast.success("Profile updated.");
    setSavingSection(null);
  };

  const saveSecurity = async () => {
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Password confirmation does not match.");
      return;
    }

    setSavingSection("security");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
      setSavingSection(null);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password updated.");
    setSavingSection(null);
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Profile photos must be under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      updateSettings({ avatarDataUrl: result });
      toast.success("Profile photo ready. Save profile to keep it.");
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="space-y-5 animate-pulse">
          <div className="h-10 w-48 rounded-xl bg-slate-200" />
          <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="h-96 rounded-2xl bg-white" />
            <div className="h-[36rem] rounded-2xl bg-white" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-8">
        <div className="rounded-2xl border border-rose-200 bg-white px-6 py-5 text-sm text-rose-700 shadow-sm">
          Unable to load your settings.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 p-6 text-white shadow-lg md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm text-slate-300">Account Control Centre</p>
              <h1 className="mt-1 text-2xl font-bold md:text-3xl">Settings</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-200 md:text-base">
                Manage profile details, profile photos, theme preferences, job workflow defaults, security, and legal acknowledgements for the operations portal.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <TopStat label="Role" value={humanize(profile.role)} icon={<ShieldCheck className="h-4 w-4" />} />
              <TopStat label="Status" value={profile.status?.toUpperCase() || "ACTIVE"} icon={<CheckCircle2 className="h-4 w-4" />} />
              <TopStat label="Theme" value={humanize(settings.theme)} icon={<Palette className="h-4 w-4" />} />
              <TopStat label="Profile" value={`${profileCompletion}%`} icon={<UserCircle2 className="h-4 w-4" />} />
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Account</p>
              </div>
              <div className="px-5 py-5">
                <div className="flex items-center gap-4">
                  <Avatar fullName={fullName || profile.full_name || profile.email || "User"} avatarDataUrl={settings.avatarDataUrl} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{fullName || profile.full_name || "Team Member"}</p>
                    <p className="truncate text-sm text-slate-500">{email}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">{humanize(profile.role)}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Profile completion</span>
                    <span className="font-semibold text-slate-900">{profileCompletion}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-sky-600" style={{ width: `${profileCompletion}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <nav className="p-2">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActive(item.key)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                      active === item.key ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span className={active === item.key ? "text-sky-600" : "text-slate-400"}>{item.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.label}</p>
                      <p className="truncate text-xs text-slate-400">{item.description}</p>
                    </div>
                    <ChevronRight className={`h-4 w-4 ${active === item.key ? "text-sky-400" : "text-slate-300"}`} />
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          <div className="min-w-0 space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Settings</span>
              <ChevronRight className="h-4 w-4" />
              <span className="font-medium text-slate-900">{currentNav.label}</span>
            </div>

            {active === "profile" && (
              <SectionCard title="Profile & Identity" description="Keep your contact details, role identity, and profile photo current.">
                <Field label="Profile Photo" hint="Shown in account summaries and future activity feeds.">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <Avatar fullName={fullName || profile.full_name || profile.email || "User"} avatarDataUrl={settings.avatarDataUrl} large />
                    <div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                        <Upload className="h-4 w-4" />
                        Upload Photo
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                      </label>
                      <p className="mt-2 text-xs text-slate-400">PNG or JPG up to 2MB. Stored locally for this account profile.</p>
                    </div>
                  </div>
                </Field>

                <Field label="Full Name" hint="Displayed in dashboards, schedules, and approvals.">
                  <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Enter your full name" />
                </Field>

                <Field label="Email Address" hint="Used for login and operations email alerts.">
                  <Input value={email} onChange={(event) => setEmail(event.target.value)} disabled className="bg-slate-50 text-slate-500" />
                </Field>

                <Field label="Phone Number" hint="Emergency contact or dispatch callback.">
                  <Input value={settings.phone} onChange={(event) => updateSettings({ phone: event.target.value })} placeholder="+61 4 0000 0000" />
                </Field>

                <Field label="Job Title" hint="Examples: Operations Manager, Field Technician, Scheduler.">
                  <Input value={settings.jobTitle} onChange={(event) => updateSettings({ jobTitle: event.target.value })} placeholder="Operations Manager" />
                </Field>

                <Field label="Bio" hint="Short internal note about responsibilities or coverage.">
                  <Textarea
                    rows={4}
                    value={settings.bio}
                    onChange={(event) => updateSettings({ bio: event.target.value })}
                    placeholder="Managing Sydney CBD escalator cleaning schedules and team readiness."
                  />
                </Field>

                <SaveButton loading={savingSection === "profile"} onClick={saveProfile} />
              </SectionCard>
            )}

            {active === "appearance" && (
              <SectionCard title="Appearance & Theme" description="Choose how the portal feels during dispatch, planning, and reporting.">
                <Field label="Theme" hint="Applies immediately and is saved for your account in this browser.">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {THEME_OPTIONS.map((option) => {
                      const selected = settings.theme === option.key;
                      return (
                        <button
                          key={option.key}
                          onClick={() => updateSettings({ theme: option.key })}
                          className={`rounded-2xl border p-4 text-left transition ${selected ? "border-sky-500 ring-2 ring-sky-200" : "border-slate-200 hover:border-slate-300"}`}
                        >
                          <div className={`h-20 rounded-xl bg-gradient-to-br ${option.swatch}`} />
                          <div className="mt-3 flex items-center gap-2 text-slate-900">
                            {option.icon}
                            <span className="font-medium">{option.label}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{option.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="Compact Interface" hint="Reduce spacing in tables and cards to fit more operational data onscreen.">
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Enable compact layout</p>
                      <p className="text-xs text-slate-500">Useful for dispatch monitors and smaller laptop screens.</p>
                    </div>
                    <ToggleSwitch enabled={settings.compactMode} onChange={(value) => updateSettings({ compactMode: value })} />
                  </div>
                </Field>

                <SaveButton loading={savingSection === "appearance"} onClick={() => saveStoredSettings("appearance", "Appearance preferences saved.")} />
              </SectionCard>
            )}

            {active === "notifications" && (
              <SectionCard title="Notifications" description="Control the alerts and reminders you receive from the operations workflow.">
                <ToggleRow
                  title="Daily Email Digest"
                  description="Receive one summary email for jobs, overdue tasks, and approvals."
                  value={settings.emailDigest}
                  onChange={(value) => updateSettings({ emailDigest: value })}
                />
                <ToggleRow
                  title="Push Alerts"
                  description="Show in-app alerts when schedules change or jobs are assigned."
                  value={settings.pushAlerts}
                  onChange={(value) => updateSettings({ pushAlerts: value })}
                />
                <ToggleRow
                  title="SMS Alerts"
                  description="Use SMS only for urgent dispatch changes and access issues."
                  value={settings.smsAlerts}
                  onChange={(value) => updateSettings({ smsAlerts: value })}
                />
                <ToggleRow
                  title="Report Reminder"
                  description="Prompt users to finish reports at the end of a shift."
                  value={settings.reportReminder}
                  onChange={(value) => updateSettings({ reportReminder: value })}
                />

                {isAdmin && (
                  <Field label="Reply-To Address" hint="Admin communication inbox for system-generated emails.">
                    <Input value={settings.replyTo} onChange={(event) => updateSettings({ replyTo: event.target.value })} placeholder="ops@statewide.example" />
                  </Field>
                )}

                <SaveButton loading={savingSection === "notifications"} onClick={() => saveStoredSettings("notifications", "Notification settings saved.")} />
              </SectionCard>
            )}

            {active === "operations" && (
              <SectionCard
                title={isAdmin ? "Operations Defaults" : "Work Preferences"}
                description="Tune the defaults that match escalator cleaning workflows, route planning, and reporting."
              >
                <Field label="Default Shift" hint="Used to preselect shift context in future scheduling flows.">
                  <Select
                    value={settings.defaultShift}
                    onChange={(event) => updateSettings({ defaultShift: event.target.value as StoredSettings["defaultShift"] })}
                  >
                    <option value="Morning">Morning</option>
                    <option value="Midday">Midday</option>
                    <option value="Night">Night</option>
                  </Select>
                </Field>

                <Field label="Travel Buffer" hint="Buffer between jobs to account for access setup and travel.">
                  <Select
                    value={String(settings.travelBufferMinutes)}
                    onChange={(event) => updateSettings({ travelBufferMinutes: Number(event.target.value) })}
                  >
                    <option value="10">10 minutes</option>
                    <option value="20">20 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                  </Select>
                </Field>

                <ToggleRow
                  title="Pre-start Checklist Required"
                  description="Require a site readiness check before a team can mark a job in progress."
                  value={settings.preStartChecklist}
                  onChange={(value) => updateSettings({ preStartChecklist: value })}
                />

                {isAdmin && (
                  <>
                    <Field label="Email Sender Name" hint="Visible in admin approval emails and report notifications.">
                      <Input value={settings.senderName} onChange={(event) => updateSettings({ senderName: event.target.value })} />
                    </Field>
                    <div className="grid gap-4 md:grid-cols-3">
                      <MetricCard title="Response Target" value="15 min" description="Average callback target for access issues" icon={<Clock3 className="h-4 w-4" />} />
                      <MetricCard title="Field Teams" value="8" description="Current active crews expected this week" icon={<Users className="h-4 w-4" />} />
                      <MetricCard title="Compliance" value="98%" description="Recent SWMS and pre-start completion" icon={<ShieldCheck className="h-4 w-4" />} />
                    </div>
                  </>
                )}

                <SaveButton loading={savingSection === "operations"} onClick={() => saveStoredSettings("operations", "Operations defaults saved.")} />
              </SectionCard>
            )}

            {active === "security" && (
              <SectionCard title="Security" description="Keep credentials current and keep account access under control.">
                <Field label="Password" hint="Update the password for your portal login.">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" />
                    <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm new password" />
                  </div>
                </Field>

                <div className="grid gap-4 md:grid-cols-3">
                  <StatusCard title="Email Login" value="Enabled" detail="Password-based auth is active for this account." />
                  <StatusCard title="Approval State" value={profile.status ?? "ACTIVE"} detail="Account access is controlled through admin approval." />
                  <StatusCard title="Session" value="Protected" detail="Protected routes require an active verified session." />
                </div>

                <SaveButton loading={savingSection === "security"} onClick={saveSecurity} label="Update Password" />
              </SectionCard>
            )}

            {active === "legal" && (
              <SectionCard title="Terms, Privacy & Compliance" description="Keep the app aligned with field safety, privacy, and employee obligations.">
                <div className="grid gap-4 md:grid-cols-3">
                  <LegalCard
                    title="Terms & Conditions"
                    description="Use of the portal must follow company scheduling, reporting, and access-control rules."
                    checked={settings.termsAccepted}
                    onChange={(value) => updateSettings({ termsAccepted: value })}
                  />
                  <LegalCard
                    title="Privacy Notice"
                    description="User profile data, site notes, and schedule history are used for operational delivery and auditing."
                    checked={settings.privacyAccepted}
                    onChange={(value) => updateSettings({ privacyAccepted: value })}
                  />
                  <LegalCard
                    title="Safety Commitment"
                    description="Teams must complete pre-start checks, use PPE, and log site hazards before commencing work."
                    checked={settings.safetyAccepted}
                    onChange={(value) => updateSettings({ safetyAccepted: value })}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-medium text-slate-900">Operational Terms Summary</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    <li>Schedule data must only be used for approved work allocation and client communication.</li>
                    <li>Profile photos are for internal identification and must not be reused outside the platform.</li>
                    <li>Incident, SWMS, and pre-start records should be completed on the day of service for compliance accuracy.</li>
                    <li>Admins are responsible for removing disabled users and maintaining active approval lists.</li>
                  </ul>
                </div>

                <SaveButton loading={savingSection === "legal"} onClick={() => saveStoredSettings("legal", "Legal acknowledgements saved.")} />
              </SectionCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TopStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-slate-200">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function Avatar({ fullName, avatarDataUrl, large = false }: { fullName: string; avatarDataUrl: string; large?: boolean }) {
  const size = large ? "h-24 w-24 text-2xl" : "h-16 w-16 text-lg";
  if (avatarDataUrl) {
    return <img src={avatarDataUrl} alt={fullName} className={`${size} rounded-2xl object-cover`} />;
  }
  return (
    <div className={`${size} flex items-center justify-center rounded-2xl bg-sky-100 font-bold text-sky-700`}>
      {getInitials(fullName)}
    </div>
  );
}

function ToggleRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <ToggleSwitch enabled={value} onChange={onChange} />
    </div>
  );
}

function MetricCard({ title, value, description, icon }: { title: string; value: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function StatusCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function LegalCard({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <ToggleSwitch enabled={checked} onChange={onChange} />
      </div>
    </div>
  );
}

function getInitials(value: string) {
  return value
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function readStoredSettings(userId: string): StoredSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const raw = window.localStorage.getItem(storageKey(userId));
  if (!raw) return DEFAULT_SETTINGS;

  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<StoredSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persistStoredSettings(userId: string, settings: StoredSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(settings));
}

function storageKey(userId: string) {
  return `ops-settings:${userId}`;
}

function applyTheme(theme: ThemeOption) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-ops-theme", theme);
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
