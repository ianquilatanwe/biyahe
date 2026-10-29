"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { MathUtils, Vector2, Vector3 } from "three";
import { autopilot, NO_INPUT, step, type Car } from "@/lib/driving";
import { sound } from "@/lib/sound";
import { stops } from "@/lib/stops";
import { makeTraffic, stepTraffic, type Traffic as TrafficState, type Vehicle } from "@/lib/traffic";
import { tuning } from "@/lib/tuning";
import { EDGE, nearestStop, OBSTACLES, SHORE_Z } from "@/lib/world";
import type { Destination } from "../IslandExperience";
import { Jeepney, type JeepneyParts } from "./Jeepney";
import { Landmarks } from "./Landmarks";
import { StopSigns } from "./StopSigns";
import { TapMarker } from "./TapMarker";
import { Town } from "./Town";
import { Traffic } from "./Traffic";
import { useCalm } from "./useCalm";
import { useKeys } from "./useKeys";
import { FOCUS } from "./weather";

const SKY = "#f6c9a1";
const START: Car = { x: -11, z: 24, yaw: Math.PI, speed: 0, yawRate: 0 }; // on the street west of FashionHub, facing north up the town
// The camera aims no nearer its own side of town than this (south when it looks north), so at the outer street less of
// what lies past the town comes into view (the jeepney drives on below the middle of the screen).
const FOCUS_EDGE = EDGE - 8;
const GIVE_UP_AFTER = 20; // seconds: an unreachable destination never leaves the jeepney circling (driving.check.ts uses the same)
const focusPoint = new Vector3();
/** A vehicle the jeepney has been holding up toots once before it pulls round. */
const toot = (v: Vehicle) => sound.toot(v.kind);
const buffer = new Vector2();

type DriverProps = {
  driving: boolean;
  traffic: TrafficState;
  destination: RefObject<Destination | null>;
  /** Quarter turns of the view, clockwise from looking north (any whole number: 1 east, -1 west). */
  turns: RefObject<number>;
  onNear: (id: string | null) => void;
  onArrive: (stopId: string) => void;
};

/** Runs every frame: works out the input, moves the jeepney, reports the nearby stop, eases the camera. */
function Driver({ driving, traffic, destination, turns, onNear, onArrive }: DriverProps) {
  const parts = useRef<JeepneyParts>(null);
  const keys = useKeys(driving);
  const calm = useCalm();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  // A portrait phone sees less of the town side to side, so the camera pulls back to compensate (less than it did on
  // the island, 1.8: the whole camera is further back now, and more would shrink the jeepney too far).
  const pullBack = useThree((s) => MathUtils.clamp(1.2 / s.viewport.aspect, 1, 1.5));
  const car = useRef<Car>(START);
  const focus = useRef(new Vector3(START.x, 0, START.z));
  const target = useMemo(() => new Vector3(), []);
  const offset = useMemo(() => new Vector3(), []);
  const lean = useRef(0);
  const heading = useRef(0); // which way the camera looks, radians clockwise from north, easing towards turns × 90°
  const near = useRef<string | null>(null);
  const route = useRef<string | null>(null);
  const tripTime = useRef(0);
  const lastTrip = useRef<Destination | null>(null);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 1 / 20); // no giant leap after a stutter, a tab switch or a pause
    stepTraffic(traffic, car.current, dt, calm.current, toot);

    // Keys win over the autopilot: touching a key cancels any trip in progress.
    let input = keys.read();
    const trip = destination.current;
    if (trip !== lastTrip.current) {
      lastTrip.current = trip;
      tripTime.current = 0;
    }
    if (!driving) {
      input = NO_INPUT;
      destination.current = null; // a card opened mid-trip ends the trip: closing it must not drive off on its own
    } else if (keys.braking()) {
      destination.current = null; // Space stops the jeepney, trip and all
      const v = car.current.speed;
      input = { throttle: Math.abs(v) > 0.2 ? -Math.sign(v) : 0, steer: input.steer };
    } else if (input.throttle || input.steer) {
      destination.current = null;
    } else if (trip) {
      tripTime.current += dt;
      const timedOut = tripTime.current >= GIVE_UP_AFTER;
      const auto = timedOut ? null : autopilot(car.current, trip, OBSTACLES, undefined, traffic.bodies);
      if (auto) input = auto;
      else {
        destination.current = null; // arrived (or gave up)
        // Open the card even after giving up: the visitor asked for that stop, and the card doesn't need the jeepney there.
        if (trip.stopId) {
          sound.horn(2); // beep-beep: "para po", this stop
          onArrive(trip.stopId);
        }
      }
    }

    const c = (car.current = step(car.current, input, dt, traffic.obstacles)); // the blocks and the traffic

    // Sound: the engine follows speed and throttle; the sea gets louder towards the bay, which is north: ahead when
    // looking north (no panning), on the left when looking east, on the right when looking west.
    const toWater = c.z - SHORE_Z - 4; // 0 on the bay boulevard's kerb
    // The plaza's chatter is loudest beside it (its kerbs are 7 m out) and gone two blocks away.
    const plaza = 1 - Math.min(Math.max(Math.hypot(c.x, c.z) - 9, 0) / 22, 1);
    sound.update(c.speed, input.throttle ? 1 : 0, 1 - Math.min(toWater / 16, 1), -Math.sin(heading.current), plaza);

    // Tell the page which stop is in range, only when it changes (a React update, not every frame).
    const id = nearestStop(c.x, c.z, stops)?.id ?? null;
    if (id !== near.current) {
      near.current = id;
      onNear(id);
    }

    const p = parts.current;
    if (!p) return;
    // The route sign on the roof names the closest stop, wherever the jeepney is (repaints only on change).
    const closest = nearestStop(c.x, c.z, stops, Infinity)!;
    if (closest.id !== route.current) {
      route.current = closest.id;
      p.showRoute(closest.name);
    }
    p.root.position.set(c.x, 0, c.z);
    p.root.rotation.y = c.yaw;
    for (const w of p.wheels) w.rotation.x += (c.speed * dt) / 0.42;

    // The body leans out of turns and jiggles a little with speed: cheap "suspension".
    lean.current = calm.current ? 0 : MathUtils.damp(lean.current, c.yawRate * c.speed * tuning.lean, 6, dt);
    p.body.rotation.z = lean.current;
    p.body.position.y = calm.current ? 0 : Math.sin(clock.elapsedTime * 22) * tuning.bounce * Math.min(Math.abs(c.speed) / 6, 1);

    // Camera: aim a little ahead of the jeepney so you see where you're going. The easing
    // uses 1 - exp(-rate·dt) so it feels the same at 30, 60 or 144 fps. It turns round the aim in quarter turns.
    const goal = turns.current * (Math.PI / 2);
    heading.current = calm.current ? goal : MathUtils.damp(heading.current, goal, tuning.cameraTurn, dt);
    const sin = Math.sin(heading.current);
    const cos = Math.cos(heading.current);
    const lookAhead = calm.current ? 0 : tuning.lookAhead;
    target.set(c.x + Math.sin(c.yaw) * c.speed * lookAhead, 0, c.z + Math.cos(c.yaw) * c.speed * lookAhead);
    // (-sin, cos) points from the aim back towards the camera: pull the aim in if it's past FOCUS_EDGE that way.
    const past = -target.x * sin + target.z * cos - FOCUS_EDGE;
    if (past > 0) target.set(target.x + past * sin, 0, target.z - past * cos);
    focus.current.lerp(target, calm.current ? 1 : 1 - Math.exp(-tuning.cameraFollow * dt));
    offset.set(-sin * tuning.cameraDistance, tuning.cameraHeight, cos * tuning.cameraDistance).multiplyScalar(pullBack);
    camera.position.copy(focus.current).add(offset);
    camera.lookAt(focus.current);

    // Tell the buildings' shader where the jeepney is on screen, so whatever stands in front of it fades out.
    camera.updateMatrixWorld();
    gl.getDrawingBufferSize(buffer);
    focusPoint.set(c.x, 1, c.z).applyMatrix4(camera.matrixWorldInverse);
    FOCUS.uFocusDepth.value = -focusPoint.z;
    focusPoint.set(c.x, 1, c.z).project(camera);
    FOCUS.uFocusPx.value.set(((focusPoint.x + 1) / 2) * buffer.x, ((focusPoint.y + 1) / 2) * buffer.y);
    // The circle is a fixed size in the world (tuning.fadeRadius metres), so it stays round the jeepney however far
    // back the camera is: metres → pixels is depth-scaled, and projectionMatrix[5] is 1 / tan(half the vertical fov).
    FOCUS.uFocusRadius.value = ((tuning.fadeRadius / FOCUS.uFocusDepth.value) * camera.projectionMatrix.elements[5] * buffer.y) / 2;
  });

  return <Jeepney ref={parts} />;
}

