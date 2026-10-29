"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, CanvasTexture, ConeGeometry, DoubleSide, ShaderMaterial, Vector3, type Group, type SpriteMaterial } from "three";
import { stops } from "@/lib/stops";
import { LANDMARKS, SHORE_Z, site } from "@/lib/world";
import { Batched, type Batch, type Vec } from "./Batched";
import { useCalm } from "./useCalm";
import { WIND } from "./weather";

// The island's shared palette. Colours live in the merged mesh's vertices, so adding one costs no draw call.
const WOOD = "#8a5a3b";
const WOOD_DARK = "#5e4331";
const CONCRETE = "#d8cbb0";
const CREAM = "#f4ead5";
const WHITE = "#f7f4ee";
const RED = "#d62839";
const YELLOW = "#ffc93c";
const BLUE = "#1d4e89";
const ORANGE = "#e07a2e";
const TEAL = "#2a9d8f";
const STEEL = "#cfd6de";
const ZINC = "#a9b7bd";
const DARK = "#2b2f3a";
const SHADE = "#2f6b3a";
const TERRACOTTA = "#c8643b";
const LEAF = "#4f9a4a";
const LEAF_DARK = "#3d7a3f";
const PINK = "#e85d75";
const ROCK = "#8d8a83";
const ROCK_DARK = "#6f6c66";
const TRUNK = "#9b7653";
const TRUNK_RING = "#7f6045";
const COCONUT = "#6b4a2b";
const BAMBOO = "#d9c27a";
const TYRE = "#1f1f24";
const GRASS_TUFT = "#73b357";
const LINE = "#fbf6ea";
const FLAGS = [RED, YELLOW, BLUE, WHITE, TEAL, ORANGE];


/** Where the weather station's mast stands in its landmark frame, and how tall it is (the cups spin on top). */
const MAST: Vec = [0.5, 0, -1.9];
const MAST_HEIGHT = 7;

/**
 * Each landmark is drawn in its own little frame: the origin is its spot on the stop ring, +z faces
 * the island's middle (where the jeepney parks), -z faces the sea. Footprints match FOOTPRINTS in world.ts.
 */
