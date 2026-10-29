"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DoubleSide,
  ShaderMaterial,
  Vector3,
  type Group,
  type Mesh,
  type SpriteMaterial,
} from "three";
import { stops } from "@/lib/stops";
import { LANDMARKS, SHORE_Z, site } from "@/lib/world";
import { Batched, type Batch, type Vec } from "./Batched";
import { parkedJeepney } from "./Jeepney";
import { makeRouteSign } from "./routeSign";
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


const GLOW = "#ffd76a"; // lit windows full of lamps
const CAPIZ = "#efe6cf"; // shell-paned windows
const GREEN = "#3f7d4a";
const GLASS = "#3d4a5c";
const SHUTTER = "#98a2a8";
const SHUTTER_LINE = "#7d868c";
const TANK = "#2f6db5";
const TARP = "#e98a3a";

/**
 * A landmark's shopfront line in its frame: level with the town's shophouses, 2 m back from the kerb, so the sidewalk
 * (where racks, pots and tables stand) runs in front of it.
 */
const FRONT = -1.4;

/** Where the weather station's mast stands in its landmark frame, and how tall it is (the cups spin on top). */
const MAST: Vec = [3.6, 0, FRONT - 3.2];
const MAST_HEIGHT = 12;

/**
 * Lumenfold's roof lamp: its turntable at the front of the roof, the elbow it nods from, and its shade, tilted below
 * level and reaching out over the sidewalk. Kept low (~8 m) and forward, so it's in frame when you park in front.
 */
const LUMEN_ROOF = 5.6;
const LAMP_BASE: Vec = [0, LUMEN_ROOF + 0.25, FRONT - 1.3];
const LAMP_ELBOW: Vec = [0, 1.6, 0.9]; // in the turntable's frame
const LAMP_SHADE: Vec = [0, 0.35, 1.6]; // in the elbow's frame
const SHADE_TILT = 0.9; // radians below level
const SHADE_DIR = new Vector3(0, -Math.sin(SHADE_TILT), Math.cos(SHADE_TILT));

/** The carinderia's pots, in its frame: steam rises from them. */
const POTS: Vec[] = [-1.6, -0.55, 0.55, 1.6].map((x) => [x, 1.42, FRONT - 0.45]);

/** Small parts with no bevel (a bevel is invisible on them and costs 108 triangles instead of 12). */
function plain(b: Batch, color: string, size: Vec, at: Vec, rot?: Vec) {
  b.add(color, new BoxGeometry(...size), at, rot);
}

/** A roll-up shutter `w` wide from the ground to `top`, raised to `open` (the dark shop shows below it). */
function shutter(b: Batch, w: number, top: number, open: number, at: Vec) {
  const [x, , z] = at;
  if (open) plain(b, DARK, [w, open, 0.04], [x, open / 2, z]);
  plain(b, SHUTTER, [w, top - open, 0.05], [x, (top + open) / 2, z + 0.01]);
  for (let y = open + 0.25; y < top; y += 0.25) plain(b, SHUTTER_LINE, [w, 0.025, 0.06], [x, y, z + 0.01]);
}

/** A plastic water tank on a steel stand, on a roof (`at` is its foot). */
function tank(b: Batch, at: Vec) {
  const [x, y, z] = at;
  for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) plain(b, STEEL, [0.04, 0.6, 0.04], [x + dx, y + 0.3, z + dz]);
  b.cyl(TANK, [0.5, 0.52, 1.1], [x, y + 1.15, z], undefined, 8);
}

/**
 * Windows round a two-storey landmark's upper floor, on the back and the sides: the view turns, so they're seen now.
 * Panes in the colour of its front windows, white sills. `sides`: the side walls (-1 left, 1 right) not already dressed.
 */
function rearWindows(b: Batch, [W, D, cx]: Vec, y: number, pane: string, sides = [-1, 1]) {
  const n = Math.max(1, Math.floor(W / 2.2));
  for (let i = 0; i < n; i++) {
    const x = cx - W / 2 + (W * (i + 0.5)) / n;
    plain(b, pane, [1.1, 1.3, 0.05], [x, y, FRONT - D - 0.02]);
    plain(b, WHITE, [1.25, 0.08, 0.14], [x, y - 0.7, FRONT - D - 0.06]);
  }
  for (const side of sides) {
    for (const z of [FRONT - D / 3, FRONT - (2 * D) / 3]) {
      plain(b, pane, [0.05, 1.3, 1.1], [cx + side * (W / 2 + 0.02), y, z]);
      plain(b, WHITE, [0.14, 0.08, 1.25], [cx + side * (W / 2 + 0.06), y - 0.7, z]);
    }
  }
}

/**
 * Each landmark is drawn in its own frame (world.ts `site()`): the origin is just behind its kerb, +z faces its street,
 * -z runs into the block. Footprints and lots match FOOTPRINTS in world.ts. Signboards with words are separate meshes
 * (SIGNS below), and so are the moving parts (Lumenfold's lamp, Bagyo's cups and radar, the carinderia's steam).
 */
