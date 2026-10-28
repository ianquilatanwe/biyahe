"use client";

import { useEffect, useRef } from "react";
import { stopLabel, type Stop } from "@/lib/stops";
import { CloseIcon } from "./icons";
import { StopDetails } from "./StopDetails";

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
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border-[3px] border-ink bg-paper p-0 text-ink shadow-[0_6px_0_var(--color-ink)] backdrop:bg-ink/50"
    >
      {stop && (
        <StopDetails
          stop={stop}
          label={stopLabel(stop)}
          titleId="stop-title"
          strip={
            <button type="button" onClick={() => dialog.current?.close()} className="-mr-3 grid size-11 place-items-center rounded-lg hover:bg-white/15" aria-label="Close">
              <CloseIcon />
            </button>
          }
        />
      )}
    </dialog>
  );
}
