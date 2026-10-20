/** The sub-brand stamp: « Feels illegal. », like a classified label. */
export function FeelsIllegal({ className = "" }: { className?: string }) {
  return (
    <span className={`light-edge inline-flex shrink-0 -rotate-3 items-center gap-2 whitespace-nowrap rounded-[10px] px-3 py-1.5 font-mono text-[12px] font-medium tracking-[0.14em] text-ink uppercase ${className}`}>
      <span className="size-1.5 rounded-full bg-rec" aria-hidden />
      Feels illegal.
    </span>
  );
}
