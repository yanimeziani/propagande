"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Detective, MegaphoneSimple, UploadSimple } from "@phosphor-icons/react";
import { setHandoff, type Handoff } from "@/lib/handoff";

const copy = {
  propagande: { title: "Dépose une vidéo longue", sub: "Un live, un podcast, un vlog. On en tire les meilleurs moments en 9:16.", accept: "video/*" },
  "agent-double": { title: "Dépose la scène à transformer", sub: "10 secondes ou moins. Tu choisis ensuite le nouveau personnage.", accept: "video/*" },
} as const;

/** The tool in the hero: pick a tool, drop a file, land in the tool with it loaded. */
export function Composer() {
  const router = useRouter();
  const [tool, setTool] = useState<Handoff["tool"]>("propagande");
  const [count, setCount] = useState(8);
  const [length, setLength] = useState(30);
  const [over, setOver] = useState(false);
  const c = copy[tool];

  function go(file?: File) {
    if (!file) return;
    setHandoff({ tool, file, count, length });
    router.push(`/${tool}`);
  }

  return (
    <div id="composer" className="light-edge mx-auto bg-surface-200/90 backdrop-blur-2xl flex w-full max-w-3xl scroll-mt-24 flex-col gap-3 rounded-[28px] p-3 text-left shadow-lift">
      <div className="flex items-center gap-1 rounded-full bg-black/20 p-1 self-start">
        {([["propagande", "Propagande", MegaphoneSimple], ["agent-double", "Agent double", Detective]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => setTool(k)} aria-pressed={tool === k}
            className={`flex h-9 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors ${tool === k ? "bg-violet text-on-violet" : "text-ink-muted hover:text-ink"}`}>
            <Icon size={18} weight={tool === k ? "fill" : "regular"} aria-hidden /> {label}
          </button>
        ))}
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); go(e.dataTransfer.files?.[0]); }}
        className={`flex cursor-pointer items-center gap-4 rounded-[20px] border border-dashed border-glass-rim p-4 transition-colors hover:bg-white/5 ${over ? "bg-white/10" : ""}`}
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-corail text-on-corail"><UploadSimple size={24} weight="bold" aria-hidden /></span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[17px] font-semibold">{c.title}</span>
          <span className="text-[14px] text-ink-muted">{c.sub}</span>
        </span>
        <span className="hidden h-10 shrink-0 items-center rounded-full bg-ink px-4 text-[14px] font-semibold text-surface-100 sm:inline-flex">Choisir un fichier</span>
        <input type="file" accept={c.accept} className="sr-only" onChange={(e) => go(e.target.files?.[0])} />
      </label>

      <div className="flex flex-wrap items-center gap-2 px-1 pb-1">
        {tool === "propagande" ? (
          <>
            <Chip label="Clips" value={count} options={[5, 8, 12]} onChange={setCount} />
            <Chip label="Durée" value={length} options={[20, 30, 45]} unit=" s" onChange={setLength} />
            <span className="font-mono text-[12px] text-ink-muted">· 9:16 · tout reste sur ton appareil</span>
          </>
        ) : (
          <span className="font-mono text-[12px] text-ink-muted">Personnage inventé ou vraie personne avec son accord · brouillon d&apos;abord</span>
        )}
      </div>
    </div>
  );
}

function Chip({ label, value, options, unit = "", onChange }: { label: string; value: number; options: number[]; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="glass flex h-9 items-center gap-2 rounded-full pr-1 pl-3 text-[13px] font-semibold text-ink-muted">
      {label}
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-7 rounded-full bg-transparent pr-1 font-mono text-ink tabular focus:outline-none">
        {options.map((o) => <option key={o} value={o}>{o}{unit}</option>)}
      </select>
    </label>
  );
}
