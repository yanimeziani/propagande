import type { Metadata } from "next";
import { Suspense } from "react";
import { CreationsFromQuery } from "@/components/library/creations-from-query";

export const metadata: Metadata = { title: "Mes créations" };

// Static page: the « ?outil= » filter is read in the browser, so the site can be exported as plain files
export default function CreationsPage() {
  return (
    <Suspense>
      <CreationsFromQuery />
    </Suspense>
  );
}
