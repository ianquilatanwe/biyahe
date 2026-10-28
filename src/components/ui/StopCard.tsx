"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { Stop } from "@/lib/stops";

/**
 * The project card that opens at a stop. A native <dialog> opened with showModal():
 * the browser traps focus inside, closes it on Esc and hands focus back afterwards.
 */
export function StopCard({ stop, onClose }: { stop: Stop | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    const d = dialog.current!;
    if (stop && !d.open) d.showModal();
    if (!stop && d.open) d.close();
  }, [stop]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="stop-title"
      onClose={onClose}
      // A click on the dim backdrop lands on the <dialog> itself, not on the card inside it. Both the press
      // and the release must be on the backdrop: selecting text and letting go outside the card keeps it open.
      onPointerDown={(e) => (pressedBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => pressedBackdrop.current && e.target === e.currentTarget && dialog.current?.close()}
      // Scrolls when the card is taller than the screen (phone in landscape, zoomed text), so the links stay reachable.
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border-[3px] border-ink bg-white p-0 text-ink shadow-[0_6px_0_var(--color-ink)] backdrop:bg-ink/50"
    >
      {stop && (
        <div>
          <div className="flex items-center justify-between gap-3 bg-red px-5 py-2 text-white">
            <p className="font-display text-sm font-semibold tracking-wide">Stop · {stop.landmark}</p>
            <button type="button" onClick={() => dialog.current?.close()} className="sign-quiet -mr-2 size-11 text-xl" aria-label="Close">
              ×
            </button>
          </div>
          {stop.shot && (
            <Image src={stop.shot} alt={`Screenshot of ${stop.title}`} width={1200} height={750} sizes="(min-width: 640px) 544px, 100vw" className="block h-auto w-full border-b-[3px] border-ink" />
          )}
          <div className="p-5 sm:p-6">
            <h2 id="stop-title" className="font-display text-2xl font-semibold sm:text-3xl">
              {stop.title}
            </h2>
            <p className="mt-2">{stop.blurb}</p>
            <p className="mt-3 text-sm text-muted">{stop.stack}</p>
            {stop.links.length > 0 ? (
              <p className="mt-5 flex flex-wrap gap-3">
                {stop.links.map((l) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="sign">
                    {l.label} <span aria-hidden="true">↗</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ))}
              </p>
            ) : (
              <p className="mt-5 text-sm text-muted">Live link coming soon.</p>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
