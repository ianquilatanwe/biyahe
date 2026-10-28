/**
 * The island's layout rules, shared by the drawing (Island.tsx) and the logic (driving,
 * and later proximity and tap-to-go). Angles are world angles: atan2(z, x).
 */
export const ISLAND_RADIUS = 27; // sand edge before the wobble
export const GRASS_RADIUS = 21.5;
export const STOP_RADIUS = 19;

/** Same "random" every load, so the coastline never changes shape between visits. */
export function wobble(angle: number) {
  return Math.sin(angle * 3) * 0.9 + Math.sin(angle * 7 + 1.3) * 0.5;
}

/** Distance from the centre to the water's edge in this direction. */
export function coastRadius(angle: number) {
  return ISLAND_RADIUS + wobble(angle);
}

/** Where a stop sits on the ground (x, z). Its angle is in degrees, 0 = towards the camera (+z). */
export function stopPosition(angleDegrees: number): [number, number] {
  const a = (angleDegrees * Math.PI) / 180;
  return [Math.sin(a) * STOP_RADIUS, Math.cos(a) * STOP_RADIUS];
}
