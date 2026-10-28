"use client";

import { useMemo } from "react";
import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Euler, Matrix4, Quaternion, SphereGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paint } from "./paint";

export type Vec = [number, number, number];

/**
 * Collects many small parts that never move on their own and merges them into one mesh per colour:
 * forty brown planks become a single draw call instead of forty. That is what keeps a detailed
 * island inside its draw-call budget on phones. Anything animated stays a separate mesh.
 */
export class Batch {
  private byColour = new Map<string, BufferGeometry[]>();
  private frame = new Matrix4();

  /** Parts added inside `fn` are placed relative to a spot: moved to `at`, then turned by `yaw` (radians). */
  place(at: Vec, yaw: number, fn: () => void) {
    const saved = this.frame.clone();
    this.frame.multiply(new Matrix4().makeRotationY(yaw).setPosition(...at));
    fn();
    this.frame.copy(saved);
  }

  add(color: string, geometry: BufferGeometry, at: Vec, rot: Vec = [0, 0, 0], scale: Vec = [1, 1, 1]) {
    const local = new Matrix4().compose(new Vector3(...at), new Quaternion().setFromEuler(new Euler(...rot)), new Vector3(...scale));
    // Every part un-indexed, so boxes, cylinders and rocks can all be merged together.
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.applyMatrix4(local.premultiply(this.frame));
    const list = this.byColour.get(color) ?? [];
    list.push(g);
    this.byColour.set(color, list);
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
    return [...this.byColour].map(([color, parts]) => ({ color, geometry: mergeGeometries(parts) }));
  }
}

/** Draws whatever `build` adds, one mesh per colour. Pass a module-level function so it builds once. */
export function Batched({ build }: { build: (b: Batch) => void }) {
  const meshes = useMemo(() => {
    const b = new Batch();
    build(b);
    return b.build();
  }, [build]);
  return meshes.map(({ color, geometry }) => <mesh key={color} geometry={geometry} material={paint(color)} />);
}