const LANDMARK_MODELS: Record<string, (b: Batch) => void> = {
  // FashionHub: a sari-sari store with a barred window, a striped awning and a rack of clothes.
  fashionhub(b) {
    b.shadow([0, -1.7], [2.3, 1.8], 2.3);
    b.box(CONCRETE, [3.4, 0.2, 2.6], [0, 0.1, -1.7]);
    b.box(TEAL, [3.0, 2.0, 2.2], [0, 1.2, -1.8]);
    b.box(DARK, [1.6, 0.9, 0.05], [-0.3, 1.35, -0.68]); // the window, dark inside
    for (let x = -1.0; x <= 0.45; x += 0.29) b.box(STEEL, [0.04, 0.9, 0.04], [x, 1.35, -0.63]);
    b.box(WOOD, [1.8, 0.08, 0.35], [-0.3, 0.88, -0.5]); // counter ledge
    [RED, YELLOW, BLUE, ORANGE].forEach((c, i) => b.box(c, [0.16, 0.2, 0.16], [-0.9 + i * 0.4, 1.02, -0.5]));
    b.box(WOOD_DARK, [0.6, 1.5, 0.05], [1.0, 0.95, -0.68]); // door
    b.box(ZINC, [3.5, 0.08, 2.9], [0, 2.35, -1.7], [0.18, 0, 0]); // zinc roof, sloping to the front
    for (let i = 0; i < 6; i++) b.box(i % 2 ? WHITE : RED, [0.55, 0.05, 0.9], [-1.37 + i * 0.55, 1.95, -0.25], [0.38, 0, 0]);
    // clothes rack in front, for FashionHub
    for (const x of [-1.9, -0.9]) b.box(STEEL, [0.05, 1.5, 0.05], [x, 0.75, -0.15]);
    b.box(STEEL, [1.1, 0.04, 0.04], [-1.4, 1.5, -0.15]);
    [RED, YELLOW, BLUE].forEach((c, i) => b.box(c, [0.26, 0.5, 0.06], [-1.75 + i * 0.33, 1.18, -0.15]));
  },

  // Sprig & Stone: a plant nursery under a shade net, benches of potted plants, two big pots by the road.
  sprig(b) {
    b.shadow([0, -1.6], [2.2, 1.8], 2.2);
    for (const x of [-1.6, 1.6]) for (const z of [-0.4, -2.8]) b.box(WOOD, [0.12, 2.2, 0.12], [x, 1.1, z]);
    b.box(SHADE, [3.5, 0.06, 2.7], [0, 2.2, -1.6]);
    for (const z of [-1.0, -2.2]) {
      b.box(WOOD, [2.8, 0.08, 0.6], [0, 0.6, z]);
      for (const x of [-1.3, 1.3]) b.box(WOOD_DARK, [0.08, 0.58, 0.5], [x, 0.29, z]);
      for (let i = 0; i < 5; i++) {
        const x = -1.1 + i * 0.55;
        b.cyl(TERRACOTTA, [0.17, 0.12, 0.25], [x, 0.77, z]);
        if (i % 2) b.cone(LEAF_DARK, 0.18, 0.5, [x, 1.12, z]);
        else b.ball(LEAF, 0.22, [x, 1.0, z], [1, 0.8, 1]);
        if (i === 2) b.ball(PINK, 0.08, [x + 0.1, 1.15, z + 0.08]);
      }
    }
    for (const x of [-1.25, 1.25]) {
      b.cyl(TERRACOTTA, [0.3, 0.22, 0.45], [x, 0.23, 0.35]);
      b.cone(LEAF_DARK, 0.3, 1.1, [x, 0.95, 0.35]);
    }
  },

  // Lumenfold: a red-and-white lighthouse on a rock base. Its lamp and turning beam are drawn separately.
  lumenfold(b) {
    b.shadow([0, -1.4], [1.9, 1.9], 3);
    b.rock(ROCK, 1.3, [0, 0.05, -1.4], [0, 0.4, 0], [1.4, 0.35, 1.4]);
    b.rock(ROCK_DARK, 0.6, [1.3, 0.1, -0.6], [0.3, 0.2, 0]);
    b.rock(ROCK, 0.5, [-1.2, 0.05, -2.4], [0, 0.5, 0.2]);
    for (let i = 0; i < 4; i++) {
      const bottom = 1.0 - 0.09 * i;
      b.cyl(i % 2 ? RED : WHITE, [bottom - 0.09, bottom, 1.5], [0, 0.5 + 1.5 * i + 0.75, -1.4], undefined, 10);
    }
    b.cyl(DARK, [0.95, 0.95, 0.12], [0, 6.56, -1.4], undefined, 10); // gallery
    for (let i = 0; i < 6; i++) b.box(DARK, [0.05, 0.75, 0.05], [Math.sin(i) * 0.45, 7.0, -1.4 + Math.cos(i) * 0.45]); // lantern frame
    b.cone(RED, 0.65, 0.6, [0, 7.65, -1.4], undefined, 10);
    b.ball(DARK, 0.1, [0, 8.0, -1.4]);
    b.box(WOOD_DARK, [0.5, 0.9, 0.1], [0, 0.95, -0.42]); // door
    for (const y of [3.0, 4.6]) b.box(DARK, [0.3, 0.4, 0.06], [0, y, -0.62 + (y - 3) * 0.05]);
  },

  // Bagyo: a weather station. A braced lattice mast with typhoon signal flags on its yard and a wind vane, a small
  // office, and a white louvred instrument box on legs. The wind cups on top are drawn separately (they spin).
  bagyo(b) {
    b.shadow([0, -1.5], [2.1, 1.8], 3);
    b.flat(() => b.box(CONCRETE, [3.8, 0.12, 3.0], [0, 0.06, -1.5]));
    const [mx, , mz] = MAST;
    const leg = (i: number, y: number): Vec => {
      const a = (i * 2 * Math.PI) / 3 + 0.3, r = 0.5 - (0.4 * y) / MAST_HEIGHT; // three legs leaning in
      return [mx + Math.sin(a) * r, y, mz + Math.cos(a) * r];
    };
    for (let i = 0; i < 3; i++) {
      strut(b, STEEL, leg(i, 0.1), leg(i, MAST_HEIGHT), 0.07);
      for (let y = 0.4; y < MAST_HEIGHT - 0.5; y += 1.05) {
        strut(b, STEEL, leg(i, y), leg(i + 1, y), 0.035);
        strut(b, STEEL, leg(i, y), leg(i + 1, y + 1.05), 0.03); // zigzag bracing
      }
    }
    b.cyl(DARK, [0.28, 0.28, 0.06], [mx, MAST_HEIGHT + 0.03, mz], undefined, 8);
    b.cyl(STEEL, [0.03, 0.03, 0.6], [mx, MAST_HEIGHT + 0.3, mz], undefined, 6); // spindle for the cups
    // The yard, a wind vane off its left end, and two typhoon flags (red, black square) hoisted on the right.
    b.box(STEEL, [1.7, 0.05, 0.05], [mx, 5.6, mz]);
    b.box(STEEL, [0.9, 0.03, 0.03], [mx - 0.85, 6.15, mz]);
    b.box(STEEL, [0.03, 0.55, 0.03], [mx - 0.85, 5.9, mz]);
    b.cone(RED, 0.08, 0.22, [mx - 1.38, 6.15, mz], [0, 0, Math.PI / 2], 4);
    b.box(RED, [0.25, 0.2, 0.02], [mx - 0.42, 6.15, mz]);
    for (const top of [5.55, 4.95]) {
      b.place([mx + 0.8, top, mz], 0, () =>
        b.sway(0.14, 1, () => {
          b.box(RED, [0.48, 0.48, 0.02], [0.26, -0.25, 0]);
          b.box(DARK, [0.2, 0.2, 0.035], [0.26, -0.25, 0]);
        }),
      );
    }
    b.box(DARK, [0.012, 1.1, 0.012], [mx + 0.8, 5.0, mz]); // halyard
    // Office: cream walls, blue roof, a dish on top.
    b.box(CREAM, [1.5, 1.4, 1.5], [-0.95, 0.82, -1.6]);
    b.box(BLUE, [1.75, 0.08, 1.8], [-0.95, 1.58, -1.6], [0.1, 0, 0]);
    b.box(WOOD_DARK, [0.45, 0.95, 0.05], [-0.65, 0.6, -0.83]);
    b.box(DARK, [0.45, 0.35, 0.05], [-1.35, 0.95, -0.83]);
    b.box(WHITE, [1.1, 0.22, 0.05], [-0.95, 1.36, -0.82]);
    b.box(BLUE, [0.9, 0.05, 0.06], [-0.95, 1.36, -0.79]);
    b.cyl(STEEL, [0.03, 0.03, 0.3], [-1.3, 1.78, -1.9], undefined, 5);
    b.cyl(WHITE, [0.22, 0.04, 0.08], [-1.3, 1.95, -1.9], [0.6, 0, 0], 10);
    // Instrument box: white, louvred, on four legs, with a slanted lid.
    for (const x of [1.13, 1.57]) for (const z of [-0.3, -0.7]) b.box(STEEL, [0.04, 1.0, 0.04], [x, 0.6, z]);
    b.box(WHITE, [0.55, 0.55, 0.5], [1.35, 1.35, -0.5]);
    for (let k = 0; k < 4; k++) b.box(ZINC, [0.48, 0.025, 0.03], [1.35, 1.15 + k * 0.12, -0.24]);
    b.box(WHITE, [0.65, 0.05, 0.62], [1.35, 1.66, -0.5], [0.12, 0, 0]);
  },

  // Recipe Finder: a carinderia, a roadside eatery with pots of food on the counter and plastic stools.
  recipes(b) {
    b.shadow([0, -1.6], [2.4, 1.9], 2.5);
    b.box(CONCRETE, [3.6, 0.15, 2.8], [0, 0.075, -1.6]);
    for (const x of [-1.6, 1.6]) for (const z of [-0.35, -2.85]) b.box(WOOD, [0.14, 2.3, 0.14], [x, 1.15, z]);
    b.box(RED, [3.9, 0.08, 1.65], [0, 2.52, -0.95], [-0.38, 0, 0]); // roof, two slopes
    b.box(RED, [3.9, 0.08, 1.65], [0, 2.52, -2.25], [0.38, 0, 0]);
    b.box(CREAM, [3.3, 1.7, 0.1], [0, 0.95, -2.8]); // back wall
    b.box(YELLOW, [3.0, 0.9, 0.5], [0, 0.6, -0.95]); // counter
    b.box(WOOD, [3.1, 0.06, 0.62], [0, 1.08, -0.95]);
    for (const x of [-1.1, -0.37, 0.37, 1.1]) {
      b.cyl(STEEL, [0.22, 0.2, 0.3], [x, 1.26, -0.95]);
      b.cyl(DARK, [0.23, 0.23, 0.03], [x, 1.43, -0.95]);
      b.ball(DARK, 0.04, [x, 1.47, -0.95]);
    }
    b.box(WHITE, [1.8, 0.4, 0.06], [0, 2.0, -0.3]); // name board under the roof
    b.box(ORANGE, [1.6, 0.08, 0.07], [0, 2.0, -0.26]);
    for (const x of [-1, 0, 1]) b.cyl(BLUE, [0.2, 0.17, 0.45], [x, 0.23, -0.15]); // stools
    banderitas(b, [-1.6, 2.15, -0.28], [1.6, 2.15, -0.28], 0.35); // fiesta flags along the front
  },

  // About: the jeepney terminal facing the plaza (a phase-1 stand-in): a long shed roof on posts over a queue, route
  // boards hanging under it, rails and a bench. Its yard runs back to the bay; the pier is across the boulevard (pier() below).
  about(b) {
    b.shadow([0, -2.5], [4.6, 2.6], 3);
    for (const x of [-4, -1.3, 1.3, 4]) for (const z of [-0.6, -4.4]) b.box(STEEL, [0.14, 3.2, 0.14], [x, 1.6, z]);
    b.box(BLUE, [9.6, 0.12, 5.6], [0, 3.25, -2.5], [0.08, 0, 0]);
    for (const x of [-2.6, 0, 2.6]) b.box(YELLOW, [2, 0.4, 0.06], [x, 2.6, -0.6]);
    for (const z of [-1.8, -3]) b.box(STEEL, [6, 0.05, 0.05], [0, 0.9, z]);
    b.box(CONCRETE, [6, 0.1, 0.5], [0, 0.45, -4]);
    banderitas(b, [-4, 3.0, -0.55], [4, 3.0, -0.55], 0.3, 12);
  },
};

