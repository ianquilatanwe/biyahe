"use client";

import { useEffect, useRef } from "react";
import type { Input } from "@/lib/driving";

const FORWARD = ["KeyW", "ArrowUp"];
const BACK = ["KeyS", "ArrowDown"];
const LEFT = ["KeyA", "ArrowLeft"];
const RIGHT = ["KeyD", "ArrowRight"];
const BRAKE = "Space";
const DRIVE_KEYS = new Set([...FORWARD, ...BACK, ...LEFT, ...RIGHT, BRAKE]);

/**
 * Tracks which driving keys are held. Read `read()` every frame; nothing re-renders.
 * While `active` is false (island scrolled away) the keys are left alone, so arrows and Space scroll the page.
 * Space is the brake; on a focused button or link it still presses it.
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
      if (e.code === BRAKE && e.target instanceof Element && e.target.closest("a, button, summary, [role=button]")) return;
      held.current.add(e.code);
      e.preventDefault(); // arrows and Space would otherwise scroll the page while you drive
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
    braking: () => held.current.has(BRAKE),
  };
}

/** A key meant for the game: no Ctrl/Alt/Cmd shortcut (Alt+← is "back", Ctrl+S is "save") and not typing in a field. */
export function isPlainKey(e: KeyboardEvent) {
  const t = e.target;
  const typing = t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  return !e.ctrlKey && !e.altKey && !e.metaKey && !typing;
}