const LANDMARK_MODELS: Record<string, (b: Batch) => void> = {
  // FashionHub: an ukay-ukay boutique in a two-storey shophouse. Capiz windows upstairs, mannequins and a striped
  // awning below, the shutter half up, and a rack of clothes on the sidewalk swinging in the wind.
  fashionhub(b) {
    const [W, D, H] = [7.6, 5, 6.2];
    const mid = FRONT - D / 2;
    b.shadow([0, mid], [W / 2 + 0.6, D / 2 + 0.6], H * 0.4);
    b.box(TEAL, [W, H, D], [0, H / 2, mid]);
    b.box(WHITE, [W + 0.3, 0.3, D + 0.3], [0, H + 0.1, mid]); // cornice
    b.box(WHITE, [W + 0.1, 0.16, 0.14], [0, 4.1, FRONT + 0.07]); // ledge between the floors
    // The display: a dark recess in a white frame, three mannequins in front of it.
    plain(b, DARK, [4.0, 2.4, 0.05], [-1.5, 1.4, FRONT + 0.01]);
    b.box(WHITE, [4.3, 0.12, 0.14], [-1.5, 2.66, FRONT + 0.07]);
    b.box(WHITE, [4.3, 0.24, 0.14], [-1.5, 0.12, FRONT + 0.07]);
    for (const x of [-3.6, 0.6]) b.box(WHITE, [0.12, 2.6, 0.14], [x, 1.35, FRONT + 0.07]);
    [RED, YELLOW, BLUE].forEach((c, i) => {
      const [x, z] = [-2.7 + i * 1.2, FRONT + 0.4];
      b.shadow([x, z], [0.35, 0.35], 1.5);
      plain(b, STEEL, [0.04, 0.6, 0.04], [x, 0.3, z]);
      b.cyl(c, [0.12, 0.36, 0.9], [x, 1.05, z], undefined, 8); // the dress
      b.cyl(CREAM, [0.1, 0.13, 0.24], [x, 1.62, z], undefined, 6);
      b.ball(CREAM, 0.12, [x, 1.87, z]);
    });
    shutter(b, 2.4, 2.6, 1.2, [2.3, 0, FRONT + 0.02]);
    for (let i = 0; i < 8; i++) b.box(i % 2 ? WHITE : RED, [0.55, 0.05, 1.1], [-3.43 + i * 0.55, 2.98, FRONT + 0.5], [0.35, 0, 0]);
    b.box(DARK, [4.5, 0.82, 0.08], [0, 3.58, FRONT + 0.04]); // the signboard's frame (its words: SIGNS)
    // Capiz windows: shell panes in a wooden grid.
    for (const x of [-2.4, 0, 2.4]) {
      plain(b, CAPIZ, [1.4, 1.3, 0.05], [x, 5.0, FRONT + 0.02]);
      for (let k = 1; k < 4; k++) {
        plain(b, WOOD_DARK, [0.03, 1.3, 0.06], [x - 0.7 + k * 0.35, 5.0, FRONT + 0.04]);
        plain(b, WOOD_DARK, [1.4, 0.03, 0.06], [x, 4.35 + k * 0.325, FRONT + 0.04]);
      }
      b.box(WOOD, [1.6, 0.1, 0.16], [x, 4.32, FRONT + 0.08]);
    }
    tank(b, [2.3, H + 0.25, FRONT - 3.6]);
    rearWindows(b, [W, D, 0], 5.0, CAPIZ);
    // The rack on the sidewalk: its clothes hang from the rail and swing (sway measured from the rail).
    const [rx, rz] = [3.0, -0.25];
    for (const x of [rx - 0.65, rx + 0.65]) plain(b, STEEL, [0.04, 1.5, 0.04], [x, 0.75, rz]);
    plain(b, STEEL, [1.4, 0.04, 0.04], [rx, 1.5, rz]);
    b.place([rx, 1.5, rz], 0, () =>
      b.sway(0.3, 1, () => [PINK, YELLOW, TEAL, ORANGE].forEach((c, i) => plain(b, c, [0.26, 0.55, 0.05], [-0.45 + i * 0.3, -0.31, 0]))),
    );
  },

  // Sprig & Stone: a shophouse taken over by plants. A balcony of hanging pots, a shade-net awning over the shop,
  // tiers of pots spilling onto the sidewalk, and a bamboo trellis of vines up the side wall the camera sees.
  sprig(b) {
    const [W, D, H] = [7.4, 5, 6.0];
    const mid = FRONT - D / 2;
    b.shadow([0, mid], [W / 2 + 0.6, D / 2 + 0.6], H * 0.4);
    b.box(CREAM, [W, H, D], [0, H / 2, mid]);
    b.box(GREEN, [W + 0.2, 0.3, D + 0.2], [0, H + 0.1, mid]);
    plain(b, DARK, [W - 1, 2.4, 0.05], [0, 1.25, FRONT + 0.01]);
    b.box(GREEN, [W - 0.2, 0.8, 0.1], [0, 2.95, FRONT + 0.05]); // fascia, its name on a signboard (SIGNS)
    b.box(SHADE, [W, 0.04, 1.7], [0, 2.45, FRONT + 0.85], [0.12, 0, 0]);
    for (const x of [-W / 2 + 0.2, W / 2 - 0.2]) b.cyl(BAMBOO, [0.05, 0.06, 2.4], [x, 1.2, FRONT + 1.6], undefined, 4);
    // The balcony, its railing, and pots hanging from its edge.
    const floor = 3.4;
    b.box(WOOD, [W - 0.6, 0.12, 0.9], [0, floor, FRONT + 0.45]);
    plain(b, WOOD_DARK, [W - 0.6, 0.06, 0.06], [0, floor + 0.9, FRONT + 0.87]);
    for (let x = -W / 2 + 0.3; x <= W / 2 - 0.3; x += 0.34) plain(b, WOOD_DARK, [0.04, 0.85, 0.04], [x, floor + 0.47, FRONT + 0.87]);
    for (const x of [-2.4, 0, 2.4]) {
      plain(b, GLASS, [1.0, 1.6, 0.05], [x, floor + 1.0, FRONT + 0.02]);
      for (const s of [-1, 1]) plain(b, GREEN, [0.42, 1.6, 0.05], [x + s * 0.74, floor + 1.0, FRONT + 0.03]); // open shutters
      b.cone(LEAF_DARK, 0.22, 0.7, [x + 0.55, floor + 0.45, FRONT + 0.4]); // plants on the balcony floor
    }
    for (let i = 0; i < 6; i++) {
      b.place([-2.6 + i * 1.04, floor - 0.06, FRONT + 0.8], 0, () =>
        b.sway(0.35, 1, () => {
          plain(b, DARK, [0.012, 0.42, 0.012], [0, -0.21, 0]);
          b.cyl(TERRACOTTA, [0.17, 0.12, 0.22], [0, -0.52, 0]);
          b.ball(i % 2 ? LEAF : LEAF_DARK, 0.2, [0, -0.36, 0], [1, 0.8, 1]);
          b.box(LEAF, [0.07, 0.45, 0.07], [0.1, -0.78, 0.05]); // a trailing vine
        }),
      );
    }
    // Tiers of pots on the sidewalk, left of the door; two big pots to the right.
    for (let t = 0; t < 3; t++) {
      const [h, z] = [0.25 + t * 0.35, 0.05 - t * 0.42];
      b.box(WOOD_DARK, [1.9, h, 0.42], [-2.5, h / 2, z]);
      for (let k = 0; k < 4; k++) {
        const x = -3.2 + k * 0.46;
        b.cyl(TERRACOTTA, [0.15, 0.11, 0.22], [x, h + 0.11, z]);
        if ((k + t) % 2) b.cone(LEAF_DARK, 0.17, 0.45, [x, h + 0.42, z]);
        else b.ball(LEAF, 0.2, [x, h + 0.34, z], [1, 0.85, 1]);
        if ((k + t) % 3 === 0) b.ball(PINK, 0.07, [x + 0.08, h + 0.48, z + 0.08]);
      }
    }
    for (const x of [2.3, 3.2]) {
      b.cyl(TERRACOTTA, [0.3, 0.22, 0.45], [x, 0.23, -0.2]);
      b.cone(LEAF_DARK, 0.32, 1.2, [x, 1.0, -0.2]);
    }
    rearWindows(b, [W, D, 0], floor + 1.0, GLASS, [1]); // the other side has the trellis
    b.box(GREEN, [0.08, 0.78, 4.2], [-W / 2 - 0.04, 5.15, FRONT - 2.5]); // the side sign's frame (SIGNS), above the trellis
    // The bamboo trellis on the side wall facing the camera (-x), vines climbing it.
    const sx = -W / 2 - 0.12;
    for (const z of [-0.6, -1.8, -3.0, -4.2]) b.cyl(BAMBOO, [0.04, 0.04, 4.6], [sx, 2.3, FRONT + z + 0.4], undefined, 4);
    for (const y of [0.9, 2.0, 3.1, 4.2]) b.cyl(BAMBOO, [0.035, 0.035, 4.0], [sx, y, FRONT - 1.6], [Math.PI / 2, 0, 0], 4);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 16; k++) {
      const [y, z] = [0.3 + rnd() * 4.1, FRONT + 0.2 - rnd() * 3.8];
      const r = 0.28 + rnd() * 0.12;
      b.place([sx - 0.06, 0, z], 0, () => b.sway(0.02, 1.5, () => b.ball(k % 3 ? LEAF : LEAF_DARK, r, [0, y, 0], [0.55, 1, 1])));
    }
  },

  // Lumenfold: a narrow lamp shop, every window lit and hung with lamps, a sign down its corner. The giant desk lamp on
  // its roof turns and nods (drawn separately). Two storeys, not the plan's three, so the lamp stays in frame.
  lumenfold(b) {
    const [W, D, H] = [4.6, 5, LUMEN_ROOF];
    const mid = FRONT - D / 2;
    b.shadow([0, mid], [W / 2 + 0.6, D / 2 + 0.6], H * 0.4);
    b.box(CREAM, [W, H, D], [0, H / 2, mid]);
    b.box(DARK, [W + 0.2, 0.25, D + 0.2], [0, H + 0.1, mid]);
    // The shop window: lit, three big shades hanging in it.
    plain(b, GLOW, [W - 0.8, 2.3, 0.05], [0, 1.35, FRONT + 0.01]);
    for (const x of [-(W / 2 - 0.35), W / 2 - 0.35]) b.box(WOOD_DARK, [0.14, 2.6, 0.14], [x, 1.3, FRONT + 0.07]);
    b.box(WOOD_DARK, [W - 0.5, 0.14, 0.14], [0, 2.6, FRONT + 0.07]);
    for (const x of [-1.1, 0, 1.1]) {
      plain(b, DARK, [0.012, 0.55, 0.012], [x, 2.25, FRONT + 0.25]);
      b.cone(DARK, 0.3, 0.34, [x, 1.82, FRONT + 0.25]);
    }
    // Upper floors: two lit windows each, a lamp in every one.
    for (const [k, y0] of [3.0].entries()) {
      for (const x of [-1.0, 1.0]) {
        plain(b, GLOW, [1.2, 1.4, 0.05], [x, y0 + 1.1, FRONT + 0.01]);
        b.box(WOOD, [1.35, 0.08, 0.16], [x, y0 + 0.36, FRONT + 0.08]);
        plain(b, DARK, [0.012, 0.3, 0.012], [x, y0 + 1.65, FRONT + 0.12]);
        b.cone(k ? RED : TEAL, 0.2, 0.24, [x, y0 + 1.4, FRONT + 0.12]);
      }
    }
    b.box(DARK, [0.1, 2.5, 0.95], [W / 2 + 0.55, 4.1, FRONT - 0.1]); // the corner sign's back (its words: SIGNS)
    for (const y of [3.1, 5.1]) plain(b, STEEL, [0.6, 0.05, 0.05], [W / 2 + 0.25, y, FRONT - 0.1]);
    b.box(DARK, [1.4, 0.9, 1.0], [-1.2, H + 0.55, FRONT - 4.2]); // roof stair hut
    rearWindows(b, [W, D, 0], 4.1, GLOW); // lit all round
  },

  // Bagyo: the PAGASA weather office. White, a blue band, a radar dome on the roof, the lattice mast beside it with its
  // typhoon flags (its cups and the radar spin, drawn separately), and the typhoon signal board by the door (SignalBoard).
  bagyo(b) {
    const [W, D, H, cx] = [6.6, 5, 6.2, -1.4];
    const mid = FRONT - D / 2;
    b.shadow([cx, mid], [W / 2 + 0.6, D / 2 + 0.6], H * 0.4);
    b.box(WHITE, [W, H, D], [cx, H / 2, mid]);
    b.box(BLUE, [W + 0.06, 0.42, D + 0.06], [cx, 3.3, mid]);
    b.box(WHITE, [W + 0.2, 0.3, D + 0.2], [cx, H + 0.1, mid]);
    b.box(BLUE, [W + 0.22, 0.08, D + 0.22], [cx, H + 0.2, mid]);
    plain(b, WOOD_DARK, [1.0, 2.2, 0.05], [cx - 0.6, 1.1, FRONT + 0.02]); // door
    b.box(CONCRETE, [1.6, 0.12, 0.6], [cx - 0.6, 0.06, FRONT + 0.3]); // its step
    plain(b, GLASS, [1.1, 1.1, 0.05], [cx - 2.4, 1.55, FRONT + 0.02]);
    for (const x of [-2.4, -0.8, 0.8, 2.4]) {
      plain(b, GLASS, [1.0, 1.1, 0.05], [cx + x, 4.75, FRONT + 0.02]);
      b.box(WHITE, [1.15, 0.08, 0.14], [cx + x, 4.15, FRONT + 0.08]);
    }
    rearWindows(b, [W, D, cx], 4.75, GLASS);
    b.box(DARK, [2.75, 0.52, 0.06], [cx + 1.6, 1.75, FRONT + 0.03]); // the signal board's frame
    b.box(DARK, [2.5, 0.48, 0.06], [cx - 0.6, 2.72, FRONT + 0.03]); // the name board's frame
    // Notice board on legs on the sidewalk.
    for (const x of [cx - 3.3, cx - 2.3]) plain(b, STEEL, [0.05, 1.4, 0.05], [x, 0.7, -0.3]);
    b.box(WHITE, [1.2, 0.8, 0.06], [cx - 2.8, 1.45, -0.3]);
    for (let k = 0; k < 3; k++) plain(b, ZINC, [0.9, 0.05, 0.02], [cx - 2.8, 1.65 - k * 0.2, -0.26]);
    // The radar dome on its drum, at the front of the roof (further back, it's above the screen when you park).
    b.cyl(CONCRETE, [0.75, 0.8, 0.6], [cx - 1.6, H + 0.55, FRONT - 1.3], undefined, 10);
    b.ball(WHITE, 0.95, [cx - 1.6, H + 0.9, FRONT - 1.3], [1, 0.95, 1]);
    // The mast: three legs leaning in, zigzag bracing, a yard with a wind vane and two typhoon flags.
    b.shadow([MAST[0], MAST[2]], [0.9, 0.9], 3);
    const [mx, , mz] = MAST;
    const leg = (i: number, y: number): Vec => {
      const a = (i * 2 * Math.PI) / 3 + 0.3, r = 0.7 - (0.55 * y) / MAST_HEIGHT;
      return [mx + Math.sin(a) * r, y, mz + Math.cos(a) * r];
    };
    for (let i = 0; i < 3; i++) {
      strut(b, STEEL, leg(i, 0.1), leg(i, MAST_HEIGHT), 0.08);
      for (let y = 0.4; y < MAST_HEIGHT - 0.6; y += 1.2) {
        strut(b, STEEL, leg(i, y), leg(i + 1, y), 0.035);
        strut(b, STEEL, leg(i, y), leg(i + 1, y + 1.2), 0.03);
      }
    }
    const top = MAST_HEIGHT;
    b.cyl(DARK, [0.28, 0.28, 0.06], [mx, top + 0.03, mz], undefined, 8);
    b.cyl(STEEL, [0.03, 0.03, 0.6], [mx, top + 0.3, mz], undefined, 6); // spindle for the cups
    b.box(STEEL, [1.9, 0.05, 0.05], [mx, top - 1.4, mz]);
    b.box(STEEL, [0.9, 0.03, 0.03], [mx - 0.95, top - 0.85, mz]);
    b.box(STEEL, [0.03, 0.55, 0.03], [mx - 0.95, top - 1.1, mz]);
    b.cone(RED, 0.08, 0.22, [mx - 1.48, top - 0.85, mz], [0, 0, Math.PI / 2], 4);
    b.box(RED, [0.25, 0.2, 0.02], [mx - 0.52, top - 0.85, mz]);
    for (const y of [top - 1.45, top - 2.1]) {
      b.place([mx + 0.9, y, mz], 0, () =>
        b.sway(0.14, 1, () => {
          b.box(RED, [0.55, 0.55, 0.02], [0.3, -0.28, 0]);
          b.box(DARK, [0.22, 0.22, 0.035], [0.3, -0.28, 0]);
        }),
      );
    }
    plain(b, DARK, [0.012, 1.3, 0.012], [mx + 0.9, top - 2.05, mz]); // halyard
  },

  // Recipe Finder: a carinderia. A single-storey eatery under a big scalloped tarpaulin on poles: a counter of steel pots
  // (steam rises from them, drawn separately), a menu board, blue plastic tables and stools on the sidewalk.
  recipes(b) {
    const [W, D, H] = [7.2, 4.2, 3.5];
    const back = FRONT - 0.8; // the room sits back under the tarp
    const mid = back - D / 2;
    b.shadow([0, mid + 0.6], [W / 2 + 0.7, D / 2 + 1.2], H * 0.4);
    b.box(CREAM, [W, H, D], [0, H / 2, mid]);
    b.box(ZINC, [W + 0.3, 0.08, D + 0.3], [0, H + 0.04, mid]);
    plain(b, DARK, [W - 1.2, 2.4, 0.05], [0, 1.3, back + 0.01]);
    b.flat(() => b.box(CONCRETE, [W + 0.4, 0.06, 1.2], [0, 0.03, back + 0.6])); // the floor under the tarp
    b.box(YELLOW, [W - 1.6, 1.0, 0.6], [0, 0.55, FRONT - 0.45]); // counter
    b.box(STEEL, [W - 1.5, 0.05, 0.66], [0, 1.07, FRONT - 0.45]);
    for (const [x, y, z] of POTS) {
      b.cyl(STEEL, [0.24, 0.22, 0.32], [x, y - 0.18, z], undefined, 10);
      b.cyl(DARK, [0.25, 0.25, 0.03], [x, y - 0.01, z], undefined, 10);
      b.ball(DARK, 0.04, [x, y + 0.03, z]);
    }
    // Menu board on the wall: dark slate, chalk lines.
    b.box(WOOD_DARK, [1.0, 0.8, 0.06], [2.6, 2.15, back + 0.04]);
    for (let k = 0; k < 4; k++) plain(b, WHITE, [0.65 - (k % 2) * 0.2, 0.04, 0.02], [2.55, 2.4 - k * 0.16, back + 0.08]);
    // The tarp: one big sheet sloping out from the wall over the sidewalk, scalloped along its front edge, on poles.
    const edge = 0.15;
    const [y0, y1] = [3.3, 2.55];
    const run = Math.hypot(edge - back, y0 - y1);
    b.box(TARP, [W + 1, 0.04, run], [0, (y0 + y1) / 2, (back + edge) / 2], [Math.atan2(y0 - y1, edge - back), 0, 0]);
    for (let k = 0; k < 13; k++) b.cyl(TARP, [0.32, 0.32, 0.03], [-(W + 1) / 2 + 0.32 + k * 0.6, y1, edge], [Math.PI / 2, 0, 0], 8);
    b.box(WHITE, [W + 1, 0.06, 0.05], [0, y1 + 0.02, edge + 0.02]);
    for (const x of [-(W / 2 + 0.3), 0, W / 2 + 0.3]) plain(b, STEEL, [0.05, y1, 0.05], [x, y1 / 2, edge - 0.05]);
    b.box(DARK, [3.6, 0.62, 0.06], [-0.6, 3.0, back + 0.03]); // its name board's frame (SIGNS)
    b.box(DARK, [0.06, 0.6, 3.1], [W / 2 + 0.03, 2.1, FRONT - 3.4]); // and on the side wall the camera sees
    // Blue plastic tables and stools on the sidewalk.
    for (const tx of [-2.6, 2.6]) {
      b.shadow([tx, -0.2], [0.7, 0.6], 0.8);
      b.box(BLUE, [0.85, 0.05, 0.85], [tx, 0.72, -0.2]);
      for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) plain(b, BLUE, [0.04, 0.7, 0.04], [tx + dx, 0.35, -0.2 + dz]);
      for (const dx of [-0.75, 0.75]) b.cyl(BLUE, [0.18, 0.15, 0.42], [tx + dx, 0.21, -0.2], undefined, 8);
    }
  },

  // About: the jeepney terminal, where every route starts and ends. A long shed roof over a queue, route boards hanging
  // from it (SIGNS), queue rails, a dispatcher's booth, and jeepneys parked waiting for passengers. Its yard runs back to
  // the bay boulevard; the pier is across it (pier() below).
  about(b) {
    const [front, back] = [-0.6, -7.2];
    const mid = (front + back) / 2;
    b.shadow([0, mid], [6.4, 3.6], 3);
    for (const x of [-5.6, -1.9, 1.9, 5.6]) {
      for (const z of [front, back]) b.box(STEEL, [0.14, 3.8, 0.14], [x, 1.9, z]);
    }
    b.box(BLUE, [12.2, 0.14, 7.4], [0, 3.95, mid], [-0.07, 0, 0]); // the shed roof, rising a little to the back
    b.box(RED, [12.2, 0.25, 0.08], [0, 3.62, front + 0.12]);
    for (const x of [-3.6, 3.6]) {
      for (const dx of [-0.9, 0.9]) plain(b, DARK, [0.015, 0.5, 0.015], [x + dx, 3.25, front + 0.05]);
      b.box(DARK, [2.4, 0.46, 0.06], [x, 2.85, front + 0.05]); // a route board's frame (SIGNS)
    }
    // The queue rails and the waiting bench, on the left; the dispatcher's booth by them.
    for (const z of [-1.6, -2.4]) plain(b, STEEL, [3.8, 0.05, 0.05], [-3.6, 0.95, z]);
    for (const x of [-5.4, -3.6, -1.8]) for (const z of [-1.6, -2.4]) plain(b, STEEL, [0.05, 0.95, 0.05], [x, 0.48, z]);
    b.box(CONCRETE, [3.6, 0.1, 0.5], [-3.6, 0.45, -6.5]);
    for (const x of [-5, -2.2]) b.box(CONCRETE, [0.12, 0.42, 0.42], [x, 0.21, -6.5]);
    b.box(WOOD, [1.3, 2.3, 1.3], [-4.6, 1.15, -4.2]);
    plain(b, GLASS, [0.9, 0.6, 0.04], [-4.6, 1.5, -3.53]);
    b.box(BLUE, [1.6, 0.1, 1.6], [-4.6, 2.35, -4.2]);
    // A jeepney waiting under the shed, nose to the street, and one more out in the yard. The bay beside it (x 3.6) is
    // the traffic jeepney's that does laps of the town (TRACKS.terminal in traffic.ts).
    b.place([0.4, 0, -3.9], 0, () => parkedJeepney(b));
    b.place([-3.2, 0, -10.2], 0.5, () => parkedJeepney(b));
    banderitas(b, [-5.6, 3.5, front + 0.05], [5.6, 3.5, front + 0.05], 0.35, 14);
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

/** A motorcycle with a roofed sidecar, the town's other public transport. Faces +z from `at`. */
export function tricycle(b: Batch, at: Vec, yaw: number) {
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

const lumenfold = frameOf("lumenfold");
const station = frameOf("bagyo");
const carinderia = frameOf("recipes");
const plantShop = frameOf("sprig");

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

/** The weather office's radar: a dish on a post, tipped up a little, turning on the roof. */
const RADAR: Vec = [0.9, 6.45, FRONT - 1.1];
function buildRadar(b: Batch) {
  b.cyl(STEEL, [0.06, 0.09, 0.7], [0, 0.35, 0], undefined, 6);
  b.cyl(WHITE, [0.55, 0.12, 0.2], [0, 0.95, 0.05], [Math.PI / 2 - 0.3, 0, 0], 10); // wide face forward
  b.box(DARK, [0.04, 0.04, 0.5], [0, 1.0, 0.3]); // its feed
}

/** Lumenfold's lamp, the part that turns: a turntable and the paired lower arms up to the elbow. */
function buildLampBase(b: Batch) {
  b.cyl(DARK, [0.8, 0.9, 0.25], [0, 0.12, 0], undefined, 12);
  b.cyl(DARK, [0.25, 0.3, 0.3], [0, 0.4, 0], undefined, 8);
  for (const x of [-0.13, 0.13]) strut(b, DARK, [x, 0.45, 0], [x, LAMP_ELBOW[1], LAMP_ELBOW[2]], 0.12);
  strut(b, STEEL, [0, 0.6, 0.15], [0, LAMP_ELBOW[1] - 0.4, LAMP_ELBOW[2] - 0.05], 0.05); // the spring
}

/** ...and the part that nods, from the elbow: the upper arms and the red shade, opening along SHADE_DIR. */
function buildLampHead(b: Batch) {
  b.ball(RED, 0.24, [0, 0, 0]);
  for (const x of [-0.13, 0.13]) strut(b, DARK, [x, 0, 0], [x, LAMP_SHADE[1], LAMP_SHADE[2]], 0.11);
  b.ball(RED, 0.2, LAMP_SHADE);
  const at = new Vector3(...LAMP_SHADE).addScaledVector(SHADE_DIR, 0.35);
  b.cone(RED, 0.8, 0.9, [at.x, at.y, at.z], [SHADE_TILT - Math.PI / 2, 0, 0], 12);
}
const BULB = new Vector3(...LAMP_SHADE).addScaledVector(SHADE_DIR, 0.7);

const BEAM_LENGTH = 9;
const BEAM = new ConeGeometry(1.6, BEAM_LENGTH, 16, 1, true);
const BEAM_AT = BULB.clone().addScaledVector(SHADE_DIR, BEAM_LENGTH / 2);

/**
 * The lamp beam's shader: brightest at the lamp and fading out along its length, soft at its edges
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

/** A soft round glow (`rgb` in the centre fading to clear), drawn once into a small canvas: the lamp's halo, the steam's puffs. */
function glowTexture(rgb = "255,240,200") {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const fill = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  fill.addColorStop(0, `rgba(${rgb},1)`);
  fill.addColorStop(0.3, `rgba(${rgb},0.5)`);
  fill.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = fill;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

/**
 * Steam off the carinderia's pots: a few soft puffs per pot, as one points mesh. They drift out towards the street as
 * they rise, so they billow from under the tarp's edge (seen from above, the tarp hides the pots).
 */
const PUFFS = 5;
function steamGeometry() {
  const n = POTS.length * PUFFS;
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(n * 4).fill(1), 4)); // alpha per puff
  rise(g, 0);
  return g;
}
function rise(g: BufferGeometry, t: number) {
  const pos = g.attributes.position as BufferAttribute;
  const col = g.attributes.color as BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = POTS[Math.floor(i / PUFFS)];
    const f = (t * 0.32 + (i % PUFFS) / PUFFS + Math.floor(i / PUFFS) * 0.13) % 1; // 0 leaving the pot, 1 gone
    pos.setXYZ(i, x + Math.sin(t * 1.7 + i * 2.3) * 0.2 * f, y + 0.1 + f * 2.1, z + f * 2.6 + Math.cos(t * 1.3 + i) * 0.08 * f);
    col.setW(i, Math.sin(f * Math.PI) * 0.65);
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
}

/**
 * A few leaves letting go of Sprig & Stone's hanging pots and fluttering down to the sidewalk, drifting the way the wind
 * blows: one points mesh, like the steam. Each leaf falls for ~8 s, fading in as it leaves and out as it lands.
 */
const LEAVES = 8;
const LEAF_TOP = 2.9; // just under the hanging pots (sprig() above), over the shade-net awning
function leafGeometry() {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(LEAVES * 3), 3));
  const rgba = new Float32Array(LEAVES * 4);
  const tint = new Color();
  for (let i = 0; i < LEAVES; i++) rgba.set([...tint.set(i % 3 ? LEAF : "#8fb34a").toArray(), 1], i * 4); // some yellowing
  g.setAttribute("color", new BufferAttribute(rgba, 4));
  fall(g, 0);
  return g;
}
function fall(g: BufferGeometry, t: number) {
  const pos = g.attributes.position as BufferAttribute;
  const col = g.attributes.color as BufferAttribute;
  for (let i = 0; i < LEAVES; i++) {
    const f = (t * 0.12 + i / LEAVES + (i % 3) * 0.07) % 1; // 0 letting go, 1 on the ground
    const x = -2.6 + (i % 6) * 1.04; // under one of the six pots
    // Blown out past the awning's edge (FRONT + 1.7) before they sink below it, or the awning would hide them.
    const out = FRONT + 0.8 + 1.2 * Math.min(1, f * 7) + f * 0.6;
    pos.setXYZ(i, x + f * 0.9 + Math.sin(t * 1.1 + i * 1.7) * 0.35 * f, LEAF_TOP * (1 - f), out + Math.cos(t * 1.6 + i) * 0.15 * f);
    col.setW(i, Math.min(1, f * 6, (1 - f) * 5));
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
}
/** A leaf's outline: a pointed oval, white (the leaves' colours tint it). */
function leafTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.beginPath();
  g.moveTo(4, 28);
  g.quadraticCurveTo(4, 6, 28, 4);
  g.quadraticCurveTo(26, 26, 4, 28);
  g.fill();
  return new CanvasTexture(c);
}

