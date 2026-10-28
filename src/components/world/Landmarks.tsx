"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BufferAttribute, ConeGeometry, type Group } from "three";
import { stops } from "@/lib/stops";
import { coastRadius, GRASS_RADIUS, LANDMARKS, OBSTACLES, SHED, stopPosition } from "@/lib/world";
import { Batched, type Batch, type Vec } from "./Batched";
import { useCalm } from "./useCalm";

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
const COCONUT = "#6b4a2b";
const BAMBOO = "#d9c27a";
const TYRE = "#1f1f24";
const GRASS_TUFT = "#73b357";
const LINE = "#fbf6ea";
const FLAGS = [RED, YELLOW, BLUE, WHITE, TEAL, ORANGE];

const rad = (deg: number) => (deg * Math.PI) / 180;

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

  // About: a pier running out over the water from a gate with a sign. The bangka is drawn separately (it bobs).
  about(b) {
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
  },
};

/**
 * Banderitas: a string of little triangle flags in fiesta colours, sagging between two points (in the
 * current frame). The string is short boxes along the curve; each flag hangs point-down below it.
 */
function banderitas(b: Batch, from: Vec, to: Vec, sag: number, flags = 10) {
  const at = (t: number): Vec => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t - sag * 4 * t * (1 - t), from[2] + (to[2] - from[2]) * t];
  const yaw = Math.atan2(to[0] - from[0], to[2] - from[2]);
  const n = flags * 2;
  for (let i = 0; i < n; i++) {
    const p = at(i / n);
    const q = at((i + 1) / n);
    const run = Math.hypot(q[0] - p[0], q[2] - p[2]);
    const mid: Vec = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
    b.place(mid, yaw, () => b.box(DARK, [0.02, 0.02, Math.hypot(run, q[1] - p[1])], [0, 0, 0], [-Math.atan2(q[1] - p[1], run), 0, 0]));
  }
  for (let i = 0; i < flags; i++) {
    const p = at((i + 0.5) / flags);
    // A three-sided cone, squashed flat and turned point-down: a triangle flag facing across the string.
    b.place(p, yaw + Math.PI / 2, () => b.add(FLAGS[i % FLAGS.length], new ConeGeometry(0.13, 0.26, 3), [0, -0.14, 0], [Math.PI, 0, 0], [1, 1, 0.15]));
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

/** Low tufts of grass and a few flowers scattered over the grass (seeded, so the same every visit). */
function tufts(b: Batch) {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 5 + rnd() * (GRASS_RADIUS - 6.5);
    if (r > 12.8 && r < 16) continue; // keep the road clear
    const at: Vec = [Math.sin(a) * r, 0, Math.cos(a) * r];
    if (OBSTACLES.some((o) => Math.hypot(o.x - at[0], o.z - at[2]) < o.r + 0.5)) continue;
    // Three thin blades leaning apart.
    b.place(at, rnd() * 6, () => {
      for (let k = 0; k < 3; k++) b.cone(GRASS_TUFT, 0.045, 0.3, [Math.sin(k * 2.1) * 0.06, 0.13, Math.cos(k * 2.1) * 0.06], [Math.cos(k * 2.1) * 0.35, 0, -Math.sin(k * 2.1) * 0.35], 3);
    });
    if (i % 7 === 0) b.ball(i % 2 ? PINK : YELLOW, 0.06, [at[0] + 0.12, 0.2, at[2]]);
  }
}

/** Where a stop's model sits and which way it faces (+z towards the island's middle). */
function frameOf(angle: number) {
  const { x, z } = stopPosition(angle);
  return { at: [x, 0, z] as [number, number, number], yaw: rad(angle) + Math.PI };
}

/** A point on the sand just above the waterline, at a stop-style angle (degrees, 0 towards the camera). */
function onSand(angle: number, inset: number) {
  const a = rad(angle);
  const r = coastRadius(Math.atan2(Math.cos(a), Math.sin(a))) - inset;
  return [Math.sin(a) * r, 0, Math.cos(a) * r] as [number, number, number];
}

/** A coconut palm: a curved trunk leaning out to sea, six drooping fronds and a few coconuts. */
function palm(b: Batch, angle: number, inset: number, height: number) {
  b.place(onSand(angle, inset), rad(angle) - Math.PI / 2, () => {
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
    }
    for (let k = 0; k < 6; k++) {
      b.place([x, y, 0], (k * Math.PI) / 3 + 0.3, () => b.box(k % 2 ? LEAF : LEAF_DARK, [0.42, 0.05, 1.8], [0, -0.25, 0.85], [0.42, 0, 0]));
    }
    b.shadow([x, 0], [1.4, 1.4], 1.5);
    for (let k = 0; k < 3; k++) b.ball(COCONUT, 0.13, [x + Math.sin(k * 2.1) * 0.18, y - 0.18, Math.cos(k * 2.1) * 0.18]);
  });
}

