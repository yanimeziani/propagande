/** Each tool's name in its own face: Propagande in a heavy stencil, Agent double on a typewriter. */
export function ToolName({ tool, className = "" }: { tool: "propagande" | "agent-double"; className?: string }) {
  if (tool === "propagande") {
    return <span className={`font-propagande font-black tracking-[0.01em] uppercase ${className}`}>Propagande</span>;
  }
  return <span className={`font-agent tracking-[0.02em] uppercase ${className}`}>Agent double</span>;
}
