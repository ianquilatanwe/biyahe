import { WorldLoader } from "@/components/world/WorldLoader";
import { stops } from "@/lib/stops";

export default function Home() {
  return (
    <main>
      {/* The island fills the first screen. Everything on it is also in the list below. */}
      <section aria-labelledby="title" className="relative h-svh overflow-hidden bg-sky">
        <WorldLoader />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
          <div className="panel pointer-events-auto px-4 py-3">
            <h1 id="title" className="font-display text-2xl font-semibold leading-none sm:text-3xl">
              Biyahe
            </h1>
            <p className="mt-1 text-sm text-muted">A portfolio by Ian Quilatan, frontend developer</p>
          </div>
          <a href="#projects" className="btn-primary pointer-events-auto">
            Skip the island
          </a>
        </div>
        <p className="panel absolute bottom-4 left-1/2 hidden -translate-x-1/2 px-4 py-2 text-sm md:block">
          Drive with <kbd className="font-semibold">W A S D</kbd> or the arrow keys
        </p>
      </section>

      <section id="projects" aria-labelledby="projects-title" className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
        <h2 id="projects-title" className="font-display text-4xl font-semibold text-sea">
          Projects
        </h2>
        <p className="mt-2 max-w-xl text-muted">Every stop on the island, without the drive.</p>
        <ul className="mt-8 grid gap-5 md:grid-cols-2">
          {stops.map((s) => (
            <li key={s.id} className="rounded-2xl border border-edge bg-white p-6">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted">{s.landmark}</p>
              <h3 className="mt-1 font-display text-2xl font-semibold">{s.title}</h3>
              <p className="mt-2">{s.blurb}</p>
              <p className="mt-3 text-sm text-muted">{s.stack}</p>
              {s.links.length > 0 && (
                <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                  {s.links.map((l) => (
                    <a key={l.href} href={l.href} className="inline-flex min-h-11 items-center font-semibold text-red underline underline-offset-4">
                      {l.label} <span className="sr-only">for {s.title}</span>
                    </a>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
