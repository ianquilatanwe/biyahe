/** Paint from the jeepney and the road, for the page's seams. Decorative: hidden from screen readers. */

/** A dashed yellow centre line (SVG, so the dashes stay crisp at any length). `vertical` runs it down the page. */
export function Road({ vertical = false, className = "" }: { vertical?: boolean; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} preserveAspectRatio="none" viewBox={vertical ? "0 0 2 100" : "0 0 100 2"}>
      <line
        x1={vertical ? 1 : 0}
        y1={vertical ? 0 : 1}
        x2={vertical ? 1 : 100}
        y2={vertical ? 100 : 1}
        stroke="var(--color-yellow)"
        strokeWidth={3}
        strokeDasharray="14 12"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** The jeepney's flank stripes (red, yellow, teal on ink), used where one part of the page meets the next. */
export function Stripes() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-[3px] bg-ink py-[3px]">
      <div className="h-2.5 bg-red" />
      <div className="h-1.5 bg-yellow" />
      <div className="h-2.5 bg-roof-teal" />
    </div>
  );
}

/** A drawn flag for the end of the route. */
export function EndFlag({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 21V4h11l-2.5 4 2.5 4H6" />
    </svg>
  );
}
