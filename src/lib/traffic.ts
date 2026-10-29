/**
 * The town's traffic: three tricycles and two jeepneys on fixed loops, keeping to the right-hand lane. Pure rules, no
 * three.js: Traffic.tsx draws it, traffic.check.ts drives it.
 *
 * Each vehicle rides its loop like a train on a track. All it decides is how fast to go, and when to swing out into the
 * other lane round the visitor's jeepney after it has stood in the way for a while (a toot first). It slows for
 * whatever is on the track ahead, and takes turns at the intersections: one vehicle in a crossing at a time, so two
 * can never wait on each other. The visitor bumps into it like into a kerb (`obstacles`); the autopilot slows behind
 * it (`bodies`).
 */
import { BODY, type Car } from "./driving.ts";
import { CROSSINGS, OBSTACLES, STREET_HALF, type Box, type Circle, type Obstacle, type Point } from "./world.ts";

export type Kind = "jeepney" | "tricycle";

const STEP = 0.5; // metres between a track's samples
const TURN_RADIUS = 3; // corners are rounded to this
const GRIP = 2.5; // m/s² sideways in a corner: √(GRIP · r) ≈ 2.7 m/s round a street corner
const ACCEL = 2.5;
const BRAKE = 5; // what it plans with
const BRAKE_HARD = 12; // what it can do when something steps out
const LOOK = 14; // metres of track ahead it watches
const GAP = 0.8; // how far short of whatever's ahead it stops
const TOOT_AFTER = 1.2; // seconds stopped behind the visitor before it toots
const PASS_AFTER = 2; // ... and before it pulls out round them
/** Out to the street's middle, to the left: just clear of a jeepney in the lane and of oncoming traffic in the other. */
const PASS_SHIFT = 2.05;
const RETURN_BEHIND = 7; // the visitor must be this far behind before it pulls back in

/** Sizes: half width and half length (bumper to bumper), top speed, and the body as circles along its length. */
const KINDS: Record<Kind, { halfWidth: number; halfLength: number; top: number; along: number[]; r: number }> = {
  jeepney: { halfWidth: 0.95, halfLength: 2.6, top: 7.5, along: [-1.6, 0, 1.6], r: 0.95 },
  tricycle: { halfWidth: 0.8, halfLength: 0.9, top: 6, along: [0], r: 0.85 },
};
/** The visitor's jeepney as traffic sees it: the circles it bumps with (driving.ts). */
const PLAYER = BODY;

/** A loop sampled every ~STEP metres: position, heading, the speed it can take there, the crossing it's in (-1: none). */
export type Track = { x: number[]; z: number[]; yaw: number[]; vmax: number[]; zone: number[]; step: number; length: number; dwell: number };

/**
 * One vehicle in each at a time: the intersections, and the terminal's gate, where its jeepney pulls out across the
 * street into the plaza tricycle's lane (each waited for the other there).
 */
export const ZONES: Box[] = [...CROSSINGS.map((c) => ({ ...c, hx: STREET_HALF, hz: STREET_HALF })), { x: 3.75, z: -10, hx: 3.15, hz: 3 }];

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const inBox = (b: Box, x: number, z: number, pad = 0) => Math.abs(x - b.x) <= b.hx + pad && Math.abs(z - b.z) <= b.hz + pad;

/**
 * A closed loop through `corners` (lane positions, in driving order), each corner rounded off. With `dwell`, the vehicle
 * stops at the first corner for that many seconds every lap (the terminal's bay), and the track brakes into it.
 */
