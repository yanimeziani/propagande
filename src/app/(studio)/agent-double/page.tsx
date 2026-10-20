import type { Metadata } from "next";
import { AgentDoubleView } from "@/components/agent-double/agent-double-view";

export const metadata: Metadata = { title: "Agent double" };

export default function AgentDoublePage() {
  return <AgentDoubleView />;
}