/** A thin bar from `p` to `q` (in the current frame): mast legs, braces, strings, frond spines. Square unless `width` is given (leaflets). */
export function strut(b: Batch, color: string, p: Vec, q: Vec, thickness: number, width = thickness) {
  const run = Math.hypot(q[0] - p[0], q[2] - p[2]);
  const mid: Vec = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
  b.place(mid, Math.atan2(q[0] - p[0], q[2] - p[2]), () =>
    b.box(color, [width, thickness, Math.hypot(run, q[1] - p[1])], [0, 0, 0], [-Math.atan2(q[1] - p[1], run), 0, 0]),
  );
}

/**
 * Banderitas: a string of little triangle flags in fiesta colours, sagging between two points (in the
 * current frame). The string is short boxes along the curve; each flag hangs point-down below it.
 */
export function banderitas(b: Batch, from: Vec, to: Vec, sag: number, flags = 10) {
  const at = (t: number): Vec => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t - sag * 4 * t * (1 - t), from[2] + (to[2] - from[2]) * t];
  const yaw = Math.atan2(to[0] - from[0], to[2] - from[2]);
  const n = flags * 2;
  for (let i = 0; i < n; i++) strut(b, DARK, at(i / n), at((i + 1) / n), 0.02);
  for (let i = 0; i < flags; i++) {
    const p = at((i + 0.5) / flags);
    // A three-sided cone, squashed flat and turned point-down: a triangle flag facing across the string. Its tip flutters.
    b.place(p, yaw + Math.PI / 2, () =>
      b.sway(0.25, 1, () => b.add(FLAGS[i % FLAGS.length], new ConeGeometry(0.13, 0.26, 3), [0, -0.14, 0], [Math.PI, 0, 0], [1, 1, 0.15])),
    );
  }
}

