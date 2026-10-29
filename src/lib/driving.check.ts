// Quick self-check for the driving and layout rules. Run: node src/lib/driving.check.ts
import assert from "node:assert/strict";
import { aimPoint, autopilot, LIMIT, NO_INPUT, reachable, step, type Car, type Input } from "./driving.ts";
import { stops } from "./stops.ts";
import { BLOCK_BOXES, nearestStop, OBSTACLES, parkingSpot, site, type Box, type Obstacle, type Point } from "./world.ts";

const DT = 1 / 60;
const GIVE_UP = 20; // seconds, as in World.tsx
const run = (car: Car, input: Input, seconds: number, obstacles: Obstacle[] = []) => {
  for (let t = 0; t < seconds; t += DT) car = step(car, input, DT, obstacles);
  return car;
};
const start: Car = { x: 0, z: 0, yaw: Math.PI, speed: 0, yawRate: 0 };
const inBlock = (p: Point, pad = 1.3 - 1e-6) => BLOCK_BOXES.some((b) => Math.abs(p.x - b.x) < b.hx + pad && Math.abs(p.z - b.z) < b.hz + pad);

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

// It never leaves the street square, in any direction.
for (let deg = 0; deg < 360; deg += 15) {
  const far = run({ ...start, yaw: (deg * Math.PI) / 180 }, { throttle: 1, steer: 0 }, 12);
  assert.ok(Math.abs(far.x) <= LIMIT + 1e-9 && Math.abs(far.z) <= LIMIT + 1e-9, `stays in town heading ${deg}°`);
}

// It can't drive into a block: from the street south of the plaza, straight north at it.
const block: Box = { x: 0, z: 0, hx: 7, hz: 7 };
const bumped = run({ ...start, z: 11 }, { throttle: 1, steer: 0 }, 3, [block]);
assert.ok(bumped.z >= 7 + 1.3 - 1e-9, "bumps the kerb, doesn't drive into the block");

// Autopilot reaches targets in front, beside and behind it (open ground).
const drive = (car: Car, target: Point, obstacles: Obstacle[] = [], seconds = GIVE_UP) => {
  for (let t = 0; t < seconds; t += DT) {
    const input = autopilot(car, target, obstacles);
    if (!input) return t;
    car = step(car, input, DT, obstacles);
  }
  return Infinity;
};
for (const target of [{ x: 0, z: -12 }, { x: 10, z: 0 }, { x: -6, z: 6 }, { x: 0, z: 3 }]) {
  assert.ok(drive(start, target) < 15, `autopilot reaches (${target.x}, ${target.z})`);
}

// Parking spots are on the street, reachable, and count as "near" their own stop.
const startSpot: Car = { x: -11, z: 24, yaw: Math.PI, speed: 0, yawRate: 0 }; // where World.tsx starts
for (const s of stops) {
  const spot = parkingSpot(s.id);
  assert.ok(!inBlock(spot), `${s.id}: parking spot is on the street`);
  assert.equal(nearestStop(spot.x, spot.z, stops)?.id, s.id, `${s.id}: parking spot is near its own stop`);
  assert.ok(drive(startSpot, spot, OBSTACLES) < GIVE_UP, `autopilot reaches ${s.id} from the start`);
}
assert.equal(nearestStop(startSpot.x, startSpot.z, stops), null, "the start is near no stop");
assert.ok(Math.abs(site("about").front.z + 15) < 1e-9, "the terminal faces the plaza");

// Taps are pulled into the square and out of blocks onto a street, so every target can be reached.
for (const p of [{ x: 0, z: 0 }, { x: -22, z: 23 }, { x: 60, z: -60 }, { x: 21.9, z: -15.1 }, { x: 14.9, z: 0 }]) {
  const q = reachable(p, OBSTACLES);
  assert.ok(!inBlock(q), `tap (${p.x}, ${p.z}) moves out of the block`);
  assert.ok(Math.abs(q.x) <= LIMIT && Math.abs(q.z) <= LIMIT, `tap (${p.x}, ${p.z}) stays in town`);
}

// A clear street: aim straight at the target. A block in the way: aim at an intersection, round it.
assert.deepEqual(aimPoint({ x: -11, z: 20 }, { x: -11, z: -20 }, OBSTACLES), { x: -11, z: -20 }, "aims straight along a clear street");
const round = aimPoint({ x: 0, z: 11 }, { x: 0, z: -11 }, OBSTACLES);
assert.ok(Math.abs(round.x) === 11 && round.z === 11, "aims at the plaza's corner to get round it");

/** Drives from `from` to `to` through the real town; returns the time taken, or Infinity if it gave up. */
const trip = (from: Car, to: Point) => drive(from, to, OBSTACLES);

// Stop-to-stop trips from awkward starts (random offset, heading and speed).
let arrived = 0;
for (let i = 0; i < 200; i++) {
  const p = parkingSpot(stops[i % 6].id);
  const from = reachable({ x: p.x + Math.sin(i) * 3, z: p.z + Math.cos(i * 1.7) * 3 }, OBSTACLES);
  const to = parkingSpot(stops[(i * 5 + 1) % 6].id);
  if (trip({ ...from, yaw: i * 0.37, speed: (i % 7) - 2, yawRate: 0 }, to) < GIVE_UP) arrived++;
}
assert.ok(arrived >= 196, `autopilot arrives on at least 98% of awkward stop trips (got ${arrived}/200)`);

// Random taps from random spots and headings (seeded, so the run is the same every time): nearly all arrive, and in time.
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const randomTap = () => reachable({ x: (rnd() * 2 - 1) * 45, z: (rnd() * 2 - 1) * 45 }, OBSTACLES);
const times: number[] = [];
for (let i = 0; i < 500; i++) {
  const t = trip({ ...randomTap(), yaw: rnd() * Math.PI * 2, speed: 0, yawRate: 0 }, randomTap());
  if (t < GIVE_UP) times.push(t);
}
times.sort((a, b) => a - b);
const p95 = times[Math.floor(times.length * 0.95)];
assert.ok(times.length >= 485, `random taps arrive at least 97% of the time (got ${times.length}/500)`);
assert.ok(p95 < 12, `95% of tap trips arrive within 12 s (got ${p95.toFixed(1)} s)`);

// Start pressed against a kerb, nose or tail first, and head for the far side of that block.
let kerbTrips = 0;
let kerbArrived = 0;
for (const b of BLOCK_BOXES) {
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const from = reachable({ x: b.x + nx * (b.hx + 1.4), z: b.z + nz * (b.hz + 1.4) }, OBSTACLES);
    const to = reachable({ x: b.x - nx * (b.hx + 2), z: b.z - nz * (b.hz + 2) }, OBSTACLES);
    for (let y = 0; y < 4; y++) {
      kerbTrips++;
      if (trip({ ...from, yaw: (y * Math.PI) / 2, speed: 0, yawRate: 0 }, to) < GIVE_UP) kerbArrived++;
    }
  }
}
assert.ok(kerbArrived >= kerbTrips * 0.98, `trips from against a kerb arrive (got ${kerbArrived}/${kerbTrips})`);

console.log(
  `driving: all checks pass (stop trips ${arrived}/200, random taps ${times.length}/500, 95% within ${p95.toFixed(1)} s, from a kerb ${kerbArrived}/${kerbTrips})`,
);
