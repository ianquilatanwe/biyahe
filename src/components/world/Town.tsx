"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { reachable } from "@/lib/driving";
import { stops } from "@/lib/stops";
import { BLOCK_HALF, BLOCKS, EDGE, LANDMARKS, OBSTACLES, SHORE_Z, site, STREET_HALF, STREETS, type Point } from "@/lib/world";
import { Batched, type Batch, type Vec } from "./Batched";
import { banderitas, strut } from "./Landmarks";
import { paint } from "./paint";
import { shophouse } from "./shophouse";
import { Water } from "./Water";

const ASPHALT = "#5d626d";
const SIDEWALK = "#d8cbb0";
const KERB = "#b9b2a4";
const LINE = "#fbf6ea";
const GRASS = "#8cc56b";
const SEAWALL = "#a39d90";
const STEEL = "#cfd6de";
const POLE = "#b8b4ab";
const WIRE = "#2b2f3a";
const WOOD = "#8a5a3b";
const WOOD_DARK = "#5e4331";
const LAMP_GREEN = "#2f4a3a";
const LAMP_GLASS = "#f4ead5";
const BAMBOO = "#d9c27a";
const TRUNK = "#9b7653";
const LEAF = "#4f9a4a";
const LEAF_DARK = "#3d7a3f";
const WATER = "#5cc9c4";

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
 * A block: kerb, sidewalk, then shophouses filling its middle. The middle is split into a north and a south row,
 * each cut into two or three plots; a plot a landmark stands on is left empty for it. The middle block is the plaza.
 * Each row fronts its own street, so the north row's shops face away from the camera and only show their roofs and backs.
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
  for (const row of rows) {
    // Storeys: the north blocks (far from the camera) two or three, the south ones one or two, and every south row
    // at most two, so the camera sees over it.
    const least = cz < 0 ? 2 : 1;
    const most = cz > 0 || row > 0 ? 2 : 3;
    const cuts = rnd() < 0.5 ? [0.5] : [0.33, 0.67];
    const edges = [0, ...cuts, 1].map((t) => cx - inner + t * 2 * inner);
    for (let i = 0; i + 1 < edges.length; i++) {
      const [x0, x1] = [edges[i], edges[i + 1]];
      const [z0, z1] = row < 0 ? [cz - inner, cz] : [cz, cz + inner];
      if (taken(x0, z0, x1, z1)) continue;
      const storeys = least + Math.floor(rnd() * (most - least + 1));
      // South row: front on the south edge facing +z. North row: front on the north edge, turned round.
      const at: Vec = [(x0 + x1) / 2, 0, row > 0 ? z1 : z0];
      b.place(at, row > 0 ? 0 : Math.PI, () => shophouse(b, x1 - x0, inner, storeys, rnd, { front: row > 0 }));
    }
  }
}

/** A shade tree (acacia, the plaza kind): a short trunk forking into a wide, flat-topped crown of leaf clumps. */
function shadeTree(b: Batch, at: Vec, size: number, rnd: () => number) {
  b.place(at, rnd() * 6, () => {
    b.shadow([0, 0], [2.4 * size, 2.2 * size], 1.2);
    b.cyl(TRUNK, [0.18 * size, 0.26 * size, 1.8 * size], [0, 0.9 * size, 0], undefined, 6);
    for (let k = 0; k < 3; k++) {
      const a = (k * 2 * Math.PI) / 3;
      strut(b, TRUNK, [0, 1.6 * size, 0], [Math.sin(a) * 1.1 * size, 2.7 * size, Math.cos(a) * 1.1 * size], 0.14 * size);
    }
    b.sway(0.08 / (size * size * 9), 2, () => {
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + rnd();
        const r = k === 0 ? 0 : (1.1 + rnd() * 0.6) * size;
        b.ball(k % 2 ? LEAF : LEAF_DARK, (0.9 + rnd() * 0.3) * size, [Math.sin(a) * r, (2.9 + rnd() * 0.4) * size, Math.cos(a) * r], [1.3, 0.55, 1.3]);
      }
    });
  });
}

/** A park bench: wooden slats on two steel legs, a backrest. Faces +z. */
function bench(b: Batch) {
  b.shadow([0, 0], [0.9, 0.4], 0.5);
  for (const x of [-0.6, 0.6]) b.box(STEEL, [0.06, 0.45, 0.42], [x, 0.22, 0]);
  for (const z of [-0.12, 0.05, 0.17]) b.box(WOOD, [1.5, 0.05, 0.11], [0, 0.46, z]);
  for (const y of [0.65, 0.82]) b.box(WOOD_DARK, [1.5, 0.11, 0.05], [0, y, -0.2]);
}

