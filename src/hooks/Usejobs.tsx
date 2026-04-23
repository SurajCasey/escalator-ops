import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";

export type JobStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";

export type Job = {
  id: string;
  title: string;
  client_name: string;
  site_name: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  status: JobStatus;
  scheduled_at: string;
  notes: string | null;
  created_at: string;
};

export type JobInput = {
  title: string;
  client_name: string;
  site_name?: string;
  assigned_to?: string | null;
  assigned_to_name?: string;
  status: JobStatus;
  scheduled_at: string;
  notes?: string;
};

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("scheduled_at", { ascending: true });

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

  const deleteJob = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Job deleted.");
    setJobs((prev) => prev.filter((j) => j.id !== id));
    return true;
  };

  return { jobs, loading, fetchJobs, createJob, updateJob, deleteJob };
}