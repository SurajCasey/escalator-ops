import { useEffect, useRef, useState, useMemo } from "react";
import toast from "react-hot-toast";
import {
  Camera, ChevronLeft, ChevronRight,
  Lock, Save, UserCircle2,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";

type Role   = "ADMIN" | "EMPLOYEE";
type Section = "profile" | "security";

type ProfileRecord = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  status: string | null;
  avatar_url: string | null;
  phone: string | null;
};

const NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: "profile",  label: "Profile",  icon: <UserCircle2 className="h-4 w-4" />, desc: "Photo, name & contact" },
  { key: "security", label: "Security", icon: <Lock className="h-4 w-4" />,        desc: "Password & account" },
];

/* ── helpers ──────────────────────────────────────────────────── */
function getInitials(v: string) {
  return v.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
const PALETTE = ["bg-blue-500","bg-violet-500","bg-pink-500","bg-teal-500","bg-orange-500","bg-indigo-500"];
function avatarBg(name: string | null) {
  return name ? PALETTE[name.charCodeAt(0) % PALETTE.length] : PALETTE[0];
}
function humanize(v: string) {
  return v.toLowerCase().split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string" && result.length > 0) resolve(result);
      else reject(new Error("FileReader returned empty result"));
    };
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

function resizeDataUrl(dataUrl: string, maxSize = 400): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(maxSize / (img.naturalWidth || 1), maxSize / (img.naturalHeight || 1), 1);
        const w = Math.max(1, Math.round((img.naturalWidth  || maxSize) * scale));
        const h = Math.max(1, Math.round((img.naturalHeight || maxSize) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL("image/jpeg", 0.92);
        resolve(out && out !== "data:," ? out : dataUrl);
      } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function processImageFile(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  return resizeDataUrl(dataUrl, 400);
}

/* ── sub-components ───────────────────────────────────────────── */
function SectionCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{desc}</p>
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[200px_1fr] lg:items-start">
      <div className="pt-1">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Inp(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition ${props.className ?? ""}`}
    />
  );
}

function Txt(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition ${props.className ?? ""}`}
    />
  );
}

