import { Vector2, type Material } from "three";
import { SURFACE_GLSL } from "./surfaces";

/**
 * The island's weather, added to the ordinary materials in their shaders, so it costs no extra draw call:
 * cloud shadows drifting over everything, and wind swaying whatever Batch marked with `sway`
 * (palms, grass, flags). Both read one clock, WIND, which Landmarks advances (and freezes under reduced motion).
 */
export const WIND = { value: 0 };

/**
 * Where the jeepney is on screen, updated every frame by the Driver: `uFocusPx` in drawing-buffer pixels, `uFocusDepth`
 * its distance in front of the camera, `uFocusRadius` in pixels. Buildings nearer the camera than the jeepney are
 * dithered away inside that circle, so it's never hidden behind them.
 */
export const FOCUS = { uFocusPx: { value: new Vector2(-1e4, -1e4) }, uFocusDepth: { value: 0 }, uFocusRadius: { value: 1 } };

// Inside the circle round the jeepney, a fragment that's above the ground (not the sidewalk under it) and more than
// 3 m nearer the camera than the jeepney is thrown away in a dither pattern, fading in towards the circle's edge.
const FADE_GLSL = /* glsl */ `
  if (vWorldY > 0.2 && vViewPosition.z < uFocusDepth - 3.0) {
    float r = length(gl_FragCoord.xy - uFocusPx) / uFocusRadius;
    float hide = 1.0 - smoothstep(0.65, 1.0, r);
    float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (dither < hide * 0.85) discard;
  }
`;

/** Soft cloud shadows: blobs of value noise blown slowly across the island. Returns how lit a spot is (0.78 to 1). */
export const CLOUDS_GLSL = /* glsl */ `
  float cloudHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float cloudNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(cloudHash(i), cloudHash(i + vec2(1, 0)), f.x), mix(cloudHash(i + vec2(0, 1)), cloudHash(i + vec2(1, 1)), f.x), f.y);
  }
  float clouds(vec2 xz) {
    vec2 p = xz * 0.07 - vec2(uWind * 0.1, uWind * 0.04); // clouds ~15 m across, drifting to +x at ~1.5 m/s, the way the plants lean
    float n = cloudNoise(p) * 0.65 + cloudNoise(p * 2.3 + 7.0) * 0.35;
    return 1.0 - 0.22 * smoothstep(0.5, 0.75, n);
  }
`;

// Each marked vertex moves sideways by its sway weight (bigger further up a palm, or down a flag).
// The phase follows the vertex's position, so neighbouring palms don't move in lockstep, and a slow gust swells it.
const SWAY_GLSL = /* glsl */ `
  float phase = dot(position.xz, vec2(0.21, 0.17));
  float gust = 0.65 + 0.35 * sin(uWind * 0.4 + position.x * 0.04);
  transformed.x += sway * gust * (0.6 + sin(uWind * 1.9 + phase));
  transformed.z += sway * gust * 0.5 * cos(uWind * 1.4 + phase * 1.3);
`;

/**
 * Adds cloud shadows to a built-in three.js material, and optionally the wind (`sway`, for Batched parts) and surface
 * detail (surfaces.ts): `"vertex"` reads each part's own surface and coordinates (Batched), a number is one surface
 * laid out in world x/z (the ground). Returns the same material.
 */
export function weathered<T extends Material>(
  material: T,
  { sway = false, surface, fade = false }: { sway?: boolean; surface?: number | "vertex"; fade?: boolean } = {},
) {
  const perVertex = surface === "vertex";
  // Which surface, and where on it: the part's own coordinates, or the ground's world x/z.
  const shade = surface === undefined ? "" : perVertex ? "surfaceShade(vSurf.z, vSurf.xy)" : `surfaceShade(${surface.toFixed(1)}, vCloudXZ)`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = WIND;
    if (fade) Object.assign(shader.uniforms, FOCUS);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uWind;
        varying vec2 vCloudXZ;
        ${fade ? "varying float vWorldY;" : ""}
        ${sway ? "attribute float sway;" : ""}
        ${perVertex ? "attribute vec3 surface; varying vec3 vSurf;" : ""}`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        ${sway ? SWAY_GLSL : ""}
        ${perVertex ? "vSurf = surface;" : ""}`,
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vCloudXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
        ${fade ? "vWorldY = (modelMatrix * vec4(transformed, 1.0)).y;" : ""}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uWind;
        varying vec2 vCloudXZ;
        ${perVertex ? "varying vec3 vSurf;" : ""}
        ${fade ? "varying float vWorldY; uniform vec2 uFocusPx; uniform float uFocusDepth; uniform float uFocusRadius;" : ""}
        ${CLOUDS_GLSL}
        ${shade ? SURFACE_GLSL : ""}`,
      )
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n${fade ? FADE_GLSL : ""}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${shade ? `diffuseColor.rgb *= ${shade};` : ""}`)
      .replace("#include <dithering_fragment>", "#include <dithering_fragment>\ngl_FragColor.rgb *= clouds(vCloudXZ);");
  };
  material.customProgramCacheKey = () => `weather-${sway}-${surface}-${fade}`;
  return material;
}
