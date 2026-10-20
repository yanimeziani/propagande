/** Hands a file from the home composer to a tool page across a client-side navigation.
 *  In memory only: nothing is uploaded, and it's read once. */
export type Handoff = { tool: "propagande" | "agent-double"; file: File; count?: number; length?: number };
let pending: Handoff | null = null;

export function setHandoff(h: Handoff) {
  pending = h;
}

export function takeHandoff(tool: Handoff["tool"]): Handoff | null {
  if (!pending || pending.tool !== tool) return null;
  const h = pending;
  pending = null;
  return h;
}