/** Shop signs with real words, on the yellow plate the jeepney's route sign uses, each in its stop's frame. */
const SIGNS: { id: string; text: string; at: Vec; width: number; yaw?: number; upright?: boolean }[] = [
  { id: "fashionhub", text: "FashionHub · Ukay-ukay", at: [0, 3.58, FRONT + 0.09], width: 4.3 },
  { id: "sprig", text: "Sprig & Stone · Plants", at: [0, 2.95, FRONT + 0.11], width: 4.4 },
  { id: "sprig", text: "Sprig & Stone", at: [-3.79, 5.15, FRONT - 2.5], width: 4.0, yaw: -Math.PI / 2 }, // on the side the camera sees
  { id: "lumenfold", text: "Lumenfold Lamps", at: [2.91, 4.1, FRONT - 0.1], width: 2.35, yaw: Math.PI / 2, upright: true },
  { id: "lumenfold", text: "Lumenfold Lamps", at: [2.79, 4.1, FRONT - 0.1], width: 2.35, yaw: -Math.PI / 2, upright: true },
  { id: "bagyo", text: "PAGASA", at: [-2.0, 2.72, FRONT + 0.07], width: 2.4 },
  { id: "recipes", text: "Carinderia", at: [-0.6, 3.0, FRONT - 0.73], width: 3.5 },
  { id: "recipes", text: "Carinderia · Lutong Bahay", at: [3.69, 2.1, FRONT - 3.4], width: 2.9, yaw: Math.PI / 2 }, // the side the camera sees
  { id: "about", text: "Plaza · Bay", at: [-3.6, 2.85, -0.51], width: 2.3 },
  { id: "about", text: "Terminal · Pier", at: [3.6, 2.85, -0.51], width: 2.3 },
];
const SIGN_ASPECT = 512 / 80; // routeSign's canvas

