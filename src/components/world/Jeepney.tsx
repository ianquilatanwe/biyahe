"use client";

import { useImperativeHandle, useMemo, useRef, type Ref } from "react";
import type { Group } from "three";
import { Batched, type Batch, type Vec } from "./Batched";
import { paint } from "./paint";
import { makeRouteSign } from "./routeSign";

/** Handles the driving loop uses each frame: the whole jeepney, its sprung body, the wheels, and the route sign. */
export type JeepneyParts = { root: Group; body: Group; wheels: Group[]; showRoute: (name: string) => void };

const RED = "#d62839";
const YELLOW = "#ffc93c";
const BLUE = "#1d4e89";
const CHROME = "#cfd6de";
const GLASS = "#22313f";
const TYRE = "#1f1f24";
const ROOF = "#2a9d8f";
const SACK = "#d9c79e";
const CRATE = "#8a5a3b";

/** A rearing chrome horse, the classic jeepney hood ornament. Faces +z, standing on y = 0. */
function horse(b: Batch, at: Vec) {
  b.place(at, 0, () => {
    b.box(CHROME, [0.14, 0.03, 0.22], [0, 0.015, 0]); // plinth
    b.box(CHROME, [0.1, 0.12, 0.3], [0, 0.26, 0], [-0.5, 0, 0]); // body, front reared up
    b.box(CHROME, [0.08, 0.2, 0.09], [0, 0.43, 0.13], [0.35, 0, 0]); // neck
    b.box(CHROME, [0.08, 0.08, 0.17], [0, 0.53, 0.21], [0.25, 0, 0]); // head
    for (const x of [-0.03, 0.03]) {
      b.box(CHROME, [0.035, 0.22, 0.035], [x, 0.12, -0.1]); // hind legs
      b.box(CHROME, [0.035, 0.16, 0.035], [x, 0.3, 0.2], [1.0, 0, 0]); // front legs, kicking
    }
    b.box(CHROME, [0.03, 0.16, 0.03], [0, 0.22, -0.18], [-0.6, 0, 0]); // tail
  });
}

/** Everything on the body that only moves with the body: merged into one mesh per colour. */
function buildBody(b: Batch) {
  // chassis and running boards
  b.box(CHROME, [1.8, 0.35, 4.5], [0, 0.72, 0]);
  // passenger cabin, with stripes and windows down both sides
  b.box(RED, [1.8, 1.05, 3.0], [0, 1.4, -0.55]);
  for (const x of [0.905, -0.905]) {
    b.box(YELLOW, [0.02, 0.12, 3.0], [x, 1.02, -0.55]);
    b.box(BLUE, [0.02, 0.06, 3.0], [x, 1.12, -0.55]);
    for (const z of [-1.6, -0.95, -0.3, 0.35]) b.box(GLASS, [0.02, 0.42, 0.5], [x, 1.6, z]);
  }
  // driver's cab and windscreen
  b.box(YELLOW, [1.7, 0.95, 0.7], [0, 1.35, 1.25]);
  b.box(GLASS, [1.5, 0.45, 0.02], [0, 1.55, 1.61]);
  // long chrome hood and grille, with the two horses on top
  b.box(CHROME, [1.4, 0.5, 1.05], [0, 1.05, 2.05]);
  b.box("#9aa4ae", [1.3, 0.42, 0.06], [0, 1.02, 2.6]);
  horse(b, [0.38, 1.3, 2.25]);
  horse(b, [-0.38, 1.3, 2.25]);
  // painted roof with yellow trim, and the rear step
  b.box(ROOF, [1.95, 0.12, 4.0], [0, 2.0, -0.1]);
  for (const x of [0.95, -0.95]) b.box(YELLOW, [0.06, 0.13, 4.0], [x, 2.0, -0.1]);
  b.box(CHROME, [1.2, 0.08, 0.35], [0, 0.55, -2.35]);
  // route sign boards: across the front of the roof and along both sides (the text is drawn on top of them)
  b.box(YELLOW, [1.9, 0.36, 0.08], [0, 2.26, 1.75]);
  for (const x of [0.92, -0.92]) b.box(YELLOW, [0.06, 0.3, 1.8], [x, 2.21, 0.55]);
  // roof rack over the back half, with some luggage
  for (const x of [0.8, -0.8]) {
    b.box(CHROME, [0.05, 0.05, 1.7], [x, 2.36, -1.15]);
    for (const z of [-1.9, -1.15, -0.4]) b.box(CHROME, [0.04, 0.3, 0.04], [x, 2.21, z]);
  }
  for (const z of [-1.9, -0.4]) b.box(CHROME, [1.6, 0.04, 0.04], [0, 2.36, z]);
  b.ball(SACK, 0.32, [0.3, 2.3, -1.45], [1.2, 0.7, 1.4]);
  b.box(CRATE, [0.55, 0.38, 0.5], [-0.35, 2.25, -1.0]);
  b.box(BLUE, [0.5, 0.22, 0.45], [-0.3, 2.15, -1.7]);
}

// The four faces that show the stop name: front, back, left side, right side.
const SIGN_FACES: { at: Vec; yaw: number; size: [number, number] }[] = [
  { at: [0, 2.26, 1.795], yaw: 0, size: [1.8, 0.3] },
  { at: [0, 2.26, 1.705], yaw: Math.PI, size: [1.8, 0.3] },
  { at: [0.955, 2.21, 0.55], yaw: Math.PI / 2, size: [1.7, 0.26] },
  { at: [-0.955, 2.21, 0.55], yaw: -Math.PI / 2, size: [1.7, 0.26] },
];

/**
 * A jeepney built from boxes and cylinders: no model file. It faces +z, sits on the
 * ground at y = 0, and is about 4.6 long and 2.5 tall with the rack.
 */
export function Jeepney({ ref }: { ref?: Ref<JeepneyParts> }) {
  const root = useRef<Group>(null!);
  const body = useRef<Group>(null!);
  const wheels = useRef<Group[]>([]);
  const sign = useMemo(makeRouteSign, []);
  useImperativeHandle(ref, () => ({ root: root.current, body: body.current, wheels: wheels.current, showRoute: sign.show }), [sign]);

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
          <mesh rotation-z={Math.PI / 2} material={paint(TYRE)}>
            <cylinderGeometry args={[0.42, 0.42, 0.32, 12]} />
          </mesh>
          {/* hub with a bar across it, so you can see the wheels turn */}
          <mesh rotation-z={Math.PI / 2} position-x={x > 0 ? 0.17 : -0.17} material={paint(CHROME)}>
            <cylinderGeometry args={[0.2, 0.2, 0.02, 8]} />
          </mesh>
          <mesh position-x={x > 0 ? 0.18 : -0.18} material={paint(TYRE)}>
            <boxGeometry args={[0.04, 0.5, 0.1]} />
          </mesh>
        </group>
      ))}

      <group ref={body}>
        <Batched build={buildBody} />
        {[0.48, -0.48].map((x) => (
          <mesh key={x} position={[x, 1.02, 2.64]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.11, 0.11, 0.04, 10]} />
            <meshBasicMaterial color="#fff6d5" />
          </mesh>
        ))}
        {SIGN_FACES.map(({ at, yaw, size }) => (
          <mesh key={yaw} position={at} rotation-y={yaw}>
            <planeGeometry args={size} />
            <meshBasicMaterial map={sign.texture} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