/** A street lamp: a dark green post curving out to a lamp head over the kerb (+z). Unlit: it's afternoon. */
function lamp(b: Batch) {
  b.shadow([0, 0], [0.3, 0.3], 1);
  b.cyl(LAMP_GREEN, [0.1, 0.16, 0.4], [0, 0.2, 0], undefined, 6);
  b.cyl(LAMP_GREEN, [0.06, 0.08, 4.2], [0, 2.3, 0], undefined, 6);
  strut(b, LAMP_GREEN, [0, 4.3, 0], [0, 4.55, 0.6], 0.06);
  b.box(LAMP_GREEN, [0.32, 0.12, 0.42], [0, 4.55, 0.75]);
  b.box(LAMP_GLASS, [0.24, 0.08, 0.32], [0, 4.46, 0.75]);
}

/** The plaza: grass, two crossing paths, a two-tier fountain, four shade trees, benches by the paths and a lamp at each corner. */
function plaza(b: Batch) {
  const h = BLOCK_HALF - KERB_WIDTH;
  b.flat(() => {
    b.box(GRASS, [2 * h - 0.6, 0.03, 2 * h - 0.6], [0, 0.03, 0]);
    b.box(SIDEWALK, [1.6, 0.04, 2 * h], [0, 0.035, 0]);
    b.box(SIDEWALK, [2 * h, 0.04, 1.6], [0, 0.035, 0]);
    b.cyl(SIDEWALK, [3, 3, 0.05], [0, 0.04, 0], undefined, 16);
  });
  b.cyl(SEAWALL, [2.2, 2.3, 0.5], [0, 0.25, 0], undefined, 16);
  b.cyl(WATER, [1.9, 1.9, 0.06], [0, 0.47, 0], undefined, 16);
  b.cyl(SEAWALL, [0.3, 0.45, 1.3], [0, 0.9, 0], undefined, 8);
  b.cyl(SEAWALL, [0.85, 0.35, 0.25], [0, 1.6, 0], undefined, 12); // the upper bowl
  b.cyl(WATER, [0.75, 0.75, 0.04], [0, 1.72, 0], undefined, 12);
  b.cyl(SEAWALL, [0.08, 0.12, 0.5], [0, 1.95, 0], undefined, 6);
  b.ball(SEAWALL, 0.12, [0, 2.25, 0]);

  const rnd = seeded(5);
  for (const [x, z] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) shadeTree(b, [x, 0.03, z], 0.78 + rnd() * 0.12, rnd);
  // Benches beside the four paths, facing them (the south-west one would stand in the waiting shed).
  for (const [x, z, yaw] of [[-1.3, -4.6, Math.PI / 2], [1.3, -4.6, -Math.PI / 2], [1.3, 4.6, -Math.PI / 2], [-4.6, -1.3, 0], [4.6, -1.3, 0], [-4.6, 1.3, Math.PI], [4.6, 1.3, Math.PI]]) {
    b.place([x, 0.05, z], yaw, () => bench(b));
  }
  for (const [x, z] of [[-h + 0.6, -h + 0.6], [h - 0.6, -h + 0.6], [-h + 0.6, h - 0.6], [h - 0.6, h - 0.6]]) b.place([x, 0, z], Math.atan2(-x, -z), () => lamp(b));
}

/** Dashed centre lines along every street, stopping short of the intersections (and their crosswalks). */
function roadPaint(b: Batch) {
  b.flat(() => {
    for (const s of STREETS) {
      for (let t = -EDGE; t < EDGE; t += 3) {
        const m = t + 0.75;
        if (STREETS.some((c) => Math.abs(m - c) < STREET_HALF + 3)) continue;
        b.box(LINE, [0.12, 0.012, 1.5], [s, 0.02, m]); // north–south street
        b.box(LINE, [1.5, 0.012, 0.12], [m, 0.02, s]); // east–west street
      }
    }
    // Zebra crossings on every side of the four crossings round the plaza.
    for (const cx of [-11, 11]) for (const cz of [-11, 11]) {
      for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        for (let i = -3; i <= 3; i++) {
          const across = i * 1.05;
          const out = STREET_HALF + 1.4;
          if (dz) b.box(LINE, [0.5, 0.012, 2], [cx + across, 0.02, cz + dz * out]);
          else b.box(LINE, [2, 0.012, 0.5], [cx + dx * out, 0.02, cz + across]);
        }
      }
    }
  });
}

/** A sagging wire from p to q (current frame), in short straight pieces. */
function wire(b: Batch, p: Vec, q: Vec, sag: number, thickness = 0.02) {
  const at = (t: number): Vec => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t - sag * 4 * t * (1 - t), p[2] + (q[2] - p[2]) * t];
  const n = 8;
  for (let i = 0; i < n; i++) strut(b, WIRE, at(i / n), at((i + 1) / n), thickness);
}

/**
 * Electric poles along the east sidewalk of every north–south street, at the kerb, with their sagging wires: three
 * power lines on the crossarm and a looser cable lower down. Every third pole carries a transformer drum. Only
 * north–south: the camera looks north, so east–west wires would cut across the screen in front of the jeepney.
 * The poles stand on the sidewalks (inside the blocks), so the kerbs already keep the jeepney off them.
 */
