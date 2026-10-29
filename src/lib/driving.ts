/**
 * Arcade driving for the jeepney. Pure functions, no three.js, so the rules can be
 * checked on their own (see driving.check.ts).
 *
 * The world is flat: x/z is the ground, yaw 0 faces +z, and a larger yaw turns left.
 */
import { tuning } from "./tuning.ts";
import { CROSSINGS, EDGE, STREETS, type Circle, type Obstacle, type Point } from "./world.ts";

export type Car = { x: number; z: number; yaw: number; speed: number; yawRate: number };

/** throttle and steer run from -1 to 1. steer > 0 turns left. */
export type Input = { throttle: number; steer: number };

export const NO_INPUT: Input = { throttle: 0, steer: 0 };

/** The jeepney as a circle, for bumping into kerbs. Its nose and tail reach ~1.5 m further, over the sidewalk. */
const CAR_RADIUS = 1.3;
/**
 * The jeepney as three circles along its length, for bumping into round things (the traffic, traffic.ts): there the
 * nose and tail matter, or it would swing its nose through a tricycle.
 */
export const BODY = { along: [-1.6, 0, 1.6], r: 0.95 };
/** Extra room the autopilot leaves round a kerb corner, on top of the jeepney's own radius. */
const CLEARANCE = 0.9;
/** The furthest the jeepney's centre may go from the middle, either way: the outer kerbs. */
export const LIMIT = EDGE - CAR_RADIUS;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const isBox = (o: Obstacle) => "hx" in o;

/**
 * If (x, z) is closer than `min` to an obstacle, where to move it so it's exactly `min` away, and the outward
 * direction it moved in. For a block that's the nearest point of the kerb; from inside a block, out of the nearest side.
 */
function pushOut(o: Obstacle, x: number, z: number, min: number): { x: number; z: number; nx: number; nz: number } | null {
  if (!isBox(o)) {
    const dx = x - o.x;
    const dz = z - o.z;
    const d = Math.hypot(dx, dz);
    const r = o.r + min;
    if (d >= r || d === 0) return null;
    return { x: o.x + (dx / d) * r, z: o.z + (dz / d) * r, nx: dx / d, nz: dz / d };
  }
  const cx = clamp(x, o.x - o.hx, o.x + o.hx);
  const cz = clamp(z, o.z - o.hz, o.z + o.hz);
  const dx = x - cx;
  const dz = z - cz;
  const d = Math.hypot(dx, dz);
  if (d >= min) return null;
  if (d > 0) return { x: cx + (dx / d) * min, z: cz + (dz / d) * min, nx: dx / d, nz: dz / d };
  // Inside the block: out through the nearest side.
  const sides = [
    { pen: x - (o.x - o.hx), nx: -1, nz: 0 },
    { pen: o.x + o.hx - x, nx: 1, nz: 0 },
    { pen: z - (o.z - o.hz), nx: 0, nz: -1 },
    { pen: o.z + o.hz - z, nx: 0, nz: 1 },
  ].sort((a, b) => a.pen - b.pen)[0];
  return { x: x + sides.nx * (sides.pen + min), z: z + sides.nz * (sides.pen + min), nx: sides.nx, nz: sides.nz };
}

/** True if (x, z) is within `pad` of an obstacle. */
function touches(o: Obstacle, x: number, z: number, pad: number) {
  return isBox(o) ? Math.abs(x - o.x) < o.hx + pad && Math.abs(z - o.z) < o.hz + pad : Math.hypot(x - o.x, z - o.z) < o.r + pad;
}

const outside = (x: number, z: number) => Math.abs(x) > LIMIT || Math.abs(z) > LIMIT;

/**
 * A tapped point moved to somewhere the jeepney's centre can actually be: into the street square, then out of
 * any block onto its nearest street. A tap on a building drives to the street in front of it.
 */
