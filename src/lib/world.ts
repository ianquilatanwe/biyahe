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
export const LANDMARK_RADIUS = 1.2; // what the jeepney bumps into at each stop
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

/** What the jeepney bumps into: one circle per stop's landmark. Driving, tap targets and the check all use this. */
export const LANDMARKS: Circle[] = stops.map((s) => ({ ...stopPosition(s.angle), r: LANDMARK_RADIUS }));

/** Where the jeepney parks for a stop: on the island side of the landmark, facing it. */
export function parkingSpot(angleDegrees: number): Point {
  return stopPosition(angleDegrees, STOP_RADIUS - 4.5);
}

/** The stop whose landmark is within OPEN_RADIUS of (x, z), nearest first, or null. */
export function nearestStop<T extends { angle: number }>(x: number, z: number, list: readonly T[]): T | null {
  let best: T | null = null;
  let bestD = OPEN_RADIUS;
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
