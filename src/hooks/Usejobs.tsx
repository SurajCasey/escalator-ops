import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { sendJobEmails } from "../lib/jobEmails";
import toast from "react-hot-toast";

export type JobStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";
export type JobType = "ADHOC" | "CONTRACT";

export type Job = {
  id: string;
  title: string;
  client_id: string | null;
  client_name: string;
  site_name: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  status: JobStatus;
  scheduled_at: string;
  completed_at: string | null;
  flat_rate: number | null;
  notes: string | null;
  created_at: string;
  job_type: JobType;
  frequency_days: number | null;
  parent_job_id: string | null;
};

export type JobInput = {
  title: string;
  client_id?: string | null;
  client_name: string;
  site_name?: string;
  assigned_to?: string | null;
  assigned_to_name?: string;
  status: JobStatus;
  scheduled_at: string;
  flat_rate?: number | null;
  notes?: string;
  job_type?: JobType;
  frequency_days?: number | null;
  parent_job_id?: string | null;
};

/** Human-readable label for a frequency value in days */
export function frequencyLabel(days: number | null | undefined): string {
  if (!days) return "";
  const map: Record<number, string> = {
    7: "Weekly",
    14: "Fortnightly",
    30: "Monthly",
    60: "Every 2 months",
    90: "Quarterly",
    180: "Every 6 months",
    365: "Annually",
  };
  return map[days] ?? `Every ${days} days`;
}

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    setLoading(true);

    // Employees only see jobs assigned to them
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;

    let query = supabase.from("jobs").select("*").order("scheduled_at", { ascending: true });

    if (uid) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .single<{ role: string }>();

      if (prof?.role === "EMPLOYEE") {
        // Jobs can be assigned via job_assignments table (new) OR assigned_to column (legacy).
        // Fetch both sets and union them.
        const { data: assignmentRows } = await supabase
          .from("job_assignments")
          .select("job_id")
          .eq("employee_id", uid);

        const assignedJobIds = (assignmentRows ?? []).map((r: { job_id: string }) => r.job_id);

        if (assignedJobIds.length > 0) {
          // Show jobs from job_assignments + any legacy assigned_to jobs
          query = query.or(`assigned_to.eq.${uid},id.in.(${assignedJobIds.join(",")})`);
        } else {
          // Fall back to legacy assigned_to only
          query = query.eq("assigned_to", uid);
        }
      }
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load jobs: " + error.message);
    } else {
      setJobs(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const createJob = async (input: JobInput): Promise<boolean> => {
    const { error } = await supabase.from("jobs").insert(input);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Job created.");
    await fetchJobs();
    return true;
  };

  const updateJob = async (id: string, patch: Partial<JobInput>): Promise<boolean> => {
    const { error } = await supabase.from("jobs").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Job updated.");
    await fetchJobs();
    return true;
  };

  const markComplete = async (id: string): Promise<boolean> => {
    const job = jobs.find((j) => j.id === id);
    const now = new Date().toISOString();

    // Mark the current job complete
    const { error } = await supabase
      .from("jobs")
      .update({ status: "COMPLETED", completed_at: now })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
      return false;
    }

    // Auto-schedule next occurrence for contract jobs
    if (job?.job_type === "CONTRACT" && job.frequency_days) {
      const nextDate = new Date(now);
      nextDate.setDate(nextDate.getDate() + job.frequency_days);

      const nextJob: JobInput = {
        title: job.title,
        client_id: job.client_id,
        client_name: job.client_name,
        site_name: job.site_name ?? undefined,
        assigned_to: job.assigned_to,
        assigned_to_name: job.assigned_to_name ?? undefined,
        status: "SCHEDULED",
        scheduled_at: nextDate.toISOString(),
        flat_rate: job.flat_rate,
        notes: job.notes ?? undefined,
        job_type: "CONTRACT",
        frequency_days: job.frequency_days,
        parent_job_id: id,
      };

      const { error: nextErr } = await supabase.from("jobs").insert(nextJob);

      if (nextErr) {
        toast.error("Completed, but failed to schedule next occurrence: " + nextErr.message);
      } else {
        const label = nextDate.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
        toast.success(`Job complete! Next occurrence auto-scheduled for ${label}.`, { duration: 5000 });
      }
    } else {
      toast.success("Job marked as complete.");
    }

    await fetchJobs();
    return true;
  };

  const deleteJob = async (id: string): Promise<boolean> => {
    const job = jobs.find((j) => j.id === id);
    const { data: assignmentRows } = await supabase
      .from("job_assignments")
      .select("employee_id")
      .eq("job_id", id);

    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }

    if (job) {
      try {
        const employeeIds = (assignmentRows ?? []).map((row: { employee_id: string }) => row.employee_id);
        let recipients: { email: string; name?: string }[] = [];

        if (employeeIds.length > 0) {
          const { data: profileRows } = await supabase
            .from("profiles")
            .select("email, full_name")
            .in("id", employeeIds);

          recipients = (profileRows ?? [])
            .map((profile: { email: string; full_name: string | null }) => ({
              email: profile.email,
              name: profile.full_name ?? undefined,
            }))
            .filter((recipient) => recipient.email);
        }

        await sendJobEmails({
          recipients,
          type: "cancelled",
          job: {
            title: job.title,
            clientName: job.client_name,
            siteName: job.site_name,
            scheduledAt: job.scheduled_at,
            status: job.status,
            notes: job.notes,
          },
        });
      } catch (emailError) {
        console.error("Failed to send cancellation email", emailError);
        toast.error(emailError instanceof Error ? emailError.message : "Failed to send cancellation email.");
      }
    }

    toast.success("Job deleted.");
    setJobs((prev) => prev.filter((j) => j.id !== id));
    return true;
  };

  /** Admin: revert a completed job back to SCHEDULED so employees can resume it */
  const undoComplete = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from("jobs")
      .update({ status: "SCHEDULED", completed_at: null })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Job re-opened — employees can clock in again.");
    await fetchJobs();
    return true;
  };

  return { jobs, loading, fetchJobs, createJob, updateJob, markComplete, deleteJob, undoComplete };
}
