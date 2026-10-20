import { FeelsIllegal } from "@/components/brand/feels-illegal";
import { ToolName } from "@/components/brand/tool-name";

/** Top of a tool page: name, stamp, one plain line, and a note on the right. */
export function ToolHeader({ tool, line, note }: { tool: "propagande" | "agent-double"; line: string; note?: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-[40px] leading-none md:text-[52px]"><ToolName tool={tool} /></h1>
          <FeelsIllegal />
        </div>
        <p className="max-w-[60ch] text-[16px] text-ink-muted">{line}</p>
      </div>
      {note && <p className="text-[14px] text-ink-muted">{note}</p>}
    </header>
  );
}
