import Image from "next/image";
import type { Stop } from "@/lib/stops";
import { OutIcon } from "./icons";

/**
 * A stop's ticket: the red strip naming the stop, the screenshot, then title, blurb, stack and links.
 * The card that opens on the island and the route board below it both use this, so they're the same object.
 * `strip` holds what sits on the right of the red strip (the dialog's close button). `wide` puts the
 * screenshot beside the text from tablet width up (the route board), instead of above it (the dialog).
 */
export function StopDetails({
  stop,
  label,
  titleId,
  heading: H = "h2",
  strip,
  wide = false,
}: {
  stop: Stop;
  label: string;
  titleId?: string;
  heading?: "h2" | "h3";
  strip?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "md:grid md:grid-cols-[1.1fr_1fr]" : undefined}>
      <div className="flex min-h-11 items-center justify-between gap-3 bg-red px-5 text-white md:col-span-2">
        <p className="font-display text-sm font-semibold tracking-wide">{label}</p>
        {strip}
      </div>
      {stop.shot && (
        <Image
          src={stop.shot}
          alt={`Screenshot of ${stop.title}`}
          width={1200}
          height={750}
          sizes="(min-width: 640px) 544px, 100vw"
          className={`block h-auto w-full border-b-[3px] border-ink ${wide ? "md:h-full md:border-r-[3px] md:border-b-0 md:object-cover md:object-left-top" : ""}`}
        />
      )}
      <div className="p-5 sm:p-6">
        <H id={titleId} className="font-display text-2xl leading-tight font-semibold text-balance sm:text-3xl">
          {stop.title}
        </H>
        <p className="mt-2 max-w-prose text-pretty">{stop.blurb}</p>
        <p className="mt-3 text-sm text-muted">{stop.stack}</p>
        {stop.links.length > 0 ? (
          <p className="mt-5 flex flex-wrap gap-3">
            {stop.links.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={l.primary ? "sign-red" : "sign"}>
                {l.label}
                <OutIcon />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ))}
          </p>
        ) : (
          <p className="mt-5 inline-flex rounded-lg border-2 border-dashed border-ink/50 px-3 py-2 text-sm text-muted">Live link coming soon</p>
        )}
      </div>
    </div>
  );
}
