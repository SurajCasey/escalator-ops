import { supabase } from "./supabase";

export type JobEmailType = "booked" | "cancelled";

export type JobEmailDetails = {
  title: string;
  clientName: string;
  siteName?: string | null;
  scheduledAt: string;
  status: string;
  notes?: string | null;
};

type Recipient = {
  email: string;
  name?: string | null;
};

function normalizeRecipients(recipients: Recipient[]) {
  const seen = new Set<string>();
  return recipients.filter((recipient) => {
    const email = recipient.email.trim().toLowerCase();
    if (!email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}

function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
}

export async function sendJobEmails(params: {
  recipients: Recipient[];
  type: JobEmailType;
  job: JobEmailDetails;
}) {
  const recipients = normalizeRecipients(params.recipients);
  if (recipients.length === 0) return;

  const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;

  const token = sessionRes.session?.access_token;
  if (!token) throw new Error("No session token available.");
  const apiBaseUrl = getApiBaseUrl();

  const sends = recipients.map((recipient) =>
    fetch(`${apiBaseUrl}/api/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: recipient.email,
        name: recipient.name ?? undefined,
        type: params.type,
        job: params.job,
      }),
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to send email to ${recipient.email}: ${text}`);
      }
    }),
  );

  const results = await Promise.allSettled(sends);
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    throw new Error(
      failures
        .map((failure) => (failure.status === "rejected" ? failure.reason?.message ?? "Unknown send error" : ""))
        .join("; "),
    );
  }
}