/** A motorcycle with a roofed sidecar, the island's other public transport. Faces +z from `at`. */
function tricycle(b: Batch, at: Vec, yaw: number) {
  b.place(at, yaw, () => {
    b.shadow([-0.3, 0], [1.0, 1.2], 1.4);
    // motorcycle
    for (const z of [0.6, -0.55]) b.cyl(TYRE, [0.24, 0.24, 0.1], [0.25, 0.24, z], [0, 0, Math.PI / 2], 10);
    b.box(RED, [0.22, 0.32, 0.9], [0.25, 0.55, 0], [0.12, 0, 0]);
    b.box(DARK, [0.24, 0.1, 0.5], [0.25, 0.76, -0.2]); // seat
    b.box(STEEL, [0.04, 0.45, 0.04], [0.25, 0.8, 0.55], [0.3, 0, 0]); // forks
    b.box(STEEL, [0.6, 0.04, 0.04], [0.25, 1.02, 0.5]); // handlebar
    // sidecar, roofed, with a little route plate on its front
    b.cyl(TYRE, [0.22, 0.22, 0.1], [-0.85, 0.22, -0.1], [0, 0, Math.PI / 2], 10);
    b.box(BLUE, [0.95, 0.55, 1.2], [-0.55, 0.6, 0]);
    b.box(DARK, [0.8, 0.12, 0.6], [-0.55, 0.9, -0.15]); // seat inside
    for (const z of [0.45, -0.5]) b.box(STEEL, [0.04, 0.75, 0.04], [-0.98, 1.25, z]);
    b.box(BLUE, [1.25, 0.06, 1.35], [-0.42, 1.64, -0.02]); // roof over rider and passengers
    b.box(YELLOW, [0.5, 0.14, 0.03], [-0.55, 1.5, 0.66]);
  });
}