export function track(corners: Point[], top: number, dwell = 0): Track {
  // 1. A fine polyline: straight runs, and an arc at every corner that turns.
  const line: Point[] = [];
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const p = corners[(i + n - 1) % n], c = corners[i], q = corners[(i + 1) % n];
    const a = { x: c.x - p.x, z: c.z - p.z }, b = { x: q.x - c.x, z: q.z - c.z };
    const la = Math.hypot(a.x, a.z), lb = Math.hypot(b.x, b.z);
    a.x /= la; a.z /= la; b.x /= lb; b.z /= lb;
    const turn = wrap(Math.atan2(b.x, b.z) - Math.atan2(a.x, a.z)); // > 0: a left turn
    if (Math.abs(turn) < 1e-3) {
      line.push(c);
      continue;
    }
    // Two corners close together (the terminal's jink out of its yard) share the street between them.
    const cut = Math.min(TURN_RADIUS * Math.tan(Math.abs(turn) / 2), la / 2, lb / 2);
    const radius = cut / Math.tan(Math.abs(turn) / 2);
    const t1 = { x: c.x - a.x * cut, z: c.z - a.z * cut };
    const side = Math.sign(turn); // the centre is to the left of a left turn: left of (x, z) is (z, -x)
    const o = { x: t1.x + side * a.z * radius, z: t1.z - side * a.x * radius };
    const vx = t1.x - o.x, vz = t1.z - o.z;
    for (let k = 0; k <= 12; k++) {
      const f = (turn * k) / 12; // turning the heading left by f turns (x, z) into (x cos f + z sin f, z cos f − x sin f)
      line.push({ x: o.x + vx * Math.cos(f) + vz * Math.sin(f), z: o.z + vz * Math.cos(f) - vx * Math.sin(f) });
    }
  }
  // 2. Resampled at even steps round the loop.
  const seg = line.map((p, i) => Math.hypot(line[(i + 1) % line.length].x - p.x, line[(i + 1) % line.length].z - p.z));
  const length = seg.reduce((s, d) => s + d, 0);
  const count = Math.round(length / STEP);
  const step = length / count;
  const t: Track = { x: [], z: [], yaw: [], vmax: [], zone: [], step, length, dwell };
  for (let i = 0, j = 0, from = 0; i < count; i++) {
    const s = i * step;
    while (from + seg[j] < s) from += seg[j++];
    const p = line[j], q = line[(j + 1) % line.length], f = (s - from) / seg[j];
    t.x.push(p.x + (q.x - p.x) * f);
    t.z.push(p.z + (q.z - p.z) * f);
  }
  // 3. Heading, the speed each bend allows, braking ahead of it, and which crossing each sample is in.
  for (let i = 0; i < count; i++) {
    const k = (i + 1) % count;
    t.yaw.push(Math.atan2(t.x[k] - t.x[i], t.z[k] - t.z[i]));
  }
  for (let i = 0; i < count; i++) {
    const bend = Math.abs(wrap(t.yaw[(i + 1) % count] - t.yaw[i])) / step; // radians per metre
    t.vmax.push(bend > 1e-4 ? Math.min(top, Math.sqrt(GRIP / bend)) : top);
    t.zone.push(ZONES.findIndex((z) => inBox(z, t.x[i], t.z[i])));
  }
  // Slow down in time for each bend: twice round, so the bends near the start are seen from the end of the loop.
  // A dwell track ends at its bay instead, stopped.
  for (let round = 0; round < (dwell ? 1 : 2); round++) {
    for (let i = count - 1; i >= 0; i--) {
      const next = i === count - 1 ? (dwell ? 0 : t.vmax[0]) : t.vmax[i + 1];
      t.vmax[i] = Math.min(t.vmax[i], Math.sqrt(next * next + 2 * BRAKE * step));
    }
  }
  return t;
}

/**
 * The loops, in lane positions (2 m right of a street's middle; streets run along ±11 and ±33). The camera looks north,
 * so northbound traffic shows its back and roof.
 */
