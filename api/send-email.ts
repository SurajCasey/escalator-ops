import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

type Body = {
  to: string;
  type: "approved" | "disabled" | "booked" | "cancelled";
  name?: string;
  job?: {
    title: string;
    clientName: string;
    siteName?: string | null;
    scheduledAt: string;
    status: string;
    notes?: string | null;
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { RESEND_API_KEY, RESEND_FROM_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

    if (!RESEND_API_KEY) return res.status(500).json({ error: "Missing RESEND_API_KEY" });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      return res.status(500).json({ error: "Missing Supabase env vars" });

    const fromAddress = RESEND_FROM_EMAIL?.trim() || "Operations <onboarding@resend.dev>";

    const resend = new Resend(RESEND_API_KEY);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // --- 1) Get token from header ---
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing authorization token" });

    // --- 2) Validate user token ---
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return res.status(401).json({ error: "Invalid token", details: userErr?.message ?? "no user returned" });
    }

    // --- 3) Check caller is ACTIVE ADMIN ---
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("role, status")
      .eq("id", userRes.user.id)
      .single();

    if (profileErr || !profile) return res.status(403).json({ error: "Profile not found" });
    if (profile.role !== "ADMIN" || profile.status !== "ACTIVE")
      return res.status(403).json({ error: "Admin access required" });

    // --- 4) Parse payload ---
    const { to, type, name, job } = (req.body || {}) as Body;
    if (!to || !type) return res.status(400).json({ error: "Missing required fields: to, type" });

    const displayName = (name?.trim() || "there").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    let subject = "";
    let html = "";

    if (type === "approved") {
      subject = "Your account has been approved";
      html = `<p>Hi ${displayName},<br/>Your account is approved. You can now log in.</p>`;
    } else if (type === "disabled") {
      subject = "Your account has been disabled";
      html = `<p>Hi ${displayName},<br/>Your account has been disabled. Please contact the admin team.</p>`;
    } else {
      if (!job) return res.status(400).json({ error: "Missing job details for job email" });

      const scheduledAt = new Date(job.scheduledAt);
      const dateLabel = Number.isNaN(scheduledAt.getTime())
        ? job.scheduledAt
        : new Intl.DateTimeFormat("en-AU", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).format(scheduledAt);
      const site = (job.siteName?.trim() || "Not specified").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const title = job.title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const client = job.clientName.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const status = job.status.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const notes = job.notes?.trim()
        ? `<p><strong>Notes:</strong> ${job.notes.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
        : "";

      subject = type === "booked" ? `Job booked: ${title}` : `Job cancelled: ${title}`;
      html =
        type === "booked"
          ? `<p>Hi ${displayName},<br/>A job has been booked or updated for you.</p>
             <p><strong>Job:</strong> ${title}</p>
             <p><strong>Client:</strong> ${client}</p>
             <p><strong>Site:</strong> ${site}</p>
             <p><strong>Scheduled:</strong> ${dateLabel}</p>
             <p><strong>Status:</strong> ${status}</p>
             ${notes}`
          : `<p>Hi ${displayName},<br/>The following job has been cancelled.</p>
             <p><strong>Job:</strong> ${title}</p>
             <p><strong>Client:</strong> ${client}</p>
             <p><strong>Site:</strong> ${site}</p>
             <p><strong>Scheduled:</strong> ${dateLabel}</p>
             <p><strong>Status:</strong> ${status}</p>
             ${notes}`;
    }

    // --- 5) Send email ---
    try {
      const { data, error: sendError } = await resend.emails.send({
        from: fromAddress,
        to,
        subject,
        html,
      });
      if (sendError) {
        console.error("Resend error:", sendError);
        return res.status(502).json({
          error: "Email provider rejected send",
          details: sendError,
        });
      }
      return res.status(200).json({ ok: true, data });
    } catch (err: any) {
      console.error("Resend error:", err);
      return res.status(500).json({ error: "Failed to send email", details: err?.message ?? String(err) });
    }
  } catch (error: any) {
    console.error("Server error:", error);
    return res.status(500).json({ error: "Internal server error", details: error?.message ?? String(error) });
  }
}
