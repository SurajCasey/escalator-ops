import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        if(req.method !== "POST"){
            return res.status(405).json({error: "Method not allowed"});
        }

        const{
            RESEND_API_KEY,
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
        }= process.env;

        if(!RESEND_API_KEY){
            return res.status(500).json({error: "Missing Resend API key"});
        }
        if(!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY){
            return res.status(500).json({error: "Missing Supabase enve vars"});
        }

        const supabaseAdmin = createClient(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
            { auth: { persistSession: false}}
        );

        // Auth header
        const auth = req.headers.authorization || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if(!token) return res.status(401).json({error: "Missing authorization token"});

        // Validate user token
        const { data: userRes} = await supabaseAdmin.auth.getUser(token);
        if(!userRes?.user) return res.status(401).json({error: "Invalid token"});

        // Check admin
        const { data: profile} = await supabaseAdmin
        .from("profiles")
        .select("role, status")
        .eq("id", userRes.user.id)
        .single()

        if(!profile || profile.role !== "ADMIN" || profile.status !== "ACTIVE"){
            return res.status(403).json({error: "Admin access required"});
        }

        const { to, type, name } = req.body || {};
        if(!to || !type){
            return res.status(400).json({error: "Missing to or type"});
        }

        const displayName = name || "there";

        const subject = 
            type === "approved"
            ? "Your account has been approved"
            : "Your account has been disabled";
            
        const html =
            type === "approved"
            ? `<p>Hi ${displayName}, <br/> Your account is approved. You can now log in .</p>`
            : `<p>Hi ${displayName}, <br/> Your account has been disabled.</p>`

        await resend.emails.send({
            from: "Operations <onboarding@resend.dev>",
            to,
            subject,
            html,
        })
    } catch (error) {
        console.error("resend error", error);
        return res.status(500).json({error: "Internal server error"});
    }
}

