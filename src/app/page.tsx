import { IslandExperience } from "@/components/IslandExperience";
import { DownIcon, OutIcon } from "@/components/ui/icons";
import { EndFlag, Road, Stripes } from "@/components/ui/RoadPaint";
import { SoundToggle } from "@/components/ui/SoundToggle";
import { StopDetails } from "@/components/ui/StopDetails";
import { stopLabel, stops, UPWORK } from "@/lib/stops";

const projects = stops.filter((s) => s.id !== "about");
const about = stops.find((s) => s.id === "about")!;

/** The left column of the route: stop markers sit on it, and the road runs down its middle. */
const ROUTE_COLS = "grid grid-cols-[2.75rem_1fr] gap-3 sm:grid-cols-[3.25rem_1fr] sm:gap-6";
const ROAD = "absolute left-[1.375rem] w-3 -translate-x-1/2 bg-ink sm:left-[1.625rem] sm:w-4";

export default function Home() {
  return (
    <>
      <main>
        {/* The island fills the first screen. Everything on it is also on the route board below. */}
        <section aria-labelledby="title" className="relative h-svh overflow-hidden bg-sky">
          {/* The header comes first in the source so "List" is the first Tab stop; z-20 keeps it above the island's signs,
              which measure it (data-hud-header) to stay below it. */}
          <div data-hud-header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-1.5 p-2.5 sm:gap-2 sm:p-5">
            {/* The route plate on a jeepney's windscreen: where it's going, then who's driving. */}
            <div className="plate pointer-events-auto min-h-10 gap-2 py-1 pr-2.5 pl-2 shadow-[0_3px_0_var(--color-ink)] sm:gap-2.5 sm:pr-3 sm:pl-2.5">
              <h1 id="title" className="text-xl leading-none text-red-deep">
                Biyahe
              </h1>
              <span aria-hidden="true" className="h-5 w-0.5 bg-ink" />
              <p className="text-sm leading-tight font-medium">
                Ian Joseph Quilatan<span className="hidden sm:inline">, frontend developer</span>
              </p>
            </div>
            <div className="pointer-events-auto flex gap-1.5 sm:gap-2">
              <a href="#projects" className="sign min-h-10 gap-1 bg-paper px-2 text-sm sm:gap-1.5 sm:px-3">
                <span className="sm:hidden">List</span>
                <span className="hidden sm:inline">Project list</span>
                <DownIcon />
                <span className="sr-only"> (skip the island)</span>
              </a>
              <a href={UPWORK} target="_blank" rel="noopener noreferrer" className="sign-red min-h-10 gap-1 px-2.5 text-sm sm:gap-1.5 sm:px-3">
                <span className="sm:hidden">Hire me</span>
                <span className="hidden sm:inline">Hire me on Upwork</span>
                <OutIcon />
                <span className="sr-only"> (Upwork, opens in a new tab)</span>
              </a>
              {/* Last, so "skip the island" stays the first Tab stop. */}
              <SoundToggle />
            </div>
          </div>
          <IslandExperience />
        </section>

        {/* The route board: the island's road runs off the bottom of the island and down past every stop to the pier. */}
        <section id="projects" aria-labelledby="projects-title">
          <Stripes />
          <div aria-hidden="true" className="h-7 bg-ink">
            <Road className="h-full w-full" />
          </div>

          <div className="mx-auto max-w-5xl px-4 pt-14 sm:px-8">
            <h2 id="projects-title" className="plate px-5 py-1.5 text-3xl text-red-deep shadow-[0_4px_0_var(--color-ink)] sm:text-4xl">
              Projects
            </h2>
            <p className="mt-4 max-w-xl text-lg text-pretty">
              Every stop on the island loop, in order, without the drive. The route ends at the pier.
            </p>

            {/* pb-20 lets the road carry on past the last card, down into the pier. */}
            <ol className="relative mt-12 grid gap-12 pb-20 sm:gap-16">
              <div aria-hidden="true" className={`${ROAD} top-0 bottom-0 rounded-t-full`}>
                <Road vertical className="h-full w-full" />
              </div>
              {projects.map((s, i) => (
                <li key={s.id} className={`relative ${ROUTE_COLS}`}>
                  <span
                    aria-hidden="true"
                    className="plate relative mt-2 grid size-11 place-items-center rounded-full text-xl shadow-[0_3px_0_var(--color-ink)] sm:size-13 sm:text-2xl"
                  >
                    {i + 1}
                  </span>
                  <article className="overflow-hidden rounded-xl border-[3px] border-ink bg-paper shadow-[0_6px_0_var(--color-ink)]">
                    <StopDetails stop={s} label={stopLabel(s)} heading="h3" wide />
                  </article>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      {/* The last stop: the pier, out over the sea. The road crosses the jeepney stripes and ends at the flag. */}
      <footer className="bg-sea text-white">
        <Stripes />
        <div className="mx-auto max-w-5xl px-4 sm:px-8">
          <div className={`relative ${ROUTE_COLS}`}>
            <div aria-hidden="true" className={`${ROAD} top-0 h-14`}>
              <Road vertical className="h-full w-full" />
            </div>
            <span
              aria-hidden="true"
              className="plate relative mt-12 grid size-11 place-items-center rounded-full bg-red text-white shadow-[0_3px_0_var(--color-ink)] sm:size-13"
            >
              <EndFlag />
            </span>
            <div className="grid gap-8 pt-12 pb-16 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <h2 className="font-display text-4xl font-semibold sm:text-5xl">{about.title}</h2>
                <p className="mt-3 max-w-xl text-lg text-pretty text-white/90">{about.blurb}</p>
                <p className="mt-3 text-sm text-white/75">{about.stack}</p>
              </div>
              <p className="flex flex-wrap gap-3">
                {about.links.map((l) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={l.primary ? "sign-red" : "sign bg-paper"}>
                    {l.label}
                    <OutIcon />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ))}
              </p>
            </div>
          </div>
        </div>
        <p className="mx-auto max-w-5xl border-t-2 border-white/20 px-4 py-6 text-sm text-white/75 sm:px-8">
          Biyahe is built in code: Next.js and three.js, no 3D model files. Everything on the island is also on this page.
        </p>
      </footer>
    </>
  );
}
