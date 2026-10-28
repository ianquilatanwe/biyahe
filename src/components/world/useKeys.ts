"use client";

import { useEffect, useRef } from "react";
import type { Input } from "@/lib/driving";

const FORWARD = ["KeyW", "ArrowUp"];
const BACK = ["KeyS", "ArrowDown"];
const LEFT = ["KeyA", "ArrowLeft"];
const RIGHT = ["KeyD", "ArrowRight"];
const DRIVE_KEYS = new Set([...FORWARD, ...BACK, ...LEFT, ...RIGHT]);

/**
 * Tracks which driving keys are held. Read `read()` every frame; nothing re-renders.
 * While `active` is false (island scrolled away) the keys are left alone, so arrows scroll the page.
 */
export function useKeys(active: boolean) {
  const held = useRef(new Set<string>());
  const on = useRef(active);

  useEffect(() => {
    on.current = active;
    if (!active) held.current.clear();
  }, [active]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!on.current || !DRIVE_KEYS.has(e.code) || !isPlainKey(e)) return;
      held.current.add(e.code);
      e.preventDefault(); // arrow keys would otherwise scroll the page while you drive
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

/** A key meant for the game: no Ctrl/Alt/Cmd shortcut (Alt+← is "back", Ctrl+S is "save") and not typing in a field. */
export function isPlainKey(e: KeyboardEvent) {
  const t = e.target;
  const typing = t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  return !e.ctrlKey && !e.altKey && !e.metaKey && !typing;
}
