"use client";
import { useSearchParams } from "next/navigation";
import { CreationsView } from "./creations-view";

/** Reads « ?outil=propagande | agent-double » and opens Mes créations on that filter. */
export function CreationsFromQuery() {
  const outil = useSearchParams().get("outil");
  return <CreationsView initialTool={outil === "propagande" || outil === "agent-double" ? outil : "tous"} />;
}
