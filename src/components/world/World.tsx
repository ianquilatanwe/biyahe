"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Vector3 } from "three";
import { autopilot, NO_INPUT, step, type Car } from "@/lib/driving";
import { stops } from "@/lib/stops";
import { tuning } from "@/lib/tuning";
import { LANDMARKS, nearestStop } from "@/lib/world";
import type { Destination } from "../IslandExperience";
import { NoIsland } from "../ui/NoIsland";
import { Island } from "./Island";
import { Jeepney, type JeepneyParts } from "./Jeepney";
import { Landmarks } from "./Landmarks";
import { useCalm } from "./useCalm";
import { useKeys } from "./useKeys";

const SKY = "#f6c9a1";
const START: Car = { x: 0, z: 2, yaw: Math.PI, speed: 0, yawRate: 0 }; // on the terminal pad, facing away from the camera
const GIVE_UP_AFTER = 12; // seconds: an unreachable destination never leaves the jeepney circling

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
    } else if (input.throttle || input.steer) {
      destination.current = null;
    } else if (trip) {
      tripTime.current += dt;
      const timedOut = tripTime.current >= GIVE_UP_AFTER;
      const auto = timedOut ? null : autopilot(car.current, trip, LANDMARKS);
      if (auto) input = auto;
      else {
        destination.current = null; // arrived (or gave up)
        // Open the card even after giving up: the visitor asked for that stop, and the card doesn't need the jeepney there.
        if (trip.stopId) onArrive(trip.stopId);
      }
    }

    const c = (car.current = step(car.current, input, dt, LANDMARKS));

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

function NoWebGL({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]); // nothing to wait for: lift the loading screen so this message shows
  return <NoIsland />;
}

type WorldProps = DriverProps & {
  /** false while the island is scrolled out of view: nothing renders. */
  active: boolean;
  onGoTo: (d: Destination) => void;
  onGoToStop: (id: string) => void;
  /** Called once, when the island has drawn its first frames (or WebGL turned out to be missing). */
  onReady: () => void;
};

export default function World({ active, onGoTo, onGoToStop, onReady, ...driver }: WorldProps) {
  return (
    <Canvas
      flat // no filmic tone mapping: the flat colours show exactly as their hex values
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]} // cap sharpness on high-density phones: the biggest single saving on mobile
      camera={{ fov: 40, near: 0.5, far: 300, position: [START.x, tuning.cameraHeight, START.z + tuning.cameraDistance] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      fallback={<NoWebGL onReady={onReady} />}
    >
      <color attach="background" args={[SKY]} />
      <fog attach="fog" args={[SKY, 55, 140]} />
      {/* Near-white light with only a hint of warmth: tinted light multiplied into every colour and turned the sand orange. */}
      <hemisphereLight args={["#fffaf0", "#6f9a62", 1.35]} />
      <directionalLight position={[-20, 30, 12]} intensity={2.0} color="#fff3e2" />
      <Island onGround={onGoTo} />
      <Landmarks onStop={onGoToStop} />
      <Driver {...driver} />
      <FirstFrames onReady={onReady} />
    </Canvas>
  );
}
