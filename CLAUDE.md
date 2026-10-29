# Biyahe: coding principles

Ian's 3D portfolio home: drive a jeepney round a small town by the bay to six project stops. On `main` it is still the
island (live); the town is built on the `town` branch in four phases (plan: `docs/town-plan.html`), all four done.
Next.js 15 + React 19 + three 0.186 + @react-three/fiber 9.8 + drei 10.7. Ian doesn't model:
everything is built from code primitives (Ian chose code over Blender for the jeepney on 2026-10-28). Distilled from the `threejs-react-three-fiber`,
`threejs-performance`, `camera-systems` and `codebase-design` skills; load them for detail.

## Structure
- **Rules live in `src/lib`, drawing lives in `src/components/world`.** Anything the game decides
  (driving, shoreline, stop positions, proximity, tap-to-go targets) is a pure function in `src/lib`
  with no three.js or React, and has a `*.check.ts` beside it (`node src/lib/<name>.check.ts`).
  Components only draw and wire input.
- **One source of truth for layout:** the street grid (`STREETS`, `BLOCKS`, `EDGE`, `SHORE_Z`), the block colliders
  (`BLOCK_BOXES`), each stop's `site()` (block + the side it faces → kerb front, model origin, yaw, parking spot) and
  the sign/click circles (`FOOTPRINTS` → `LANDMARKS`) and the plot each stop claims (`lot` → `LOTS`, which the town's
  shophouses leave empty) live in `src/lib/world.ts`. Change a model in `Landmarks.tsx`,
  change its footprint too, then run the check (it drives the real town).
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
  merged into ONE mesh with the colour in each vertex. The town's buildings (`Town.tsx`), the stops and their props
  (`Landmarks.tsx`) and the jeepney body cost 2 draw calls each this way (parts + shadows); the whole frame is ~27.
  Ordinary buildings come from one seeded generator, `shophouse.ts` (`Town.tsx` lays out the plots). A north-row shop
  faces away from the camera, so it's built with `front: false` (roof and back windows only); the edge row uses `low`.
  Small details there use plain `BoxGeometry` (12 triangles, not a bevelled box's 108). Only animated, unlit,
  textured (the jeepney's side art) or clickable ground parts (the road ring) are separate meshes.
- **Detail lives in Batch's helpers**, so every model gets it: `box` bevels its edges (RoundedBoxGeometry, 1 segment;
  bars under 3 cm stay plain), `cyl`/`cone` double the sides they're given (3–4-sided shapes like flags stay), balls are
  12×8, rocks are subdivided and chipped. ~113k triangles a frame (was ~14k) at 60 fps; draw calls unchanged, since it
  all still merges into one mesh. Triangles are cheap here; draw calls and full-screen passes are what cost on phones.
- Baked shading lives in `Batch.add`: vertices darken towards the ground (fake ambient occlusion). Flat ground pieces
  (court lines, slabs) go inside `b.flat(...)`, floating things use `<Batched ao={false}>`, or they turn grey.
- Soft shadows: `b.shadow(at, size, height)` inside a build adds a blurred disc, offset away from the sun; all of a
  batch's shadows are one transparent mesh. Moving things use `<SoftShadow>`.
- The jeepney bumps into `OBSTACLES` (world.ts): the block rectangles, kerb to kerb. Props on sidewalks sit inside a
  block, so the kerb covers them; anything standing in a street needs its own circle there. `LANDMARKS` (sign and click
  anchors, not colliders) stays index-aligned with `stops`. Against boxes the jeepney is one 1.3 m circle (its nose may
  hang over a sidewalk); against circles (the traffic) it's three (`BODY` in driving.ts), or its nose swings through a tricycle.
- **Traffic** (`src/lib/traffic.ts`, drawn by `Traffic.tsx`, stepped by the Driver before the jeepney): 3 tricycles and
  2 jeepneys on fixed loops (`TRACKS`, lane positions 2 m right of a street's middle, corners rounded). Each rides its
  track like a train and only picks a speed: it stops short of any body on its track ahead, takes turns at `ZONES` (the
  crossings and the terminal's gate; a claim is remade every tick, and only when nobody is queued in front, or the back
  of a queue holds a crossing the front waits for), and, held up by the visitor for 2 s, toots and pulls round along
  the street's middle (`PASS_SHIFT` 2.05: clears a parked jeepney and the oncoming lane), never sideways into anybody
  (`fits`). Shared lanes always run the same way. The autopilot queues behind traffic going its way and steers round
  traffic that isn't (that traffic has stopped for it). Reduced motion takes the traffic off the streets and keeps the
  terminal's jeepney parked. `node src/lib/traffic.check.ts` runs it alone for 10 min, parked at every stop, and with
  300 tap trips: no overlaps, no jams. Each kind is one `Fleet` (instanced `Batched` model, Batched.tsx): 2 draw calls
  per kind. `weathered()` handles `instanceMatrix`, so the clouds pass over instanced copies too.
- Click areas are invisible meshes (`<meshBasicMaterial visible={false} />`): raycast, but no draw call.
- **The camera turns in quarter turns** (⟲/⟳ buttons and `,` `.`; `turns` ref → the Driver eases `heading`), north
  by default. The layout still favours north (stops face south or sideways, tall things in the north row, the south
  row low), but every side is now seen: whatever the north view never showed comes from shophouse.ts's second random
  stream (`Detail.extra`), so adding it never reshuffles the town. Past the edge rows, cheap `farHouse` rows run out to
  the fog. The camera's aim stops `FOCUS_EDGE` short of the edge on its own side. Whatever stands between the camera
  and the jeepney is dithered away by `fade` on `Batched` (`FOCUS` in weather.ts): a circle `tuning.fadeRadius` metres
  round the jeepney, projected by depth, so it fits at any zoom.
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
- The sky is never in frame (the camera looks ~41° down; the sea or the far town fills the top of the screen), so "sky" effects
  have to land on the ground or the water.
- In shaders, vary colour by multiplying, not adding: a channel pushed below zero turns into NaN blotches
  after the sRGB step. The sea's foam breaks along the seawall at `SHORE_Z`.
- No real-time shadows: fake soft shadows with a dark transparent disc.
- Measure with `renderer.info.render.calls` before optimising; merge or instance static props when
  the count climbs (town budget: ≤ 60 draw calls, ≤ 400k triangles; phase 4 is ~33 and ~293k). Count instanced draws
  too (`drawElementsInstanced`): `tmp/biyahe/tris.mjs` does.
- No new texture or model files unless they're small (whole scene under 1 MB of assets).

## The HTML layer (signboard style)
- Every HTML piece is jeepney signage: `sign` (yellow plate, ink rim, ink ledge it presses into), `sign-red` (the one
  action that matters most on a screen), `plate` (a label that doesn't press), red "Stop N · landmark" strips.
  No frosted glass, pills or plain card grids. Tokens in `globals.css`; red lettering on yellow uses `red-deep` (plain red is 3.8:1).
- One project ticket, `StopDetails`, is both the island's card and the route board's card, so they can't drift apart.
- External links always open in a new tab (Ian's call) with "(opens in a new tab)" for screen readers.
- In-world signs (`StopSigns`) are drei `<Html>` with an explicit `portal`: without it `<Html>` follows fiber's event
  target, which changes after the first render, and the first sign came up empty. Layers: signs z 1–8, loader z 9,
  controls z 10, header z 20.
- Taps and stop trips show `TapMarker` chevrons. The autopilot follows the streets: `route()` takes the shortest way
  through the 16 intersections (`CROSSINGS`) and aims at the furthest point on it in plain sight (`clearLine`), braking
  for the corner after it. A tap on a building or sidewalk drives to the street in front (`reachable`).
  `driving.check.ts` runs 200 awkward stop trips, 500 seeded random taps (97% must arrive, 95% within 12 s) and trips
  starting pressed against every kerb (98%). Trips give up after 20 s (`GIVE_UP_AFTER`, same in the check).
  Bumps only cost the head-on part of the speed, so a jeepney sliding along a wall can still steer.
- The card's close button fills the red strip's height and sits by the dialog's edge, which clips anything outside it:
  its focus ring is drawn inside the button (yellow, inset), not the page's outer ring plus halo.
- In-world sign tails keep their base flat on the plate edge and lean only the tip (CSS skew); rotating the whole
  tail lifts one end of the base off the plate.
- Signs stay below the header by measuring it (`data-hud-header`, a ResizeObserver): it wraps to two rows on phones
  and at 768. Off-screen signs that would land on each other step along their edge (`spots` in `StopSigns.tsx`).
- **What the north camera sees of a stop when parked:** its facade up to ~8 m, nothing behind the roof's front edge. So moving
  or landmark roof parts sit at the front of the roof (Lumenfold's lamp reaches out over the sidewalk; Bagyo's dome and
  radar are at the roof's front), and the two sideways-facing stops (Sprig, Recipe Finder) carry a second sign on the
  side wall the camera sees. Stop facades stand on `FRONT` (2 m back from the kerb, level with the shophouses).
- Shop signs with words are `makeRouteSign` planes (`SIGNS` in `Landmarks.tsx`, one draw call each); Bagyo's
  `SignalBoard` steps Signal No. 1 → 5 while you're parked there.
- Electric poles and wires run only along north–south streets: east–west wires cut across the screen in front of the
  jeepney in the default view (turned east or west, the north–south ones do; the fade thins them over the jeepney).
  Poles keep 6 m clear of every stop's front.

## Sound
- `src/lib/sound.ts` is one module-level engine (Web Audio, no files): engine, sea, horn, and the town bed (far traffic
  rumble, the odd distant horn every 7–20 s, plaza chatter by distance to the plaza, `toot()` from held-up traffic);
  every horn goes through `beep()`. Ian liked the idle as it is:
  the moving layers (gears, sub-octave chug, exhaust, tyres) all fall back to zero when parked, so idle never changes.
  Never chop a signal with a square wave after its last filter, and keep sub-bass oscillators triangle/sine: hard
  edges there are the clicks Ian heard as "broken speaker" spikes (clip B). A/B listening: `catalog-video/tmp/biyahe/drive-audio.mjs` records a fixed drive to mp3 (clips in `sound-review/`, gitignored; `PARK=s` stays
  parked at the end). It blurs the sound button after clicking it: Space presses a focused button, and in clips A–C it
  switched the sound off halfway (they stop at ~17 s). Horn edges show as sample jumps; count clicks outside the horns. On by default, but no
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
