"use client";

import { useImperativeHandle, useMemo, useRef, type Ref } from "react";
import { ExtrudeGeometry, MeshLambertMaterial, PlaneGeometry, Shape, type Group } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Batched, SoftShadow, type Batch, type Vec } from "./Batched";
import { weathered } from "./weather";
import { paint } from "./paint";
import { makeRouteSign } from "./routeSign";
import { ART, makeSideArt } from "./sideArt";

/** Handles the driving loop uses each frame: the whole jeepney, its sprung body, the wheels, and the route sign. */
export type JeepneyParts = { root: Group; body: Group; wheels: Group[]; showRoute: (name: string) => void };

// A classic stainless jeepney: bare stainless body, painted stripes, chrome trim.
const STEEL = "#c3cbd3";
const STEEL_DARK = "#9da7b1";
const CHROME = "#f2f5f8";
const RED = "#c41e30"; // the page's --color-red, so the 3D jeepney and the HTML match
const BLUE = "#1d4e89";
const INSIDE = "#2b2f3a";
const GLASS = "#22313f";
const SEAT = "#7a1b26";
const AMBER = "#f2a531";
const TYRE = "#1f1f24";
const SACK = "#d9c79e";
const CRATE = "#8a5a3b";

const FRONT_AXLE = 1.45;
const REAR_AXLE = -1.35;
const WHEEL_R = 0.42;
const TRACK = 0.86; // wheel centres either side of the middle

/**
 * A flat outline in the side view (u = forward along z, v = up), pushed out sideways into a solid with
 * rounded edges. That is how the curved fenders and the wheel arches get made without a model file.
 * `x` is the outer face; the solid grows `depth` inwards from there.
 */
function sideways(b: Batch, color: string, shape: Shape, x: number, depth: number) {
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 12 });
  // Turned so the outline's u runs along +z; the push then runs along -x, so the right side starts at its outer face.
  b.add(color, g, x > 0 ? [x, 0, 0] : [x + depth, 0, 0], [0, -Math.PI / 2, 0]);
}

/** The front fender: sweeps up over the front wheel from the running board and rounds down at the nose. */
function fenderShape() {
  const s = new Shape();
  s.moveTo(0.6, 0.6);
  s.absarc(FRONT_AXLE, WHEEL_R, 0.55, Math.PI - 0.3, 0.3, true); // the arch over the wheel
  s.lineTo(2.58, 0.6);
  s.lineTo(2.6, 0.78);
  s.quadraticCurveTo(2.5, 1.12, 1.75, 1.13);
  s.quadraticCurveTo(1.0, 1.12, 0.6, 0.8);
  s.closePath();
  return s;
}

/**
 * The passenger body's lower side panel, from the back to the windscreen, with both wheel arches cut out. Its front
 * edge (z = 1.35) is behind the front axle, so only the back of the front arch is cut; the fender covers the rest.
 */
function sidePanelShape() {
  const s = new Shape();
  s.moveTo(-2.35, 0.58);
  s.absarc(REAR_AXLE, WHEEL_R, 0.55, Math.PI - 0.3, 0.3, true);
  // Along the bottom to the front arch, then up its curve to where it meets the panel's front edge.
  s.absarc(FRONT_AXLE, WHEEL_R, 0.55, Math.PI - 0.3, Math.PI - Math.acos((FRONT_AXLE - 1.35) / 0.55), true);
  s.lineTo(1.35, 1.27);
  s.lineTo(-2.35, 1.27);
  s.closePath();
  return s;
}

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

