import type { VercelRequest, VercelResponse } from "@vercel/node";
import sgMail from "@sendgrid/mail";
import { createClient } from "@supabase/supabase-js";

type Body = {
  to: string;
  subject?: string;
  name?: string;
  type: "approved" | "disabled";
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const {
      SENDGRID_API_KEY,
      SENDGRID_FROM_EMAIL,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    } = process.env;

    if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
      return res.status(500).json({ error: "Missing SendGrid env vars" });
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Missing Supabase env vars" });
    }

    sgMail.setApiKey(SENDGRID_API_KEY);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1) Read Authorization header
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing authorization token" });

    // 2) Validate token + get user
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userRes?.user) return res.status(401).json({ error: "Invalid token" });

    const callerId = userRes.user.id;

    // 3) Confirm caller is ACTIVE ADMIN
    const { data: callerProfile, error: callerProfileErr } = await supabaseAdmin
      .from("profiles")
      .select("role, status")
      .eq("id", callerId)
      .single();

    if (callerProfileErr || !callerProfile) {
      return res.status(403).json({ error: "Profile not found" });
    }
    if (callerProfile.status !== "ACTIVE" || callerProfile.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin access required" });
    }

    // 4) Parse body
    const body = req.body as Body;
    if (!body?.to || !body?.type) {
      return res.status(400).json({ error: "Missing required fields: to, type" });
    }

    const displayName = body.name?.trim() || "there";
    const subject =
      body.subject ??
      (body.type === "approved"
        ? "Your account has been approved"
        : "Your account has been disabled");

    const html =
      body.type === "approved"
        ? `<div><h2>Hi ${displayName},</h2><p>Your account has been approved. You can now login and access the Operations Portal.</p><p>Thanks,<br/>Statewide Escalator Cleaning</p></div>`
        : `<div><h2>Hi ${displayName},</h2><p>Your account has been disabled. Please contact the admin team.</p><p>Thanks,<br/>Statewide Escalator Cleaning</p></div>`;

    // 5) Send
    await sgMail.send({
      to: body.to,
      from: SENDGRID_FROM_EMAIL, 
      subject,
      html,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("send-email error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