export const TRACKS = {
  // The terminal's jeepney: out of its bay under the shed, across to the plaza side and round the plaza, up to the bay
  // boulevard and back in through the yard from there, so it parks nose to the street again. Then it waits for
  // passengers. It crosses the street in front of the terminal (where the visitor parks for that stop) beside the
  // parking spot, not through it, and takes no lane anybody drives the other way.
  terminal: track([{ x: 3.6, z: -18.3 }, { x: 3.6, z: -9 }, { x: 9, z: -9 }, { x: 9, z: 9 }, { x: -9, z: 9 }, { x: -9, z: -31 }, { x: 3.6, z: -31 }], KINDS.jeepney.top, 40),
  ring: track([{ x: -31, z: -31 }, { x: 31, z: -31 }, { x: 31, z: 31 }, { x: -31, z: 31 }], KINDS.jeepney.top), // the outer streets
  plaza: track([{ x: -9, z: -9 }, { x: 9, z: -9 }, { x: 9, z: 9 }, { x: -9, z: 9 }], KINDS.tricycle.top),
  west: track([{ x: -31, z: -9 }, { x: -13, z: -9 }, { x: -13, z: 31 }, { x: -31, z: 31 }], KINDS.tricycle.top),
  east: track([{ x: 13, z: -31 }, { x: 31, z: -31 }, { x: 31, z: 9 }, { x: 13, z: 9 }], KINDS.tricycle.top),
};

export type Vehicle = {
  kind: Kind;
  track: Track;
  s: number; // metres along its track
  speed: number;
  shift: number; // metres out to the left of its lane (overtaking)
  passing: boolean;
  waited: number; // seconds stopped behind the visitor
  tooted: boolean;
  dwell: number; // seconds left waiting in its bay
  away: boolean; // not on the streets (reduced motion)
  x: number;
  z: number;
  yaw: number;
};

/** A circle of a vehicle's body, and which way that vehicle is heading. */
export type Body = Circle & { yaw: number };

export type Traffic = {
  vehicles: Vehicle[];
  /** Every vehicle's body, as circles (`owner` says whose): what traffic and the autopilot keep clear of. */
  bodies: Body[];
  owner: number[];
  /** What the visitor's jeepney bumps into: the blocks, and the traffic's bodies. */
  obstacles: Obstacle[];
  /** Which vehicle holds each of the ZONES, or -1. */
  holder: number[];
  player: Circle[];
};

const vehicle = (kind: Kind, t: Track, s: number, dwell = 0): Vehicle => ({
  kind, track: t, s, speed: 0, shift: 0, passing: false, waited: 0, tooted: false, dwell, away: false, x: 0, z: 0, yaw: 0,
});

export function makeTraffic(): Traffic {
  const vehicles = [
    vehicle("jeepney", TRACKS.terminal, 0, 10), // pulls out ten seconds after the town appears
    vehicle("jeepney", TRACKS.ring, 50),
    vehicle("tricycle", TRACKS.plaza, 30),
    vehicle("tricycle", TRACKS.west, 4),
    vehicle("tricycle", TRACKS.east, 60),
  ];
  const bodies: Body[] = [];
  const owner: number[] = [];
  vehicles.forEach((v, i) => {
    const { along, r } = KINDS[v.kind];
    bodies.push(...along.map(() => ({ x: 0, z: 0, r, yaw: 0 })));
    owner.push(...along.map(() => i));
  });
  for (const v of vehicles) moveTo(v, 0);
  const traffic: Traffic = {
    vehicles, bodies, owner, obstacles: [...OBSTACLES, ...bodies], holder: ZONES.map(() => -1),
    player: PLAYER.along.map(() => ({ x: 0, z: 0, r: PLAYER.r })),
  };
  place(traffic);
  return traffic;
}

/** A point on a track `s` metres along, moved `shift` metres to its left. */
function at(t: Track, s: number, shift: number, out: { x: number; z: number; yaw: number }) {
  s = ((s % t.length) + t.length) % t.length;
  const f = s / t.step;
  const i = Math.floor(f) % t.x.length, k = (i + 1) % t.x.length, u = f - Math.floor(f);
  out.yaw = t.yaw[i] + wrap(t.yaw[k] - t.yaw[i]) * u;
  out.x = t.x[i] + (t.x[k] - t.x[i]) * u + Math.cos(out.yaw) * shift;
  out.z = t.z[i] + (t.z[k] - t.z[i]) * u - Math.sin(out.yaw) * shift;
  return out;
}
const spot = { x: 0, z: 0, yaw: 0 };
const AWAY = 1e4;

