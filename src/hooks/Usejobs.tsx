import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { sendJobEmails } from "../lib/jobEmails";
import toast from "react-hot-toast";

export type JobStatus  = "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE" | "CANCELLED";
export type VisitStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE" | "CANCELLED";
export type JobType    = "ADHOC" | "CONTRACT";

/* ── Parent Job ────────────────────────────────────────────── */
export type Job = {
  id: string;
  title: string;
  client_id: string | null;
  client_name: string;
  site_name: string | null;
  status: JobStatus;
  flat_rate: number | null;
  notes: string | null;
  created_at: string;
  job_type: JobType;
  cancellation_reason: string | null;
  recurring_template_id: string | null;
  is_generated: boolean;
  // Cached from visits (updated by DB trigger)
  scheduled_start: string | null;
  scheduled_end: string | null;
  visit_count: number;
  completed_visit_count: number;
  // Legacy columns (kept for migrated data, do not use for new bookings)
  scheduled_at: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  frequency_days: number | null;
  booking_id: string | null;
  parent_job_id: string | null;
  completed_at: string | null;
};

/* ── Visit ─────────────────────────────────────────────────── */
export type Visit = {
  id: string;
  job_id: string;
  scheduled_at: string;
  status: VisitStatus;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

/* ── Visit with denormalised job info (from visits_with_job view) ── */
export type VisitWithJob = Visit & {
  job_title: string;
  client_name: string;
  site_name: string | null;
  flat_rate: number | null;
  job_notes: string | null;
};

/* ── Inputs ────────────────────────────────────────────────── */
export type JobInput = {
  title: string;
  client_id?: string | null;
  client_name: string;
  site_name?: string | null;
  status?: JobStatus;
  flat_rate?: number | null;
  notes?: string | null;
  job_type?: JobType;
  recurring_template_id?: string | null;
  // Legacy fields — kept so AddJobModal and other existing callers don't break
  scheduled_at?: string;
  frequency_days?: number | null;
  assigned_to?: string | null;
  assigned_to_name?: string;
};

export type VisitInput = {
  job_id: string;
  scheduled_at: string;
  notes?: string | null;
  status?: VisitStatus;
};

/** Human-readable label for a frequency value in days */
export function frequencyLabel(days: number | null | undefined): string {
  if (!days) return "";
  const map: Record<number, string> = {
    7:   "Weekly",
    14:  "Fortnightly",
    30:  "Monthly",
    60:  "Every 2 months",
    90:  "Quarterly",
    180: "Every 6 months",
    365: "Annually",
  };
  return map[days] ?? `Every ${days} days`;
}

/* ════════════════════════════════════════════════════════════ */
export function useJobs() {
  const [jobs, setJobs]       = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;

    let query = supabase
      .from("jobs")
      .select("*")
      .neq("status", "CANCELLED")
      .order("scheduled_start", { ascending: true, nullsFirst: false });

    if (uid) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .single<{ role: string }>();

      if (prof?.role === "EMPLOYEE") {
        // Employees see jobs where they have a visit assignment
        const { data: vaRows } = await supabase
          .from("visit_assignments")
          .select("visit_id")
          .eq("employee_id", uid);

        const visitIds = (vaRows ?? []).map((r: { visit_id: string }) => r.visit_id);

        if (visitIds.length > 0) {
          const { data: visitRows } = await supabase
            .from("visits")
            .select("job_id")
            .in("id", visitIds);

          const jobIds = [...new Set((visitRows ?? []).map((r: { job_id: string }) => r.job_id))];

          if (jobIds.length > 0) {
            query = query.in("id", jobIds);
          } else {
            // Legacy fallback: assigned_to column
            query = query.eq("assigned_to", uid);
          }
        } else {
          // Legacy fallback: assigned_to column
          query = query.eq("assigned_to", uid);
        }
      }
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load jobs: " + error.message);
      setLoading(false);
      return;
    }

    const jobData = (data ?? []) as Job[];

    // Auto-mark SCHEDULED jobs as OVERDUE when their scheduled_start has passed
    // Rule: job is overdue the moment scheduled_start < now AND it hasn't been started
    const now = new Date();
    const overdueJobIds = jobData
      .filter(j =>
        j.status === "SCHEDULED" &&
        j.scheduled_start &&
        new Date(j.scheduled_start) < now
      )
      .map(j => j.id);

    if (overdueJobIds.length > 0) {
      // Mark jobs overdue
      await supabase.from("jobs").update({ status: "OVERDUE" }).in("id", overdueJobIds);
      jobData.forEach(j => { if (overdueJobIds.includes(j.id)) j.status = "OVERDUE"; });

      // Also mark each overdue job's SCHEDULED visits as OVERDUE
      // (visits whose scheduled_at has passed and are still SCHEDULED)
      await supabase
        .from("visits")
        .update({ status: "OVERDUE" })
        .in("job_id", overdueJobIds)
        .eq("status", "SCHEDULED")
        .lt("scheduled_at", now.toISOString());
    }

    // Also mark individual SCHEDULED visits as OVERDUE even if the parent job
    // has multiple visits (some future, some past). We target only past-due visits.
    const activeJobIds = jobData
      .filter(j => j.status === "IN_PROGRESS" || j.status === "OVERDUE")
      .map(j => j.id);

    if (activeJobIds.length > 0) {
      await supabase
        .from("visits")
        .update({ status: "OVERDUE" })
        .in("job_id", activeJobIds)
        .eq("status", "SCHEDULED")
        .lt("scheduled_at", now.toISOString());
    }

    // ── Un-mark rescheduled items ──────────────────────────────────────
    // OVERDUE visits whose scheduled_at is now in the future were rescheduled
    // by an admin. Reset them back to SCHEDULED.
    await supabase
      .from("visits")
      .update({ status: "SCHEDULED" })
      .eq("status", "OVERDUE")
      .gte("scheduled_at", now.toISOString());

    // Un-mark OVERDUE jobs whose earliest visit (scheduled_start) is now in
    // the future — all visits were rescheduled ahead.
    const jobsToUnmark = jobData
      .filter(j =>
        j.status === "OVERDUE" &&
        j.scheduled_start &&
        new Date(j.scheduled_start) > now
      )
      .map(j => j.id);

    if (jobsToUnmark.length > 0) {
      await supabase.from("jobs").update({ status: "SCHEDULED" }).in("id", jobsToUnmark);
      jobData.forEach(j => { if (jobsToUnmark.includes(j.id)) j.status = "SCHEDULED"; });
    }

    setJobs(jobData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  /* ── Create a single job (simple / quick-add) ─────────────── */
  const createJob = async (input: JobInput): Promise<string | null> => {
    const { data, error } = await supabase
      .from("jobs")
      .insert({
        ...input,
        status:       input.status ?? "SCHEDULED",
        assigned_to:  null,
        assigned_to_name: "",
        scheduled_at: new Date().toISOString(), // legacy col; visits drive scheduling
      })
      .select("id")
      .single();

    if (error) { toast.error(error.message); return null; }
    toast.success("Job created.");
    await fetchJobs();
    return (data as { id: string }).id;
  };

  /* ── Update a job ─────────────────────────────────────────── */
  const updateJob = async (id: string, patch: Partial<JobInput>): Promise<boolean> => {
    const { error } = await supabase.from("jobs").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Job updated.");
    await fetchJobs();
    return true;
  };

  /* ── Admin explicitly closes a job ───────────────────────── */
  const markJobComplete = async (id: string): Promise<boolean> => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("jobs")
      .update({ status: "COMPLETED", completed_at: now })
      .eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Job marked as complete.");
    await fetchJobs();
    return true;
  };

  /* ── Legacy alias kept so existing pages don't break ─────── */
  const markComplete = markJobComplete;

  /* ── Delete a job (cascades to visits via DB) ─────────────── */
  const deleteJob = async (id: string): Promise<boolean> => {
    const job = jobs.find(j => j.id === id);

    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }

    // Best-effort cancellation email — only when API is configured
    if (job && import.meta.env.VITE_API_BASE_URL?.trim()) {
      (async () => {
        try {
          // Get employees via visit_assignments for this job's visits
          const { data: visitRows } = await supabase
            .from("visits")
            .select("id")
            .eq("job_id", id);

          const visitIds = (visitRows ?? []).map((v: { id: string }) => v.id);
          let recipients: { email: string; name?: string }[] = [];

          if (visitIds.length > 0) {
            const { data: vaRows } = await supabase
              .from("visit_assignments")
              .select("employee_id")
              .in("visit_id", visitIds);

            const empIds = [...new Set((vaRows ?? []).map((r: { employee_id: string }) => r.employee_id))];
            if (empIds.length > 0) {
              const { data: profileRows } = await supabase
                .from("profiles")
                .select("email, full_name")
                .in("id", empIds);

              recipients = (profileRows ?? [])
                .map((p: { email: string; full_name: string | null }) => ({
                  email: p.email,
                  name:  p.full_name ?? undefined,
                }))
                .filter(r => r.email);
            }
          }

          await sendJobEmails({
            recipients,
            type: "cancelled",
            job: {
              title:       job.title,
              clientName:  job.client_name,
              siteName:    job.site_name,
              scheduledAt: job.scheduled_start ?? job.scheduled_at,
              status:      job.status,
              notes:       job.notes,
            },
          });
        } catch (e) {
          console.warn("Cancellation email skipped:", e);
        }
      })();
    }

    toast.success("Job deleted.");
    setJobs(prev => prev.filter(j => j.id !== id));
    return true;
  };

  /* ── Revert a completed job to SCHEDULED ─────────────────── */
  const undoComplete = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from("jobs")
      .update({ status: "SCHEDULED", completed_at: null })
      .eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Job re-opened.");
    await fetchJobs();
    return true;
  };

  return { jobs, loading, fetchJobs, createJob, updateJob, markComplete, markJobComplete, deleteJob, undoComplete };
}
