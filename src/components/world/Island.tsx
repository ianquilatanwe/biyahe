"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CircleGeometry, CylinderGeometry, type Mesh } from "three";
import { stops } from "@/lib/stops";

/** Same "random" every load, so the coastline never changes shape between visits. */
function wobble(angle: number) {
  return Math.sin(angle * 3) * 0.9 + Math.sin(angle * 7 + 1.3) * 0.5;
}

/** Pushes the outer ring of vertices in and out so the coast looks hand-made, not machine-round. */
function roughenEdge<T extends CylinderGeometry | CircleGeometry>(geo: T, minRadius: number): T {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = geo instanceof CircleGeometry ? pos.getY(i) : pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < minRadius) continue;
    const k = (r + wobble(Math.atan2(z, x))) / r;
    pos.setX(i, x * k);
    if (geo instanceof CircleGeometry) pos.setY(i, z * k);
    else pos.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

export const STOP_RADIUS = 19;

/** Where a stop sits on the ground (x, z), from its angle. */
export function stopPosition(angle: number): [number, number] {
  const a = (angle * Math.PI) / 180;
  return [Math.sin(a) * STOP_RADIUS, Math.cos(a) * STOP_RADIUS];
}

export function Island() {
  const sand = useMemo(() => roughenEdge(new CylinderGeometry(27, 30, 2, 40, 1), 26), []);
  const grass = useMemo(() => roughenEdge(new CircleGeometry(21.5, 40), 21), []);
  const foam = useRef<Mesh>(null!);

  // The foam ring breathes slowly, like small waves on the beach.
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.elapsedTime * 0.8) * 0.012;
    foam.current.scale.set(s, s, 1);
  });

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.6}>
        <circleGeometry args={[180, 48]} />
        <meshLambertMaterial color="#3aa6b9" />
      </mesh>
      <mesh ref={foam} rotation-x={-Math.PI / 2} position-y={-0.55}>
        <ringGeometry args={[27, 30.5, 64]} />
        <meshBasicMaterial color="#e9fbff" transparent opacity={0.55} />
      </mesh>
      <mesh geometry={sand} position-y={-1}>
        <meshLambertMaterial color="#f1d9a7" flatShading />
      </mesh>
      <mesh geometry={grass} rotation-x={-Math.PI / 2} position-y={0.01}>
        <meshLambertMaterial color="#8cc56b" flatShading />
      </mesh>
      {/* Terminal pad in the middle, where the trip starts. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[4, 24]} />
        <meshLambertMaterial color="#d8cbb0" />
      </mesh>

      {/* Day-1 placeholders for the five stops: a post and a coloured sign each. */}
      {stops.map((s, i) => {
        const [x, z] = stopPosition(s.angle);
        return (
          <group key={s.id} position={[x, 0, z]}>
            <mesh position-y={1.2}>
              <cylinderGeometry args={[0.15, 0.15, 2.4, 8]} />
              <meshLambertMaterial color="#6b4f3a" />
            </mesh>
            <mesh position-y={2.6}>
              <boxGeometry args={[2.2, 1, 0.2]} />
              <meshLambertMaterial color={["#d62839", "#2f8f5b", "#ffb347", "#e07a2e", "#1d4e89"][i]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
