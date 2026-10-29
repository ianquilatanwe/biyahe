"use client";

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { CircleGeometry, CylinderGeometry } from "three";
import { reachable } from "@/lib/driving";
import { GRASS_RADIUS, ISLAND_RADIUS, OBSTACLES, wobble, type Point } from "@/lib/world";
import { paint } from "./paint";
import { Water } from "./Water";

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

const SAND = "#f1d9a7";
const GRASS = "#8cc56b";
const ROAD = "#d6c59c";

/** The ground: sea, sand, grass and the terminal pad. A click or tap on it drives there (onGround). */
export function Island({ onGround }: { onGround: (p: Point) => void }) {
  // A tap near the water or beside a landmark still counts: the target moves to where the jeepney can actually reach.
  const tapGround = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onGround(reachable({ x: e.point.x, z: e.point.z }, OBSTACLES));
  };

  const sand = useMemo(() => roughenEdge(new CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS + 3, 2, 96, 1), ISLAND_RADIUS - 1), []);
  const grass = useMemo(() => roughenEdge(new CircleGeometry(GRASS_RADIUS, 96), GRASS_RADIUS - 0.5), []);

  return (
    <group>
      <Water />
      <mesh geometry={sand} position-y={-1} material={paint(SAND)} onClick={tapGround} />
      <mesh geometry={grass} rotation-x={-Math.PI / 2} position-y={0.01} material={paint(GRASS)} onClick={tapGround} />
      {/* The jeepney's route: a packed-earth loop past every stop (the parking spots sit on it). */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.015} material={paint(ROAD)} onClick={tapGround}>
        <ringGeometry args={[13.3, 15.7, 144]} />
      </mesh>
      {/* Terminal pad in the middle, where the trip starts. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} material={paint("#d8cbb0")} onClick={tapGround}>
        <circleGeometry args={[4, 48]} />
      </mesh>
    </group>
  );
}
