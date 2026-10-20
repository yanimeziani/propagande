"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ping } from "@/lib/ping";

/** madelucid.com/clip is the address on the « Fait avec Propagande » end card. It counts the visit (no identifier)
 *  so the Monday scorecard can tell what the end card brings in, then opens Propagande. */
export default function Page() {
  const router = useRouter();
  useEffect(() => {
    ping("from-endcard");
    router.replace("/propagande");
  }, [router]);
  return <p className="px-4 pt-16 text-center text-ink-muted">Ouverture de Propagande…</p>;
}
