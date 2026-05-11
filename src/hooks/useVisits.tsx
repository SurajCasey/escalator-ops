import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";
import type { Visit, VisitInput, VisitStatus } from "./Usejobs";

export type { Visit, VisitInput, VisitStatus };

/* ── Assignment helper ──────────────────────────────────────────── */
export type VisitAssignment = {
  id: string;
  visit_id: string;
  employee_id: string;
  created_at: string;
};

/* ════════════════════════════════════════════════════════════════ */
export function useVisits() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);

  /* ── Fetch visits for a specific job ──────────────────────────── */
  const fetchVisits = useCallback(async (jobId: string): Promise<Visit[]> => {
    setLoading(true);
    const { data, error } = await supabase
      .from("visits")
      .select("*")
      .eq("job_id", jobId)
      .order("scheduled_at", { ascending: true });

    setLoading(false);
    if (error) {
      toast.error("Failed to load visits: " + error.message);
      return [];
    }
    const rows = (data ?? []) as Visit[];
    setVisits(rows);
    return rows;
  }, []);

  /* ── Fetch all visits (admin view) ───────────────────────────── */
  const fetchAllVisits = useCallback(async (): Promise<Visit[]> => {
    setLoading(true);
    const { data, error } = await supabase
      .from("visits")
      .select("*")
      .order("scheduled_at", { ascending: true });

    setLoading(false);
    if (error) {
      toast.error("Failed to load visits: " + error.message);
      return [];
    }
    const rows = (data ?? []) as Visit[];
    setVisits(rows);
    return rows;
  }, []);

  /* ── Create a single visit ────────────────────────────────────── */
  const createVisit = async (input: VisitInput): Promise<string | null> => {
    const { data, error } = await supabase
      .from("visits")
      .insert({
        job_id:       input.job_id,
        scheduled_at: input.scheduled_at,
        notes:        input.notes ?? null,
        status:       input.status ?? "SCHEDULED",
      })
      .select("id")
      .single();

    if (error) { toast.error(error.message); return null; }
    return (data as { id: string }).id;
  };

  /* ── Create multiple visits for a job at once ─────────────────── */
  const createVisits = async (inputs: VisitInput[]): Promise<string[]> => {
    if (inputs.length === 0) return [];

    const rows = inputs.map(i => ({
      job_id:       i.job_id,
      scheduled_at: i.scheduled_at,
      notes:        i.notes ?? null,
      status:       i.status ?? "SCHEDULED",
    }));

    const { data, error } = await supabase
      .from("visits")
      .insert(rows)
      .select("id");

    if (error) { toast.error(error.message); return []; }
    return ((data ?? []) as { id: string }[]).map(r => r.id);
  };

  /* ── Assign employees to a visit ─────────────────────────────── */
  const assignEmployeesToVisit = async (
    visitId: string,
    employeeIds: string[]
  ): Promise<boolean> => {
    if (employeeIds.length === 0) return true;

    const rows = employeeIds.map(eid => ({
      visit_id:    visitId,
      employee_id: eid,
    }));

    const { error } = await supabase
      .from("visit_assignments")
      .insert(rows);

    if (error) { toast.error(error.message); return false; }
    return true;
  };

  /* ── Remove all assignments for a visit, then re-assign ─────── */
  const setVisitEmployees = async (
    visitId: string,
    employeeIds: string[]
  ): Promise<boolean> => {
    // Delete existing
    const { error: delErr } = await supabase
      .from("visit_assignments")
      .delete()
      .eq("visit_id", visitId);

    if (delErr) { toast.error(delErr.message); return false; }
    if (employeeIds.length === 0) return true;

    return assignEmployeesToVisit(visitId, employeeIds);
  };

  /* ── Update a visit ───────────────────────────────────────────── */
  const updateVisit = async (
    id: string,
    patch: Partial<VisitInput & { status: VisitStatus }>
  ): Promise<boolean> => {
    const { error } = await supabase
      .from("visits")
      .update(patch)
      .eq("id", id);

    if (error) { toast.error(error.message); return false; }
    toast.success("Visit updated.");
    setVisits(prev =>
      prev.map(v => v.id === id ? { ...v, ...patch } : v)
    );
    return true;
  };

  /* ── Mark a visit complete ────────────────────────────────────── */
  const markVisitComplete = async (id: string): Promise<boolean> => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("visits")
      .update({ status: "COMPLETED", completed_at: now })
      .eq("id", id);

    if (error) { toast.error(error.message); return false; }
    toast.success("Visit marked complete.");
    setVisits(prev =>
      prev.map(v =>
        v.id === id ? { ...v, status: "COMPLETED" as VisitStatus, completed_at: now } : v
      )
    );
    return true;
  };

  /* ── Mark a visit in progress ────────────────────────────────── */
  const markVisitInProgress = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from("visits")
      .update({ status: "IN_PROGRESS" })
      .eq("id", id);

    if (error) { toast.error(error.message); return false; }
    toast.success("Visit started.");
    setVisits(prev =>
      prev.map(v =>
        v.id === id ? { ...v, status: "IN_PROGRESS" as VisitStatus } : v
      )
    );
    return true;
  };

  /* ── Delete a visit ───────────────────────────────────────────── */
  const deleteVisit = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from("visits")
      .delete()
      .eq("id", id);

    if (error) { toast.error(error.message); return false; }
    toast.success("Visit deleted.");
    setVisits(prev => prev.filter(v => v.id !== id));
    return true;
  };

  /* ── Cancel a visit ───────────────────────────────────────────── */
  const cancelVisit = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from("visits")
      .update({ status: "CANCELLED" })
      .eq("id", id);

    if (error) { toast.error(error.message); return false; }
    toast.success("Visit cancelled.");
    setVisits(prev =>
      prev.map(v =>
        v.id === id ? { ...v, status: "CANCELLED" as VisitStatus } : v
      )
    );
    return true;
  };

  /* ── Get assignments for a visit ─────────────────────────────── */
  const getVisitAssignments = async (visitId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from("visit_assignments")
      .select("employee_id")
      .eq("visit_id", visitId);

    if (error) return [];
    return ((data ?? []) as { employee_id: string }[]).map(r => r.employee_id);
  };

  return {
    visits,
    loading,
    fetchVisits,
    fetchAllVisits,
    createVisit,
    createVisits,
    assignEmployeesToVisit,
    setVisitEmployees,
    updateVisit,
    markVisitComplete,
    markVisitInProgress,
    deleteVisit,
    cancelVisit,
    getVisitAssignments,
  };
}