/** Everything on the body that only moves with the body: merged into one mesh. */
function buildBody(b: Batch) {
  // Underneath: chassis rails, so you don't see daylight under the body.
  b.box(INSIDE, [1.36, 0.22, 4.6], [0, 0.55, 0.1]); // narrower than the track, so it clears the tyres' inner faces

  // The nose: long stainless hood with a chrome ridge and louvres, chrome grille, bumper, horses.
  b.box(STEEL, [1.24, 0.47, 1.2], [0, 0.985, 1.97]);
  b.box(CHROME, [0.08, 0.025, 1.2], [0, 1.225, 1.97]);
  for (const x of [0.625, -0.625]) for (let i = 0; i < 4; i++) b.box(INSIDE, [0.01, 0.05, 0.16], [x, 1.1 - i * 0.08, 1.75]);
  b.box(CHROME, [1.26, 0.62, 0.08], [0, 0.98, 2.58]); // grille surround
  b.box(INSIDE, [1.02, 0.46, 0.02], [0, 0.98, 2.625]);
  for (let i = -3; i <= 3; i++) b.box(CHROME, [0.045, 0.46, 0.03], [i * 0.14, 0.98, 2.635]); // grille bars
  b.box(CHROME, [2.0, 0.17, 0.16], [0, 0.56, 2.7]); // bumper
  for (const x of [0.8, -0.8]) b.box(AMBER, [0.16, 0.1, 0.03], [x, 0.56, 2.79]); // bumper lamps
  horse(b, [0.36, 1.22, 2.25]);
  horse(b, [-0.36, 1.22, 2.25]);

  for (const side of [1, -1]) {
    const x = side * 1.0;
    sideways(b, STEEL, fenderShape(), x, 0.36); // front fender
    sideways(b, STEEL, sidePanelShape(), side * 0.985, 0.06); // passenger side panel
    b.box(CHROME, [0.03, 0.05, 3.72], [side * 1.01, 1.28, -0.5]); // belt-line trim (the paint job is drawn on top: see SideArt)
    // Window pillars: the side windows are open, so you see into the dark cabin between them.
    for (let z = 1.3; z > -2.4; z -= 0.52) b.box(STEEL, [0.05, 0.48, 0.07], [side * 0.97, 1.5, z]);
    // Mud flaps behind both wheels.
    for (const z of [FRONT_AXLE - 0.62, REAR_AXLE - 0.62]) b.box(INSIDE, [0.3, 0.3, 0.03], [side * TRACK, 0.32, z]);
    // Mirrors on long arms beside the windscreen, and a tall one on each fender.
    b.box(CHROME, [0.28, 0.025, 0.025], [side * 1.08, 1.52, 1.36]);
    b.box(STEEL_DARK, [0.04, 0.2, 0.13], [side * 1.22, 1.52, 1.38]);
    b.box(CHROME, [0.025, 0.36, 0.025], [side * 0.88, 1.28, 2.3]);
    b.box(STEEL_DARK, [0.1, 0.12, 0.04], [side * 0.88, 1.5, 2.3]);
    // A whip antenna on each front corner of the roof, swept back.
    b.box(CHROME, [0.02, 0.75, 0.02], [side * 0.9, 2.35, 1.82], [-0.3, 0, 0]);
    // Tail lamps.
    b.box(RED, [0.16, 0.22, 0.03], [side * 0.8, 0.85, -2.42]);
  }

  // The cabin, dark inside, with red vinyl bench backs along both sides, seen through the open windows.
  b.box(INSIDE, [1.84, 0.48, 3.62], [0, 1.49, -0.5]);
  for (const side of [1, -1]) b.box(SEAT, [0.04, 0.16, 3.3], [side * 0.92, 1.35, -0.65]);

  // Windscreen: split down the middle, under the roof's visor.
  b.box(GLASS, [1.6, 0.46, 0.03], [0, 1.49, 1.36]);
  b.box(CHROME, [0.05, 0.46, 0.04], [0, 1.49, 1.37]);
  b.box(STEEL, [1.86, 0.06, 0.08], [0, 1.25, 1.36]);

  // Back: stainless panels either side of the open doorway, grab rails, step and bumper.
  for (const x of [0.66, -0.66]) b.box(STEEL, [0.62, 0.69, 0.05], [x, 0.925, -2.38]);
  for (const x of [0.36, -0.36]) b.box(CHROME, [0.035, 1.05, 0.035], [x, 1.22, -2.42]);
  b.box(CHROME, [0.9, 0.05, 0.32], [0, 0.42, -2.55]); // step
  b.box(CHROME, [2.0, 0.12, 0.12], [0, 0.55, -2.44]);

  // The roof: deep stainless edge (the route is painted on it), reaching forward over the windscreen as a visor.
  b.box(STEEL, [2.0, 0.3, 4.4], [0, 1.88, -0.2]);
  for (const side of [1, -1]) {
    b.box(RED, [0.06, 0.03, 4.4], [side * 0.97, 2.045, -0.2]);
    b.box(BLUE, [0.02, 0.06, 4.4], [side * 1.005, 1.76, -0.2]);
  }
  for (const x of [-0.6, -0.2, 0.2, 0.6]) b.box(STEEL_DARK, [0.03, 0.015, 4.3], [x, 2.035, -0.2]); // seams in the roof sheet
  b.box(RED, [1.9, 0.02, 0.5], [0, 2.035, 1.72]); // painted visor
  b.box(BLUE, [1.9, 0.021, 0.06], [0, 2.036, 1.44]);
  for (let i = -2; i <= 2; i++) b.box(AMBER, [0.12, 0.07, 0.07], [i * 0.36, 2.07, 1.95]); // visor lamps

  // Roof rack over the back half, with some luggage.
  for (const x of [0.8, -0.8]) {
    b.box(CHROME, [0.04, 0.04, 1.8], [x, 2.35, -1.2]);
    for (const z of [-2.0, -1.2, -0.4]) b.box(CHROME, [0.035, 0.32, 0.035], [x, 2.19, z]);
  }
  for (const z of [-2.0, -0.4]) b.box(CHROME, [1.6, 0.035, 0.035], [0, 2.35, z]);
  b.ball(SACK, 0.32, [0.3, 2.27, -1.45], [1.2, 0.7, 1.4]);
  b.box(CRATE, [0.55, 0.36, 0.5], [-0.35, 2.21, -1.0]);
  b.box(BLUE, [0.5, 0.22, 0.45], [-0.3, 2.14, -1.75]);
}

