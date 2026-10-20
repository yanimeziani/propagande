/** The turning glass « m », keyed at render time: black drops out with mix-blend-mode: screen on our dark ground. */
export function GlassLoop({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div
        className="absolute -inset-[10%] rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(40% 50% at 30% 50%, var(--corail) 0%, transparent 70%), radial-gradient(40% 50% at 72% 50%, var(--violet) 0%, transparent 70%)" }}
        aria-hidden
      />
      <video
        className="relative w-full motion-reduce:hidden"
        style={{ mixBlendMode: "screen" }}
        src="/brand/m-glass-hero.mp4"
        poster="/brand/m-glass-hero-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-label="Le logo MadeLucid en verre qui tourne lentement"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="relative hidden w-full motion-reduce:block" style={{ mixBlendMode: "screen" }} src="/brand/m-glass-hero-poster.jpg" alt="Le logo MadeLucid en verre" />
    </div>
  );
}