function Signboard({ text, at, width, yaw = 0, upright = false }: Omit<(typeof SIGNS)[number], "id">) {
  const sign = useMemo(() => {
    const s = makeRouteSign();
    s.show(text);
    return s;
  }, [text]);
  return (
    <mesh position={at} rotation={[0, yaw, upright ? -Math.PI / 2 : 0]}>
      <planeGeometry args={[width, width / SIGN_ASPECT]} />
      <meshBasicMaterial map={sign.texture} />
    </mesh>
  );
}

/**
 * The typhoon signal board by the weather office's door. Park there and it steps up from Signal No. 1 to No. 5,
 * the scale Bagyo scrolls through; drive off and it drops back to 1.
 */
function SignalBoard({ nearId }: { nearId: string | null }) {
  const sign = useMemo(() => {
    const s = makeRouteSign();
    s.show("Signal No. 1");
    return s;
  }, []);
  const since = useRef(-1);
  useFrame(({ clock }) => {
    if (nearId !== "bagyo") {
      since.current = -1;
      sign.show("Signal No. 1");
      return;
    }
    if (since.current < 0) since.current = clock.elapsedTime;
    sign.show(`Signal No. ${Math.min(5, 1 + Math.floor((clock.elapsedTime - since.current) / 0.8))}`);
  });
  return (
    <mesh position={[0.2, 1.75, FRONT + 0.07]}>
      <planeGeometry args={[2.6, 2.6 / SIGN_ASPECT]} />
      <meshBasicMaterial map={sign.texture} />
    </mesh>
  );
}

