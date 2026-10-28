"use client";

import { createRef, useMemo, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Vector3, type Camera, type Object3D } from "three";
import { stops } from "@/lib/stops";
import { LANDMARKS } from "@/lib/world";

/** How high each sign floats: just above the roof. The lighthouse's sits halfway up, or it's off the top of the screen. */
const HEIGHT: Record<string, number> = { fashionhub: 3.6, sprig: 3.3, lumenfold: 5, recipes: 3.6, about: 3.4 };

const at = new Vector3();
const base = new Vector3();
/**
 * Where on screen a sign goes: over its landmark, but kept inside the part of the screen nobody covers
 * (below the header, above the stop buttons, off the edges). A landmark out of frame keeps its sign at the
 * nearest edge, like a game's off-screen marker: the sign turns paper-white and its tail moves round the
 * sign's border to the side facing the landmark, pointing at it, so it never reads as "the landmark is here".
 * A landmark that is in frame but whose sign had to move (below the header, say) keeps a yellow sign, its
 * tail turned to the building. Signs also shrink with distance from the camera, to 85% on the far side.
 * This runs every frame, so it writes CSS variables straight onto the sign's element instead of re-rendering.
 */
function placer(box: RefObject<HTMLDivElement | null>) {
  return (el: Object3D, camera: Camera, size: { width: number; height: number }) => {
    at.setFromMatrixPosition(el.matrixWorld);
    const scale = Math.min(1, Math.max(0.85, 1 - ((at.distanceTo(camera.position) - 20) / 35) * 0.15));
    base.set(at.x, 0, at.z).project(camera); // the landmark's foot, on the ground
    at.project(camera);
    const bx = (base.x + 1) * (size.width / 2);
    const by = (1 - base.y) * (size.height / 2);
    const x = (at.x + 1) * (size.width / 2);
    const y = (1 - at.y) * (size.height / 2);
    const phone = size.width < 768;
    const top = phone ? 124 : 130; // header row plus the sign's own height (the sign hangs above this point)
    const bottom = size.height - (phone ? 190 : 120); // the stop strip and the hint
    const side = phone ? 64 : 90;
    const cx = Math.min(Math.max(x, side), size.width - side);
    const cy = Math.min(Math.max(y, top), bottom);
    const b = box.current;
    const plate = b?.querySelector<HTMLElement>("[data-go]");
    if (b && plate) {
      const moved = Math.hypot(x - cx, y - cy) > 4;
      const edge = base.z > 1 || bx < 0 || bx > size.width || by < 0 || by > size.height; // the landmark itself is out of frame
      // The tail points down at the landmark; once the sign has moved, towards the landmark's foot (or, out of
      // frame, towards where it is). It leaves the plate's rectangle on that side, on the straight part of
      // the edge (clear of the rounded corners). Its base stays flat on that edge and only its tip leans,
      // at most 45°: turning the whole tail lifted one end of its base ~4px off the plate.
      const a = moved ? (edge ? Math.atan2(y - cy, x - cx) : Math.atan2(by - cy, bx - cx)) : Math.PI / 2;
      const hw = plate.offsetWidth / 2;
      const hh = plate.offsetHeight / 2;
      const k = Math.max(Math.abs(Math.cos(a)) / hw, Math.abs(Math.sin(a)) / hh);
      let ox = Math.cos(a) / k;
      let oy = Math.sin(a) / k;
      const corner = 17; // 8px radius plus half the tail
      let n: number; // the edge's outward direction
      if (Math.abs(Math.abs(oy) - hh) < 0.5) {
        ox = Math.max(-(hw - corner), Math.min(hw - corner, ox)); // top or bottom edge
        n = Math.sign(oy) * (Math.PI / 2);
      } else {
        oy = 0; // a side: the plate is only ~36px tall, so the middle is the only straight part
        n = ox > 0 ? 0 : Math.PI;
      }
      const lean = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, Math.atan2(Math.sin(a - n), Math.cos(a - n))));
      const pull = 1 - 3 / Math.hypot(ox, oy); // overlap the rim by 3px
      const vars = `${edge}|${(hw + ox * pull).toFixed(1)}|${(hh + oy * pull).toFixed(1)}|${(n - Math.PI / 2).toFixed(3)}|${(-lean).toFixed(3)}|${scale.toFixed(2)}`;
      if (b.dataset.v !== vars) {
        const [e, px, py, rot, skew, s] = vars.split("|");
        b.dataset.v = vars;
        b.dataset.edge = e;
        b.style.cssText = `--px:${px}px;--py:${py}px;--rot:${rot}rad;--skew:${skew}rad;--s:${s}`;
      }
    }
    return [cx, cy];
  };
}

