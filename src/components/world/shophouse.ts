import { BoxGeometry, ConeGeometry, CylinderGeometry } from "three";
import type { Batch, Vec } from "./Batched";

/**
 * The town's ordinary buildings: one generator for every shophouse, seeded so the town is the same every visit.
 * Shop below (open, shuttered or a plain door), one or two floors of rooms above, a flat roof with a water tank or a
 * hipped zinc one. Colours are listed in SURFACE_OF (surfaces.ts), so the walls get plaster and the roofs zinc ridges.
 */

// Walls: the washed-out pastels of a provincial poblacion.
const WALLS = ["#f4ead5", "#f2c4a8", "#bfe0d0", "#a9cfe0", "#f6dc8c", "#e9b7c2", "#f7f4ee", "#d9d2c3"];
const ROOFS = ["#a9b7bd", "#b0623f", "#c4473a", "#4f8a6e"]; // bare zinc, rusted, painted red, painted green
const SIGNS: [string, string][] = [["#d62839", "#f7f4ee"], ["#ffc93c", "#d62839"], ["#1d4e89", "#ffc93c"], ["#f7f4ee", "#1d4e89"], ["#2a9d8f", "#f7f4ee"]];
const GOODS = ["#d62839", "#ffc93c", "#1d4e89", "#e07a2e", "#2a9d8f", "#e85d75"];
const CONCRETE = "#d8cbb0";
const DARK = "#2b2f3a";
const GLASS = "#3d4a5c";
const WHITE = "#f7f4ee";
const STEEL = "#cfd6de";
const SHUTTER = "#98a2a8";
const SHUTTER_LINE = "#7d868c";
const WOOD = "#8a5a3b";
const WOOD_DARK = "#5e4331";
const TANKS = ["#2f6db5", "#2b2f3a"]; // the blue and the black plastic water tanks on every roof
const TERRACOTTA = "#c8643b";
const LEAF = "#4f9a4a";

const GROUND = 3.2; // the shop floor, taller than the floors above
const STOREY = 2.8;

export type Detail = {
  /** The front faced the camera's side when it only looked north (south, east or west): shop and sign drawn from `rnd`. */
  front: boolean;
  /** The rest of town past the edge: windows, roof and sign only, no aircons, balconies or pots. */
  low?: boolean;
  /**
   * Since the view turns, every side gets seen: given this, the parts the north-looking camera never saw are added too
   * (the shopfront of a building facing away, windows on the back and on the sides). They draw from this second random
   * stream, so adding them left every building that was already there exactly as it was.
   */
  extra?: () => number;
};

/** Height of a shophouse with this many storeys, roof parapet not included. */
export const heightOf = (storeys: number) => GROUND + (storeys - 1) * STOREY;

/**
 * One shophouse in the current frame: its front's middle at the origin on the ground, +z facing the street, the
 * building running back to -depth. `width` is the plot's frontage.
 */
