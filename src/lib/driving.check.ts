// Quick self-check for the driving and layout rules. Run: node src/lib/driving.check.ts
import assert from "node:assert/strict";
import { aimPoint, autopilot, NO_INPUT, reachable, shoreLimit, step, type Car, type Input } from "./driving.ts";
import { stops as realStops } from "./stops.ts";
import { coastRadius, LANDMARKS, nearestStop, parkingSpot, stopPosition, type Circle, type Point } from "./world.ts";

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

// A landmark across the straight line: aim beside it, not at the target. A clear line: aim at the target.
const across = aimPoint({ x: 0, z: 0 }, { x: 0, z: -12 }, [post]);
assert.ok(Math.abs(across.x) > post.r + 1.3, "aims round a landmark in the way");
assert.deepEqual(aimPoint({ x: 0, z: 0 }, { x: 0, z: -12 }, []), { x: 0, z: -12 }, "aims straight when the way is clear");

// A tap between a landmark and the sea parks in front of the landmark, on the island side.
for (const o of LANDMARKS) {
  const behind = reachable({ x: o.x * 1.08, z: o.z * 1.08 }, LANDMARKS);
  assert.ok(Math.hypot(behind.x, behind.z) < Math.hypot(o.x, o.z), "tap behind a landmark parks in front of it");
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

// Random taps from random spots and headings (seeded, so the run is the same every time): nearly all arrive,
// and quickly. Before path planning round landmarks, 86% arrived and the slowest 5% took 9 s or more.
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const randomTap = () => {
  const a = rnd() * Math.PI * 2;
  const r = Math.sqrt(rnd()) * coastRadius(a);
  return reachable({ x: Math.cos(a) * r, z: Math.sin(a) * r }, LANDMARKS);
};
const times: number[] = [];
for (let i = 0; i < 500; i++) {
  const from = randomTap();
  const to = randomTap();
  let car: Car = { ...from, yaw: rnd() * Math.PI * 2, speed: 0, yawRate: 0 };
  for (let t = 0; t < 12; t += DT) {
    const input = autopilot(car, to, LANDMARKS);
    if (!input) {
      times.push(t);
      break;
    }
    car = step(car, input, DT, LANDMARKS);
  }
}
times.sort((a, b) => a - b);
const p95 = times[Math.floor(times.length * 0.95)];
assert.ok(times.length >= 485, `random taps arrive at least 97% of the time (got ${times.length}/500)`);
assert.ok(p95 < 6.5, `95% of tap trips arrive within 6.5 s (got ${p95.toFixed(1)} s)`);

// Start right beside a landmark, tap its other side, from all round and facing every way. Before the
// "never round the back" rule and glancing bumps, about 1 in 14 of these got wedged or crawled.
let besideTrips = 0;
let besideArrived = 0;
for (const o of LANDMARKS) {
  for (let deg = 0; deg < 360; deg += 20) {
    for (const off of [0.1, 0.6]) {
      const a = (deg * Math.PI) / 180;
      const d = o.r + 1.3 + off;
      const from = reachable({ x: o.x + Math.cos(a) * d, z: o.z + Math.sin(a) * d }, LANDMARKS);
      const to = reachable({ x: o.x - Math.cos(a) * (d + 1), z: o.z - Math.sin(a) * (d + 1) }, LANDMARKS);
      if (Math.hypot(to.x - from.x, to.z - from.z) < 3) continue;
      for (let y = 0; y < 4; y++) {
        let car: Car = { ...from, yaw: (y * Math.PI) / 2, speed: 0, yawRate: 0 };
        besideTrips++;
        for (let t = 0; t < 12; t += DT) {
          const input = autopilot(car, to, LANDMARKS);
          if (!input) {
            besideArrived++;
            break;
          }
          car = step(car, input, DT, LANDMARKS);
        }
      }
    }
  }
}
assert.ok(besideArrived >= besideTrips * 0.98, `trips round a landmark from right beside it arrive (got ${besideArrived}/${besideTrips})`);

console.log(
  `driving: all checks pass (stop sweep ${arrived}/200, random taps ${times.length}/500, 95% within ${p95.toFixed(1)} s, beside a landmark ${besideArrived}/${besideTrips})`,
);
