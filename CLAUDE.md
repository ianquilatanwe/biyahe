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
- **One source of truth for layout:** island sizes, `wobble()`, `stopPosition()` live in `src/lib/world.ts`.
  The drawing and the logic both import them, so what you see is where things collide.
- **Content in `src/lib/stops.ts`.** The 3D stops and the HTML project list read the same data.

## The frame loop
- Per-frame changes go through refs inside `useFrame`; never `setState` in the loop.
- Move by `delta` (clamped, see `Driver`); smooth with `1 - Math.exp(-rate * dt)` or `MathUtils.damp`,
  never a fixed `lerp(a, b, 0.1)`, which feels different at every frame rate.
- No allocations in the loop: reuse vectors created with `useMemo`/module scope.
- Read time from `state.clock.elapsedTime`, never `getElapsedTime()`. The THREE.Clock deprecation
  warning comes from fiber 9.8 itself; ignore it.
- The camera updates after the jeepney moves, in the same frame callback.

## Rendering and performance (phones first)
- Canvas stays `flat` (no tone mapping, so the palette matches its hex values), `dpr` capped at 1.75,
  and `frameloop="never"` while the island is scrolled away.
- Use `paint(color)` for low-poly parts: one shared Lambert material per colour.
- No real-time shadows: fake soft shadows with a dark transparent disc.
- Measure with `renderer.info.render.calls` before optimising; merge or instance static props when
  the count climbs (target under ~150 draw calls on the whole island).
- No new texture or model files unless they're small (whole island under 1 MB of assets).

## Accessibility and fallback
- The HTML comes first: the name, the skip link and the full project list render without WebGL or JS.
- The canvas wrapper is `aria-hidden`; nothing focusable may live inside it.
- Every stop is reachable without driving skill (stop list buttons, from day 2).
- Reduced motion (`useCalm`, read live): no bounce, lean, look-ahead or ambient animation.
- Keys only drive while the island is on screen; arrows scroll the page otherwise.

## Process
- Four-day time box with a clip after each day; follow `~/upwork/CLAUDE.md` (no unannounced
  dependencies, plain-words explanations, ui-standards before "done").
