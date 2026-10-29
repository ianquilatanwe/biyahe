export const UPWORK = "https://www.upwork.com/freelancers/ianquilatan";

/** The six stops in town. Each one is a real project (or the "about" terminal). Where each stands: `site()` in world.ts. */
export type Stop = {
  id: string;
  name: string; // shown on the jeepney's route sign
  landmark: string;
  title: string;
  blurb: string;
  stack: string;
  /** `primary` is drawn in jeepney red: the one link that matters most on that card. */
  links: { label: string; href: string; primary?: boolean }[];
  /** Screenshot in public/shots, 1200 × 750. */
  shot?: string;
};

export const stops: Stop[] = [
  {
    id: "fashionhub",
    name: "FashionHub",
    landmark: "Sari-sari store",
    title: "FashionHub product listing",
    blurb: "A Figma product listing page built in Next.js on a live product API: search, filters, sorting, a working cart and offline support.",
    stack: "Next.js · TypeScript · Tailwind CSS",
    links: [
      { label: "Live site", href: "https://product-listing-demo-ten.vercel.app/" },
      { label: "Code", href: "https://github.com/ianquilatanwe/product-listing-demo" },
    ],
    shot: "/shots/fashionhub.jpg",
  },
  {
    id: "sprig",
    name: "Sprig & Stone",
    landmark: "Plant nursery",
    title: "Sprig & Stone landing page",
    blurb: "A six-section landing page for a made-up plant shop: FAQ, contact form and a 0-violation accessibility check.",
    stack: "Next.js · TypeScript · Tailwind CSS",
    links: [
      { label: "Live site", href: "https://landing-demo-rust-psi.vercel.app/" },
      { label: "Code", href: "https://github.com/ianquilatanwe/landing-demo" },
    ],
    shot: "/shots/sprig.jpg",
  },
  {
    id: "lumenfold",
    name: "Lumenfold",
    landmark: "Lighthouse",
    title: "Lumenfold motion demo",
    blurb: "A scroll-driven launch page for a made-up desk lamp: a pinned dusk-to-night scene and a shared-element finish picker.",
    stack: "Next.js · Motion · Tailwind CSS",
    links: [
      { label: "Live site", href: "https://motion-demo-one.vercel.app/" },
      { label: "Code", href: "https://github.com/ianquilatanwe/motion-demo" },
    ],
    shot: "/shots/lumenfold.jpg",
  },
  {
    id: "bagyo",
    name: "Bagyo",
    landmark: "Weather station",
    title: "Bagyo typhoon demo",
    blurb: "Scroll up into a typhoon drawn by one WebGL shader: rain and spiral clouds build through the five PAGASA signals, then the eye opens onto blue sky. Hold to call lightning; the sound is made in code.",
    stack: "Next.js · WebGL2 shader · Web Audio",
    links: [
      { label: "Live site", href: "https://bagyo-three.vercel.app/" },
      { label: "Code", href: "https://github.com/ianquilatanwe/bagyo" },
    ],
    shot: "/shots/bagyo.jpg",
  },
  {
    id: "recipes",
    name: "Recipe Finder",
    landmark: "Carinderia",
    title: "Recipe Finder app",
    blurb: "A Figma recipe-app design built in Flutter for Android and the web, on a live recipe API. Save recipes and build a shopping list, even offline.",
    stack: "Flutter · Dart · REST API",
    links: [
      { label: "Live web app", href: "https://recipe-finder-flutter.pages.dev/" },
      { label: "Code", href: "https://github.com/ianquilatanwe/recipe-finder-flutter" },
    ],
    shot: "/shots/recipes.jpg",
  },
  {
    id: "about",
    name: "About Ian", // "Pier" alone didn't say what's there
    landmark: "Pier",
    title: "About Ian",
    blurb: "Frontend developer in the Philippines (UTC+8). Figma to UI, bug fixes, API wiring and responsive layouts, in React, Next.js and Flutter.",
    stack: "React · Next.js · TypeScript · Tailwind CSS · Flutter",
    links: [
      { label: "Hire me on Upwork", href: UPWORK, primary: true },
      { label: "GitHub", href: "https://github.com/ianquilatanwe" },
    ],
  },
];

/** The red strip on a stop's card: "Stop 2 · Plant nursery", or "Last stop · Pier" for the about stop. */
export function stopLabel(stop: Stop) {
  return stop.id === "about" ? `Last stop · ${stop.landmark}` : `Stop ${stops.indexOf(stop) + 1} · ${stop.landmark}`;
}
