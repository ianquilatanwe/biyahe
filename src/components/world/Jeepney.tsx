"use client";

import { forwardRef, useRef, useImperativeHandle } from "react";
import type { Group } from "three";

/** Handles the driving loop moves each frame: the whole jeepney, its sprung body and the wheels. */
export type JeepneyParts = { root: Group; body: Group; wheels: Group[] };

const RED = "#d62839";
const YELLOW = "#ffc93c";
const BLUE = "#1d4e89";
const CHROME = "#cfd6de";
const GLASS = "#22313f";
const TYRE = "#1f1f24";

/** One box with flat-shaded paint, the building block of the whole model. */
function Box({ size, at, color }: { size: [number, number, number]; at: [number, number, number]; color: string }) {
  return (
    <mesh position={at}>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} flatShading />
    </mesh>
  );
}

/**
 * A jeepney built from boxes and cylinders: no model file. It faces +z, sits on the
 * ground at y = 0, and is about 4.6 long and 2.3 tall.
 */
export const Jeepney = forwardRef<JeepneyParts>(function Jeepney(_, ref) {
  const root = useRef<Group>(null!);
  const body = useRef<Group>(null!);
  const wheels = useRef<Group[]>([]);
  useImperativeHandle(ref, () => ({ root: root.current, body: body.current, wheels: wheels.current }));

  return (
    <group ref={root}>
      {/* Fake soft shadow: far cheaper than real shadows, which matters on phones. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} scale={[1.3, 2.7, 1]}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} />
      </mesh>

      {[
        [0.95, 1.45],
        [-0.95, 1.45],
        [0.95, -1.35],
        [-0.95, -1.35],
      ].map(([x, z], i) => (
        <group
          key={i}
          position={[x, 0.42, z]}
          ref={(g) => {
            if (g) wheels.current[i] = g;
          }}
        >
          <mesh rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.42, 0.42, 0.32, 12]} />
            <meshLambertMaterial color={TYRE} flatShading />
          </mesh>
          <mesh rotation-z={Math.PI / 2} position-x={x > 0 ? 0.17 : -0.17}>
            <cylinderGeometry args={[0.2, 0.2, 0.02, 8]} />
            <meshLambertMaterial color={CHROME} />
          </mesh>
        </group>
      ))}

      <group ref={body}>
        {/* chassis and running boards */}
        <Box size={[1.8, 0.35, 4.5]} at={[0, 0.72, 0]} color={CHROME} />
        {/* passenger cabin, with stripes and windows down both sides */}
        <Box size={[1.8, 1.05, 3.0]} at={[0, 1.4, -0.55]} color={RED} />
        {[0.905, -0.905].map((x) => (
          <group key={x}>
            <Box size={[0.02, 0.12, 3.0]} at={[x, 1.02, -0.55]} color={YELLOW} />
            <Box size={[0.02, 0.06, 3.0]} at={[x, 1.12, -0.55]} color={BLUE} />
            {[-1.6, -0.95, -0.3, 0.35].map((z) => (
              <Box key={z} size={[0.02, 0.42, 0.5]} at={[x, 1.6, z]} color={GLASS} />
            ))}
          </group>
        ))}
        {/* driver's cab and windscreen */}
        <Box size={[1.7, 0.95, 0.7]} at={[0, 1.35, 1.25]} color={YELLOW} />
        <Box size={[1.5, 0.45, 0.02]} at={[0, 1.55, 1.61]} color={GLASS} />
        {/* long chrome hood and grille */}
        <Box size={[1.4, 0.5, 1.05]} at={[0, 1.05, 2.05]} color={CHROME} />
        <Box size={[1.3, 0.42, 0.06]} at={[0, 1.02, 2.6]} color="#9aa4ae" />
        {[0.48, -0.48].map((x) => (
          <mesh key={x} position={[x, 1.02, 2.64]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.11, 0.11, 0.04, 10]} />
            <meshBasicMaterial color="#fff6d5" />
          </mesh>
        ))}
        {/* roof with a little lip at the front, and the rear step */}
        <Box size={[1.95, 0.12, 4.0]} at={[0, 2.0, -0.1]} color="#f4f1ea" />
        <Box size={[1.95, 0.22, 0.25]} at={[0, 2.12, 1.8]} color={BLUE} />
        <Box size={[1.2, 0.08, 0.35]} at={[0, 0.55, -2.35]} color={CHROME} />
      </group>
    </group>
  );
});