export function reachable(p: Point, obstacles: Obstacle[] = []): Point {
  let x = clamp(p.x, -LIMIT, LIMIT);
  let z = clamp(p.z, -LIMIT, LIMIT);
  for (const o of obstacles) {
    const out = pushOut(o, x, z, CAR_RADIUS + 0.2);
    if (out) ({ x, z } = out);
  }
  return { x, z };
}

export function step(car: Car, input: Input, dt: number, obstacles: Obstacle[] = []): Car {
  const t = tuning;
  let speed = car.speed;
  if (input.throttle !== 0) {
    const braking = Math.abs(speed) > 0.1 && Math.sign(input.throttle) !== Math.sign(speed);
    speed += input.throttle * (braking ? t.brake : t.accel) * dt;
  } else {
    speed *= Math.max(0, 1 - t.drag * dt);
  }
  speed = clamp(speed, -t.maxReverse, t.maxForward);

  // Steering only bites when the wheels roll, and flips when reversing, like a real car.
  const yawRate = input.steer * t.turn * clamp(speed / 4, -1, 1);
  const yaw = car.yaw + yawRate * dt;

  let x = car.x + Math.sin(yaw) * speed * dt;
  let z = car.z + Math.cos(yaw) * speed * dt;

  // How head-on a bump is, 0 (sliding along) to 1 (straight in), given the wall's outward normal.
  // Only that part costs speed: a flat per-frame cut left a jeepney touching a wall crawling at walking
  // pace, too slow to steer away (steering needs speed).
  const headOn = (nx: number, nz: number) => clamp(-(Math.sin(yaw) * nx + Math.cos(yaw) * nz) * Math.sign(speed), 0, 1);

  // Soft bump against kerbs and traffic: slide out to the edge and lose some speed.
  for (const o of obstacles) {
    if (isBox(o)) {
      const out = pushOut(o, x, z, CAR_RADIUS);
      if (!out) continue;
      ({ x, z } = out);
      speed *= 1 - 0.5 * headOn(out.nx, out.nz);
      continue;
    }
    for (const d of BODY.along) {
      const px = x + Math.sin(yaw) * d, pz = z + Math.cos(yaw) * d;
      const out = pushOut(o, px, pz, BODY.r);
      if (!out) continue;
      x += out.x - px;
      z += out.z - pz;
      speed *= 1 - 0.5 * headOn(out.nx, out.nz);
    }
  }

  // The outer kerbs: hold it inside the square.
  if (Math.abs(x) > LIMIT) {
    speed *= 1 - 0.4 * headOn(-Math.sign(x), 0);
    x = clamp(x, -LIMIT, LIMIT);
  }
  if (Math.abs(z) > LIMIT) {
    speed *= 1 - 0.4 * headOn(0, -Math.sign(z));
    z = clamp(z, -LIMIT, LIMIT);
  }

  return { x, z, yaw, speed, yawRate };
}

/** Angle wrapped to -π..π, so a turn always goes the short way round. */
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * True if the jeepney can drive straight from `a` to `b` without its body (plus some room) touching a block.
 * A block that `a` or `b` already sits close to (a car hugging a kerb, a parking spot) is tested at its real size,
 * so a line from there along the street still counts as clear.
 */
export function clearLine(a: Point, b: Point, obstacles: Obstacle[]) {
  const pad = CAR_RADIUS + CLEARANCE;
  for (const o of obstacles) {
    const near = touches(o, a.x, a.z, pad) || touches(o, b.x, b.z, pad);
    if (segmentHits(a, b, o, near ? 0.3 : pad)) return false;
  }
  return true;
}

/** Does the segment a→b come within `pad` of the obstacle? Boxes by the slab test, circles by closest point. */
function segmentHits(a: Point, b: Point, o: Obstacle, pad: number) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  if (!isBox(o)) {
    const len2 = dx * dx + dz * dz || 1e-9;
    const t = clamp(((o.x - a.x) * dx + (o.z - a.z) * dz) / len2, 0, 1);
    return Math.hypot(a.x + dx * t - o.x, a.z + dz * t - o.z) < o.r + pad;
  }
  let t0 = 0;
  let t1 = 1;
  for (const [p, d, lo, hi] of [
    [a.x, dx, o.x - o.hx - pad, o.x + o.hx + pad],
    [a.z, dz, o.z - o.hz - pad, o.z + o.hz + pad],
  ]) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return false;
      continue;
    }
    let ta = (lo - p) / d;
    let tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

