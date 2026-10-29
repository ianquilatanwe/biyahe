/**
 * The town's layout rules, shared by the drawing (Town.tsx, Landmarks.tsx) and the logic (driving,
 * proximity, tap-to-drive). x runs east, z runs south (towards the camera); the bay is to the north.
 *
 * A 3 × 3 grid of blocks with 8 m streets between and around them. The outer streets are the edge of the
 * drivable square; the northern one is the bay boulevard, with the promenade and the seawall beyond it.
 */
import { stops } from "./stops.ts";

export type Point = { x: number; z: number };
export type Circle = Point & { r: number };
/** An axis-aligned rectangle: centre and half sizes. Blocks are these. */
export type Box = Point & { hx: number; hz: number };
export type Obstacle = Circle | Box;

/** Street centre lines, the same both ways: x for north–south streets, z for east–west ones. */
export const STREETS = [-33, -11, 11, 33];
export const STREET_HALF = 4; // half a street's width, kerb to kerb
/** Block centres, both ways. A block is kerb to kerb, sidewalks included. */
export const BLOCKS = [-22, 0, 22];
export const BLOCK_HALF = 7;
/** The drivable square: the outer streets' outer kerbs. */
export const EDGE = 37;
/** The seawall: the promenade runs from the boulevard's kerb (z = -EDGE) to here, the sea is north of it. */
export const SHORE_Z = -41;
export const OPEN_RADIUS = 7; // how close to a stop's shopfront the "Open" prompt appears

/** The blocks as colliders. The jeepney drives on the streets; the kerb is the wall. */
export const BLOCK_BOXES: Box[] = BLOCKS.flatMap((z) => BLOCKS.map((x) => ({ x, z, hx: BLOCK_HALF, hz: BLOCK_HALF })));

/** Every street intersection: the autopilot's road map. */
export const CROSSINGS: Point[] = STREETS.flatMap((z) => STREETS.map((x) => ({ x, z })));

type Face = "n" | "s" | "e" | "w";
const FACING: Record<Face, Point> = { n: { x: 0, z: -1 }, s: { x: 0, z: 1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } };

/**
 * Where each stop stands: its block, and the street side its shopfront faces. The camera always looks north, so
 * fronts face south (or sideways): a shop facing north is only ever seen from behind.
 */
const SITES: Record<string, { block: Point; face: Face }> = {
  fashionhub: { block: { x: 0, z: 22 }, face: "s" }, // south row, facing the south street
  sprig: { block: { x: -22, z: 0 }, face: "e" },
  lumenfold: { block: { x: 22, z: -22 }, face: "s" }, // north row: tall things go on the far side from the camera
  bagyo: { block: { x: -22, z: -22 }, face: "s" },
  recipes: { block: { x: 22, z: 0 }, face: "w" },
  about: { block: { x: 0, z: -22 }, face: "s" }, // the terminal, facing the plaza; its yard runs back to the bay boulevard and the pier
};

/** How far a landmark's frame sits back from the kerb, so its front steps and pots stand on the sidewalk. */
const SET_BACK = 0.6;

/**
 * A stop's place in the town. `front` is the middle of its kerb; models are drawn in a frame at `origin` (just behind
 * it), turned by `yaw`, with +z facing the street and -z going into the block. `park` is where the jeepney stops, on
 * the street in front.
 */
export function site(id: string) {
  const { block, face } = SITES[id];
  const d = FACING[face];
  const front = { x: block.x + d.x * BLOCK_HALF, z: block.z + d.z * BLOCK_HALF };
  const origin = { x: front.x - d.x * SET_BACK, z: front.z - d.z * SET_BACK };
  return { front, origin, facing: d, yaw: Math.atan2(d.x, d.z), park: { x: front.x + d.x * 2, z: front.z + d.z * 2 } };
}

/** Where the jeepney parks for a stop: on the street in front of it. */
export function parkingSpot(id: string): Point {
  return site(id).park;
}

/**
 * Each landmark's size as a circle, for its sign and its click area (the kerb is the wall, not this):
 * `out` is how far its centre sits behind its frame's origin, `r` its radius. Keep in step with the models in Landmarks.tsx.
 */
export const FOOTPRINTS: Record<string, { out: number; r: number }> = {
  fashionhub: { out: 1.6, r: 2.4 },
  sprig: { out: 1.6, r: 2.5 },
  lumenfold: { out: 1.4, r: 1.9 },
  bagyo: { out: 1.4, r: 2.0 },
  recipes: { out: 1.6, r: 2.4 },
  about: { out: 2.5, r: 2.6 },
};

/** Each stop's landmark as a circle, index-aligned with `stops`: where its sign floats and its click area stands. */
export const LANDMARKS: Circle[] = stops.map((s) => {
  const { origin, facing } = site(s.id);
  const { out, r } = FOOTPRINTS[s.id];
  return { x: origin.x - facing.x * out, z: origin.z - facing.z * out, r };
});

/** Everything the jeepney bumps into. Props on the sidewalks sit inside the blocks, so the kerb covers them. */
export const OBSTACLES: Obstacle[] = BLOCK_BOXES;

/** The stop whose shopfront is within `within` of (x, z), nearest first, or null. */
export function nearestStop<T extends { id: string }>(x: number, z: number, list: readonly T[], within = OPEN_RADIUS): T | null {
  let best: T | null = null;
  let bestD = within;
  for (const s of list) {
    const { front } = site(s.id);
    const d = Math.hypot(front.x - x, front.z - z);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}
