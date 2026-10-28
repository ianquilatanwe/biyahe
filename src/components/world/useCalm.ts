"use client";

import { useEffect, useRef } from "react";

/**
 * True while the visitor asks for reduced motion. A ref (read it inside useFrame) that
 * follows the OS setting live, so switching it mid-visit takes effect without a reload.
 */
export function useCalm() {
  const calm = useRef(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => (calm.current = query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return calm;
}
