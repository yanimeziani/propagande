import type { Metadata } from "next";
import { PropagandeView } from "@/components/propagande/propagande-view";

export const metadata: Metadata = { title: "Propagande" };

export default function PropagandePage() {
  return <PropagandeView />;
}