/** A barangay waiting shed: concrete bench under a painted roof, open at the front, a tricycle waiting for fares. Faces +z. */
function waitingShed(b: Batch) {
  b.shadow([0, -0.1], [1.6, 1.0], 2.2);
  b.flat(() => b.box(CONCRETE, [2.6, 0.03, 1.6], [0, 0.015, 0])); // thin, so the shadow (y 0.04) lies on top of it
  for (const x of [-1.15, 1.15]) for (const z of [0.65, -0.65]) b.box(STEEL, [0.08, 2.1, 0.08], [x, 1.1, z]);
  b.box(CREAM, [2.4, 1.1, 0.08], [0, 0.65, -0.68]); // back wall
  b.box(TEAL, [2.4, 0.18, 0.09], [0, 1.0, -0.64]);
  b.box(CONCRETE, [2.0, 0.08, 0.45], [0, 0.48, -0.4]); // bench
  for (const x of [-0.8, 0.8]) b.box(CONCRETE, [0.12, 0.42, 0.35], [x, 0.24, -0.4]);
  b.box(BLUE, [2.9, 0.08, 1.9], [0, 2.2, 0], [0.12, 0, 0]); // roof, sloping to the back
  b.box(WHITE, [1.6, 0.3, 0.05], [0, 1.95, 0.85]); // name board
  b.box(RED, [1.4, 0.06, 0.06], [0, 1.95, 0.88]);
  banderitas(b, [-1.3, 2.05, 0.75], [1.3, 2.05, 0.75], 0.2, 7);
  tricycle(b, [0.3, 0, 1.6], Math.PI / 2); // parked across the front; PROPS in world.ts covers it
}

/** A half court painted on a concrete slab under the beach hoop: the key, the free-throw circle, the arc. Faces +z. */
function court(b: Batch) {
  b.flat(() => {
    b.box(CONCRETE, [6.0, 0.03, 4.4], [0, 0.015, 1.8]);
    const line = (w: number, d: number, x: number, z: number) => b.box(LINE, [w, 0.012, d], [x, 0.03, z]); // top 0.036, under the shadows
    line(1.8, 0.06, 0, 2.9); // free-throw line
    for (const x of [-0.9, 0.9]) line(0.06, 2.9, x, 1.45); // sides of the key
    line(5.8, 0.06, 0, -0.35); // baseline
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      if (i < 9) b.box(LINE, [0.22, 0.012, 0.06], [Math.cos(a * 2) * 0.9, 0.03, 2.9 + Math.sin(a * 2) * 0.9], [0, -a * 2 + Math.PI / 2, 0]); // free-throw circle
      b.box(LINE, [0.55, 0.012, 0.06], [Math.cos(a) * 2.6, 0.03, -0.1 + Math.sin(a) * 1.6], [0, -a + Math.PI / 2, 0]); // three-point arc
    }
  });
}

/** Low tufts of grass and a few flowers on the plaza lawn, off the paths and the fountain (seeded, so the same every visit). */
function tufts(b: Batch) {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) {
    const at: Vec = [(rnd() * 2 - 1) * 6, 0.03, (rnd() * 2 - 1) * 6];
    const underShed = at[0] > -4.4 && at[0] < -0.9 && at[2] > 4;
    if (Math.abs(at[0]) < 1.1 || Math.abs(at[2]) < 1.1 || Math.hypot(at[0], at[2]) < 3.3 || underShed) continue;
    // Three thin blades leaning apart.
    b.place(at, rnd() * 6, () => b.sway(0.4, 2, () => {
      for (let k = 0; k < 3; k++) b.cone(GRASS_TUFT, 0.045, 0.3, [Math.sin(k * 2.1) * 0.06, 0.13, Math.cos(k * 2.1) * 0.06], [Math.cos(k * 2.1) * 0.35, 0, -Math.sin(k * 2.1) * 0.35], 3);
    }));
    if (i % 7 === 0) b.ball(i % 2 ? PINK : YELLOW, 0.06, [at[0] + 0.12, 0.2, at[2]]);
  }
}

/** Where a stop's model sits and which way it faces (+z towards its street). */
function frameOf(id: string) {
  const { origin, yaw } = site(id);
  return { at: [origin.x, 0, origin.z] as Vec, yaw };
}

