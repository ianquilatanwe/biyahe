// Quick self-check for the driving rules. Run: node src/lib/driving.check.ts
import assert from "node:assert/strict";
import { ISLAND_LIMIT, step, type Car, type Input } from "./driving.ts";

const run = (car: Car, input: Input, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) car = step(car, input, 1 / 60);
  return car;
};
const start: Car = { x: 0, z: 0, yaw: Math.PI, speed: 0, yawRate: 0 };

// Throttle moves it the way it faces (yaw π = towards -z).
const ahead = run(start, { throttle: 1, steer: 0 }, 1);
assert.ok(ahead.z < -3 && Math.abs(ahead.x) < 1e-6, "drives forward");

// Steering left raises yaw when going forward, and lowers it when reversing.
assert.ok(run(ahead, { throttle: 1, steer: 1 }, 0.5).yaw > ahead.yaw, "left turns left");
const backing = run(start, { throttle: -1, steer: 0 }, 1);
assert.ok(run(backing, { throttle: -1, steer: 1 }, 0.5).yaw < backing.yaw, "reverse steering flips");

// Standing still, steering does nothing.
assert.equal(step(start, { throttle: 0, steer: 1 }, 1 / 60).yaw, start.yaw);

// Coasting slows it down; it never leaves the island.
assert.ok(run(ahead, { throttle: 0, steer: 0 }, 2).speed < ahead.speed / 5, "coasts to a stop");
const far = run(start, { throttle: 1, steer: 0 }, 20);
assert.ok(Math.hypot(far.x, far.z) <= ISLAND_LIMIT + 1e-9, "stays on the island");

console.log("driving: all checks pass");
