import type { Metadata } from "next";
import { CreationsView } from "@/components/library/creations-view";

export const metadata: Metadata = { title: "Mes créations" };

export default async function CreationsPage({ searchParams }: { searchParams: Promise<{ outil?: string }> }) {
  const { outil } = await searchParams;
  const tool = outil === "propagande" || outil === "agent-double" ? outil : "tous";
  return <CreationsView initialTool={tool} />;
}
