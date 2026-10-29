# Biyahe: coding principles

Ian's 3D portfolio home: drive a jeepney around an island to six project stops.
Next.js 15 + React 19 + three 0.186 + @react-three/fiber 9.8 + drei 10.7. Ian doesn't model:
everything is built from code primitives (Ian chose code over Blender for the jeepney on 2026-10-28). Distilled from the `threejs-react-three-fiber`,
`threejs-performance`, `camera-systems` and `codebase-design` skills; load them for detail.

## Structure
- **Rules live in `src/lib`, drawing lives in `src/components/world`.** Anything the game decides
  (driving, shoreline, stop positions, proximity, tap-to-go targets) is a pure function in `src/lib`
  with no three.js or React, and has a `*.check.ts` beside it (`node src/lib/<name>.check.ts`).
  Components only draw and wire input.
- **One source of truth for layout:** island sizes, `wobble()`, `stopPosition()` and the landmark colliders
  (`FOOTPRINTS` → `LANDMARKS`) live in `src/lib/world.ts`. Change a model in `Landmarks.tsx`, change its footprint
  too, then run the check (its autopilot sweep uses the real stops and colliders).
  The drawing and the logic both import them, so what you see is where things collide.
- **Content in `src/lib/stops.ts`.** The 3D stops and the HTML project list read the same data.

- **Feel numbers live in `src/lib/tuning.ts`.** In `npm run dev` a Leva panel edits them live (dev-only:
  `IslandExperience` loads `TuningPanel` behind `NODE_ENV === "development"`, so leva never ships).
  New feel constants go there, with a range in `TuningPanel.tsx`.
- **The frame loop owns the game, React owns the HUD.** Shared state crosses once per change:
  the destination is a ref the loop reads; the loop calls `onNear`/`onArrive` only when they change.
- Browser tests run a production build in its own folder, so `next dev` (on `.next`) can stay open:
  `npm run build:test`, then the `biyahe-test` launch config (`npm run start:test`, port 3310).
  Never run a plain `npm run build` while `next dev` is open: it overwrites dev's `.next` and dev starts
  failing with "X is not a function". A server started from Bash outlives TaskStop on Windows; use the launch config.
  For quick visual iteration, `npm run dev:test` (`biyahe-dev-test`, port 3320) hot-reloads on the same `.next-test`
  folder: stop it before `build:test`, since they share that folder.

## The frame loop
- Per-frame changes go through refs inside `useFrame`; never `setState` in the loop.
- Move by `delta` (clamped, see `Driver`); smooth with `1 - Math.exp(-rate * dt)` or `MathUtils.damp`,
  never a fixed `lerp(a, b, 0.1)`, which feels different at every frame rate.
- No allocations in the loop: reuse vectors created with `useMemo`/module scope.
- Read time from `state.clock.elapsedTime`, never `getElapsedTime()`. The THREE.Clock deprecation
  warning comes from fiber 9.8 itself; ignore it.
- The camera updates after the jeepney moves, in the same frame callback.

## Rendering and performance (phones first)
- Canvas stays `flat` (no tone mapping, so the palette matches its hex values), `dpr` capped at 1.75
  (drei's `PerformanceMonitor` drops it to 1 if a device can't hold ~50 fps), and `frameloop="never"` while the
  island is scrolled away.
- Use `paint(color)` for the few separate low-poly meshes (wheels, ground): one shared Lambert material per colour.
- **Static parts go through `Batched`** (`components/world/Batched.tsx`): a build function adds boxes, cylinders,
  rocks and extruded side-view outlines (`sideways()` in `Jeepney.tsx`: curved fenders, wheel arches), and they're
  merged into ONE mesh with the colour in each vertex. The whole island (6 landmarks, palms, props, tufts) and the
  jeepney body cost 2 draw calls each this way (parts + shadows); the whole frame is ~30. Only animated, unlit,
  textured (the jeepney's side art) or clickable ground parts (the road ring) are separate meshes.
- **Detail lives in Batch's helpers**, so every model gets it: `box` bevels its edges (RoundedBoxGeometry, 1 segment;
  bars under 3 cm stay plain), `cyl`/`cone` double the sides they're given (3–4-sided shapes like flags stay), balls are
  12×8, rocks are subdivided and chipped. ~113k triangles a frame (was ~14k) at 60 fps; draw calls unchanged, since it
  all still merges into one mesh. Triangles are cheap here; draw calls and full-screen passes are what cost on phones.
- Baked shading lives in `Batch.add`: vertices darken towards the ground (fake ambient occlusion). Flat ground pieces
  (court lines, slabs) go inside `b.flat(...)`, floating things use `<Batched ao={false}>`, or they turn grey.
- Soft shadows: `b.shadow(at, size, height)` inside a build adds a blurred disc, offset away from the sun; all of a
  batch's shadows are one transparent mesh. Moving things use `<SoftShadow>`.
- Props the jeepney should bump into go in `PROPS` (world.ts); driving, taps and the check use `OBSTACLES`
  (landmarks + props). `LANDMARKS` stays index-aligned with `stops`.
- Click areas are invisible meshes (`<meshBasicMaterial visible={false} />`): raycast, but no draw call.
- Tall things go on the far side of the island (angles near ±180): the camera looks from +z, so a tall
  landmark on the near side hides the jeepney parked at it.
