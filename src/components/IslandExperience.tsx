"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { sound } from "@/lib/sound";
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

const FACING = ["north", "east", "south", "west"];

/** Where the autopilot is heading. `stopId` means "open that stop's card on arrival". */
export type Destination = Point & { stopId?: string };

/**
 * The island and everything layered over it: the canvas, the on-screen controls and the
 * project card. Holds the little bit of state they share (which stop is near, which card is open).
 */
export function IslandExperience() {
  const box = useRef<HTMLDivElement>(null);
  const destination = useRef<Destination | null>(null); // read by the frame loop every frame
  const turns = useRef(0); // quarter turns of the view, clockwise from north; the frame loop eases the camera round
  const [turned, setTurned] = useState(0); // the same, for the compass
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

  // The island's sound pauses while it's scrolled away or the tab is hidden.
  useEffect(() => {
    const update = () => sound.setAudible(onScreen && document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [onScreen]);

  const goTo = useCallback((d: Destination) => {
    destination.current = d;
    setMoved(true);
  }, []);
  const goToStop = useCallback((id: string) => {
    const stop = stops.find((s) => s.id === id)!;
    goTo({ ...parkingSpot(stop.id), stopId: id });
    setStatus(`Driving to ${stop.name}. Its card opens when you arrive.`);
  }, [goTo]);
  const turnTo = useCallback((n: number) => {
    turns.current = n;
    setTurned(n);
    setStatus(`Facing ${FACING[((n % 4) + 4) % 4]}.`);
  }, []);
  const openStop = useCallback((id: string | null) => {
    setStatus(""); // so the next drive is announced again, even to the same stop
    setOpenId(id);
  }, []);

  // F opens the stop you're parked at (the same action as clicking the prompt); Q and E turn the view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPlainKey(e) || !onScreen) return;
      if (e.code === "KeyF" && nearId && !openId) openStop(nearId);
      if (e.code === "KeyH" && !e.repeat) sound.horn();
      if ((e.code === "KeyQ" || e.code === "KeyE") && !e.repeat && !openId) turnTo(turns.current + (e.code === "KeyQ" ? -1 : 1));
      if (/^(Key[WASD]|Arrow)/.test(e.code)) setMoved(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nearId, openId, onScreen, openStop, turnTo]);

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
            turns={turns}
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
              aria-keyshortcuts="F"
              className="sign-red sr-only pointer-events-auto px-6 text-lg focus:not-sr-only"
            >
              Open {near.name}
            </button>
          )}
          {/* The driving hint, and the turn control on its right (it wraps under the hint below ~350 px). From 1280 px
              there's room beside the stop strip, so the control moves down there and the hint centres again. */}
          <div className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 xl:justify-center">
            <p
              className={`plate bg-paper px-3 py-1 text-sm font-medium transition-opacity duration-500 motion-reduce:transition-none ${moved ? "opacity-0" : ""}`}
            >
              <span className="hidden md:inline">
                Drive with <Key>W</Key> <Key>A</Key> <Key>S</Key> <Key>D</Key> or the arrows, <Key>Space</Key> to brake, <Key>H</Key> to honk, or click the ground
              </span>
              <span className="md:hidden">Tap the ground to drive there</span>
            </p>
            <TurnControls
              turned={turned}
              onTurn={turnTo}
              className="ml-auto xl:absolute xl:right-5 xl:bottom-[max(0.75rem,env(safe-area-inset-bottom))]"
            />
          </div>
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

/**
 * Turns the view a quarter at a time (Q and E do the same). Between the two arrows sits a route marker whose needle
 * always points at the bay, the one thing in town everyone can place, so it turns the opposite way to the view; pressing
 * it turns the view back to face the bay. `turned` isn't wrapped to 0..3, so the needle always turns the short way.
 */
function TurnControls({ turned, onTurn, className }: { turned: number; onTurn: (to: number) => void; className: string }) {
  return (
    <div role="group" aria-label="Turn the view" className={`pointer-events-auto flex items-center gap-2 ${className}`}>
      <button type="button" onClick={() => onTurn(turned - 1)} aria-keyshortcuts="Q" className="sign px-2.5">
        <span className="sr-only">{"Turn left "}</span>
        <TurnArrow />
        <KeyCap>Q</KeyCap>
      </button>
      <button type="button" onClick={() => onTurn(Math.round(turned / 4) * 4)} aria-label="Face the bay" className="marker">
        <svg
          viewBox="0 0 44 44"
          aria-hidden="true"
          className="size-full transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `rotate(${-turned * 90}deg)` }}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* A compass needle, its red-deep half pointing at the bay (red lettering on yellow is always red-deep), the
              ink half behind, and the bay's waves past its tip. */}
          <path d="M22 13l5 11h-10z" fill="var(--color-red-deep)" stroke="var(--color-red-deep)" strokeWidth="1.5" />
          <path d="M17 24h10l-5 11z" fill="var(--color-ink)" stroke="var(--color-ink)" strokeWidth="1.5" />
          <path d="M14.5 9q1.9-2.6 3.75 0t3.75 0 3.75 0 3.75 0" stroke="var(--color-sea)" strokeWidth="2.25" />
          <circle cx="22" cy="24" r="1.4" fill="var(--color-yellow)" />
        </svg>
      </button>
      <button type="button" onClick={() => onTurn(turned + 1)} aria-keyshortcuts="E" className="sign px-2.5">
        <span className="sr-only">{"Turn right "}</span>
        <KeyCap>E</KeyCap>
        <TurnArrow right />
      </button>
    </div>
  );
}

/** A curved arrow for the turn buttons: anticlockwise, or clockwise when `right`. */
function TurnArrow({ right = false }: { right?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-5 ${right ? "-scale-x-100" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

/** A key cap inside a turn button, shown where there's a keyboard to press it (from 768 px); part of the button's name. */
function KeyCap({ children }: { children: React.ReactNode }) {
  return <kbd className="hidden rounded border-2 border-ink bg-paper px-1 font-display text-xs leading-tight md:inline">{children}</kbd>;
}

/** A keyboard key in the driving hint. */
function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border-2 border-ink bg-yellow px-1 font-display text-xs">{children}</kbd>;
}
