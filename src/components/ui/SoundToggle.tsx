"use client";

import { useEffect, useState } from "react";
import { sound } from "@/lib/sound";
import { SoundIcon } from "./icons";

/**
 * The header's sound switch. Sound is on by default, but browsers only allow audio after the visitor clicks,
 * taps or presses a key (scrolling doesn't count), so it starts on the first of those anywhere on the page;
 * until then the button says so. No AudioContext exists before that, which keeps the console clean too.
 */
export function SoundToggle() {
  const [on, setOn] = useState(true);
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    if (!waiting || !on) return;
    // pointerup, not pointerdown: on a touch screen only the lift counts, and a swipe that scrolls ends in pointercancel.
    const events = ["pointerup", "keydown"];
    const start = (e: Event) => {
      if ((e.target as Element).closest?.("[data-sound-toggle]")) return; // the button handles itself
      if (navigator.userActivation && !navigator.userActivation.isActive) return; // Escape and shortcuts don't unlock audio
      sound.setEnabled(true);
      setWaiting(false);
    };
    for (const type of events) addEventListener(type, start, { capture: true });
    return () => {
      for (const type of events) removeEventListener(type, start, { capture: true });
    };
  }, [waiting, on]);

  const label = waiting && on ? "Sound starts when you click" : `Sound ${on ? "on" : "off"}`;
  return (
    <button
      type="button"
      data-sound-toggle
      aria-pressed={on && !waiting}
      aria-label={waiting && on ? "Start sound" : "Sound"}
      title={label}
      onClick={() => {
        // While waiting, pressing the button is the click that starts the sound, not one that stops it.
        const next = waiting || !on;
        sound.setEnabled(next);
        setOn(next);
        setWaiting(false);
      }}
      className="sign min-h-10 min-w-10 justify-center gap-1.5 bg-paper px-2 text-sm sm:px-3"
    >
      <SoundIcon on={on} />
      <span aria-hidden="true" className="hidden md:inline">
        {waiting && on ? "Click for sound" : on ? "Sound on" : "Sound off"}
      </span>
    </button>
  );
}
