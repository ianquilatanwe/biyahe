"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshBasicMaterial, Shape, ShapeGeometry, type Group } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Destination } from "../IslandExperience";
import { useCalm } from "./useCalm";

/** Four chevrons lying on the ground, pointing in at the spot. Built once, one merged mesh. */
function chevrons() {
  const v = new Shape().moveTo(0, 0).lineTo(0.45, 0.42).lineTo(0.66, 0.42).lineTo(0.21, 0).lineTo(0.66, -0.42).lineTo(0.45, -0.42).closePath();
  const parts = [0, 1, 2, 3].map((i) => new ShapeGeometry(v).translate(0.75, 0, 0).rotateZ((i * Math.PI) / 2).rotateX(-Math.PI / 2));
  return mergeGeometries(parts);
}
const CHEVRONS = chevrons();
const FACE = new MeshBasicMaterial({ color: "#ffc93c" });
const LEDGE = new MeshBasicMaterial({ color: "#1d2433" });

/**
 * Where a tap (or a stop button) is sending the jeepney: yellow chevrons with an ink ledge, like the
 * signboards. They land big and settle, then pulse in towards the spot until the jeepney arrives.
 * Reads the destination ref every frame, so nothing re-renders. Reduced motion: no landing or pulse.
 */
export function TapMarker({ destination }: { destination: RefObject<Destination | null> }) {
  const group = useRef<Group>(null!);
  const last = useRef<Destination | null>(null);
  const landed = useRef(0);
  const calm = useCalm();

  useFrame(({ clock }) => {
    const d = destination.current;
    const g = group.current;
    g.visible = !!d;
    if (!d) return;
    const t = clock.elapsedTime;
    if (d !== last.current) {
      last.current = d;
      landed.current = t;
      g.position.set(d.x, 0.05, d.z);
    }
    if (calm.current) {
      g.scale.setScalar(1);
      return;
    }
    const land = 1 + 0.9 * Math.exp(-(t - landed.current) * 10);
    g.scale.setScalar(land * (1 + 0.14 * Math.sin(t * 7)));
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={CHEVRONS} material={LEDGE} position={[0, 0, 0.09]} />
      <mesh geometry={CHEVRONS} material={FACE} position-y={0.02} />
    </group>
  );
}
