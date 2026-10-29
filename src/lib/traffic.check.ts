// Quick self-check for the traffic. Run: node src/lib/traffic.check.ts
import assert from "node:assert/strict";
import { autopilot, reachable, step, type Car } from "./driving.ts";
import { stops } from "./stops.ts";
import { makeTraffic, stepTraffic, TRACKS, type Traffic } from "./traffic.ts";
import { BLOCK_BOXES, OBSTACLES, parkingSpot, site, type Point } from "./world.ts";

const DT = 1 / 60;
const GIVE_UP = 20; // seconds, as in World.tsx

// Every track is a smooth closed loop on the streets (the terminal's also crosses its own yard).
for (const [name, t] of Object.entries(TRACKS)) {
  for (let i = 0; i < t.x.length; i++) {
    const k = (i + 1) % t.x.length;
    assert.ok(Math.abs(Math.hypot(t.x[k] - t.x[i], t.z[k] - t.z[i]) - t.step) < 0.05, `${name}: evenly sampled at ${i}`);
    const inBlock = BLOCK_BOXES.some((b) => Math.abs(t.x[i] - b.x) < b.hx && Math.abs(t.z[i] - b.z) < b.hz);
    const inYard = name === "terminal" && Math.abs(t.x[i] - 3.6) < 3.1 && t.z[i] > -30 && t.z[i] < -15;
    assert.ok(!inBlock || inYard, `${name}: on the street at (${t.x[i].toFixed(1)}, ${t.z[i].toFixed(1)})`);
  }
}

/** The closest any two bodies come (vehicle to vehicle, vehicle to visitor), as overlap in metres (≤ 0 is apart). */
function overlaps(traffic: Traffic) {
  let cars = -Infinity;
  let player = -Infinity;
  const { bodies, owner } = traffic;
  for (let a = 0; a < bodies.length; a++) {
    if (traffic.vehicles[owner[a]].away) continue;
    for (let b = a + 1; b < bodies.length; b++) {
      if (owner[a] === owner[b]) continue;
      cars = Math.max(cars, bodies[a].r + bodies[b].r - Math.hypot(bodies[a].x - bodies[b].x, bodies[a].z - bodies[b].z));
    }
    for (const p of traffic.player) player = Math.max(player, bodies[a].r + p.r - Math.hypot(bodies[a].x - p.x, bodies[a].z - p.z));
  }
  return { cars, player };
}

/**
 * Runs the town for `seconds` with the visitor's jeepney driven by `drive` (or parked). Returns the worst overlaps, the
 * longest any vehicle stood still, laps of the terminal's jeepney, and toots.
 */
function run(seconds: number, player: Car, drive?: (car: Car, traffic: Traffic) => Car) {
  const traffic = makeTraffic();
  let worstCars = -Infinity, worstPlayer = -Infinity, toots = 0, laps = 0;
  const still = traffic.vehicles.map(() => 0);
  const longest = traffic.vehicles.map(() => 0);
  for (let t = 0; t < seconds; t += DT) {
    const before = traffic.vehicles[0].dwell;
    stepTraffic(traffic, player, DT, false, () => toots++);
    if (traffic.vehicles[0].dwell > before + 1) laps++;
    if (drive) player = drive(player, traffic);
    const o = overlaps(traffic);
    worstCars = Math.max(worstCars, o.cars);
    worstPlayer = Math.max(worstPlayer, o.player);
    traffic.vehicles.forEach((v, i) => {
      still[i] = v.speed < 0.05 && v.dwell <= 0 ? still[i] + DT : 0;
      longest[i] = Math.max(longest[i], still[i]);
    });
  }
  return { worstCars, worstPlayer, longest: Math.max(...longest), laps, toots, player };
}

// On their own (the visitor parked in the plaza, out of every lane): ten minutes without a bump or a jam.
const alone = run(600, { x: 0, z: 0, yaw: 0, speed: 0, yawRate: 0 });
assert.ok(alone.worstCars < 0.15, `traffic never drives into traffic (worst overlap ${alone.worstCars.toFixed(2)} m)`);
assert.ok(alone.longest < 6, `nobody waits more than 6 s on their own (longest ${alone.longest.toFixed(1)} s)`);
assert.ok(alone.laps >= 6, `the terminal's jeepney keeps doing laps (${alone.laps} in 10 min)`);
assert.equal(alone.toots, 0, "nobody toots at a visitor who isn't in the way");

// The visitor parked at every stop (along the street, either way), two minutes each: traffic stops short of them,
// toots, pulls round, and never jams.
let parkedWorst = -Infinity, parkedLongest = 0, parkedToots = 0;
for (const s of stops) {
  const along = site(s.id).facing.x ? 0 : Math.PI / 2; // a stop facing east or west is on a north–south street
  for (const yaw of [along, along + Math.PI]) {
    const p = parkingSpot(s.id);
    const r = run(120, { x: p.x, z: p.z, yaw, speed: 0, yawRate: 0 });
    parkedWorst = Math.max(parkedWorst, r.worstCars, r.worstPlayer);
    parkedLongest = Math.max(parkedLongest, r.longest);
    parkedToots += r.toots;
  }
}
assert.ok(parkedWorst < 0.15, `traffic never drives into the parked visitor or each other (worst overlap ${parkedWorst.toFixed(2)} m)`);
assert.ok(parkedLongest < 15, `nobody is stuck behind a parked visitor for long (longest ${parkedLongest.toFixed(1)} s)`);
assert.ok(parkedToots > 0, "someone toots at a visitor parked in their lane");

// Random taps with the traffic moving (seeded): nearly all still arrive, and nobody drives through anybody.
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const randomTap = (): Point => reachable({ x: (rnd() * 2 - 1) * 45, z: (rnd() * 2 - 1) * 45 }, OBSTACLES);
const traffic = makeTraffic();
let arrived = 0, tried = 0, worst = -Infinity, worstCars = -Infinity;
for (let i = 0; i < 300; i++) {
  let car: Car = { ...randomTap(), yaw: rnd() * Math.PI * 2, speed: 0, yawRate: 0 };
  // Don't start inside a vehicle.
  if (traffic.bodies.some((b) => Math.hypot(b.x - car.x, b.z - car.z) < b.r + 2)) continue;
  tried++;
  const to = randomTap();
  for (let t = 0; t < GIVE_UP; t += DT) {
    stepTraffic(traffic, car, DT);
    const input = autopilot(car, to, OBSTACLES, 2.5, traffic.bodies);
    if (!input) {
      arrived++;
      break;
    }
    car = step(car, input, DT, traffic.obstacles);
    const o = overlaps(traffic);
    worst = Math.max(worst, o.player);
    worstCars = Math.max(worstCars, o.cars);
  }
}
assert.ok(arrived >= tried * 0.95, `taps arrive with traffic about (got ${arrived}/${tried})`);
assert.ok(worst < 0.3, `the visitor never drives through traffic (worst overlap ${worst.toFixed(2)} m)`);
assert.ok(worstCars < 0.15, `traffic never drives into traffic while the visitor drives (worst ${worstCars.toFixed(2)} m)`);

console.log(
  `traffic: all checks pass (alone: worst ${alone.worstCars.toFixed(2)} m, longest wait ${alone.longest.toFixed(1)} s, ${alone.laps} terminal laps; ` +
    `parked: longest ${parkedLongest.toFixed(1)} s, ${parkedToots} toots; taps ${arrived}/${tried}, visitor overlap ${worst.toFixed(2)} m)`,
);
