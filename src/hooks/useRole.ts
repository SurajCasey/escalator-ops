/**
 * useRole — lightweight hook to get the current user's role and ID.
 * Used to gate admin-only UI actions without duplicating profile queries.
 */

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type Role = "ADMIN" | "EMPLOYEE";

export function useRole() {
  const [role, setRole]     = useState<Role>("EMPLOYEE");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) { setLoading(false); return; }
      setUserId(uid);
      supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .single<{ role: Role }>()
        .then(({ data: p }) => {
          setRole(p?.role ?? "EMPLOYEE");
          setLoading(false);
        });
    });
  }, []);

  return { role, userId, isAdmin: role === "ADMIN", loading };
}
