"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { reachable } from "@/lib/driving";
import { BLOCK_HALF, BLOCKS, EDGE, LANDMARKS, OBSTACLES, SHORE_Z, STREET_HALF, STREETS, type Point } from "@/lib/world";
import { Batched, type Batch } from "./Batched";
import { paint } from "./paint";
import { Water } from "./Water";

const ASPHALT = "#5d626d";
const SIDEWALK = "#d8cbb0";
const KERB = "#b9b2a4";
const LINE = "#fbf6ea";
const GRASS = "#8cc56b";
const SEAWALL = "#a39d90";
const STEEL = "#cfd6de";
/** Blockout greys, a little warm, so neighbouring buildings still read apart. Phase 2 paints them. */
const GREYS = ["#c9c2b4", "#bdb6a8", "#d4cdbf", "#b3ad9f", "#c4bfb6"];

const SIDEWALK_WIDTH = 2;
const KERB_WIDTH = 0.3;

/** Same "random" every load (seeded), so the town never changes between visits. */
function seeded(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

/** A building plot that a stop's landmark already stands on (its footprint plus room round it). */
const taken = (x0: number, z0: number, x1: number, z1: number) =>
  LANDMARKS.some((l) => x1 > l.x - l.r - 1.2 && x0 < l.x + l.r + 1.2 && z1 > l.z - l.r - 1.2 && z0 < l.z + l.r + 1.2);

/**
 * A block: kerb, sidewalk, then the buildings filling its middle. The middle is split into a north and a south row,
 * each cut into two or three plots; a plot a landmark stands on is left empty for it. The middle block is the plaza.
 */
function block(b: Batch, cx: number, cz: number, rnd: () => number) {
  const h = BLOCK_HALF;
  b.flat(() => b.box(SIDEWALK, [2 * h, 0.02, 2 * h], [cx, 0.01, cz]));
  for (const [w, d, x, z] of [
    [2 * h, KERB_WIDTH, cx, cz - h + KERB_WIDTH / 2],
    [2 * h, KERB_WIDTH, cx, cz + h - KERB_WIDTH / 2],
    [KERB_WIDTH, 2 * h, cx - h + KERB_WIDTH / 2, cz],
    [KERB_WIDTH, 2 * h, cx + h - KERB_WIDTH / 2, cz],
  ]) b.box(KERB, [w, 0.15, d], [x, 0.075, z]);

  if (cx === 0 && cz === 0) return plaza(b);
  // The terminal's block is its yard: open ground for the jeepneys waiting there, so nothing hides the terminal.
  if (cx === 0 && cz === -22) return b.flat(() => b.box(SIDEWALK, [2 * h - 0.6, 0.03, 2 * h - 0.6], [cx, 0.025, cz]));
  const inner = h - SIDEWALK_WIDTH;
  // The south-east block has the basketball court in its north half (Landmarks.tsx): buildings only on its south row.
  const rows = cx === 22 && cz === 22 ? [1] : [-1, 1];
  // Two to three storeys. The north blocks (far from the camera) a little taller, the south row nearest the camera lower.
  const tall = cz < 0 ? 1.2 : cz > 0 ? 0.8 : 1;
  for (const row of rows) {
    const z0 = row < 0 ? cz - inner : cz;
    const z1 = row < 0 ? cz : cz + inner;
    const cuts = rnd() < 0.5 ? [0.5] : [0.33, 0.67];
    const edges = [0, ...cuts, 1].map((t) => cx - inner + t * 2 * inner);
    for (let i = 0; i + 1 < edges.length; i++) {
      const [x0, x1] = [edges[i], edges[i + 1]];
      if (taken(x0, z0, x1, z1)) continue;
      const height = (3 + rnd() * 3.5) * tall;
      const gap = 0.15;
      b.box(GREYS[Math.floor(rnd() * GREYS.length)], [x1 - x0 - gap, height, z1 - z0 - gap], [(x0 + x1) / 2, height / 2, (z0 + z1) / 2]);
      b.shadow([(x0 + x1) / 2, (z0 + z1) / 2], [(x1 - x0) / 2 + 0.6, (z1 - z0) / 2 + 0.6], height * 0.4);
    }
  }
}

/** The plaza: grass, two crossing paths and a round fountain basin in the middle. Its trees are in Landmarks.tsx. */
function plaza(b: Batch) {
  const h = BLOCK_HALF - KERB_WIDTH;
  b.flat(() => {
    b.box(GRASS, [2 * h - 0.6, 0.03, 2 * h - 0.6], [0, 0.03, 0]);
    b.box(SIDEWALK, [1.6, 0.04, 2 * h], [0, 0.035, 0]);
    b.box(SIDEWALK, [2 * h, 0.04, 1.6], [0, 0.035, 0]);
    b.cyl(SIDEWALK, [3, 3, 0.05], [0, 0.04, 0], undefined, 16);
  });
  b.cyl(SEAWALL, [2.2, 2.3, 0.5], [0, 0.25, 0], undefined, 16);
  b.cyl("#5cc9c4", [1.9, 1.9, 0.06], [0, 0.47, 0], undefined, 16);
  b.cyl(SEAWALL, [0.35, 0.45, 1.2], [0, 0.9, 0], undefined, 8);
}

/** Dashed centre lines along every street, stopping short of the intersections. */
function roadPaint(b: Batch) {
  b.flat(() => {
    for (const s of STREETS) {
      for (let t = -EDGE; t < EDGE; t += 3) {
        const m = t + 0.75;
        if (STREETS.some((c) => Math.abs(m - c) < STREET_HALF + 0.5)) continue;
        b.box(LINE, [0.12, 0.012, 1.5], [s, 0.02, m]); // north–south street
        b.box(LINE, [1.5, 0.012, 0.12], [m, 0.02, s]); // east–west street
      }
    }
  });
}

/** The promenade between the bay boulevard and the sea: paving, a kerb, a railing, and the seawall dropping to the water. */
function promenade(b: Batch) {
  const width = 200;
  const depth = EDGE + SHORE_Z; // negative: the promenade runs north of the boulevard's kerb
  b.flat(() => b.box(SIDEWALK, [width, 0.02, -depth], [0, 0.01, (-EDGE + SHORE_Z) / 2]));
  b.box(KERB, [width, 0.15, KERB_WIDTH], [0, 0.075, -EDGE - KERB_WIDTH / 2]);
  b.box(SEAWALL, [width, 2.4, 0.5], [0, -1.2, SHORE_Z - 0.25]);
  for (let x = -width / 2; x <= width / 2; x += 2.5) b.box(STEEL, [0.06, 0.9, 0.06], [x, 0.45, SHORE_Z + 0.3]);
  for (const y of [0.88, 0.5]) b.box(STEEL, [width, 0.05, 0.05], [0, y, SHORE_Z + 0.3]);
}

/**
 * The rest of town, beyond the outer streets: a row of buildings along the west, south and east edges, so the town
 * carries on past where you can drive instead of stopping at a cliff. Not in the colliders: the square's edge stops the jeepney first.
 */
function edgeRow(b: Batch, rnd: () => number) {
  const from = EDGE + SIDEWALK_WIDTH;
  const depth = 7;
  const lay = (place: (along: number, len: number) => [number, number, number, number]) => {
    for (let along = -60; along < 60; ) {
      const len = 4 + rnd() * 3.5;
      const height = 3 + rnd() * 4;
      const [x, z, w, d] = place(along + len / 2, len - 0.2);
      b.box(GREYS[Math.floor(rnd() * GREYS.length)], [w, height, d], [x, height / 2, z]);
      along += len;
    }
  };
  b.flat(() => {
    for (const [w, d, x, z] of [
      [SIDEWALK_WIDTH, 120, -EDGE - 1, 0],
      [SIDEWALK_WIDTH, 120, EDGE + 1, 0],
      [120, SIDEWALK_WIDTH, 0, EDGE + 1],
    ]) b.box(SIDEWALK, [w, 0.02, d], [x, 0.01, z]);
  });
  lay((a, len) => [-from - depth / 2, a, depth, len]);
  lay((a, len) => [from + depth / 2, a, depth, len]);
  lay((a, len) => [a, from + depth / 2, len, depth]);
}

function buildTown(b: Batch) {
  const rnd = seeded(23);
  for (const z of BLOCKS) for (const x of BLOCKS) block(b, x, z, rnd);
  roadPaint(b);
  promenade(b);
  edgeRow(b, rnd);
}

/** The ground (streets), the sea, and every building that isn't a stop. A click or tap on the ground drives there. */
export function Town({ onGround }: { onGround: (p: Point) => void }) {
  // A tap on a building or a sidewalk still counts: the target moves to the street in front of it.
  const tapGround = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onGround(reachable({ x: e.point.x, z: e.point.z }, OBSTACLES));
  };
  const south = 160;
  return (
    <group>
      <Water />
      {/* Asphalt from the seawall south, far past the edge of town (the fog hides where it ends). */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, (SHORE_Z + south) / 2]} material={paint(ASPHALT)} onClick={tapGround}>
        <planeGeometry args={[2 * south, south - SHORE_Z]} />
      </mesh>
      <Batched build={buildTown} fade />
    </group>
  );
}