export function shophouse(b: Batch, width: number, depth: number, storeys: number, rnd: () => number, detail: Detail) {
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)];
  // Thin details skip the bevel: at ~50 px a metre it's invisible, and a plain box is 12 triangles instead of 108.
  const plain = (color: string, size: Vec, at: Vec, rot?: Vec) => b.add(color, new BoxGeometry(...size), at, rot);
  const w = width - 0.15; // a hairline gap between neighbours
  const wall = pick(WALLS);
  const height = heightOf(storeys);
  // Upper floors often jut out over the sidewalk, which shades the shop below.
  const jut = storeys > 1 && rnd() < 0.4 ? 0.8 : 0;

  b.shadow([0, -depth / 2], [w / 2 + 0.6, depth / 2 + 0.6], height * 0.4);
  if (jut) {
    b.box(wall, [w, GROUND, depth], [0, GROUND / 2, -depth / 2]);
    b.box(rnd() < 0.5 ? wall : pick(WALLS), [w, height - GROUND, depth + jut], [0, (height + GROUND) / 2, (jut - depth) / 2]);
  } else {
    b.box(wall, [w, height, depth], [0, height / 2, -depth / 2]);
  }

  if (detail.front) {
    shopfront(b, plain, w, rnd, detail, jut);
    for (let k = 1; k < storeys; k++) upperFloor(b, plain, w, GROUND + (k - 1) * STOREY, jut, rnd, detail, k === storeys - 1);
  } else if (storeys > 1) {
    // Shown from behind: only the back wall's windows (seen over the lower row in front of it), no shop.
    b.place([0, 0, -depth], Math.PI, () => {
      for (let k = 1; k < storeys; k++) windows(plain, w, GROUND + (k - 1) * STOREY, 0, rnd);
    });
  }
  const more = detail.extra;
  if (more) {
    if (!detail.front) {
      shopfront(b, plain, w, more, detail, jut);
      for (let k = 1; k < storeys; k++) upperFloor(b, plain, w, GROUND + (k - 1) * STOREY, jut, more, detail, k === storeys - 1);
    } else if (storeys > 1) {
      b.place([0, 0, -depth], Math.PI, () => {
        for (let k = 1; k < storeys; k++) windows(plain, w, GROUND + (k - 1) * STOREY, 0, more);
      });
    }
    // Windows down both sides of the upper floors: a side shows wherever its neighbour is lower or missing (and is
    // hidden behind a taller one, which costs a few triangles but keeps the plots independent of each other).
    if (!detail.low) {
      for (const side of [-1, 1]) {
        b.place([(side * w) / 2, 0, (jut - depth) / 2], (side * Math.PI) / 2, () => {
          for (let k = 1; k < storeys; k++) windows(plain, depth + jut - 1, GROUND + (k - 1) * STOREY, 0, more);
        });
      }
    }
  }
  roof(b, plain, w, depth, height, rnd, detail, jut);
}

/**
 * The town past the edge rows, out to where the fog is full: a plain block with a hipped roof or a flat one with a
 * water tank, no shop (at that distance, and that hazy, they're colour and shape). About 30 triangles; the nearer rows
 * add dark windows on their two long sides (`windows`), ~12 triangles each.
 * In the current frame like `shophouse`: front middle at the origin, running back to -depth.
 */
export function farHouse(b: Batch, width: number, depth: number, storeys: number, rnd: () => number, windows = false) {
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const w = width - 0.15;
  const height = heightOf(storeys);
  b.add(pick(WALLS), new BoxGeometry(w, height, depth), [0, height / 2, -depth / 2]);
  if (windows) {
    const n = Math.max(1, Math.floor(w / 2));
    for (let k = 0; k < storeys; k++) {
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + (w * (i + 0.5)) / n;
        for (const z of [0.01, -depth - 0.01]) b.add(GLASS, new BoxGeometry(0.9, 1.1, 0.04), [x, (k ? GROUND + (k - 1) * STOREY : 0) + 1.5, z]);
      }
    }
  }
  if (rnd() < 0.5) {
    const rise = 1 + rnd() * 0.4;
    const g = new ConeGeometry(Math.SQRT1_2, rise, 4).rotateY(Math.PI / 4).scale(w + 0.4, 1, depth + 0.4);
    b.add(pick(ROOFS), g, [0, height + rise / 2, -depth / 2]);
  } else {
    b.add(pick(TANKS), new CylinderGeometry(0.48, 0.5, 1.1, 6), [(rnd() - 0.5) * (w - 1.4), height + 1.15, -depth / 2]);
  }
}

type Plain = (color: string, size: Vec, at: Vec, rot?: Vec) => void;

