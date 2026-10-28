/**
 * Covers the island until its first frame is on screen: a route signboard and a little jeepney
 * driving along a road (parked, for reduced motion). Decorative: it sits in the aria-hidden
 * island wrapper, and the page's heading and project list are already readable underneath.
 */
export function Loading({ done }: { done: boolean }) {
  return (
    <div
      className={`absolute inset-0 z-[9] grid place-items-center bg-sky transition-opacity duration-500 motion-reduce:transition-none ${done ? "pointer-events-none opacity-0" : ""}`}
    >
      <div className="flex flex-col items-center gap-5">
        <p className="rounded-lg border-2 border-ink bg-yellow px-6 py-1.5 font-display text-2xl font-semibold text-red-deep shadow-[0_3px_0_var(--color-ink)]">
          Island loop
        </p>
        <div className="relative h-9 w-56 overflow-hidden">
          <svg viewBox="0 0 48 26" className="absolute bottom-2 left-1/2 w-12 -translate-x-1/2 motion-safe:left-0 motion-safe:translate-x-0 motion-safe:animate-drive">
            <rect x="2" y="4" width="30" height="14" rx="2" fill="#d62839" />
            <rect x="2" y="2" width="31" height="3" fill="#2a9d8f" />
            <rect x="6" y="7" width="5" height="5" fill="#22313f" />
            <rect x="14" y="7" width="5" height="5" fill="#22313f" />
            <rect x="22" y="7" width="5" height="5" fill="#22313f" />
            <rect x="32" y="8" width="7" height="10" fill="#ffc93c" />
            <rect x="39" y="12" width="7" height="6" rx="1" fill="#cfd6de" />
            <circle cx="10" cy="20" r="4" fill="#1f1f24" />
            <circle cx="38" cy="20" r="4" fill="#1f1f24" />
          </svg>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-[repeating-linear-gradient(90deg,var(--color-ink)_0_12px,transparent_12px_20px)]" />
        </div>
        <p className="font-display text-lg font-semibold text-ink">Loading the island…</p>
      </div>
    </div>
  );
}