const GRID_STEP = STREETS[1] - STREETS[0];
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * The route to `target` along the streets: straight there if nothing's in the way, otherwise through the
 * intersections, the shortest way. `aim` is the furthest point on that route the jeepney can see from where it is
 * (so it cuts across an intersection instead of driving to its exact middle), `then` the point after it, or null
 * when `aim` is the target. Recomputed every frame: 16 intersections, so it costs nothing.
 */
export function route(from: Point, target: Point, obstacles: Obstacle[]): { aim: Point; then: Point | null } {
  if (clearLine(from, target, obstacles)) return { aim: target, then: null };
  // Shortest path over the intersections (Dijkstra; neighbours are one block apart along a street).
  const n = CROSSINGS.length;
  const cost = CROSSINGS.map((c) => (clearLine(from, c, obstacles) ? dist(from, c) : Infinity));
  const prev = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  for (;;) {
    let i = -1;
    for (let k = 0; k < n; k++) if (!done[k] && cost[k] < Infinity && (i < 0 || cost[k] < cost[i])) i = k;
    if (i < 0) break;
    done[i] = true;
    for (let k = 0; k < n; k++) {
      const step = dist(CROSSINGS[i], CROSSINGS[k]);
      if (Math.abs(step - GRID_STEP) > 0.01) continue; // only next-door intersections
      if (cost[i] + step < cost[k]) {
        cost[k] = cost[i] + step;
        prev[k] = i;
      }
    }
  }
  let best = -1;
  let bestCost = Infinity;
  for (let k = 0; k < n; k++) {
    if (cost[k] === Infinity || !clearLine(CROSSINGS[k], target, obstacles)) continue;
    const total = cost[k] + dist(CROSSINGS[k], target);
    if (total < bestCost) [best, bestCost] = [k, total];
  }
  if (best < 0) return { aim: target, then: null }; // nowhere to route through (off the streets): just head for it
  const path: Point[] = [];
  for (let k = best; k >= 0; k = prev[k]) path.unshift(CROSSINGS[k]);
  path.push(target);
  // The furthest point along the route that's in plain sight.
  let i = 0;
  while (i + 1 < path.length && clearLine(from, path[i + 1], obstacles)) i++;
  return { aim: path[i], then: path[i + 1] ?? null };
}

/** Where to aim right now on the way to `target` (see `route`). */
export function aimPoint(from: Point, target: Point, obstacles: Obstacle[]): Point {
  return route(from, target, obstacles).aim;
}

/**
 * Drives towards a point by itself (tap-to-drive and the stop buttons). Returns the
 * input to apply this frame, or null once it has arrived.
 *
 * Like a careful driver:
 * - Follow the streets: steer for `route`'s aim point, round the blocks.
 * - Slow down before a corner, enough to make the turn (the turning circle shrinks with speed).
 * - Target close behind: reverse into it rather than loop round.
 * - Traffic ahead going its way (`traffic`, the vehicles' bodies): slow down and queue behind it, rather than ram it.
 *   Traffic coming the other way or across stops for the jeepney instead (traffic.ts), so it doesn't wait for that.
 */