/** The pier: out over the water from a gate with a sign on the promenade, facing north (-z). The bangka is drawn separately (it bobs). */
const PIER: Vec = [0, 0, SHORE_Z + 0.6];
function pier(b: Batch) {
  b.shadow([0, -0.6], [1.6, 0.5], 1.9);
  for (const x of [-1.1, 1.1]) b.box(WOOD_DARK, [0.18, 1.9, 0.18], [x, 0.95, -0.6]);
  b.box(BLUE, [2.6, 0.4, 0.1], [0, 1.95, -0.6]);
  b.box(YELLOW, [2.2, 0.08, 0.11], [0, 1.95, -0.6]);
  for (let z = -1.0; z > -15; z -= 0.42) b.box(WOOD, [2.0, 0.1, 0.34], [0, 0.25, z]);
  for (let z = -2; z >= -15; z -= 2.2) for (const x of [-0.95, 0.95]) b.cyl(WOOD_DARK, [0.1, 0.1, 1.8], [x, -0.6, z], undefined, 6);
  for (const x of [-0.8, 0.8]) b.cyl(DARK, [0.1, 0.12, 0.3], [x, 0.45, -14.6], undefined, 6); // bollards
  b.box(WOOD, [0.5, 0.4, 0.5], [1.5, 0.2, 0.2]); // crates by the gate
  b.box(WOOD_DARK, [0.4, 0.35, 0.4], [1.55, 0.58, 0.2], [0, 0.4, 0]);
  banderitas(b, [-1.1, 2.1, -0.6], [1.1, 2.1, -0.6], 0.25, 6);
}

/**
 * One palm frond, pointing along +z from the crown: a spine that arches up then droops towards its tip, in five
 * segments, with two pairs of leaflets hanging off each, shorter towards the tip.
 */