- **Weather lives in the shaders** (`weather.ts`): `weathered(material)` adds cloud shadows to a built-in material;
  `VERTEX_PAINT` also sways what a build adds inside `b.sway(k, power, fn)` (k · distance^power from the current frame's
  origin: a palm's foot, a flag's hoist). All of it, plus the sea and the beam's dust, runs on one clock, `WIND`,
  advanced in `Landmarks` and frozen under reduced motion. New Lambert materials go through `paint()` or `weathered()`
  so the clouds pass over them too.
- **Surface detail is in the shader too** (`surfaces.ts`, no image files): a Batched part picks its surface from its paint
  colour (`SURFACE_OF`; a new colour is plain paint until it's listed there) and carries its own coordinates in metres,
  u along its longest side; the ground picks by colour (`GROUND_OF`) and uses world x/z. Patterns only multiply
  brightness, and fade out (`surfFine`) before they get finer than a few pixels: the camera sees ~50 px per metre,
  so keep detail at or below ~12 cycles per metre or it shimmers, then vanishes.
- The sky is never in frame (the camera looks ~31° down; the sea fills the top of the screen), so "sky" effects
  have to land on the ground or the water.
- In shaders, vary colour by multiplying, not adding: a channel pushed below zero turns into NaN blotches
  after the sRGB step. The sea's foam uses the same `wobble()` formula as `world.ts`; keep them in step.
- No real-time shadows: fake soft shadows with a dark transparent disc.
- Measure with `renderer.info.render.calls` before optimising; merge or instance static props when
  the count climbs (target under ~150 draw calls on the whole island).
- No new texture or model files unless they're small (whole island under 1 MB of assets).

## The HTML layer (signboard style)
- Every HTML piece is jeepney signage: `sign` (yellow plate, ink rim, ink ledge it presses into), `sign-red` (the one
  action that matters most on a screen), `plate` (a label that doesn't press), red "Stop N · landmark" strips.
  No frosted glass, pills or plain card grids. Tokens in `globals.css`; red lettering on yellow uses `red-deep` (plain red is 3.8:1).
- One project ticket, `StopDetails`, is both the island's card and the route board's card, so they can't drift apart.
- External links always open in a new tab (Ian's call) with "(opens in a new tab)" for screen readers.
- In-world signs (`StopSigns`) are drei `<Html>` with an explicit `portal`: without it `<Html>` follows fiber's event
  target, which changes after the first render, and the first sign came up empty. Layers: signs z 1–8, loader z 9,
  controls z 10, header z 20.
- Taps and stop trips show `TapMarker` chevrons; the autopilot plans round landmarks with `aimPoint` (tangent points).
  `driving.check.ts` runs 500 seeded random taps and fails if fewer than 97% arrive or the slowest 5% exceed 6.5 s,
  plus trips from right beside each landmark to its far side (98% must arrive).
  Every landmark's back (the strip to the sea) is too narrow to drive: `aimPoint` never plans round it, and a tap in
  its shadow parks in front. Bumps only cost the head-on part of the speed, so a jeepney sliding along a wall can still steer.
- The card's close button fills the red strip's height and sits by the dialog's edge, which clips anything outside it:
  its focus ring is drawn inside the button (yellow, inset), not the page's outer ring plus halo.
- In-world sign tails keep their base flat on the plate edge and lean only the tip (CSS skew); rotating the whole
  tail lifts one end of the base off the plate.

## Sound
- `src/lib/sound.ts` is one module-level engine (Web Audio, no files): engine, sea, horn. Ian liked the idle as it is:
  the moving layers (gears, sub-octave chug, exhaust, tyres) all fall back to zero when parked, so idle never changes.
  Never chop a signal with a square wave after its last filter, and keep sub-bass oscillators triangle/sine: hard
  edges there are the clicks Ian heard as "broken speaker" spikes (clip B). A/B listening: `catalog-video/tmp/biyahe/drive-audio.mjs` records a fixed drive to mp3 (clips in `sound-review/`, gitignored). On by default, but no
  AudioContext exists until the first click/tap/key (`SoundToggle` in the header); paused while the island is
  scrolled away or the tab is hidden. The frame loop feeds it numbers (`sound.update`), at most 20 updates a second.

## Accessibility and fallback
- The HTML comes first: the name, the skip link and the full project list render without WebGL or JS.
- The canvas wrapper is `aria-hidden`; nothing focusable may live inside it.
- The header comes before the island in the source, so "Skip the island" is the first Tab stop.
- `<Loading>` covers the island until its second frame; `IslandBoundary` swaps in the plain message if the
  3D code fails to load, there's no WebGL (the renderer throws), or it crashes, so the loader can never get stuck.
  It also hides the on-screen controls, which would drive a jeepney that isn't there.
- Don't put logic in `<Canvas fallback>`: fiber always mounts it (as the `<canvas>` element's children), so its
  effects run on every load, WebGL or not.
- Stop buttons announce the drive in a polite live region; the card takes focus when it opens.
- Every stop is reachable without driving skill (stop list buttons, from day 2).
- Reduced motion (`useCalm`, read live): no bounce, lean, look-ahead or ambient animation.
- Keys only drive while the island is on screen; arrows and Space scroll the page otherwise. Space brakes, except on a
  focused button or link, where it presses it.
- The in-world signs are mouse/touch only (no focus inside the aria-hidden wrapper); the keyboard gets the stop buttons,
  E, and an Open button that is visually hidden until focused.

## Process
- Four-day time box with a clip after each day; follow `~/upwork/CLAUDE.md` (no unannounced
  dependencies, plain-words explanations, ui-standards before "done").