/** The ground floor's front: an open store, a roll-up shutter (sometimes half up) or a house door, a canopy and a sign. */
function shopfront(b: Batch, plain: Plain, w: number, rnd: () => number, detail: Detail, jut: number) {
  const open = w - 0.8;
  const kind = rnd();
  if (kind < 0.45) {
    plain(DARK, [open, 2.4, 0.05], [0, 1.25, 0.02]); // the dark inside
    if (!detail.low) {
      b.box(WOOD, [open - 0.4, 0.9, 0.45], [0, 0.45, 0.3]); // counter, goods on top
      for (let x = -open / 2 + 0.5; x < open / 2 - 0.4; x += 0.45) plain(GOODS[Math.floor(rnd() * GOODS.length)], [0.3, 0.22 + rnd() * 0.2, 0.25], [x, 1.0, 0.3]);
    }
  } else if (kind < 0.8) {
    const top = rnd() < 0.4 ? 1.3 : 0; // half up: the shop's dark inside shows below
    if (top) plain(DARK, [open, top, 0.04], [0, top / 2 + 0.05, 0.02]);
    plain(SHUTTER, [open, 2.45 - top, 0.05], [0, top + (2.45 - top) / 2 + 0.05, 0.03]);
    for (let y = top + 0.3; y < 2.45; y += 0.3) plain(SHUTTER_LINE, [open, 0.025, 0.06], [0, y, 0.03]);
  } else {
    plain(WOOD_DARK, [0.9, 2.1, 0.05], [-w / 4, 1.05, 0.02]); // a house: front door and a barred window
    plain(GLASS, [1.0, 1.0, 0.04], [w / 4, 1.5, 0.02]);
    for (let x = w / 4 - 0.4; x <= w / 4 + 0.41; x += 0.2) plain(STEEL, [0.025, 1.0, 0.025], [x, 1.5, 0.06]);
  }

  // A canopy over the sidewalk (a jutting floor above is its own canopy): a concrete slab or a sloping zinc awning.
  if (!jut) {
    if (rnd() < 0.5) b.box(CONCRETE, [w, 0.12, 1.1], [0, GROUND - 0.15, 0.55]);
    else plain(ROOFS[Math.floor(rnd() * ROOFS.length)], [w, 0.04, 1.3], [0, GROUND - 0.35, 0.6], [0.3, 0, 0]);
  }

  // The sign: a painted board with its "lettering" as blocks, one or two lines.
  const [board, ink] = SIGNS[Math.floor(rnd() * SIGNS.length)];
  const signW = Math.min(w - 0.4, 2.2 + rnd() * 2);
  const z = jut + 0.06;
  b.box(board, [signW, 0.62, 0.08], [0, GROUND + 0.42, z]);
  if (!detail.low) {
    const lines = rnd() < 0.5 ? [0.42] : [0.52, 0.32];
    for (const y of lines) {
      let x = -signW / 2 + 0.25;
      const end = signW / 2 - 0.25;
      const tall = lines.length === 1 ? 0.2 : 0.11;
      while (x < end - 0.2) {
        const word = Math.min(0.25 + rnd() * 0.6, end - x);
        plain(ink, [word, tall, 0.02], [x + word / 2, GROUND + y, z + 0.05]);
        x += word + 0.14;
      }
    }
  }

  // Potted plants by the door.
  if (!detail.low && rnd() < 0.45) {
    for (const x of rnd() < 0.5 ? [w / 2 - 0.35] : [-w / 2 + 0.35, w / 2 - 0.35]) {
      b.cyl(TERRACOTTA, [0.22, 0.16, 0.35], [x, 0.18, 0.45]);
      b.ball(LEAF, 0.3, [x, 0.55, 0.45], [1, 0.85, 1]);
    }
  }
}

/** Windows across one floor: dark glass with a white sill, in the plane z = `z`. */
function windows(plain: Plain, w: number, floor: number, z: number, rnd: () => number) {
  const n = Math.max(1, Math.floor(w / 1.7));
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n;
    xs.push(x);
    const tall = rnd() < 0.3 ? 1.6 : 1.2;
    plain(GLASS, [0.95, tall, 0.04], [x, floor + 0.95 + tall / 2, z + 0.02]);
    plain(WHITE, [1.1, 0.07, 0.14], [x, floor + 0.92, z + 0.06]);
  }
  return xs;
}

