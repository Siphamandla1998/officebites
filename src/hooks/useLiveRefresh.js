import { useEffect, useRef } from "react";
import { supabase } from "../services/api/supabaseClient";

// Realtime while connected, with focus/visibility refresh and a polling fallback.
export function useLiveRefresh(refresh, key, filter) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    let running = false;
    const update = async () => {
      if (!active || running || document.visibilityState === "hidden") return;
      running = true;
      try { await latest.current(); } catch (error) { console.error("Could not refresh messages:", error); } finally { running = false; }
    };
    const channel = supabase.channel(`messages-refresh:${key}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", ...(filter ? { filter } : {}) }, update)
      .subscribe();
    const timer = setInterval(update, 10000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
      supabase.removeChannel(channel);
    };
  }, [key, filter]);
}