/**
 * A parked jeepney merged into a scene's batch (the terminal yard's): the same body, its wheels as plain cylinders, and
 * painted stripes and a route board in place of the side art and sign textures. Costs no draw calls of its own.
 */
export function parkedJeepney(b: Batch) {
  b.shadow([0, 0.1], [1.5, 3.1], 1.2);
  buildBody(b);
  for (const [x, z] of [[TRACK, FRONT_AXLE], [-TRACK, FRONT_AXLE], [TRACK, REAR_AXLE], [-TRACK, REAR_AXLE]]) {
    b.cyl(TYRE, [WHEEL_R, WHEEL_R, 0.3], [x, WHEEL_R, z], [0, 0, Math.PI / 2], 12);
    b.cyl(CHROME, [0.22, 0.22, 0.02], [x + Math.sign(x) * 0.16, WHEEL_R, z], [0, 0, Math.PI / 2], 10);
  }
  const length = ART.front - ART.back;
  const mid = (ART.front + ART.back) / 2;
  for (const side of [1, -1]) {
    b.box(RED, [0.02, 0.1, length], [side * 1.02, ART.bottom + 0.14, mid]);
    b.box(BLUE, [0.02, 0.06, length], [side * 1.02, ART.bottom + 0.28, mid]);
  }
  b.box("#ffc93c", [1.66, 0.26, 0.02], [0, 1.86, 2.01]);
}

/**
 * The painted sides: a plane on each stainless side panel, both drawn with one canvas texture (one draw call).
 * Lit like the body, and cut out where the canvas is clear (the wheel arch).
 */
function SideArt() {
  const { geometry, material } = useMemo(() => {
    const map = makeSideArt([REAR_AXLE, FRONT_AXLE], 0.58, WHEEL_R);
    const w = ART.front - ART.back;
    const h = ART.top - ART.bottom;
    const z = (ART.front + ART.back) / 2;
    const y = (ART.top + ART.bottom) / 2;
    const side = (s: number) => {
      const g = new PlaneGeometry(w, h).rotateY((s * Math.PI) / 2).translate(s * 1.016, y, z);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + (s > 0 ? 1 : 0)) / 2); // right side: top row of the canvas
      return g;
    };
    return { geometry: mergeGeometries([side(1), side(-1)]), material: weathered(new MeshLambertMaterial({ map, alphaTest: 0.5 })) };
  }, []);
  return <mesh geometry={geometry} material={material} />;
}

// The four faces that show the stop name, painted on the roof's edge: front (visor), back, both sides.
const SIGN_FACES: { at: Vec; yaw: number; size: [number, number] }[] = [
  { at: [0, 1.86, 2.006], yaw: 0, size: [1.66, 0.26] },
  { at: [0, 1.86, -2.406], yaw: Math.PI, size: [1.66, 0.26] },
  { at: [1.006, 1.86, 0.5], yaw: Math.PI / 2, size: [1.66, 0.26] },
  { at: [-1.006, 1.86, 0.5], yaw: -Math.PI / 2, size: [1.66, 0.26] },
];

/**
 * A jeepney built from boxes and side-view outlines: no model file. It faces +z, sits on the
 * ground at y = 0, and is about 5.3 long and 2.4 tall with the rack.
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
      <SoftShadow size={[1.5, 3.1]} />

      {[
        [TRACK, FRONT_AXLE],
        [-TRACK, FRONT_AXLE],
        [TRACK, REAR_AXLE],
        [-TRACK, REAR_AXLE],
      ].map(([x, z], i) => (
        <group
          key={i}
          position={[x, WHEEL_R, z]}
          ref={(g) => {
            if (g) wheels.current[i] = g;
          }}
        >
          <mesh rotation-z={Math.PI / 2} material={paint(TYRE)}>
            <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.3, 24]} />
          </mesh>
          {/* chrome hubcap with a bar across it, so you can see the wheels turn */}
          <mesh rotation-z={Math.PI / 2} position-x={x > 0 ? 0.16 : -0.16} material={paint(CHROME)}>
            <cylinderGeometry args={[0.22, 0.22, 0.02, 20]} />
          </mesh>
          <mesh position-x={x > 0 ? 0.17 : -0.17} material={paint(TYRE)}>
            <boxGeometry args={[0.04, 0.46, 0.08]} />
          </mesh>
        </group>
      ))}

      <group ref={body}>
        <Batched build={buildBody} />
        <SideArt />
        {/* Round headlamps on the fender fronts: unlit, so they read as lit in any light. */}
        {[0.8, -0.8].map((x) => (
          <mesh key={x} position={[x, 0.9, 2.56]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.12, 0.12, 0.06, 20]} />
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
