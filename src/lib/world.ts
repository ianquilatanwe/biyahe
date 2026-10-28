/**
 * The island's layout rules, shared by the drawing (Island.tsx) and the logic (driving,
 * proximity, tap-to-drive). Angles are world angles: atan2(z, x).
 */
import { stops } from "./stops.ts";

export type Point = { x: number; z: number };
export type Circle = Point & { r: number };

export const ISLAND_RADIUS = 27; // sand edge before the wobble
export const GRASS_RADIUS = 21.5;
export const STOP_RADIUS = 19; // landmarks sit on this ring
export const OPEN_RADIUS = 7; // how close to a landmark the "Open" prompt appears

/** Same "random" every load, so the coastline never changes shape between visits. */
export function wobble(angle: number) {
  return Math.sin(angle * 3) * 0.9 + Math.sin(angle * 7 + 1.3) * 0.5;
}

/** Distance from the centre to the water's edge in this direction. */
export function coastRadius(angle: number) {
  return ISLAND_RADIUS + wobble(angle);
}

/** Where a stop's landmark sits. Its angle is in degrees, 0 = towards the camera (+z). */
export function stopPosition(angleDegrees: number, radius = STOP_RADIUS): Point {
  const a = (angleDegrees * Math.PI) / 180;
  return { x: Math.sin(a) * radius, z: Math.cos(a) * radius };
}

/**
 * Each landmark's footprint as a circle the jeepney bumps into: `out` is how far its centre sits past the
 * stop ring towards the sea, `r` its radius. Keep in step with the models in Landmarks.tsx.
 * Rule of thumb: out + 4.5 (parking distance) - r must stay above 1.3 (the jeepney) + 2.5 (arrive radius).
 */
export const FOOTPRINTS: Record<string, { out: number; r: number }> = {
  fashionhub: { out: 1.6, r: 2.4 }, // store, awning and clothes rack
  sprig: { out: 1.6, r: 2.5 }, // shade house and benches of pots
  lumenfold: { out: 1.4, r: 1.9 }, // lighthouse on its rock base
  recipes: { out: 1.6, r: 2.4 }, // eatery roof, counter and stools
  about: { out: 0.6, r: 1.5 }, // the pier's gate posts; the pier itself runs out over the water
};

/** What the jeepney bumps into: one circle per stop's landmark. Driving, tap targets and the check all use this. */
export const LANDMARKS: Circle[] = stops.map((s) => {
  const { out, r } = FOOTPRINTS[s.id];
  return { ...stopPosition(s.angle, STOP_RADIUS + out), r };
});

/** Props off the stops that the jeepney bumps into too: the waiting shed on the far side. Drawn in Landmarks.tsx. */
export const SHED = { angle: -105, radius: STOP_RADIUS + 1 };
export const PROPS: Circle[] = [{ ...stopPosition(SHED.angle, SHED.radius), r: 1.5 }];

/** Everything the jeepney bumps into: landmarks first (same order as stops), then props. */
export const OBSTACLES: Circle[] = [...LANDMARKS, ...PROPS];

/** Where the jeepney parks for a stop: on the island side of the landmark, facing it. */
export function parkingSpot(angleDegrees: number): Point {
  return stopPosition(angleDegrees, STOP_RADIUS - 4.5);
}

/** The stop whose landmark is within `within` of (x, z), nearest first, or null. */
export function nearestStop<T extends { angle: number }>(x: number, z: number, list: readonly T[], within = OPEN_RADIUS): T | null {
  let best: T | null = null;
  let bestD = within;
  for (const s of list) {
    const p = stopPosition(s.angle);
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}