/** Puts v where its track says, turned `steer` off the track's heading. */
function moveTo(v: Vehicle, steer: number) {
  at(v.track, v.s, v.shift, spot);
  [v.x, v.z, v.yaw] = [spot.x, spot.z, spot.yaw + steer];
}

/** Moves each body's circles to where its vehicle is now (`obstacles` holds the same circles). */
function place(traffic: Traffic) {
  let c = 0;
  for (const v of traffic.vehicles) {
    for (const d of KINDS[v.kind].along) {
      const b = traffic.bodies[c++];
      // Along the track, not the drawn heading: the nose's small turn into a lane change is only for show.
      at(v.track, v.s + d, v.shift, spot);
      b.x = v.away ? AWAY : spot.x;
      b.z = v.away ? AWAY : spot.z;
      b.yaw = v.yaw;
    }
  }
}

/**
 * How far along the track (at the given shift) `v` can go before its nose meets something, and whether that's the
 * visitor. Infinity if the next LOOK metres are clear.
 */
function clearAhead(traffic: Traffic, i: number, shift: number) {
  const v = traffic.vehicles[i];
  const { halfWidth, halfLength } = KINDS[v.kind];
  for (let d = 0; d <= LOOK; d += STEP) {
    at(v.track, v.s + d, shift, spot);
    for (const p of traffic.player) {
      if (Math.hypot(p.x - spot.x, p.z - spot.z) < halfWidth + p.r) return { room: d - halfLength - GAP, player: true };
    }
    for (let k = 0; k < traffic.bodies.length; k++) {
      const b = traffic.bodies[k];
      if (traffic.owner[k] !== i && Math.hypot(b.x - spot.x, b.z - spot.z) < halfWidth + b.r) return { room: d - halfLength - GAP, player: false };
    }
  }
  return { room: Infinity, player: false };
}

/** True if v's body, moved to `shift`, overlaps nobody (traffic or the visitor). */
function fits(traffic: Traffic, i: number, shift: number) {
  const v = traffic.vehicles[i];
  const { along, r } = KINDS[v.kind];
  for (const d of along) {
    at(v.track, v.s + d, shift, spot);
    for (const p of traffic.player) if (Math.hypot(p.x - spot.x, p.z - spot.z) < r + p.r - 0.05) return false;
    for (let k = 0; k < traffic.bodies.length; k++) {
      const b = traffic.bodies[k];
      if (traffic.owner[k] !== i && Math.hypot(b.x - spot.x, b.z - spot.z) < r + b.r - 0.05) return false;
    }
  }
  return true;
}

/** True if none of the visitor's circles is within `from`..`to` metres along v's own lane. */
function playerClearOfLane(traffic: Traffic, v: Vehicle, from: number, to: number) {
  const { halfWidth } = KINDS[v.kind];
  for (let d = from; d <= to; d += STEP) {
    at(v.track, v.s + d, 0, spot);
    for (const p of traffic.player) if (Math.hypot(p.x - spot.x, p.z - spot.z) < halfWidth + p.r) return false;
  }
  return true;
}

/** The first zone on v's track ahead (within LOOK) other than the ones it holds, and how far off its edge is. */
function nextZone(traffic: Traffic, i: number) {
  const v = traffic.vehicles[i];
  const t = v.track;
  const base = Math.floor(v.s / t.step);
  for (let k = 0; k * t.step <= LOOK; k++) {
    const z = t.zone[(base + k) % t.zone.length];
    if (z >= 0 && traffic.holder[z] !== i) return { zone: z, distance: k * t.step };
  }
  return null;
}

const speedFor = (room: number) => Math.sqrt(2 * BRAKE * Math.max(0, room));

/**
 * One tick. `player` is the visitor's jeepney; `calm` (reduced motion) takes the traffic off the streets and keeps the
 * terminal's jeepney parked in its bay. `onToot` hears a vehicle toot at the visitor.
 */
