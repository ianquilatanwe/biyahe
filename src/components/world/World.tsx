"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Vector3 } from "three";
import { step, type Car } from "@/lib/driving";
import { Island } from "./Island";
import { Jeepney, type JeepneyParts } from "./Jeepney";
import { useKeys } from "./useKeys";

const SKY = "#f6c9a1";
const CAMERA_OFFSET = new Vector3(0, 12, 20); // fixed angle: up and behind, never spins with the jeepney

/** Runs every frame: reads the keys, moves the jeepney, then eases the camera after it. */
function Driver() {
  const parts = useRef<JeepneyParts>(null);
  const keys = useKeys();
  const camera = useThree((s) => s.camera);
  const car = useRef<Car>({ x: 0, z: 2, yaw: Math.PI, speed: 0, yawRate: 0 });
  const focus = useRef(new Vector3(0, 0, 2));
  const target = useMemo(() => new Vector3(), []);
  const lean = useRef(0);
  const calm = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 1 / 20); // no giant leap after a stutter or a tab switch
    const c = (car.current = step(car.current, keys.read(), dt));
    const p = parts.current;
    if (!p) return;

    p.root.position.set(c.x, 0, c.z);
    p.root.rotation.y = c.yaw;
    for (const w of p.wheels) w.rotation.x += (c.speed * dt) / 0.42;

    if (!calm) {
      // The body leans out of turns and jiggles a little with speed: cheap "suspension".
      lean.current = MathUtils.damp(lean.current, c.yawRate * c.speed * 0.01, 6, dt);
      p.body.rotation.z = lean.current;
      p.body.position.y = Math.sin(clock.elapsedTime * 22) * 0.012 * Math.min(Math.abs(c.speed) / 6, 1);
    }

    // Camera: aim a little ahead of the jeepney so you see where you're going.
    const lookAhead = calm ? 0 : 0.3;
    target.set(c.x + Math.sin(c.yaw) * c.speed * lookAhead, 0, c.z + Math.cos(c.yaw) * c.speed * lookAhead);
    focus.current.lerp(target, calm ? 1 : 1 - Math.exp(-4 * dt));
    camera.position.copy(focus.current).add(CAMERA_OFFSET);
    camera.lookAt(focus.current);
  });

  return <Jeepney ref={parts} />;
}

function NoWebGL() {
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <p className="max-w-sm rounded-2xl bg-white/90 p-5 text-ink">
        {/* Plain text, no link: this sits inside an aria-hidden wrapper, and the skip link already goes to the list. */}
        This browser can’t show the 3D island. Every project is in the list below.
      </p>
    </div>
  );
}

export default function World() {
  return (
    <Canvas
      dpr={[1, 1.75]} // cap sharpness on high-density phones: the biggest single saving on mobile
      camera={{ fov: 40, near: 0.5, far: 300, position: [0, 16, 18] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      fallback={<NoWebGL />}
    >
      <color attach="background" args={[SKY]} />
      <fog attach="fog" args={[SKY, 55, 140]} />
      <hemisphereLight args={["#fff1d6", "#5f8f5a", 1.4]} />
      <directionalLight position={[-20, 30, 12]} intensity={2.2} color="#ffd9a6" />
      <Island />
      <Driver />
    </Canvas>
  );
}
