/**
 * Arcade driving for the jeepney. Pure functions, no three.js, so the rules can be
 * checked on their own (see driving.check.ts).
 *
 * The world is flat: x/z is the ground, yaw 0 faces +z, and a larger yaw turns left.
 */
import { tuning } from "./tuning.ts";
import { coastRadius, type Circle, type Point } from "./world.ts";

export type Car = { x: number; z: number; yaw: number; speed: number; yawRate: number };

/** throttle and steer run from -1 to 1. steer > 0 turns left. */
export type Input = { throttle: number; steer: number };

export const NO_INPUT: Input = { throttle: 0, steer: 0 };

/** How far inside the water's edge the jeepney's centre must stay: half its length plus a little sand. */
const SHORE_MARGIN = 2.6;
/** The jeepney as a circle, for bumping into landmarks. */
const CAR_RADIUS = 1.3;

/** The furthest the jeepney's centre may go from the island centre in this direction. */
export function shoreLimit(x: number, z: number) {
  return coastRadius(Math.atan2(z, x)) - SHORE_MARGIN;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Extra room the autopilot leaves around a landmark, on top of the jeepney's own radius. */
const CLEARANCE = 0.9;

/**
 * A tapped point moved to somewhere the jeepney's centre can actually be: out of any landmark,
 * then in from the water. Without this a tap beside a big landmark is a target it can never reach.
 * A tap in the thin strip between a landmark and the sea counts as a tap on the landmark: the jeepney
 * parks on its island side, since squeezing round the back is barely possible.
 */
export function reachable(p: Point, obstacles: Circle[] = []): Point {
  let { x, z } = p;
  const r = Math.hypot(x, z);
  const limit = shoreLimit(x, z);
  if (r > limit) [x, z] = [(x * limit) / r, (z * limit) / r];
  for (const o of obstacles) {
    const min = o.r + CAR_RADIUS;
    let dx = x - o.x;
    let dz = z - o.z;
    let d = Math.hypot(dx, dz);
    const oR = Math.hypot(o.x, o.z);
    if (d < min + CLEARANCE && (x * o.x + z * o.z) / oR > oR) {
      // Seaward side: park in front instead.
      [x, z] = [o.x - (o.x / oR) * (min + 0.2), o.z - (o.z / oR) * (min + 0.2)];
      continue;
    }
    if (d >= min) continue;
    // Out the near side; if that's in the water (a landmark by the shore), out the island side instead.
    const outX = o.x + (dx / d) * min;
    const outZ = o.z + (dz / d) * min;
    if (d < 1e-6 || Math.hypot(outX, outZ) > shoreLimit(outX, outZ)) [dx, dz, d] = [-o.x, -o.z, Math.hypot(o.x, o.z)];
    x = o.x + (dx / d) * min;
    z = o.z + (dz / d) * min;
  }
  return { x, z };
}

export function step(car: Car, input: Input, dt: number, obstacles: Circle[] = []): Car {
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

  // Soft bump against landmarks: slide out to their edge and lose some speed.
  for (const o of obstacles) {
    const dx = x - o.x;
    const dz = z - o.z;
    const d = Math.hypot(dx, dz);
    const min = o.r + CAR_RADIUS;
    if (d > 0 && d < min) {
      x = o.x + (dx / d) * min;
      z = o.z + (dz / d) * min;
      speed *= 0.5;
    }
  }

  // Soft bump at the shoreline: pull back onto the island and lose some speed.
  const r = Math.hypot(x, z);
  const limit = shoreLimit(x, z);
  if (r > limit) {
    x *= limit / r;
    z *= limit / r;
    speed *= 0.6;
  }

  return { x, z, yaw, speed, yawRate };
}

/** Angle wrapped to -π..π, so a turn always goes the short way round. */
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Where to aim right now on the way to `target`. If a landmark sits across the straight line, aim
 * at the edge of a slightly bigger circle around it (the tangent point), on the side the line already
 * passes, unless that side is in the sea. Called every frame, the aim point slides round the circle,
 * so the jeepney sweeps around the landmark instead of hitting it and backing out.
 */
export function aimPoint(from: Point, target: Point, obstacles: Circle[], depth = 2): Point {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const len2 = dx * dx + dz * dz || 1e-9;
  let hit: { o: Circle; R: number; t: number } | null = null;
  for (const o of obstacles) {
    // A target parked right beside this landmark shrinks its circle, so the target itself stays outside it.
    const R = Math.min(o.r + CAR_RADIUS + CLEARANCE, Math.hypot(target.x - o.x, target.z - o.z) - 0.05);
    const t = clamp(((o.x - from.x) * dx + (o.z - from.z) * dz) / len2, 0, 1);
    const gap = Math.hypot(from.x + dx * t - o.x, from.z + dz * t - o.z);
    if (gap < R && t > 0 && (!hit || t < hit.t)) hit = { o, R, t };
  }
  if (!hit || depth === 0) return target;
  const { o, R } = hit;

  // Which way round: the side of the landmark the straight line passes, unless that's in the sea.
  const cross = dx * (o.z - from.z) - dz * (o.x - from.x); // > 0: landmark left of the line, so pass on the right
  let side = cross > 0 ? -1 : 1;
  const len = Math.sqrt(len2);
  const around = (s: number) => ({ x: o.x - (dz / len) * s * R, z: o.z + (dx / len) * s * R });
  const wet = (p: Point) => Math.hypot(p.x, p.z) > shoreLimit(p.x, p.z);
  if (wet(around(side)) && !wet(around(-side))) side = -side;

  // Tangent point from `from` onto the circle; from inside it, a point a little further round instead.
  const ax = from.x - o.x;
  const az = from.z - o.z;
  const d = Math.hypot(ax, az) || 1e-9;
  const turn = d > R ? Math.acos(R / d) : 0.7;
  const a = Math.atan2(az, ax) - side * turn;
  const aim = { x: o.x + Math.cos(a) * R, z: o.z + Math.sin(a) * R };
  // Another landmark in the way of the aim point gets the same treatment.
  return aimPoint(from, aim, obstacles, depth - 1);
}

/**
 * Drives towards a point by itself (tap-to-drive and the stop buttons). Returns the
 * input to apply this frame, or null once it has arrived.
 *
 * Like a careful driver:
 * - Plan round landmarks: steer for `aimPoint`, which skirts any landmark across the way.
 * - Target close behind: reverse into it rather than loop round.
 * - Pick a speed slow enough to turn onto the target (the turning circle shrinks with speed),
 *   and brake down to it.
 */
export function autopilot(car: Car, target: Point, obstacles: Circle[] = [], arriveRadius = 2.5): Input | null {
  const dx = target.x - car.x;
  const dz = target.z - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < arriveRadius) return null;

  const aim = aimPoint(car, target, obstacles);
  const diff = wrap(Math.atan2(aim.x - car.x, aim.z - car.z) - car.yaw);

  // Bumper or tail against a landmark or the shore: a three-point turn. Back out if the nose is stuck,
  // pull forward if the tail is, so it never keeps pushing into whatever is behind it.
  const blockedAt = (ahead: number) => {
    const x = car.x + Math.sin(car.yaw) * ahead;
    const z = car.z + Math.cos(car.yaw) * ahead;
    return Math.hypot(x, z) > shoreLimit(x, z) || obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 0.5);
  };
  const noseStuck = blockedAt(2.6);
  const tailStuck = blockedAt(-2.6);
  if (noseStuck && !tailStuck && car.speed < 1) return { throttle: -0.8, steer: diff > 0 ? -1 : 1 };
  if (tailStuck && car.speed > -1 && (noseStuck || Math.abs(diff) > 2.2)) return { throttle: 0.8, steer: diff > 0 ? 1 : -1 };

  if (Math.abs(diff) > 2.2 && dist < 6) {
    // Reversing flips the steering, so steer the tail (yaw + π) towards the target.
    return { throttle: -0.7, steer: clamp(-wrap(diff - Math.PI) * 2, -1, 1) };
  }

  const steer = clamp(diff * 2, -1, 1);

  const t = tuning;
  const turnable = t.turn * dist * 0.6; // fast enough to arrive, slow enough not to circle
  const wanted = Math.max(1.5, Math.min(t.maxForward, turnable) * (1 - 0.7 * Math.min(Math.abs(diff) / (Math.PI / 2), 1)));
  let throttle = clamp((wanted - car.speed) * 0.5, -1, 1);
  if (throttle < 0 && car.speed < 0.5) throttle = 0; // brake, but never back up by accident
  return { throttle, steer };
}