export function stepTraffic(traffic: Traffic, player: Car, dt: number, calm = false, onToot?: (v: Vehicle) => void) {
  PLAYER.along.forEach((d, k) => {
    traffic.player[k].x = player.x + Math.sin(player.yaw) * d;
    traffic.player[k].z = player.z + Math.cos(player.yaw) * d;
  });

  traffic.vehicles.forEach((v, i) => {
    const kind = KINDS[v.kind];
    v.away = calm && !v.track.dwell;
    if (calm) {
      if (v.track.dwell) [v.s, v.speed, v.shift, v.dwell] = [0, 0, 0, Math.max(v.dwell, 1)];
      moveTo(v, 0);
      return;
    }

    // Let go of the crossings it has left: no part of its body in them any more.
    traffic.holder.forEach((h, z) => {
      if (h !== i) return;
      const inside = kind.along.some((d) => inBox(ZONES[z], v.x + Math.sin(v.yaw) * d, v.z + Math.cos(v.yaw) * d, kind.r));
      if (!inside) traffic.holder[z] = -1;
    });

    if (v.dwell > 0) {
      v.dwell -= dt;
      v.speed = 0;
      return;
    }

    let want = v.track.vmax[Math.floor(v.s / v.track.step) % v.track.vmax.length];

    // Something on the track ahead: stop short of it.
    const ahead = clearAhead(traffic, i, v.shift);
    want = Math.min(want, speedFor(ahead.room));

    // A crossing ahead: claim it if it's free and nobody is queued between it and the crossing, otherwise wait at
    // its edge. (A claim it hasn't driven into yet is let go above and made again every tick, so it can't hold a
    // crossing from the back of a queue while the one in front waits for it.)
    const next = nextZone(traffic, i);
    if (next && next.distance - kind.halfLength < 5) {
      const edge = next.distance - kind.halfLength - 0.5;
      if (traffic.holder[next.zone] < 0 && ahead.room >= edge) traffic.holder[next.zone] = i;
      else want = Math.min(want, speedFor(edge));
    }

    // Held up by the visitor: toot, then pull out round them along the middle of the street. Back in once past.
    const heldUp = ahead.player && v.speed < 0.3 && ahead.room < 2;
    v.waited = heldUp ? v.waited + dt : 0;
    if (v.waited > TOOT_AFTER && !v.tooted) {
      v.tooted = true;
      onToot?.(v);
    }
    // Not into a left turn: the middle of the street is on the inside of it, tighter than the corner itself.
    const bendsLeft = wrap(at(v.track, v.s + LOOK, 0, spot).yaw - at(v.track, v.s, 0, spot).yaw) > 0.3;
    if (!v.passing && !bendsLeft && v.waited > PASS_AFTER && clearAhead(traffic, i, PASS_SHIFT).room > kind.halfLength) v.passing = true;
    if (v.passing && playerClearOfLane(traffic, v, -RETURN_BEHIND - kind.halfLength, LOOK)) v.passing = false; // past them
    if (!heldUp && !v.passing) v.tooted = false;

    v.speed = want < v.speed ? Math.max(want, v.speed - BRAKE_HARD * dt) : Math.min(want, v.speed + ACCEL * dt);
    // Steering out or back in. It can edge its nose out even when stopped, like pulling out of a queue, but never
    // sideways into anybody.
    const sideways = Math.max(0.8, 0.5 * v.speed) * dt;
    const goal = v.passing ? PASS_SHIFT : 0;
    const before = v.shift;
    const shift = v.shift + Math.max(-sideways, Math.min(sideways, goal - v.shift));
    if (shift !== v.shift && fits(traffic, i, shift)) v.shift = shift;

    v.s += v.speed * dt;
    if (v.s >= v.track.length) {
      v.s -= v.track.length;
      if (v.track.dwell) [v.s, v.speed, v.dwell] = [0, 0, v.track.dwell];
    }
    // Nose into the lane change (left is a larger yaw).
    moveTo(v, Math.atan2((v.shift - before) / Math.max(dt, 1e-6), Math.max(v.speed, 5)));
  });

  place(traffic);
}