export function autopilot(car: Car, target: Point, obstacles: Obstacle[] = [], arriveRadius = 2.5, traffic: readonly (Circle & { yaw: number })[] = []): Input | null {
  const toTarget = Math.hypot(target.x - car.x, target.z - car.z);
  if (toTarget < arriveRadius) return null;

  const { aim, then } = route(car, target, obstacles);
  const toAim = Math.hypot(aim.x - car.x, aim.z - car.z);
  const heading = Math.atan2(aim.x - car.x, aim.z - car.z);
  const diff = wrap(heading - car.yaw);

  // Bumper or tail against a kerb: a three-point turn. Back out if the nose is stuck,
  // pull forward if the tail is, so it never keeps pushing into whatever is behind it.
  const blockedAt = (ahead: number) => {
    const x = car.x + Math.sin(car.yaw) * ahead;
    const z = car.z + Math.cos(car.yaw) * ahead;
    return outside(x, z) || obstacles.some((o) => touches(o, x, z, 0.5));
  };
  // Once backing out, keep going until the nose has real room, or it rocks back and forth on the spot.
  // Aim behind with little room ahead: a forward U-turn won't fit, so back round first.
  const noseStuck = blockedAt(2.6) || ((car.speed < -0.1 || Math.abs(diff) > 2.2) && blockedAt(4.5));
  const tailStuck = blockedAt(-2.6);
  if (noseStuck && !tailStuck && car.speed < 1) return { throttle: -0.8, steer: diff > 0 ? -1 : 1 };
  if (tailStuck && car.speed > -1 && (noseStuck || Math.abs(diff) > 2.2)) return { throttle: 0.8, steer: diff > 0 ? 1 : -1 };

  if (Math.abs(diff) > 2.2 && toTarget < 6) {
    // Reversing flips the steering, so steer the tail (yaw + π) towards the target.
    return { throttle: -0.7, steer: clamp(-wrap(diff - Math.PI) * 2, -1, 1) };
  }

  let steer = clamp(diff * 2, -1, 1);

  const t = tuning;
  const turnable = t.turn * toTarget * 0.6; // fast enough to arrive, slow enough not to circle
  let wanted = Math.max(1.5, Math.min(t.maxForward, turnable) * (1 - 0.7 * Math.min(Math.abs(diff) / (Math.PI / 2), 1)));
  if (then) {
    // A corner at the aim point: arrive slow enough to turn inside the street (≈5 units/s for a right angle),
    // braking at about half the jeepney's real braking power so it's never a slam.
    const bend = Math.abs(wrap(Math.atan2(then.x - aim.x, then.z - aim.z) - heading));
    const cornerSpeed = 4 + 9 * Math.max(0, 1 - bend / (Math.PI / 2));
    wanted = Math.min(wanted, Math.sqrt(cornerSpeed * cornerSpeed + t.brake * toAim));
  }
  // Traffic in the jeepney's path (a body within its width, straight ahead). Something a lane over (2 m off its
  // middle) doesn't count, so it squeezes past traffic on the street's middle.
  // - Going the same way: queue ~1 m behind it.
  // - Coming the other way or across: it has stopped for the jeepney (traffic.ts), so steer round it, keeping right.
  const hx = Math.sin(car.yaw), hz = Math.cos(car.yaw);
  let dodge = 0;
  for (const c of traffic) {
    const ahead = (c.x - car.x) * hx + (c.z - car.z) * hz;
    const side = (c.x - car.x) * hz - (c.z - car.z) * hx; // > 0: on the left
    if (ahead <= 0 || ahead > 14) continue;
    if (Math.cos(c.yaw - car.yaw) >= 0.5) {
      if (Math.abs(side) < 0.8 + c.r) wanted = Math.min(wanted, Math.sqrt(t.brake * Math.max(0, ahead - c.r - 3.6)));
    } else if (ahead < 8 && Math.abs(side) < CAR_RADIUS + c.r) {
      dodge = (side > -0.5 ? -1 : 1) * (1 - ahead / 8);
      wanted = Math.min(wanted, 4);
    }
  }
  steer = clamp(steer + dodge * 2, -1, 1);
  let throttle = clamp((wanted - car.speed) * 0.5, -1, 1);
  if (throttle < 0 && car.speed < 0.5) throttle = 0; // brake, but never back up by accident
  return { throttle, steer };
}
