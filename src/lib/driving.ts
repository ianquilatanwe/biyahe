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

/**
 * A tapped point moved to somewhere the jeepney's centre can actually be: out of any landmark,
 * then in from the water. Without this a tap beside a big landmark is a target it can never reach.
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
 * Drives towards a point by itself (tap-to-drive and the stop buttons). Returns the
 * input to apply this frame, or null once it has arrived.
 *
 * Three rules, like a careful driver:
 * - Target close behind: reverse into it rather than loop round.
 * - Pick a speed slow enough to turn onto the target (the turning circle shrinks with speed),
 *   and brake down to it.
 * - Steer away from a landmark in front of the bumper, then back on course.
 */
export function autopilot(car: Car, target: Point, obstacles: Circle[] = [], arriveRadius = 2.5): Input | null {
  const dx = target.x - car.x;
  const dz = target.z - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < arriveRadius) return null;

  const diff = wrap(Math.atan2(dx, dz) - car.yaw);

  // Nose against a landmark or the shore and barely moving: back out, turning towards the target.
  const noseX = car.x + Math.sin(car.yaw) * 2.6;
  const noseZ = car.z + Math.cos(car.yaw) * 2.6;
  const blocked =
    Math.hypot(noseX, noseZ) > shoreLimit(noseX, noseZ) || obstacles.some((o) => Math.hypot(noseX - o.x, noseZ - o.z) < o.r + 0.5);
  if (blocked && car.speed < 1) return { throttle: -0.8, steer: diff > 0 ? -1 : 1 };

  if (Math.abs(diff) > 2.2 && dist < 6) {
    // Reversing flips the steering, so steer the tail (yaw + π) towards the target.
    return { throttle: -0.7, steer: clamp(-wrap(diff - Math.PI) * 2, -1, 1) };
  }

  let avoid = 0;
  for (const o of obstacles) {
    const d = Math.hypot(o.x - car.x, o.z - car.z) - o.r;
    const side = wrap(Math.atan2(o.x - car.x, o.z - car.z) - car.yaw);
    if (d < 5 && Math.abs(side) < 1.2) avoid += (side >= 0 ? -1 : 1) * (1 - Math.max(d, 0) / 5) * 1.5;
  }
  const steer = clamp(diff * 2 + avoid, -1, 1);

  const t = tuning;
  const turnable = t.turn * dist * 0.6; // fast enough to arrive, slow enough not to circle
  const wanted = Math.max(1.5, Math.min(t.maxForward, turnable) * (1 - 0.7 * Math.min(Math.abs(diff) / (Math.PI / 2), 1)));
  let throttle = clamp((wanted - car.speed) * 0.5, -1, 1);
  if (throttle < 0 && car.speed < 0.5) throttle = 0; // brake, but never back up by accident
  return { throttle, steer };
}
