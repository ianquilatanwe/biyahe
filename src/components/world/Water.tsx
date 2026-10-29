"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, ShaderMaterial, UniformsLib, UniformsUtils } from "three";
import { ISLAND_RADIUS } from "@/lib/world";
import { useCalm } from "./useCalm";
import { CLOUDS_GLSL, WIND } from "./weather";

/**
 * The sea as one flat disc with a small shader, so it costs a single draw call:
 * turquoise shallows fading to deeper blue, a slow shimmer, and foam that hugs the
 * wobbly coastline (the same wobble() formula as world.ts) with thin lines rolling in, sun glints twinkling
 * on the ripples, and the same drifting cloud shadows as the land.
 */
const vertexShader = /* glsl */ `
  varying vec2 vXZ;
  #include <fog_pars_vertex>
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vXZ = world.xz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uWind;
  uniform float uShore;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uFoam;
  varying vec2 vXZ;
  #include <fog_pars_fragment>
  ${CLOUDS_GLSL}

  // Keep in step with wobble() in src/lib/world.ts.
  float wobble(float a) { return sin(a * 3.0) * 0.9 + sin(a * 7.0 + 1.3) * 0.5; }

  void main() {
    float a = atan(vXZ.y, vXZ.x);
    float d = length(vXZ) - (uShore + wobble(a)); // metres out from the waterline

    vec3 col = mix(uShallow, uDeep, smoothstep(0.5, 16.0, d));
    // Slow shimmer. Multiplied, not added: adding could push a channel below zero, which the sRGB step turns into NaN blotches.
    col *= 1.0 + 0.1 * sin(vXZ.x * 0.35 + uTime * 0.6) * sin(vXZ.y * 0.3 - uTime * 0.5);

    // Foam: a breathing rim on the sand, plus thin broken lines rolling in towards the beach.
    float rim = 1.0 - smoothstep(0.1, 0.55 + 0.2 * sin(uTime * 0.8 + a * 5.0), d);
    float f = fract(d * 0.4 + uTime * 0.22);
    float line = smoothstep(0.0, 0.05, f) * (1.0 - smoothstep(0.05, 0.16, f));
    line *= (1.0 - smoothstep(0.4, 4.5, d)) * smoothstep(0.35, 0.8, 0.5 + 0.5 * sin(a * 11.0 + d * 0.7));
    col = mix(col, uFoam, clamp(max(rim, line * 0.8), 0.0, 1.0));

    // Sun glints: one in fourteen 60 cm cells holds a small bright dot that flashes now and then, each on its own clock.
    // Kept off the foam and faded out with distance, where they'd shimmer into noise.
    vec2 cell = floor(vXZ * 1.6);
    float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    float flash = smoothstep(0.82, 1.0, sin(uTime * (1.2 + h * 2.0) + h * 40.0));
    float spot = 1.0 - smoothstep(0.04, 0.14, length(fract(vXZ * 1.6) - 0.5));
    float glint = step(0.93, h) * flash * spot * smoothstep(1.5, 5.0, d) * (1.0 - smoothstep(25.0, 55.0, d));
    col = mix(col, vec3(1.0, 0.98, 0.9), glint * 0.85);
    col *= clouds(vXZ);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function Water() {
  const calm = useCalm();
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        fog: true,
        uniforms: UniformsUtils.merge([
          UniformsLib.fog,
          {
            uTime: { value: 0 },
            uShore: { value: ISLAND_RADIUS + 0.9 }, // where the sloping sand meets the water (y = -0.6)
            uShallow: { value: new Color("#5cc9c4") },
            uDeep: { value: new Color("#2a86a3") },
            uFoam: { value: new Color("#f3fbf8") },
          },
        ]),
      }),
    [],
  );
  material.uniforms.uWind = WIND; // after the merge, which copies values: this one is shared, not copied

  useFrame((_, delta) => {
    if (!calm.current) material.uniforms.uTime.value += Math.min(delta, 1 / 20);
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.6} material={material}>
      <circleGeometry args={[180, 48]} />
    </mesh>
  );
}
