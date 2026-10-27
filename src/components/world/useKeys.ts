"use client";

import { useEffect, useRef } from "react";
import type { Input } from "@/lib/driving";

const FORWARD = ["KeyW", "ArrowUp"];
const BACK = ["KeyS", "ArrowDown"];
const LEFT = ["KeyA", "ArrowLeft"];
const RIGHT = ["KeyD", "ArrowRight"];
const DRIVE_KEYS = new Set([...FORWARD, ...BACK, ...LEFT, ...RIGHT]);

/** Tracks which driving keys are held. Read `read()` every frame; nothing re-renders. */
export function useKeys() {
  const held = useRef(new Set<string>());

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!DRIVE_KEYS.has(e.code) || isTyping(e.target)) return;
      held.current.add(e.code);
      // Arrow keys would scroll the page while the island fills the screen.
      if (window.scrollY < window.innerHeight / 2) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => held.current.delete(e.code);
    const clear = () => held.current.clear(); // no stuck keys after switching tabs
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, []);

  return {
    read(): Input {
      const any = (codes: string[]) => codes.some((c) => held.current.has(c));
      return {
        throttle: (any(FORWARD) ? 1 : 0) - (any(BACK) ? 1 : 0),
        steer: (any(LEFT) ? 1 : 0) - (any(RIGHT) ? 1 : 0),
      };
    },
  };
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}
