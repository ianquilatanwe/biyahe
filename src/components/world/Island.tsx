"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CircleGeometry, CylinderGeometry, type Mesh } from "three";
import { stops } from "@/lib/stops";
import { GRASS_RADIUS, ISLAND_RADIUS, stopPosition, wobble } from "@/lib/world";
import { paint } from "./paint";
import { useCalm } from "./useCalm";

/**
 * Pushes the outer ring of vertices in and out so the coast looks hand-made, not machine-round.
 * Uses the same wobble() as the driving limit, so what you see is where the jeepney stops.
 */
function roughenEdge<T extends CylinderGeometry | CircleGeometry>(geo: T, minRadius: number): T {
  const flat = geo instanceof CircleGeometry; // a circle lies in x/y and is laid flat later, so its y becomes world -z
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = flat ? -pos.getY(i) : pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < minRadius) continue;
    const k = (r + wobble(Math.atan2(z, x))) / r;
    pos.setX(i, x * k);
    if (flat) pos.setY(i, -z * k);
    else pos.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

const SIGN_COLOURS = ["#d62839", "#2f8f5b", "#ffb347", "#e07a2e", "#1d4e89"];

export function Island() {
  const sand = useMemo(() => roughenEdge(new CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS + 3, 2, 40, 1), ISLAND_RADIUS - 1), []);
  const grass = useMemo(() => roughenEdge(new CircleGeometry(GRASS_RADIUS, 40), GRASS_RADIUS - 0.5), []);
  const foam = useRef<Mesh>(null!);
  const calm = useCalm();

  // The foam ring breathes slowly, like small waves on the beach (still for reduced motion).
  useFrame(({ clock }) => {
    const s = calm.current ? 1 : 1 + Math.sin(clock.elapsedTime * 0.8) * 0.012;
    foam.current.scale.set(s, s, 1);
  });

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.6} material={paint("#3aa6b9")}>
        <circleGeometry args={[180, 48]} />
      </mesh>
      <mesh ref={foam} rotation-x={-Math.PI / 2} position-y={-0.55}>
        <ringGeometry args={[ISLAND_RADIUS, ISLAND_RADIUS + 3.5, 64]} />
        <meshBasicMaterial color="#e9fbff" transparent opacity={0.55} />
      </mesh>
      <mesh geometry={sand} position-y={-1} material={paint("#f1d9a7")} />
      <mesh geometry={grass} rotation-x={-Math.PI / 2} position-y={0.01} material={paint("#8cc56b")} />
      {/* Terminal pad in the middle, where the trip starts. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} material={paint("#d8cbb0")}>
        <circleGeometry args={[4, 24]} />
      </mesh>

      {/* Day-1 placeholders for the five stops: a post and a coloured sign each. */}
      {stops.map((s, i) => {
        const [x, z] = stopPosition(s.angle);
        return (
          <group key={s.id} position={[x, 0, z]}>
            <mesh position-y={1.2} material={paint("#6b4f3a")}>
              <cylinderGeometry args={[0.15, 0.15, 2.4, 8]} />
            </mesh>
            <mesh position-y={2.6} material={paint(SIGN_COLOURS[i])}>
              <boxGeometry args={[2.2, 1, 0.2]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
