"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUp } from "@phosphor-icons/react";
import { formats } from "@/lib/formats";

/** « Qu'est-ce qu'on filme aujourd'hui ? »: type an idea or tap a format; both open Créer prefilled. */
export function PromptBox() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const go = (q: string) => router.push(q);
  return (
    <form
      className="glass light-edge mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-[28px] p-3 shadow-lift"
      onSubmit={(e) => {
        e.preventDefault();
        if (idea.trim()) go(`/creer?idee=${encodeURIComponent(idea.trim())}`);
      }}
    >
      <label htmlFor="idee" className="px-2 pt-1 font-display text-[22px] font-bold md:text-[26px]">Qu&apos;est-ce qu&apos;on filme aujourd&apos;hui ?</label>
      <div className="flex items-end gap-2">
        <textarea
          id="idee"
          rows={2}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Ex. : mon café le matin, avant l'ouverture"
          className="min-h-[56px] flex-1 resize-none rounded-[18px] bg-transparent px-2 py-2 text-[16px] text-ink placeholder:text-ink-muted focus:outline-none"
        />
        <button type="submit" aria-label="Créer" disabled={!idea.trim()} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-corail text-on-corail transition-opacity disabled:opacity-40">
          <ArrowUp size={20} weight="bold" aria-hidden />
        </button>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-1 pb-1">
        {formats.map((f) => (
          <button key={f.slug} type="button" onClick={() => go(`/creer?format=${f.slug}`)} className="h-9 shrink-0 rounded-full border border-glass-rim px-3.5 text-[13.5px] font-semibold text-ink-muted transition-colors hover:bg-white/5 hover:text-ink">
            {f.title}
          </button>
        ))}
      </div>
    </form>
  );
}