/** Tells the page once the island is really on screen: two frames in, the shaders are compiled and drawn. */
function FirstFrames({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    if (++frames.current === 2) onReady();
  });
  return null;
}

type WorldProps = Omit<DriverProps, "traffic"> & {
  /** false while the island is scrolled out of view: nothing renders. */
  active: boolean;
  onGoTo: (d: Destination) => void;
  onGoToStop: (id: string) => void;
  /** The stop the jeepney is parked at: its sign turns into an Open button. */
  nearId: string | null;
  onOpen: (id: string) => void;
  /** Called once, when the island has drawn its first frames. No WebGL throws instead, and IslandBoundary catches it. */
  onReady: () => void;
};

export default function World({ active, onGoTo, onGoToStop, nearId, onOpen, onReady, ...driver }: WorldProps) {
  const [sharpness, setSharpness] = useState(1.75);
  const traffic = useMemo(makeTraffic, []);
  return (
    <Canvas
      flat // no filmic tone mapping: the flat colours show exactly as their hex values
      frameloop={active ? "always" : "never"}
      dpr={[1, sharpness]} // cap sharpness on high-density phones: the biggest single saving on mobile
      camera={{ fov: 40, near: 0.5, far: 300, position: [START.x, tuning.cameraHeight, START.z + tuning.cameraDistance] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={[SKY]} />
      <fog attach="fog" args={[SKY, 70, 160]} />
      {/* Late afternoon: a lower, warmer sun from the west for longer light-and-shade, and a cooler sky fill.
          Kept near-white: strongly tinted light multiplies into every colour and turned the sand orange.
          The ground bounce is warm pavement grey (the town has little grass; green tinted every wall). */}
      <hemisphereLight args={["#f3f6ff", "#a39a8a", 1.25]} />
      <directionalLight position={[-26, 22, 14]} intensity={2.25} color="#ffe9cc" />
      <Town onGround={onGoTo} />
      <Landmarks onStop={onGoToStop} nearId={nearId} />
      <Driver {...driver} traffic={traffic} />
      <Traffic traffic={traffic} />
      <TapMarker destination={driver.destination} />
      <StopSigns nearId={nearId} onStop={onGoToStop} onOpen={onOpen} />
      <FirstFrames onReady={onReady} />
      {/* If a slow phone keeps dropping below ~50 fps, draw at 1 pixel per CSS pixel: fewer pixels, steadier frames.
          ponytail: one step down only; add more steps if real phones still struggle at dpr 1. */}
      <PerformanceMonitor onDecline={() => setSharpness(1)} />
    </Canvas>
  );
}
