import { useEffect, useState } from "react";
import { initAppStore, useAppStore, type AppState } from "@/store/appStore";
import { initSession } from "@/store/sessionStore";

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Boots the in-memory store on the client. Returns false until data is loaded. */
export function useAppReady() {
  useEffect(() => {
    initAppStore();
    initSession();
  }, []);
  return useAppStore((s: AppState) => s.ready);
}