/** One floor above the shop: its windows, an aircon box or two, and on the top floor sometimes a balcony with washing. */
function upperFloor(b: Batch, plain: Plain, w: number, floor: number, jut: number, rnd: () => number, detail: Detail, top: boolean) {
  const xs = windows(plain, w, floor, jut, rnd);
  if (detail.low) return;
  for (const x of xs) {
    if (rnd() < 0.35) {
      plain(WHITE, [0.62, 0.42, 0.45], [x + 0.25, floor + 0.62, jut + 0.23]);
      plain(SHUTTER_LINE, [0.5, 0.3, 0.02], [x + 0.25, floor + 0.62, jut + 0.46]); // its grille
    }
  }
  if (top && rnd() < 0.35) {
    const bw = Math.min(w - 0.4, 3);
    const out = 0.9;
    b.box(CONCRETE, [bw, 0.12, out], [0, floor + 0.06, jut + out / 2]);
    plain(STEEL, [bw, 0.05, 0.05], [0, floor + 1.0, jut + out]);
    for (let x = -bw / 2; x <= bw / 2 + 0.01; x += bw / Math.round(bw / 0.3)) plain(STEEL, [0.025, 0.95, 0.025], [x, floor + 0.55, jut + out]);
    for (const side of [-1, 1]) plain(STEEL, [0.025, 0.95, 0.025], [side * bw / 2, floor + 0.55, jut + out / 2]);
    // Washing over the rail, moving a little in the wind (the sway shader measures from the rail).
    if (rnd() < 0.6) {
      b.place([0, floor + 1.0, jut + out], 0, () => b.sway(0.25, 1, () => {
        for (let x = -bw / 2 + 0.35; x < bw / 2 - 0.3; x += 0.5) plain(GOODS[Math.floor(rnd() * GOODS.length)], [0.36, 0.5, 0.03], [x, -0.24, 0.03]);
      }));
    }
  }
}

/** A flat concrete roof with a parapet, a water tank and sometimes rebar left for the next floor; or a hipped zinc roof. */
function roof(b: Batch, plain: Plain, w: number, depth: number, height: number, rnd: () => number, detail: Detail, jut: number) {
  const d = depth + jut;
  const back = -depth; // the roof spans back..jut
  const mid = (back + jut) / 2;
  if (rnd() < 0.55) {
    b.flat(() => plain(CONCRETE, [w - 0.1, 0.02, d - 0.1], [0, height + 0.01, mid]));
    for (const [sw, sd, x, z] of [
      [w, 0.15, 0, jut - 0.075],
      [w, 0.15, 0, back + 0.075],
      [0.15, d, -w / 2 + 0.075, mid],
      [0.15, d, w / 2 - 0.075, mid],
    ]) b.box(CONCRETE, [sw, 0.45, sd], [x, height + 0.22, z]);
    if (rnd() < 0.65) {
      const at: Vec = [(rnd() - 0.5) * (w - 1.4), height, back + 1 + rnd() * Math.max(0, d - 2.2)];
      for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) plain(STEEL, [0.04, 0.8, 0.04], [at[0] + dx, height + 0.4, at[2] + dz]);
      b.cyl(TANKS[Math.floor(rnd() * TANKS.length)], [0.48, 0.5, 1.1], [at[0], height + 1.35, at[2]], undefined, 8);
      b.shadow([at[0], at[2]], [0.6, 0.6], 2);
    }
    if (!detail.low && rnd() < 0.25) {
      // Rebar sticking up from the columns: the floor someone will build "next year".
      for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) for (const z of [back + 0.3, jut - 0.3]) {
        for (const o of [-0.06, 0.06]) plain(DARK, [0.025, 0.9, 0.025], [x + o, height + 0.45, z]);
      }
    }
  } else {
    // A hipped roof: a four-sided cone, its corners turned to the building's corners and stretched to fit.
    const rise = 1 + rnd() * 0.4;
    const g = new ConeGeometry(Math.SQRT1_2, rise, 4).rotateY(Math.PI / 4).scale(w + 0.5, 1, d + 0.5);
    b.add(ROOFS[Math.floor(rnd() * ROOFS.length)], g, [0, height + rise / 2, mid]);
  }
}
