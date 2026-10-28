# Biyahe: coding principles

Ian's 3D portfolio home: drive a jeepney around an island to five project stops.
Next.js 15 + React 19 + three 0.186 + @react-three/fiber 9.8 + drei 10.7. Ian doesn't model:
everything is built from code primitives. Distilled from the `threejs-react-three-fiber`,
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
- Use `paint(color)` for low-poly parts: one shared Lambert material per colour.
- **Static parts go through `Batched`** (`components/world/Batched.tsx`): a build function adds boxes, cylinders,
  rocks, and they're merged into one mesh per colour. The whole island (5 landmarks, 12 palms, rocks, props) and
  the jeepney body cost about 30 draw calls this way. Only animated or unlit parts are separate meshes.
- Click areas are invisible meshes (`<meshBasicMaterial visible={false} />`): raycast, but no draw call.
- Tall things go on the far side of the island (angles near ±180): the camera looks from +z, so a tall
  landmark on the near side hides the jeepney parked at it.
- In shaders, vary colour by multiplying, not adding: a channel pushed below zero turns into NaN blotches
  after the sRGB step. The sea's foam uses the same `wobble()` formula as `world.ts`; keep them in step.
- No real-time shadows: fake soft shadows with a dark transparent disc.
- Measure with `renderer.info.render.calls` before optimising; merge or instance static props when
  the count climbs (target under ~150 draw calls on the whole island).
- No new texture or model files unless they're small (whole island under 1 MB of assets).

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
- Keys only drive while the island is on screen; arrows scroll the page otherwise.

## Process
- Four-day time box with a clip after each day; follow `~/upwork/CLAUDE.md` (no unannounced
  dependencies, plain-words explanations, ui-standards before "done").
