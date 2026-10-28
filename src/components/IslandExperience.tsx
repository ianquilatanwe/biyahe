"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { stops } from "@/lib/stops";
import { parkingSpot, type Point } from "@/lib/world";
import { Loading } from "./ui/Loading";
import { Road } from "./ui/RoadPaint";
import { IslandBoundary } from "./ui/NoIsland";
import { StopCard } from "./ui/StopCard";
import { isPlainKey } from "./world/useKeys";

// The 3D code only loads in the browser, after the HTML (name, skip link, project list) is already on screen.
// <Loading> covers the island until it has drawn its first frame.
const World = dynamic(() => import("./world/World"), { ssr: false });

// Dev-only tuning sliders. In a production build this condition is false at build time,
// so the panel and the leva package are left out of the site entirely.
const TuningPanel = process.env.NODE_ENV === "development" ? dynamic(() => import("./world/TuningPanel"), { ssr: false }) : () => null;

/** Where the autopilot is heading. `stopId` means "open that stop's card on arrival". */
export type Destination = Point & { stopId?: string };

/**
 * The island and everything layered over it: the canvas, the on-screen controls and the
 * project card. Holds the little bit of state they share (which stop is near, which card is open).
 */
export function IslandExperience() {
  const box = useRef<HTMLDivElement>(null);
  const destination = useRef<Destination | null>(null); // read by the frame loop every frame
  const [onScreen, setOnScreen] = useState(true);
  const [nearId, setNearId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [island, setIsland] = useState<"loading" | "ready" | "failed">("loading");
  const onReady = useCallback(() => setIsland("ready"), []);
  const onFail = useCallback(() => setIsland("failed"), []);
  // Read out by screen readers while the autopilot drives (the card takes focus when it opens).
  const [status, setStatus] = useState("");
  // The driving hint goes once you've driven: by then it has done its job.
  const [moved, setMoved] = useState(false);

  // Render only while at least a quarter of the island is on screen (saves battery while reading the list).
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.intersectionRatio >= 0.25), { threshold: 0.25 });
    observer.observe(box.current!);
    return () => observer.disconnect();
  }, []);

  const goTo = useCallback((d: Destination) => {
    destination.current = d;
    setMoved(true);
  }, []);
  const goToStop = useCallback((id: string) => {
    const stop = stops.find((s) => s.id === id)!;
    goTo({ ...parkingSpot(stop.angle), stopId: id });
    setStatus(`Driving to ${stop.name}. Its card opens when you arrive.`);
  }, [goTo]);
  const openStop = useCallback((id: string | null) => {
    setStatus(""); // so the next drive is announced again, even to the same stop
    setOpenId(id);
  }, []);

  // E opens the stop you're parked at (the same action as clicking the prompt).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPlainKey(e) || !onScreen) return;
      if (e.code === "KeyE" && nearId && !openId) openStop(nearId);
      if (/^(Key[WASD]|Arrow)/.test(e.code)) setMoved(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nearId, openId, onScreen, openStop]);

  const near = stops.find((s) => s.id === nearId);
  const open = stops.find((s) => s.id === openId) ?? null;

  return (
    <>
      <div ref={box} aria-hidden="true" className="absolute inset-0">
        <IslandBoundary onFail={onFail}>
          <World
            active={onScreen}
            driving={onScreen && !openId}
            destination={destination}
            onGoTo={goTo}
            onGoToStop={goToStop}
            onNear={setNearId}
            onArrive={openStop}
            nearId={nearId}
            onOpen={openStop}
            onReady={onReady}
          />
        </IslandBoundary>
        <Loading done={island !== "loading"} />
      </div>

      {/* On-screen controls. The wrapper lets taps through to the island; only the controls catch them.
          Hidden when the island can't run: the buttons would drive a jeepney that isn't there. */}
      {island !== "failed" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* Mouse and touch open a stop from its sign on the island. This button is the same action for the
              keyboard and screen readers: out of sight until it has focus. */}
          {near && (
            <button
              type="button"
              onClick={() => openStop(near.id)}
              aria-keyshortcuts="E"
              className="sign-red sr-only pointer-events-auto px-6 text-lg focus:not-sr-only"
            >
              Open {near.name}
            </button>
          )}
          <p
            className={`plate bg-paper px-3 py-1 text-sm font-medium transition-opacity duration-500 motion-reduce:transition-none ${moved ? "opacity-0" : ""}`}
          >
            <span className="hidden md:inline">
              Drive with <Key>W</Key> <Key>A</Key> <Key>S</Key> <Key>D</Key> or the arrows, <Key>Space</Key> to brake, or click the ground
            </span>
            <span className="md:hidden">Tap the ground to drive there</span>
          </p>
          <nav aria-label="Stops" className="pointer-events-auto relative w-full max-w-3xl">
            {/* The stops sit along a short stretch of road (between the two rows on a phone). */}
            <div aria-hidden="true" className="absolute inset-x-6 top-1/2 h-4 -translate-y-1/2 rounded-full bg-ink">
              <Road className="h-full w-full" />
            </div>
            <ul className="relative flex flex-wrap justify-center gap-2">
              {stops.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => goToStop(s.id)} className="sign min-h-11 px-3 text-[15px] sm:px-4">
                    <span className="sr-only">Drive to </span>
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <p className="sr-only" aria-live="polite">
            {status}
          </p>
        </div>
      )}

      <StopCard stop={open} onClose={() => setOpenId(null)} />
      <TuningPanel />
    </>
  );
}

/** A keyboard key in the driving hint. */
function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border-2 border-ink bg-yellow px-1 font-display text-xs">{children}</kbd>;
}
