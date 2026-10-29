import { MeshLambertMaterial } from "three";
import { GROUND_OF } from "./surfaces";
import { weathered } from "./weather";

// For the few meshes that stay separate (wheels, ground). Static parts don't use this: Batched merges
// them into one vertex-coloured mesh.
const cache = new Map<string, MeshLambertMaterial>();

/**
 * The flat-shaded paint every low-poly part uses. Same colour, same material object, so
 * twenty yellow boxes share one material. Passed as a prop, fiber never disposes it,
 * which is what we want for materials that live as long as the page.
 */
export function paint(color: string) {
  let material = cache.get(color);
  if (!material) {
    // Cloud shadows pass over it too; the ground colours also get sand, grass or dirt detail.
    material = weathered(new MeshLambertMaterial({ color, flatShading: true }), { surface: GROUND_OF[color] });
    cache.set(color, material);
  }
  return material;
}
