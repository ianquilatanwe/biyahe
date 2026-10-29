/**
 * Covers the town until its first frame is on screen: a route signboard and a little jeepney
 * driving along a road (parked, for reduced motion). Decorative: it sits in the aria-hidden
 * island wrapper, and the page's heading and project list are already readable underneath.
 */
export function Loading({ done }: { done: boolean }) {
  return (
    <div
      className={`absolute inset-0 z-[9] grid place-items-center bg-sky transition-opacity duration-500 motion-reduce:transition-none ${done ? "pointer-events-none opacity-0" : ""}`}
    >
      <div className="flex flex-col items-center gap-5">
        <p className="plate px-6 py-1.5 text-2xl text-red-deep">Town loop</p>
        <div className="relative h-9 w-56 overflow-hidden">
          {/* The town's stainless jeepney from the side, in the page's own colour tokens. */}
          <svg viewBox="0 0 54 26" className="absolute bottom-2 left-1/2 w-14 -translate-x-1/2 motion-safe:left-0 motion-safe:translate-x-0 motion-safe:animate-drive">
            <g className="fill-[#d5dbe1]">
              <rect x="1" y="3" width="41" height="4" rx="1" />
              <rect x="2" y="12" width="32" height="7" />
              <rect x="34" y="11" width="12" height="5" />
              <path d="M33 19 Q34 12 41 12 Q47 12 48 16 L48 19 Z" />
            </g>
            <rect x="3" y="7" width="30" height="5" className="fill-ink" />
            <g className="fill-[#d5dbe1]">
              {[3, 9, 15, 21, 27].map((x) => <rect key={x} x={x} y="7" width="1.5" height="5" />)}
            </g>
            <rect x="33" y="7" width="2" height="5" className="fill-[#22313f]" />
            <rect x="2" y="12.5" width="32" height="1.6" className="fill-red" />
            <rect x="2" y="14.1" width="32" height="0.9" className="fill-yellow" />
            <rect x="2" y="15" width="32" height="0.8" className="fill-[#1d4e89]" />
            <rect x="34" y="4.2" width="7" height="1.8" rx="0.5" className="fill-yellow" />
            <path d="M40 11 L41 8.5 L42.5 9 L42 11 Z" className="fill-[#f2f5f8]" />
            <rect x="47.5" y="11" width="1.5" height="6" className="fill-[#f2f5f8]" />
            <rect x="46" y="17.5" width="4" height="1.5" className="fill-[#f2f5f8]" />
            <circle cx="10" cy="20" r="4" className="fill-ink" />
            <circle cx="41" cy="20" r="4" className="fill-ink" />
            <circle cx="10" cy="20" r="1.6" className="fill-[#f2f5f8]" />
            <circle cx="41" cy="20" r="1.6" className="fill-[#f2f5f8]" />
          </svg>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-[repeating-linear-gradient(90deg,var(--color-ink)_0_12px,transparent_12px_20px)]" />
        </div>
        <p className="font-display text-lg font-semibold text-ink">Loading the town…</p>
      </div>
    </div>
  );
}