function frond(b: Batch, color: string) {
  let p: Vec = [0, 0, 0];
  for (let i = 0; i < 5; i++) {
    const droop = -0.3 + i * 0.32; // radians below level: rises a little, then bends down
    const q: Vec = [0, p[1] - Math.sin(droop) * 0.4, p[2] + Math.cos(droop) * 0.4];
    strut(b, color, p, q, 0.05, 0.07);
    const reach = 0.5 - i * 0.07;
    for (const t of [0.25, 0.75]) {
      const at: Vec = [0, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
      for (const side of [-1, 1]) strut(b, color, at, [side * reach, at[1] - 0.16, at[2] + 0.14], 0.02, 0.15);
    }
    p = q;
  }
}

/** A coconut palm at `at`: a curved trunk leaning towards `lean` (radians, like yaw), six drooping fronds and a few coconuts. */
function palm(b: Batch, at: Vec, height: number, lean: number) {
  // The crown sways ~12 cm in the wind, the foot not at all (k · height², from the palm's foot).
  b.place(at, lean - Math.PI / 2, () => b.sway(0.12 / (height * height), 2, () => {
    let x = 0;
    let y = 0;
    const segments = 5;
    const len = height / segments;
    for (let i = 0; i < segments; i++) {
      const lean = 0.07 * (i + 1);
      const cx = x + (Math.sin(lean) * len) / 2;
      const cy = y + (Math.cos(lean) * len) / 2;
      b.cyl(TRUNK, [0.15 - i * 0.015, 0.2 - i * 0.015, len + 0.05], [cx, cy, 0], [0, 0, -lean], 6);
      x += Math.sin(lean) * len;
      y += Math.cos(lean) * len;
      if (i < segments - 1) b.cyl(TRUNK_RING, [0.17 - i * 0.015, 0.17 - i * 0.015, 0.07], [x, y, 0], [0, 0, -lean], 6); // the ring where each year's fronds fell
    }
    for (let k = 0; k < 6; k++) b.place([x, y, 0], (k * Math.PI) / 3 + 0.3, () => frond(b, k % 2 ? LEAF : LEAF_DARK));
    b.shadow([x, 0], [1.4, 1.4], 1.5);
    for (let k = 0; k < 3; k++) b.ball(COCONUT, 0.13, [x + Math.sin(k * 2.1) * 0.18, y - 0.18, Math.cos(k * 2.1) * 0.18]);
  }));
}

/** Everything around the stops that never moves, merged into one mesh. */
function buildScenery(b: Batch) {
  for (const s of stops) {
    const { at, yaw } = frameOf(s.id);
    b.place(at, yaw, () => LANDMARK_MODELS[s.id](b));
  }
  b.place(PIER, 0, () => pier(b));
  // Palms along the promenade, leaning out over the bay, clear of the pier.
  for (let x = -66; x <= 66; x += 8.5) if (Math.abs(x) > 4) palm(b, [x + Math.sin(x) * 1.2, 0, SHORE_Z + 1.8], 3.6 + (Math.abs(x * 7) % 1.1), Math.PI);
  // Rocks at the foot of the seawall.
  for (const [x, size] of [[-31, 0.8], [-12, 0.6], [9, 0.9], [27, 0.6], [44, 0.8], [-50, 0.7]]) {
    b.rock(x % 2 ? ROCK : ROCK_DARK, size, [x, -0.5, SHORE_Z - 1.6], [x, x * 2, 0], [1.2, 0.7, 1]);
  }
  tufts(b); // the plaza's trees, benches and fountain are town fabric (Town.tsx)
  // The basketball court in the south-east block, its hoop at the north end.
  b.place([22, 0, 19.5], 0, () => {
    court(b);
    b.shadow([0, -0.3], [0.9, 0.5], 2.5);
    b.cyl(STEEL, [0.07, 0.07, 3.0], [0, 1.5, -0.5], undefined, 6);
    b.box(WHITE, [1.2, 0.8, 0.06], [0, 3.0, -0.25]);
    b.box(RED, [0.4, 0.3, 0.07], [0, 2.85, -0.24]);
    b.cyl(ORANGE, [0.25, 0.25, 0.04], [0, 2.7, 0.05], undefined, 10);
  });
  // A waiting shed on the plaza's south edge, facing the street, its tricycle parked in front inside the kerb.
  b.place([-2.7, 0.03, 5.1], 0, () => waitingShed(b));
}

/** The outrigger boat moored by the pier, built once and bobbed as a whole. */
function buildBangka(b: Batch) {
  b.box(WHITE, [0.8, 0.45, 3.2], [0, 0.1, 0]);
  b.box(WHITE, [0.6, 0.35, 1.0], [0, 0.32, 1.85], [-0.45, 0, 0]); // upturned bow
  b.box(WHITE, [0.6, 0.3, 0.8], [0, 0.28, -1.75], [0.4, 0, 0]);
  b.box(BLUE, [0.84, 0.08, 3.22], [0, 0.3, 0]);
  b.box(RED, [0.84, 0.05, 3.22], [0, 0.2, 0]);
  for (const x of [-1.9, 1.9]) b.cyl(BAMBOO, [0.08, 0.08, 3.6], [x, -0.05, 0], [Math.PI / 2, 0, 0], 6);
  for (const z of [-0.9, 0.9]) b.cyl(BAMBOO, [0.05, 0.05, 3.9], [0, 0.3, z], [0, 0, Math.PI / 2], 6);
}

const lighthouse = frameOf("lumenfold");

const station = frameOf("bagyo");

/** The wind cups on top of the weather mast: three arms, a cup on each, turned to catch the wind. */
function buildCups(b: Batch) {
  b.cyl(DARK, [0.06, 0.06, 0.1], [0, 0, 0], undefined, 8);
  for (let i = 0; i < 3; i++) {
    b.place([0, 0, 0], (i * 2 * Math.PI) / 3, () => {
      b.box(STEEL, [0.025, 0.025, 0.32], [0, 0, 0.16]);
      b.cyl(WHITE, [0.09, 0.05, 0.13], [0, 0, 0.34], [0, 0, Math.PI / 2], 8);
    });
  }
}

const BEAM_LENGTH = 7;
const BEAM = new ConeGeometry(0.9, BEAM_LENGTH, 16, 1, true);

/**
 * The lighthouse beam's shader: brightest at the lamp and fading out along its length, soft at its edges
 * (where you look across the cone's side instead of through it, it fades, so it reads as a shaft of light,
 * not a plastic cone), with faint dust drifting out along it. Additive, so it only ever brightens what's behind.
 */
const beamMaterial = () =>
  new ShaderMaterial({
    uniforms: { uTime: WIND, uColor: { value: new Vector3(1, 0.93, 0.74) } },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying float vFacing;
      void main() {
        vAlong = 0.5 + position.y / ${BEAM_LENGTH.toFixed(1)}; // 1 at the lamp (the cone's tip), 0 at the far end
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      varying float vAlong;
      varying float vFacing;
      void main() {
        float dust = 0.85 + 0.15 * sin(vAlong * 40.0 + uTime * 3.0) * sin(vAlong * 17.0 - uTime * 1.3);
        float a = vAlong * vAlong * smoothstep(0.0, 0.7, vFacing) * dust * 0.32;
        gl_FragColor = vec4(uColor * a, 1.0);
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });

/** A soft round glow (white centre fading to clear), drawn once into a small canvas: the lamp's halo. */
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const fill = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  fill.addColorStop(0, "rgba(255,246,216,1)");
  fill.addColorStop(0.25, "rgba(255,232,170,0.55)");
  fill.addColorStop(1, "rgba(255,220,150,0)");
  g.fillStyle = fill;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

// The lamp in world space, and scratch vectors for the halo (no allocations in the frame loop).
const LAMP = new Vector3(0, 7, -1.4).applyAxisAngle(new Vector3(0, 1, 0), lighthouse.yaw).add(new Vector3(...lighthouse.at));
const beamAxis = new Vector3();
const toCamera = new Vector3();

/** The stops' landmarks, palms, rocks and props. A click on a landmark drives to that stop and opens it. */
export function Landmarks({ onStop }: { onStop: (id: string) => void }) {
  const beam = useRef<Group>(null!);
  const boat = useRef<Group>(null!);
  const cups = useRef<Group>(null!);
  const halo = useRef<SpriteMaterial>(null!);
  const beamShader = useMemo(beamMaterial, []);
  const glow = useMemo(glowTexture, []);
  const calm = useCalm();
  // The "go" cursor goes on the canvas, not the page: scrolling away from a hovered landmark fires no
  // "pointer out", and a body cursor would then stick over the project list.
  const canvas = useThree((s) => s.gl.domElement);
  const setCursor = (c: string) => () => (canvas.style.cursor = c);

  useFrame(({ clock, camera }, delta) => {
    // The halo flares as the beam swings past the camera (either end of it: the beam shines both ways).
    beamAxis.setFromMatrixColumn(beam.current.matrixWorld, 0).setY(0).normalize();
    toCamera.copy(camera.position).sub(LAMP).setY(0).normalize();
    halo.current.opacity = 0.35 + 0.65 * Math.abs(beamAxis.dot(toCamera)) ** 6;
    if (calm.current) return; // reduced motion: the beam, the boat, the cups and the wind hold still
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 1 / 20);
    WIND.value += dt; // drives the swaying plants and flags, the cloud shadows and the beam's dust
    cups.current.rotation.y -= dt * 5;
    beam.current.rotation.y += dt * 0.9;
    boat.current.position.y = Math.sin(t * 1.3) * 0.06;
    boat.current.rotation.z = Math.sin(t * 1.1) * 0.04;
    boat.current.rotation.x = Math.sin(t * 0.9 + 1) * 0.02;
  });

  return (
    <group>
      <Batched build={buildScenery} fade />

      {/* Click areas: invisible (no draw call) cylinders over each landmark's footprint. */}
      {stops.map((s, i) => (
        <mesh
          key={s.id}
          position={[LANDMARKS[i].x, 1.5, LANDMARKS[i].z]}
          onClick={(e) => {
            e.stopPropagation();
            onStop(s.id);
          }}
          onPointerOver={setCursor("var(--cursor-go)")}
          onPointerOut={setCursor("")}
        >
          <cylinderGeometry args={[LANDMARKS[i].r, LANDMARKS[i].r, s.id === "lumenfold" || s.id === "bagyo" ? 16 : 4, 8]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ))}

      {/* Lighthouse lamp and its slowly turning beam (glow only: no light source, so it costs nothing to shade). */}
      <group position={lighthouse.at} rotation-y={lighthouse.yaw}>
        <mesh position={[0, 7.0, -1.4]}>
          <cylinderGeometry args={[0.42, 0.42, 0.7, 10]} />
          <meshBasicMaterial color="#ffe38a" />
        </mesh>
        <sprite position={[0, 7.0, -1.4]} scale={2.6}>
          <spriteMaterial ref={halo} map={glow} blending={AdditiveBlending} depthWrite={false} transparent />
        </sprite>
        <group ref={beam} position={[0, 7.0, -1.4]}>
          {[1, -1].map((side) => (
            <mesh key={side} geometry={BEAM} material={beamShader} position-x={side * (BEAM_LENGTH / 2)} rotation-z={(side * Math.PI) / 2} />
          ))}
        </group>
      </group>

      {/* The weather station's wind cups, spinning on top of its mast. */}
      <group position={station.at} rotation-y={station.yaw}>
        <group ref={cups} position={[MAST[0], MAST_HEIGHT + 0.6, MAST[2]]}>
          <Batched build={buildCups} ao={false} />
        </group>
      </group>

      {/* The bangka, moored beside the end of the pier, rocking on the water. */}
      <group position={PIER}>
        <group position={[2.6, -0.55, -11.5]}>
          <group ref={boat}>
            <Batched build={buildBangka} ao={false} />
          </group>
        </group>
      </group>
    </group>
  );
}