// Scratch vectors for the lamp's halo (no allocations in the frame loop).
const bulbWorld = new Vector3();
const beamWorld = new Vector3();
const toCamera = new Vector3();

/** The stops' landmarks, palms, rocks and props. A click on a landmark drives to that stop and opens it. */
export function Landmarks({ onStop, nearId }: { onStop: (id: string) => void; nearId: string | null }) {
  const lampBase = useRef<Group>(null!);
  const lampHead = useRef<Group>(null!);
  const bulb = useRef<Mesh>(null!);
  const boat = useRef<Group>(null!);
  const cups = useRef<Group>(null!);
  const radar = useRef<Group>(null!);
  const halo = useRef<SpriteMaterial>(null!);
  const beamShader = useMemo(beamMaterial, []);
  const glow = useMemo(() => glowTexture(), []);
  const steam = useMemo(steamGeometry, []);
  const puff = useMemo(() => glowTexture("255,255,255"), []);
  const leaves = useMemo(leafGeometry, []);
  const leaf = useMemo(leafTexture, []);
  const calm = useCalm();
  // The "go" cursor goes on the canvas, not the page: scrolling away from a hovered landmark fires no
  // "pointer out", and a body cursor would then stick over the project list.
  const canvas = useThree((s) => s.gl.domElement);
  const setCursor = (c: string) => () => (canvas.style.cursor = c);

  useFrame(({ clock, camera }, delta) => {
    // The halo flares when the lamp points towards the camera.
    bulbWorld.setFromMatrixPosition(bulb.current.matrixWorld);
    beamWorld.copy(SHADE_DIR).transformDirection(lampHead.current.matrixWorld);
    toCamera.copy(camera.position).sub(bulbWorld).normalize();
    halo.current.opacity = 0.35 + 0.65 * Math.max(0, beamWorld.dot(toCamera)) ** 3;
    if (calm.current) return; // reduced motion: the lamp, the boat, the cups, the radar, the steam, the leaves and the wind hold still
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 1 / 20);
    WIND.value += dt; // drives the swaying plants and flags, the cloud shadows and the beam's dust
    cups.current.rotation.y -= dt * 5;
    radar.current.rotation.y += dt * 1.1;
    // The lamp looks slowly from side to side over its street, nodding as it goes.
    lampBase.current.rotation.y = Math.sin(t * 0.25) * 0.8;
    lampHead.current.rotation.x = Math.sin(t * 0.45) * 0.15;
    rise(steam, t);
    fall(leaves, t);
    boat.current.position.y = Math.sin(t * 1.3) * 0.06;
    boat.current.rotation.z = Math.sin(t * 1.1) * 0.04;
    boat.current.rotation.x = Math.sin(t * 0.9 + 1) * 0.02;
  });

  return (
    <group>
      <Batched build={buildScenery} fade />

      {/* Click areas: invisible (no draw call) cylinders over each landmark's footprint. */}
      {stops.map((s, i) => {
        const height = s.id === "lumenfold" || s.id === "bagyo" ? 16 : 7;
        return (
          <mesh
            key={s.id}
            position={[LANDMARKS[i].x, height / 2, LANDMARKS[i].z]}
            onClick={(e) => {
              e.stopPropagation();
              onStop(s.id);
            }}
            onPointerOver={setCursor("var(--cursor-go)")}
            onPointerOut={setCursor("")}
          >
            <cylinderGeometry args={[LANDMARKS[i].r, LANDMARKS[i].r, height, 8]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        );
      })}

      {SIGNS.map(({ id, ...sign }) => {
        const { at, yaw } = frameOf(id);
        return (
          <group key={id + sign.at.join()} position={at} rotation-y={yaw}>
            <Signboard {...sign} />
          </group>
        );
      })}
      <group position={station.at} rotation-y={station.yaw}>
        <SignalBoard nearId={nearId} />
      </group>

      {/* Lumenfold's giant desk lamp: it turns on its turntable and nods at the elbow, its beam sweeping the street
          (glow only: no light source, so it costs nothing to shade). */}
      <group position={lumenfold.at} rotation-y={lumenfold.yaw}>
        <group ref={lampBase} position={LAMP_BASE}>
          <Batched build={buildLampBase} ao={false} />
          <group ref={lampHead} position={LAMP_ELBOW}>
            <Batched build={buildLampHead} ao={false} />
            <mesh ref={bulb} position={BULB}>
              <sphereGeometry args={[0.3, 12, 8]} />
              <meshBasicMaterial color="#fff3c4" />
            </mesh>
            <sprite position={BULB} scale={3}>
              <spriteMaterial ref={halo} map={glow} blending={AdditiveBlending} depthWrite={false} transparent />
            </sprite>
            <mesh geometry={BEAM} material={beamShader} position={BEAM_AT} rotation-x={SHADE_TILT - Math.PI / 2} />
          </group>
        </group>
      </group>

      {/* The weather station's wind cups, spinning on top of its mast, and the radar turning on the office roof. */}
      <group position={station.at} rotation-y={station.yaw}>
        <group ref={cups} position={[MAST[0], MAST_HEIGHT + 0.6, MAST[2]]}>
          <Batched build={buildCups} ao={false} />
        </group>
        <group ref={radar} position={RADAR}>
          <Batched build={buildRadar} ao={false} />
        </group>
      </group>

      {/* Steam off the carinderia's pots. */}
      <group position={carinderia.at} rotation-y={carinderia.yaw}>
        <points geometry={steam}>
          <pointsMaterial map={puff} size={1.1} vertexColors transparent depthWrite={false} />
        </points>
      </group>

      {/* Leaves drifting down from the plant shop's hanging pots. */}
      <group position={plantShop.at} rotation-y={plantShop.yaw}>
        <points geometry={leaves}>
          <pointsMaterial map={leaf} size={0.35} vertexColors transparent depthWrite={false} />
        </points>
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
