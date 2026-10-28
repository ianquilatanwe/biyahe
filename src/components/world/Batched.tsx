"use client";

import { useMemo } from "react";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Euler,
  Matrix4,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type Vec = [number, number, number];

/** Parts are painted through their vertex colours, so one material (and one draw call) covers every colour. */
const VERTEX_PAINT = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
/** Soft shadows: black, with each vertex's alpha in its colour (dark in the middle, clear at the rim). */
const SHADOW_PAINT = new MeshBasicMaterial({ color: "#000", vertexColors: true, transparent: true, depthWrite: false });

// Baked "ambient occlusion": parts get darker towards the ground, as if the ground shaded them.
// Costs nothing at runtime: it's in the vertex colours. Colours are in linear space, so 0.6 reads as ~80% brightness.
const AO_FLOOR = 0.6;
const AO_HEIGHT = 1.3; // metres above the ground where the darkening has faded out

// Shadows fall away from the sun (World.tsx lights from -x, +z): this far per metre of height.
const SHADOW_LEAN: [number, number] = [0.22, -0.14];

/** A flat disc of radius 1, opaque-ish at the centre and clear at the rim. Shared by every soft shadow. */
export function softDisc(strength = 0.28) {
  const g = new CircleGeometry(1, 20).rotateX(-Math.PI / 2);
  const rgba = new Float32Array(g.attributes.position.count * 4);
  for (let i = 0; i < g.attributes.position.count; i++) rgba.set([1, 1, 1, i === 0 ? strength : 0], i * 4); // vertex 0 is the centre
  return g.setAttribute("color", new BufferAttribute(rgba, 4));
}
const DISC = softDisc();

const colour = new Color();
const point = new Vector3();

/**
 * Collects many small parts that never move on their own and merges them into one mesh: forty brown
 * planks and the red roof above them become a single draw call. That is what keeps a detailed island
 * inside its draw-call budget on phones. Anything animated stays a separate mesh.
 */
export class Batch {
  private parts: BufferGeometry[] = [];
  private shadows: BufferGeometry[] = [];
  private frame = new Matrix4();

  /** ao: false for things that don't stand on the ground (the bangka floats), so they aren't darkened. */
  constructor(private ao = true) {}

  /** Parts added inside `fn` lie flat on the ground (court lines, slabs): not darkened, or they'd turn grey. */
  flat(fn: () => void) {
    const ao = this.ao;
    this.ao = false;
    fn();
    this.ao = ao;
  }

  /** Parts added inside `fn` are placed relative to a spot: moved to `at`, then turned by `yaw` (radians). */
  place(at: Vec, yaw: number, fn: () => void) {
    const saved = this.frame.clone();
    this.frame.multiply(new Matrix4().makeRotationY(yaw).setPosition(...at));
    fn();
    this.frame.copy(saved);
  }

  add(color: string, geometry: BufferGeometry, at: Vec, rot: Vec = [0, 0, 0], scale: Vec = [1, 1, 1]) {
    const local = new Matrix4().compose(new Vector3(...at), new Quaternion().setFromEuler(new Euler(...rot)), new Vector3(...scale));
    // Every part un-indexed and without uv, so boxes, cylinders, rocks and extruded shapes all merge together.
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.deleteAttribute("uv");
    g.applyMatrix4(local.premultiply(this.frame));
    const pos = g.attributes.position;
    const rgb = new Float32Array(pos.count * 3);
    colour.set(color);
    for (let i = 0; i < pos.count; i++) {
      const t = this.ao ? Math.min(Math.max(pos.getY(i) / AO_HEIGHT, 0), 1) : 1;
      const shade = AO_FLOOR + (1 - AO_FLOOR) * t * t * (3 - 2 * t); // smoothstep
      rgb.set([colour.r * shade, colour.g * shade, colour.b * shade], i * 3);
    }
    g.setAttribute("color", new BufferAttribute(rgb, 3));
    this.parts.push(g);
  }

  /** A soft shadow on the ground under a part `height` tall: an ellipse of radii `size` (x, z in the current frame). */
  shadow(at: [number, number], size: [number, number], height = 1) {
    const g = DISC.clone().applyMatrix4(new Matrix4().makeScale(size[0], 1, size[1]).setPosition(at[0], 0, at[1]).premultiply(this.frame));
    point.setFromMatrixPosition(this.frame);
    g.translate(SHADOW_LEAN[0] * height, 0.04 - point.y, SHADOW_LEAN[1] * height); // just above the ground, wherever the frame is
    this.shadows.push(g);
  }

  box(color: string, size: Vec, at: Vec, rot?: Vec) {
    this.add(color, new BoxGeometry(...size), at, rot);
  }
  /** size = [top radius, bottom radius, height] */
  cyl(color: string, size: Vec, at: Vec, rot?: Vec, sides = 8) {
    this.add(color, new CylinderGeometry(size[0], size[1], size[2], sides), at, rot);
  }
  cone(color: string, radius: number, height: number, at: Vec, rot?: Vec, sides = 6) {
    this.add(color, new ConeGeometry(radius, height, sides), at, rot);
  }
  ball(color: string, radius: number, at: Vec, scale?: Vec) {
    this.add(color, new SphereGeometry(radius, 6, 4), at, undefined, scale);
  }
  rock(color: string, radius: number, at: Vec, rot?: Vec, scale?: Vec) {
    this.add(color, new DodecahedronGeometry(radius), at, rot, scale);
  }

  build() {
    return {
      solid: mergeGeometries(this.parts),
      shadows: this.shadows.length ? mergeGeometries(this.shadows) : null,
    };
  }
}

/**
 * Draws whatever `build` adds: one mesh for the parts, one for their shadows. Pass a module-level
 * function so it builds once. ao={false} for things that float.
 */
export function Batched({ build, ao = true }: { build: (b: Batch) => void; ao?: boolean }) {
  const { solid, shadows } = useMemo(() => {
    const b = new Batch(ao);
    build(b);
    return b.build();
  }, [build, ao]);
  return (
    <>
      <mesh geometry={solid} material={VERTEX_PAINT} />
      {shadows && <mesh geometry={shadows} material={SHADOW_PAINT} renderOrder={-1} />}
    </>
  );
}

/** A soft shadow that moves with its parent (the jeepney's): same disc and paint as the batched ones. */
export function SoftShadow({ size }: { size: [number, number] }) {
  return <mesh geometry={DISC} material={SHADOW_PAINT} position-y={0.04} scale={[size[0], 1, size[1]]} renderOrder={-1} />;
}
