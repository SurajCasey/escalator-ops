import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";

const IDLE_MS = 10 * 60 * 1000; // 10 minutes
const WARN_MS = 9 * 60 * 1000;  // warn at 9 minutes

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
  "click",
];

export function useIdleLogout() {
  const navigate = useNavigate();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnToastId = useRef<string | null>(null);

  useEffect(() => {
    function clearTimers() {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
    }

    function dismissWarn() {
      if (warnToastId.current) {
        toast.dismiss(warnToastId.current);
        warnToastId.current = null;
      }
    }

    async function logout() {
      dismissWarn();
      await supabase.auth.signOut();
      toast("Signed out due to inactivity.", { icon: "🔒" });
      navigate("/login", { replace: true });
    }

    function resetTimers() {
      clearTimers();
      dismissWarn();

      warnTimer.current = setTimeout(() => {
        warnToastId.current = toast(
          "You'll be signed out in 1 minute due to inactivity.",
          { duration: 60000, icon: "⚠️" }
        );
      }, WARN_MS);

      idleTimer.current = setTimeout(logout, IDLE_MS);
    }

    // Start on mount
    resetTimers();

    // Reset on any activity
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, resetTimers, { passive: true })
    );

    return () => {
      clearTimers();
      dismissWarn();
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, resetTimers)
      );
    };
  }, [navigate]);
}