/**
 * A route signboard floating over each landmark, its tail pointing down at the building, so you can see what's
 * where. Parked at a stop, its sign turns red and says "Open". These are page elements (drei's <Html>),
 * styled like the rest of the page; they live in the aria-hidden island wrapper and take no focus. The
 * keyboard and screen readers use the stop buttons and the Open button instead.
 * zIndexRange keeps them under the loading screen (z 9) and the on-screen controls (z 10).
 */
export function StopSigns({ nearId, onStop, onOpen }: { nearId: string | null; onStop: (id: string) => void; onOpen: (id: string) => void }) {
  // Give <Html> a fixed parent. By default it follows fiber's event target, which changes once after the first
  // render; <Html> then re-creates its element and the first sign came up empty.
  const parent = useThree((s) => s.gl.domElement.parentElement);
  const portal = useMemo(() => ({ current: parent! }), [parent]);
  const boxes = useMemo(() => stops.map(() => createRef<HTMLDivElement>()), []);
  const placers = useMemo(() => boxes.map(placer), [boxes]);
  return stops.map((s, i) => {
    const near = s.id === nearId;
    return (
      <Html
        key={s.id}
        position={[LANDMARKS[i].x, HEIGHT[s.id], LANDMARKS[i].z]}
        portal={portal}
        calculatePosition={placers[i]}
        zIndexRange={[8, 1]}
        style={{ pointerEvents: "none" }}
      >
        {/* pb-3 leaves room for the tail, so its tip (not the plate) is what sits on the landmark. */}
        <div ref={boxes[i]} data-edge="false" className="group origin-bottom -translate-x-1/2 -translate-y-full pb-3 [scale:var(--s,1)]">
          <div className="motion-safe:animate-bob">
            <div
              data-go
              onClick={() => (near ? onOpen(s.id) : onStop(s.id))}
              className={`${near ? "sign-red" : "sign group-data-[edge=true]:bg-paper"} pointer-events-auto relative min-h-9 px-3 text-sm select-none`}
            >
              {near ? `Open ${s.name}` : s.name}
              {near && <kbd className="ml-1 hidden rounded border-2 border-white/70 px-1 font-display text-xs leading-tight md:inline">E</kbd>}
              {/* The tail: the plate's own fill and rim, pinned to its border, turned square to that edge, its tip
                  leaning to point (skewed round its base, so the base stays on the edge; -2px: positions count from inside the rim). */}
              <span aria-hidden="true" className="absolute top-[calc(var(--py)-2px)] left-[calc(var(--px)-2px)] size-0 [rotate:var(--rot)]">
                <svg
                  viewBox="0 0 18 12"
                  className={`absolute top-0 left-0 w-[18px] origin-top -translate-x-1/2 overflow-visible [transform:skewX(var(--skew,0))] ${near ? "text-red" : "text-yellow group-data-[edge=true]:text-paper"}`}
                >
                  <path d="M0 0L9 11L18 0Z" fill="currentColor" />
                  <path d="M0.5 0.5L9 10.5L17.5 0.5" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </Html>
    );
  });
}
