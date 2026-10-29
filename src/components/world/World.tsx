"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { MathUtils, Vector2, Vector3 } from "three";
import { autopilot, NO_INPUT, step, type Car } from "@/lib/driving";
import { sound } from "@/lib/sound";
import { stops } from "@/lib/stops";
import { tuning } from "@/lib/tuning";
import { nearestStop, OBSTACLES, SHORE_Z } from "@/lib/world";
import type { Destination } from "../IslandExperience";
import { Jeepney, type JeepneyParts } from "./Jeepney";
import { Landmarks } from "./Landmarks";
import { StopSigns } from "./StopSigns";
import { TapMarker } from "./TapMarker";
import { Town } from "./Town";
import { useCalm } from "./useCalm";
import { useKeys } from "./useKeys";
import { FOCUS } from "./weather";

const SKY = "#f6c9a1";
const START: Car = { x: -11, z: 24, yaw: Math.PI, speed: 0, yawRate: 0 }; // on the street west of FashionHub, facing north up the town
const GIVE_UP_AFTER = 20; // seconds: an unreachable destination never leaves the jeepney circling (driving.check.ts uses the same)
const focusPoint = new Vector3();
const buffer = new Vector2();

type DriverProps = {
  driving: boolean;
  destination: RefObject<Destination | null>;
  onNear: (id: string | null) => void;
  onArrive: (stopId: string) => void;
};

/** Runs every frame: works out the input, moves the jeepney, reports the nearby stop, eases the camera. */
function Driver({ driving, destination, onNear, onArrive }: DriverProps) {
  const parts = useRef<JeepneyParts>(null);
  const keys = useKeys(driving);
  const calm = useCalm();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  // A portrait phone sees less of the island side to side, so the camera pulls back to compensate.
  const pullBack = useThree((s) => MathUtils.clamp(1.2 / s.viewport.aspect, 1, 1.8));
  const car = useRef<Car>(START);
  const focus = useRef(new Vector3(START.x, 0, START.z));
  const target = useMemo(() => new Vector3(), []);
  const offset = useMemo(() => new Vector3(), []);
  const lean = useRef(0);
  const near = useRef<string | null>(null);
  const route = useRef<string | null>(null);
  const tripTime = useRef(0);
  const lastTrip = useRef<Destination | null>(null);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 1 / 20); // no giant leap after a stutter, a tab switch or a pause

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
      const auto = timedOut ? null : autopilot(car.current, trip, OBSTACLES);
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

    const c = (car.current = step(car.current, input, dt, OBSTACLES));

    // Sound: the engine follows speed and throttle; the sea gets louder towards the bay (ahead, so no panning).
    const toWater = c.z - SHORE_Z - 4; // 0 on the bay boulevard's kerb
    sound.update(c.speed, input.throttle ? 1 : 0, 1 - Math.min(toWater / 16, 1), 0);

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
    // uses 1 - exp(-rate·dt) so it feels the same at 30, 60 or 144 fps.
    const lookAhead = calm.current ? 0 : tuning.lookAhead;
    target.set(c.x + Math.sin(c.yaw) * c.speed * lookAhead, 0, c.z + Math.cos(c.yaw) * c.speed * lookAhead);
    focus.current.lerp(target, calm.current ? 1 : 1 - Math.exp(-tuning.cameraFollow * dt));
    camera.position.copy(focus.current).add(offset.set(0, tuning.cameraHeight, tuning.cameraDistance).multiplyScalar(pullBack));
    camera.lookAt(focus.current);

    // Tell the buildings' shader where the jeepney is on screen, so whatever stands in front of it fades out.
    camera.updateMatrixWorld();
    gl.getDrawingBufferSize(buffer);
    focusPoint.set(c.x, 1, c.z).applyMatrix4(camera.matrixWorldInverse);
    FOCUS.uFocusDepth.value = -focusPoint.z;
    focusPoint.set(c.x, 1, c.z).project(camera);
    FOCUS.uFocusPx.value.set(((focusPoint.x + 1) / 2) * buffer.x, ((focusPoint.y + 1) / 2) * buffer.y);
    FOCUS.uFocusRadius.value = 0.2 * Math.max(buffer.y, buffer.x * 0.6);
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

type WorldProps = DriverProps & {
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
      <Driver {...driver} />
      <TapMarker destination={driver.destination} />
      <StopSigns nearId={nearId} onStop={onGoToStop} onOpen={onOpen} />
      <FirstFrames onReady={onReady} />
      {/* If a slow phone keeps dropping below ~50 fps, draw at 1 pixel per CSS pixel: fewer pixels, steadier frames.
          ponytail: one step down only; add more steps if real phones still struggle at dpr 1. */}
      <PerformanceMonitor onDecline={() => setSharpness(1)} />
    </Canvas>
  );
}