function SaveBtn({ loading, onClick, label = "Save Changes" }: { loading: boolean; onClick: () => void; label?: string }) {
  return (
    <div className="flex justify-end pt-4 border-t border-slate-100">
      <button
        onClick={onClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
      >
        <Save className="h-4 w-4" />
        {loading ? "Saving…" : label}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function Settings() {
  const [active, setActive]               = useState<Section>("profile");
  const [mobileShowContent, setMobileShowContent] = useState(false);
  const [loading, setLoading]             = useState(true);
  const [profile, setProfile]             = useState<ProfileRecord | null>(null);
  const [saving, setSaving]               = useState<Section | null>(null);

  /* profile fields */
  const [fullName,      setFullName]      = useState("");
  const [phone,         setPhone]         = useState("");
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  /* security fields */
  const [newPw,  setNewPw]  = useState("");
  const [confPw, setConfPw] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  /* load */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: sd } = await supabase.auth.getSession();
      const session = sd.session;
      if (!session) { setLoading(false); return; }

      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, status, avatar_url, phone")
        .eq("id", session.user.id)
        .single<ProfileRecord>();

      if (p) {
        setProfile(p);
        setFullName(p.full_name ?? "");
        setPhone(p.phone ?? "");
        setAvatarUrl(p.avatar_url ?? null);
      }
      setLoading(false);
    })();
  }, []);

  const profileCompletion = useMemo(() => {
    const checks = [
      fullName.trim().length > 0,
      !!profile?.email,
      phone.trim().length > 0,
      !!(avatarPreview ?? avatarUrl),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [fullName, profile?.email, phone, avatarPreview, avatarUrl]);

  /* avatar */
  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;

    const isHeic = file.type === "image/heic" || file.type === "image/heif"
      || file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");
    if (isHeic) {
      toast.error("iPhone HEIC photos aren't supported. Convert to JPG or PNG first.");
      return;
    }
    if (!file.type.startsWith("image/")) { toast.error("Please pick an image file (JPG, PNG, WebP)."); return; }
    if (file.size > 10 * 1024 * 1024)   { toast.error("Photo must be under 10 MB."); return; }

    const id = toast.loading("Processing photo…");
    try {
      const resized = await processImageFile(file);
      setAvatarPreview(resized);
      toast.success("Photo ready — save profile to apply.", { id });
    } catch (err) {
      toast.error(`Could not read image: ${err instanceof Error ? err.message : "Unknown error"}`, { id });
    }
  };

  /* save profile */
  const saveProfile = async () => {
    if (!profile) return;
    if (!fullName.trim()) { toast.error("Full name is required."); return; }
    setSaving("profile");

    const patch: Record<string, unknown> = {
      full_name: fullName.trim(),
      phone:     phone.trim() || null,
    };
    if (avatarPreview) patch.avatar_url = avatarPreview;

    const { error } = await supabase.from("profiles").update(patch).eq("id", profile.id);
    if (error) { toast.error(error.message); setSaving(null); return; }

    if (avatarPreview) setAvatarUrl(avatarPreview);
    setAvatarPreview(null);
    setProfile((p) => p ? {
      ...p,
      full_name: fullName.trim(),
      phone:     phone.trim() || null,
      avatar_url: avatarPreview ?? p.avatar_url,
    } : p);
    toast.success("Profile saved!");
    setSaving(null);
  };

  /* save password */
  const savePassword = async () => {
    if (newPw.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (newPw !== confPw) { toast.error("Passwords do not match."); return; }
    setSaving("security");
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) { toast.error(error.message); setSaving(null); return; }
    setNewPw(""); setConfPw("");
    toast.success("Password updated.");
    setSaving(null);
  };

  const displayAvatar = avatarPreview ?? avatarUrl;
  const displayName   = fullName || profile?.full_name || "Team Member";

  /* ── loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 animate-pulse space-y-5">
        <div className="h-36 rounded-2xl bg-slate-200" />
        <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
          <div className="h-64 rounded-2xl bg-slate-200" />
          <div className="h-64 rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-5 py-3">
          Unable to load settings.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="bg-linear-to-r from-slate-900 via-slate-800 to-blue-900 text-white px-6 py-8 md:px-10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="h-20 w-20 rounded-2xl overflow-hidden shadow-lg">
              {displayAvatar
                ? <img src={displayAvatar} alt={displayName} className="h-full w-full object-cover" />
                : <div className={`h-full w-full flex items-center justify-center text-white text-xl font-bold ${avatarBg(displayName)}`}>{getInitials(displayName)}</div>
              }
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-blue-500 hover:bg-blue-600 border-2 border-slate-900 flex items-center justify-center transition"
              title="Change photo"
            >
              <Camera className="h-3.5 w-3.5 text-white" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
          </div>

          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">Account Settings</p>
            <h1 className="text-2xl md:text-3xl font-extrabold mt-1">{displayName}</h1>
            <p className="text-sm text-slate-300 mt-0.5">
              {profile.email} · <span className="capitalize">{humanize(profile.role)}</span>
            </p>
          </div>

          {/* Profile completion ring */}
          <div className="shrink-0 flex flex-col items-center gap-1">
            <div className="relative h-16 w-16">
              <svg viewBox="0 0 36 36" className="-rotate-90 h-16 w-16">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15" fill="none"
                  stroke={profileCompletion === 100 ? "#34d399" : "#60a5fa"}
                  strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${(profileCompletion / 100) * 94.2} 94.2`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-white">{profileCompletion}%</span>
              </div>
            </div>
            <p className="text-xs text-slate-400">Profile</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">

        {/* ── Mobile: section list ─────────────────────────────── */}
        <div className={`xl:hidden space-y-2 ${mobileShowContent ? "hidden" : "block"}`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1 mb-3">Settings</p>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => { setActive(item.key); setMobileShowContent(true); }}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-left"
            >
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
            </button>
          ))}
        </div>

        {/* ── Desktop: sidebar + content ───────────────────────── */}
        <div className={`xl:grid xl:grid-cols-[220px_1fr] xl:gap-6 ${mobileShowContent ? "block" : "hidden xl:grid"}`}>

          {/* Sidebar */}
          <aside className="hidden xl:block space-y-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setActive(item.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                  active === item.key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white border border-slate-100 text-slate-600 hover:bg-slate-50 shadow-sm"
                }`}
              >
                <span className={active === item.key ? "text-blue-100" : "text-slate-400"}>{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{item.label}</p>
                  <p className={`text-xs truncate ${active === item.key ? "text-blue-200" : "text-slate-400"}`}>{item.desc}</p>
                </div>
                <ChevronRight className={`h-4 w-4 shrink-0 ${active === item.key ? "text-blue-200" : "text-slate-300"}`} />
              </button>
            ))}
          </aside>

          {/* Content */}
          <div className="space-y-4 min-w-0">

            {/* Mobile breadcrumb */}
            <div className="xl:hidden flex items-center gap-2 pb-1">
              <button
                onClick={() => setMobileShowContent(false)}
                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Settings
              </button>
              <span className="text-slate-300">/</span>
              <span className="text-sm font-semibold text-slate-700">
                {NAV_ITEMS.find((i) => i.key === active)?.label}
              </span>
            </div>

            {/* ── PROFILE ── */}
            {active === "profile" && (
              <SectionCard
                title="Profile & Identity"
                desc="Your details appear in the People directory, job assignments, and reports."
              >
                <Field label="Profile Photo" hint="PNG or JPG, max 10 MB — saved to your account.">
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-2xl overflow-hidden border-2 border-slate-200 shrink-0">
                      {displayAvatar
                        ? <img src={displayAvatar} alt={displayName} className="h-full w-full object-cover" />
                        : <div className={`h-full w-full flex items-center justify-center text-white text-lg font-bold ${avatarBg(displayName)}`}>{getInitials(displayName)}</div>
                      }
                    </div>
                    <div>
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition"
                      >
                        <Camera className="h-4 w-4" />
                        {displayAvatar ? "Change Photo" : "Upload Photo"}
                      </button>
                      {avatarPreview && (
                        <p className="text-xs text-amber-600 mt-1.5">New photo ready — save to apply.</p>
                      )}
                    </div>
                  </div>
                </Field>

                <Field label="Full Name" hint="Displayed in schedules, approvals, and reports.">
                  <Inp
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                  />
                </Field>

                <Field label="Email" hint="Login email — contact your admin to change this.">
                  <Inp value={profile.email ?? ""} disabled className="opacity-60 cursor-not-allowed" />
                </Field>

                <Field label="Phone" hint="Used for dispatch callbacks and emergency contact.">
                  <Inp
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+61 4 0000 0000"
                  />
                </Field>

                {/* Live preview */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Preview — how you appear in People
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl overflow-hidden shrink-0">
                      {displayAvatar
                        ? <img src={displayAvatar} alt={displayName} className="h-full w-full object-cover" />
                        : <div className={`h-full w-full flex items-center justify-center text-white text-sm font-bold ${avatarBg(displayName)}`}>{getInitials(displayName)}</div>
                      }
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                      <p className="text-xs text-slate-400">{profile.email}</p>
                    </div>
                    <span className="ml-auto text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {humanize(profile.role)}
                    </span>
                  </div>
                </div>

                <SaveBtn loading={saving === "profile"} onClick={saveProfile} />
              </SectionCard>
            )}

            {/* ── SECURITY ── */}
            {active === "security" && (
              <SectionCard
                title="Security"
                desc="Keep your credentials current and your account protected."
              >
                <Field label="Change Password" hint="Must be at least 8 characters.">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Inp
                      type="password"
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="New password"
                    />
                    <Inp
                      type="password"
                      value={confPw}
                      onChange={(e) => setConfPw(e.target.value)}
                      placeholder="Confirm password"
                    />
                  </div>
                </Field>

                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { label: "Auth Method",     value: "Email / Password",   note: "Password-based login is active." },
                    { label: "Account Status",  value: profile.status ?? "ACTIVE", note: "Controlled by admin approval." },
                    { label: "Session",         value: "Protected",          note: "Active verified session required." },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide font-semibold text-slate-400">{s.label}</p>
                      <p className="mt-1.5 font-semibold text-slate-900">{s.value}</p>
                      <p className="text-xs text-slate-500 mt-1">{s.note}</p>
                    </div>
                  ))}
                </div>

                <SaveBtn loading={saving === "security"} onClick={savePassword} label="Update Password" />
              </SectionCard>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
