"use client";

import { button, folder, useControls } from "leva";
import { tuning, type Tuning } from "@/lib/tuning";

type Range = [min: number, max: number, step: number];

const RANGES: Record<keyof Tuning, Range> = {
  accel: [2, 40, 0.5],
  brake: [4, 60, 1],
  maxForward: [4, 30, 0.5],
  maxReverse: [1, 12, 0.5],
  drag: [0.2, 6, 0.1],
  turn: [0.5, 5, 0.1],
  lean: [0, 0.04, 0.001],
  bounce: [0, 0.05, 0.001],
  cameraHeight: [4, 30, 0.5],
  cameraDistance: [6, 40, 0.5],
  fadeRadius: [1, 10, 0.5],
  lookAhead: [0, 1, 0.05],
  cameraFollow: [0.5, 12, 0.5],
  cameraTurn: [1, 15, 0.5],
};

/** One slider per value. onChange writes straight into `tuning`, so nothing re-renders while you drag. */
function sliders(keys: (keyof Tuning)[]) {
  return Object.fromEntries(
    keys.map((k) => {
      const [min, max, step] = RANGES[k];
      return [k, { value: tuning[k], min, max, step, onChange: (v: number) => (tuning[k] = v) }];
    }),
  );
}

/**
 * Development-only sliders (Leva) for the driving and camera feel. Never part of the
 * live site: IslandExperience only loads this file when NODE_ENV is "development".
 * "Copy values" puts the current numbers on the clipboard to paste into src/lib/tuning.ts.
 */
export default function TuningPanel() {
  useControls({
    Driving: folder(sliders(["accel", "brake", "maxForward", "maxReverse", "drag", "turn"])),
    Body: folder(sliders(["lean", "bounce"])),
    Camera: folder(sliders(["cameraHeight", "cameraDistance", "lookAhead", "cameraFollow", "cameraTurn", "fadeRadius"])),
    "Copy values": button(() => navigator.clipboard.writeText(JSON.stringify(tuning, null, 2))),
  });
  return null;
}
