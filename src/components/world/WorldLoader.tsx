"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

// The 3D code only loads in the browser, after the HTML (name, skip link, project list) is already on screen.
const World = dynamic(() => import("./World"), {
  ssr: false,
  loading: () => <p className="grid h-full place-items-center font-display text-xl font-semibold text-ink">Loading the island…</p>,
});

/**
 * The canvas is decorative for assistive tech: everything on the island is also in the project list.
 * It only renders while at least a quarter of it is on screen, which saves battery while you read the list.
 */
export function WorldLoader() {
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setActive(entry.intersectionRatio >= 0.25), { threshold: 0.25 });
    observer.observe(box.current!);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={box} aria-hidden="true" className="absolute inset-0">
      <World active={active} />
    </div>
  );
}