/** Everything that never moves, merged into one mesh per colour. */
function buildScenery(b: Batch) {
  for (const s of stops) {
    const { at, yaw } = frameOf(s.angle);
    b.place(at, yaw, () => LANDMARK_MODELS[s.id](b));
  }
  // Palms along the beach, kept clear of the stops.
  [
    [35, 1.2, 4.2], [52, 1.6, 3.6], [112, 1.3, 4.4], [128, 1.8, 3.4], [178, 1.2, 4.0], [-165, 1.5, 3.8],
    [-112, 1.3, 4.3], [-95, 1.7, 3.5], [-40, 1.2, 4.0], [-22, 1.6, 3.4], [96, 1.4, 3.8], [-4, 1.5, 3.6],
  ].forEach(([angle, inset, height]) => palm(b, angle, inset, height));
  // Rocks at the waterline and out in the shallows.
  [
    [24, -1.0, 0.7], [62, -2.5, 0.5], [140, -1.2, 0.8], [-58, -2.0, 0.6], [-120, -1.0, 0.9], [-178, -3.0, 0.5], [100, -4.0, 0.6], [-10, -3.5, 0.45],
  ].forEach(([angle, inset, size], i) => {
    b.rock(i % 2 ? ROCK : ROCK_DARK, size, [...onSand(angle, inset)].map((v, k) => (k === 1 ? -0.45 : v)) as [number, number, number], [i, i * 2, 0], [1.2, 0.7, 1]);
  });
  // A basketball hoop on the beach: every barangay has one.
  b.place(onSand(43, 2.2), rad(43) + Math.PI, () => {
    court(b);
    b.shadow([0, -0.3], [0.9, 0.5], 2.5);
    b.cyl(STEEL, [0.07, 0.07, 3.0], [0, 1.5, -0.5], undefined, 6);
    b.box(WHITE, [1.2, 0.8, 0.06], [0, 3.0, -0.25]);
    b.box(RED, [0.4, 0.3, 0.07], [0, 2.85, -0.24]);
    b.cyl(ORANGE, [0.25, 0.25, 0.04], [0, 2.7, 0.05], undefined, 10);
  });
  // The waiting shed on the far side: a collider too (SHED in world.ts), so the jeepney bumps it.
  const shed = stopPosition(SHED.angle, SHED.radius);
  b.place([shed.x, 0, shed.z], rad(SHED.angle) + Math.PI, () => waitingShed(b));
  tufts(b);
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

const lighthouse = frameOf(stops.find((s) => s.id === "lumenfold")!.angle);
const pier = frameOf(stops.find((s) => s.id === "about")!.angle);

/** One side of the lighthouse beam: an open cone that fades out towards its wide end (alpha per vertex). */
function beamGeometry() {
  const length = 7;
  const g = new ConeGeometry(0.9, length, 12, 1, true);
  const pos = g.attributes.position;
  const rgba = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) rgba.set([1, 1, 1, 0.3 * (0.5 + pos.getY(i) / length)], i * 4); // 0.3 at the lamp, 0 at the end
  g.setAttribute("color", new BufferAttribute(rgba, 4));
  return g;
}
const BEAM = beamGeometry();

/** The stops' landmarks, palms, rocks and props. A click on a landmark drives to that stop and opens it. */
export function Landmarks({ onStop }: { onStop: (id: string) => void }) {
  const beam = useRef<Group>(null!);
  const boat = useRef<Group>(null!);
  const calm = useCalm();
  // The "go" cursor goes on the canvas, not the page: scrolling away from a hovered landmark fires no
  // "pointer out", and a body cursor would then stick over the project list.
  const canvas = useThree((s) => s.gl.domElement);
  const setCursor = (c: string) => () => (canvas.style.cursor = c);

  useFrame(({ clock }, delta) => {
    if (calm.current) return; // reduced motion: the beam and the boat hold still
    const t = clock.elapsedTime;
    beam.current.rotation.y += Math.min(delta, 1 / 20) * 0.9;
    boat.current.position.y = Math.sin(t * 1.3) * 0.06;
    boat.current.rotation.z = Math.sin(t * 1.1) * 0.04;
    boat.current.rotation.x = Math.sin(t * 0.9 + 1) * 0.02;
  });

  return (
    <group>
      <Batched build={buildScenery} />

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
          <cylinderGeometry args={[LANDMARKS[i].r, LANDMARKS[i].r, s.id === "lumenfold" ? 16 : 3, 8]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ))}

      {/* Lighthouse lamp and its slowly turning beam (glow only: no light source, so it costs nothing to shade). */}
      <group position={lighthouse.at} rotation-y={lighthouse.yaw}>
        <mesh position={[0, 7.0, -1.4]}>
          <cylinderGeometry args={[0.42, 0.42, 0.7, 10]} />
          <meshBasicMaterial color="#ffe38a" />
        </mesh>
        <group ref={beam} position={[0, 7.0, -1.4]}>
          {[1, -1].map((side) => (
            <mesh key={side} geometry={BEAM} position-x={side * 3.5} rotation-z={(side * Math.PI) / 2}>
              <meshBasicMaterial color="#fff6d8" vertexColors transparent depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>

      {/* The bangka, moored beside the end of the pier, rocking on the water. */}
      <group position={pier.at} rotation-y={pier.yaw}>
        <group position={[2.6, -0.55, -11.5]}>
          <group ref={boat}>
            <Batched build={buildBangka} ao={false} />
          </group>
        </group>
      </group>
    </group>
  );
}