function poles(b: Batch) {
  // Not in front of a stop, where a pole and its wires would stand across the shopfront.
  const fronts = stops.map((s) => site(s.id).front);
  const clear = (x: number, z: number) => fronts.every((f) => Math.hypot(f.x - x, f.z - z) > 6);
  for (const s of STREETS) {
    const x = s + STREET_HALF + 0.5;
    const line = BLOCKS.flatMap((c) => [c - 5, c + 5]).filter((z) => clear(x, z));
    line.forEach((z, i) => {
      b.place([x, 0, z], 0, () => {
        b.shadow([0, 0], [0.3, 0.3], 1);
        b.cyl(POLE, [0.11, 0.16, 6.4], [0, 3.2, 0], undefined, 6);
        b.box(WOOD_DARK, [1.4, 0.09, 0.09], [0, 6.0, 0]); // crossarm, across the line
        if (i % 3 === 1) b.cyl(WIRE, [0.2, 0.2, 0.55], [0.28, 5.2, 0], undefined, 8);
      });
    });
    for (let i = 0; i + 1 < line.length; i++) {
      const [p, q] = [line[i], line[i + 1]];
      if (q - p > 13) continue; // a gap left for a stop: no wire across it
      for (const o of [-0.6, 0, 0.6]) wire(b, [x + o, 6.05, p], [x + o, 6.05, q], 0.4, 0.015);
      wire(b, [x, 4.8, p], [x, 4.8, q], 0.6, 0.025); // the cable bundle
    }
  }
}

/** Banderitas strung across the street south of the plaza (the fiesta street), from bamboo poles on either sidewalk. */
function fiesta(b: Batch) {
  const [north, south] = [BLOCK_HALF - 0.4, 22 - BLOCK_HALF + 0.4];
  for (const x of [-5.5, 1.1, 3.3, 5.5]) { // clear of the waiting shed's tricycle and the plaza path
    for (const z of [north, south]) b.cyl(BAMBOO, [0.05, 0.06, 5], [x, 2.5, z], undefined, 4);
    banderitas(b, [x, 4.9, north], [x, 4.9, south], 0.7, 12);
  }
}

/** The promenade between the bay boulevard and the sea: paving, a kerb, a railing, lamps, and the seawall dropping to the water. */
function promenade(b: Batch) {
  const width = 200;
  const depth = EDGE + SHORE_Z; // negative: the promenade runs north of the boulevard's kerb
  b.flat(() => b.box(SIDEWALK, [width, 0.02, -depth], [0, 0.01, (-EDGE + SHORE_Z) / 2]));
  b.box(KERB, [width, 0.15, KERB_WIDTH], [0, 0.075, -EDGE - KERB_WIDTH / 2]);
  b.box(SEAWALL, [width, 2.4, 0.5], [0, -1.2, SHORE_Z - 0.25]);
  for (let x = -width / 2; x <= width / 2; x += 2.5) b.box(STEEL, [0.06, 0.9, 0.06], [x, 0.45, SHORE_Z + 0.3]);
  for (const y of [0.88, 0.5]) b.box(STEEL, [width, 0.05, 0.05], [0, y, SHORE_Z + 0.3]);
  // Lamps halfway between the palms (Landmarks.tsx), leaning out over the walk; none at the pier gate.
  for (let x = -61.75; x <= 66; x += 8.5) if (Math.abs(x) > 5) b.place([x, 0, SHORE_Z + 0.8], 0, () => lamp(b));
}

/**
 * The rest of town, beyond the outer streets: a row of shophouses along the west, south and east edges, so the town
 * carries on past where you can drive instead of stopping at a cliff. Lower detail; not in the colliders: the square's
 * edge stops the jeepney first. The south row faces away from the camera, so it shows only roofs.
 */
function edgeRow(b: Batch, rnd: () => number) {
  const from = EDGE + SIDEWALK_WIDTH;
  const depth = 7;
  const lay = (place: (along: number) => Vec, yaw: number, front: boolean, most: number) => {
    for (let along = -60; along < 60; ) {
      const len = 4 + rnd() * 3.5;
      const storeys = 1 + Math.floor(rnd() * most);
      b.place(place(along + len / 2), yaw, () => shophouse(b, len, depth, storeys, rnd, { front, low: true }));
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
  lay((a) => [-from, 0, a], Math.PI / 2, true, 2); // west edge, facing east into town
  lay((a) => [from, 0, a], -Math.PI / 2, true, 2); // east edge, facing west
  lay((a) => [a, 0, from], Math.PI, false, 1); // south edge, facing north (away from the camera), kept low
}

function buildTown(b: Batch) {
  const rnd = seeded(23);
  for (const z of BLOCKS) for (const x of BLOCKS) block(b, x, z, rnd);
  roadPaint(b);
  poles(b);
  fiesta(b);
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
