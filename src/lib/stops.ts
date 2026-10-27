/** The five stops around the island. Each one is a real project (or the "about" pier). */
export type Stop = {
  id: string;
  name: string; // shown on the jeepney's route sign
  landmark: string;
  title: string;
  blurb: string;
  stack: string;
  links: { label: string; href: string }[];
  /** Where it sits on the island: angle in degrees around the centre (0 = towards the camera). */
  angle: number;
};

export const stops: Stop[] = [
  {
    id: "fashionhub",
    name: "FashionHub",
    landmark: "Sari-sari store",
    title: "FashionHub product listing",
    blurb: "A product listing page built from a Figma design, with filters, sorting and a cart drawer.",
    stack: "Next.js · TypeScript · Tailwind CSS",
    links: [
      { label: "Live site", href: "https://product-listing-demo-ten.vercel.app/" },
      { label: "Code", href: "https://github.com/ianquilatanwe/product-listing-demo" },
    ],
    angle: 150,
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
    angle: 80,
  },
  {
    id: "lumenfold",
    name: "Lumenfold",
    landmark: "Lighthouse",
    title: "Lumenfold motion demo",
    blurb: "A scroll-driven launch page for a made-up desk lamp: a pinned dusk-to-night scene and a shared-element finish picker.",
    stack: "Next.js · Motion · Tailwind CSS",
    links: [],
    angle: 10,
  },
  {
    id: "recipes",
    name: "Recipe Finder",
    landmark: "Carinderia",
    title: "Recipe Finder app",
    blurb: "A Flutter app that searches a recipe API, with loading, empty and error states and saved favourites.",
    stack: "Flutter · Dart · REST API",
    links: [{ label: "Code", href: "https://github.com/ianquilatanwe/recipe-finder-flutter" }],
    angle: -70,
  },
  {
    id: "about",
    name: "Pier",
    landmark: "Pier",
    title: "About Ian",
    blurb: "Frontend developer in the Philippines (UTC+8). Figma to UI, bug fixes, API wiring and responsive layouts, in React, Next.js and Flutter.",
    stack: "React · Next.js · TypeScript · Tailwind CSS · Flutter",
    links: [{ label: "GitHub", href: "https://github.com/ianquilatanwe" }],
    angle: -140,
  },
];
