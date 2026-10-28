// Quick self-check for the driving and layout rules. Run: node src/lib/driving.check.ts
import assert from "node:assert/strict";
import { autopilot, NO_INPUT, reachable, shoreLimit, step, type Car, type Input } from "./driving.ts";
import { stops as realStops } from "./stops.ts";
import { LANDMARKS, nearestStop, parkingSpot, stopPosition, type Circle, type Point } from "./world.ts";

const DT = 1 / 60;
const run = (car: Car, input: Input, seconds: number, obstacles: Circle[] = []) => {
  for (let t = 0; t < seconds; t += DT) car = step(car, input, DT, obstacles);
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
assert.equal(step(start, { throttle: 0, steer: 1 }, DT).yaw, start.yaw);

// Coasting slows it down.
assert.ok(run(ahead, NO_INPUT, 2).speed < ahead.speed / 5, "coasts to a stop");

// It never leaves the island, in any direction, including where the coast dips in.
for (let deg = 0; deg < 360; deg += 15) {
  const far = run({ ...start, yaw: (deg * Math.PI) / 180 }, { throttle: 1, steer: 0 }, 12);
  assert.ok(Math.hypot(far.x, far.z) <= shoreLimit(far.x, far.z) + 1e-9, `stays on the island heading ${deg}°`);
}

// It can't drive through a landmark.
const post: Circle = { x: 0, z: -8, r: 1.2 };
const blocked = run(start, { throttle: 1, steer: 0 }, 3, [post]);
assert.ok(Math.hypot(blocked.x - post.x, blocked.z - post.z) >= post.r + 1.3 - 1e-9, "bumps, doesn't pass through");

// Autopilot reaches targets in front, beside and behind it.
const drive = (car: Car, target: Point, seconds = 15) => {
  for (let t = 0; t < seconds; t += DT) {
    const input = autopilot(car, target);
    if (!input) return t;
    car = step(car, input, DT);
  }
  return Infinity;
};
for (const target of [{ x: 0, z: -12 }, { x: 10, z: 0 }, { x: -6, z: 6 }, { x: 0, z: 3 }]) {
  assert.ok(drive(start, target) < 15, `autopilot reaches (${target.x}, ${target.z})`);
}

// Parking spots are reachable and count as "near" their own stop.
const stops = [{ id: "a", angle: 150 }, { id: "b", angle: -70 }];
for (const s of stops) {
  const spot = parkingSpot(s.angle);
  assert.equal(nearestStop(spot.x, spot.z, stops)?.id, s.id, `parking spot is near stop ${s.id}`);
  assert.ok(drive(start, spot) < 15, `autopilot reaches stop ${s.id}`);
}
assert.equal(nearestStop(0, 0, stops), null, "the terminal is near no stop");

// Taps are pulled out of landmarks and in from the water, so every target can be reached.
for (const o of LANDMARKS) {
  for (const p of [o, { x: o.x + 0.3, z: o.z }, { x: o.x * 1.3, z: o.z * 1.3 }]) {
    const q = reachable(p, LANDMARKS);
    assert.ok(Math.hypot(q.x - o.x, q.z - o.z) >= o.r + 1.3 - 1e-9, "tap target leaves the landmark");
    assert.ok(Math.hypot(q.x, q.z) <= shoreLimit(q.x, q.z) + 1e-9, "tap target stays on the island");
  }
}

// Stop-to-stop trips from awkward starts (random offset, heading and speed) around the real landmarks.
const angles = realStops.map((s) => s.angle);
const landmarks = LANDMARKS;
let arrived = 0;
for (let i = 0; i < 200; i++) {
  const from = parkingSpot(angles[i % 5]);
  let car: Car = { x: from.x + Math.sin(i) * 3, z: from.z + Math.cos(i * 1.7) * 3, yaw: i * 0.37, speed: (i % 7) - 2, yawRate: 0 };
  const to = parkingSpot(angles[(i * 3 + 1) % 5]);
  for (let t = 0; t < 12; t += DT) {
    const input = autopilot(car, to, landmarks);
    if (!input) {
      arrived++;
      break;
    }
    car = step(car, input, DT, landmarks);
  }
}
// The frame loop gives up after 12 s, so a rare miss just stops the trip.
assert.ok(arrived >= 196, `autopilot arrives on at least 98% of awkward trips (got ${arrived}/200)`);
assert.ok(Math.hypot(stopPosition(0).x, stopPosition(0).z - 19) < 1e-9, "angle 0 points at the camera");

console.log("driving: all checks pass");
