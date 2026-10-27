"use client";

import dynamic from "next/dynamic";

// The 3D code only loads in the browser, after the HTML (name, skip link, project list) is already on screen.
const World = dynamic(() => import("./World"), {
  ssr: false,
  loading: () => <p className="grid h-full place-items-center font-display text-xl font-semibold text-ink">Loading the island…</p>,
});

/** The canvas is decorative for assistive tech: everything on the island is also in the project list. */
export function WorldLoader() {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <World />
    </div>
  );
}
