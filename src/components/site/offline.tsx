"use client";
import { useEffect } from "react";

/** Registers the offline worker (public/sw.js) on the built site, so Propagande opens and runs without internet
 *  once it has been visited. Not in development, where it would fight hot reload. */
export function Offline() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
