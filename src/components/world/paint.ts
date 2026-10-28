import { MeshLambertMaterial } from "three";

// ponytail: one shared material per colour cuts GPU state changes, not draw calls; merge
// static geometry (BufferGeometryUtils.mergeGeometries) if renderer.info shows calls climbing.
const cache = new Map<string, MeshLambertMaterial>();

/**
 * The flat-shaded paint every low-poly part uses. Same colour, same material object, so
 * twenty yellow boxes share one material. Passed as a prop, fiber never disposes it,
 * which is what we want for materials that live as long as the page.
 */
export function paint(color: string) {
  let material = cache.get(color);
  if (!material) {
    material = new MeshLambertMaterial({ color, flatShading: true });
    cache.set(color, material);
  }
  return material;
}
