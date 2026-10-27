/**
 * Arcade driving for the jeepney. Pure functions, no three.js, so the rules can be
 * checked on their own (see driving.check.ts).
 *
 * The world is flat: x/z is the ground, yaw 0 faces +z, and a larger yaw turns left.
 */
export type Car = { x: number; z: number; yaw: number; speed: number; yawRate: number };

/** throttle and steer run from -1 to 1. steer > 0 turns left. */
export type Input = { throttle: number; steer: number };

/** The jeepney's centre never goes further than this from the island centre. */
export const ISLAND_LIMIT = 24.5;

const ACCEL = 14; // units/s² when speeding up
const BRAKE = 24; // units/s² when pressing against the current direction
const MAX_FORWARD = 12;
const MAX_REVERSE = 5;
const DRAG = 2.2; // how fast it coasts to a stop with no throttle
const TURN = 2.3; // radians/s at full lock and speed

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function step(car: Car, input: Input, dt: number): Car {
  let speed = car.speed;
  if (input.throttle !== 0) {
    const braking = Math.abs(speed) > 0.1 && Math.sign(input.throttle) !== Math.sign(speed);
    speed += input.throttle * (braking ? BRAKE : ACCEL) * dt;
  } else {
    speed *= Math.max(0, 1 - DRAG * dt);
  }
  speed = clamp(speed, -MAX_REVERSE, MAX_FORWARD);

  // Steering only bites when the wheels roll, and flips when reversing, like a real car.
  const yawRate = input.steer * TURN * clamp(speed / 4, -1, 1);
  const yaw = car.yaw + yawRate * dt;

  let x = car.x + Math.sin(yaw) * speed * dt;
  let z = car.z + Math.cos(yaw) * speed * dt;

  // Soft bump at the shoreline: pull back onto the island and lose some speed.
  const r = Math.hypot(x, z);
  if (r > ISLAND_LIMIT) {
    x *= ISLAND_LIMIT / r;
    z *= ISLAND_LIMIT / r;
    speed *= 0.6;
  }

  return { x, z, yaw, speed, yawRate };
}
