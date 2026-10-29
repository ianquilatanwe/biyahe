"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Traffic as TrafficState } from "@/lib/traffic";
import { Fleet, type Batch, type FleetHandle } from "./Batched";
import { parkedJeepney } from "./Jeepney";
import { tricycle } from "./Landmarks";

// The same models as the parked ones, wheels and all (they don't turn: from up here they barely show).
const buildJeepney = (b: Batch) => parkedJeepney(b);
const buildTricycle = (b: Batch) => tricycle(b, [0.25, 0, 0], 0); // sidecar and bike either side of the middle
const JEEPNEY_SHADOW: [number, number] = [1.5, 3.1];
const TRICYCLE_SHADOW: [number, number] = [1.0, 1.1];

/** Draws the town's traffic where traffic.ts (stepped by the Driver) has put it: one instanced mesh per kind. */
export function Traffic({ traffic }: { traffic: TrafficState }) {
  const jeepneys = useRef<FleetHandle>(null);
  const tricycles = useRef<FleetHandle>(null);
  const count = (kind: string) => traffic.vehicles.filter((v) => v.kind === kind).length;

  useFrame(() => {
    let j = 0;
    let t = 0;
    for (const v of traffic.vehicles) {
      if (v.away) continue;
      if (v.kind === "jeepney") jeepneys.current?.place(j++, v.x, v.z, v.yaw);
      else tricycles.current?.place(t++, v.x, v.z, v.yaw);
    }
    jeepneys.current?.show(j);
    tricycles.current?.show(t);
  });

  return (
    <>
      <Fleet ref={jeepneys} build={buildJeepney} count={count("jeepney")} shadow={JEEPNEY_SHADOW} />
      <Fleet ref={tricycles} build={buildTricycle} count={count("tricycle")} shadow={TRICYCLE_SHADOW} />
    </>
  );
}
