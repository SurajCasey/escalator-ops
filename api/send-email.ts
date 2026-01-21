import type { VercelRequest, VercelResponse} from "@vercel/node";
import sgMail from "@sendgrid/mail";
import { createClient } from "@supabase/supabase-js";


const{
    SENDGRID_API_KEY,
    SENDGRID_FROM_EMAIL,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
} = process.env

if(!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL){
    throw new Error("Missing SENDGRID_API_KEY or SENDGRID_FROM_EMAIL");
}

if(!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY){
    throw new Error("Missing SUPABASE_URL OR SUPABASE_SERVICE_ROLE_KEY");
}


//Narrow types once, after checks
const FROM_EMAIL = SENDGRID_FROM_EMAIL; // string
const SUPA_URL = SUPABASE_URL;          // string
const SERVICE_ROLE = SUPABASE_SERVICE_ROLE_KEY; // string


sgMail.setApiKey(SENDGRID_API_KEY);

// Service role client (server-only; Never expose to frontend)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Body = {
    to: string,
    subject?: string,
    name?: string,
    type: "approved" | "disabled";
};

export default async function handler(req: VercelRequest, res: VercelResponse){
    if( req.method !== "POST") return res.status(405).json({error: "Method not allowed"});

    try {
        // 1) Require supabase access token from client
        const auth = req.headers.authorization || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if(!token) return res.status(401).json({error: "Missing authorization token"});
        
        // 2) Validate token + fetch user
        const { data: userRes, error: userErr} = await supabaseAdmin.auth.getUser(token);
        if(userErr || !userRes?.user) return res.status(401).json({error: "Invalid token"});

        const callerId = userRes.user.id;

        // 3) Confirm caller is ADMIN (server-side check)
        const {data: callerProfile, error: callerProfileErr} = await supabaseAdmin
            .from("profiles")
            .select("role, status")
            .eq("id", callerId)
            .single();

        if(callerProfileErr || !callerProfile){
            return res.status(403).json({error: "Profile not found"});
        }

        if(callerProfile.status !== "ACTIVE" || callerProfile.role !== "ADMIN"){
            return res.status(403).json({error: "Admin access required"});
        }

        // 4) Parse payload
        const body = req.body as Body;
        if(!body?.to || !body?.type){
            return res.status(400).json({ error: "Missing required fields: to, type"});
        }

        const subject = body.subject ??
        (body.type === "approved" ? "Your account has been approved" : "Your account has been disabled.")
            
        const displayName = body.name?.trim() ||  "there";

        const html = body.type === "approved" ?
        `
            <div>
                <h2> Hi ${displayName}, </h2>
                <p>Your account has been approved. You can now login and access the Operations portal.</p>
                <p>Thanks, <br/> Statewide Escalator Cleaning </p>
            </div>
        ` : 
        `
         <div>
                <h2> Hi ${displayName}, </h2>
                <p>Your account has been disabled. Please contact the admin team.</p>
                <p>Thanks, <br/> Statewide Escalator Cleaning </p>
            </div>   
        `
        // 5) Send email
        await sgMail.send({
            to: body.to,
            from: FROM_EMAIL,
            subject,
            html,
        });
    } catch (error) {
        console.error("send-email error: ", error);
        return res.status(500).json({ error: "Internal server error "});
    }

}