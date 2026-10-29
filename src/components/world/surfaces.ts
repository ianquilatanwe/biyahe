/**
 * Surface detail drawn in the shader, no image files: wood grain, zinc ridges, brushed steel, plaster speckle,
 * rock, leaves, cloth weave, and sand / grass / dirt on the ground. It only varies how bright the paint is
 * (multiplied, ~0.8 to 1.1), so every part keeps its flat palette colour.
 *
 * Batched parts pick a surface from their paint colour (SURFACE_OF), so the models didn't change. Each part also
 * carries its own 2D coordinates in metres (see Batch.add), with u along the part's longest side: grain runs along
 * a plank, ridges run down a roof sheet, whichever way the part is turned. The ground uses world x/z instead.
 */
export const SURFACE = { paint: 0, wood: 1, zinc: 2, steel: 3, plaster: 4, rock: 5, leaf: 6, cloth: 7, sand: 8, grass: 9, dirt: 10, asphalt: 11 } as const;

/** Paint colour (lower-case hex) → surface. Anything not listed is plain paint (a faint grain). */
export const SURFACE_OF: Record<string, number> = {
  // Landmarks.tsx
  "#8a5a3b": SURFACE.wood, // WOOD, also the jeepney's CRATE
  "#5e4331": SURFACE.wood, // WOOD_DARK
  "#9b7653": SURFACE.wood, // TRUNK
  "#d9c27a": SURFACE.wood, // BAMBOO
  "#a9b7bd": SURFACE.zinc, // ZINC roofs
  "#cfd6de": SURFACE.steel, // STEEL
  "#d8cbb0": SURFACE.plaster, // CONCRETE
  "#f4ead5": SURFACE.plaster, // CREAM
  "#f7f4ee": SURFACE.plaster, // WHITE
  "#c8643b": SURFACE.plaster, // TERRACOTTA pots
  "#8d8a83": SURFACE.rock, // ROCK
  "#6f6c66": SURFACE.rock, // ROCK_DARK
  "#4f9a4a": SURFACE.leaf, // LEAF
  "#3d7a3f": SURFACE.leaf, // LEAF_DARK
  "#73b357": SURFACE.leaf, // GRASS_TUFT
  "#2f6b3a": SURFACE.cloth, // SHADE net
  // Town.tsx
  "#8cc56b": SURFACE.grass, // the plaza lawn
  "#b9b2a4": SURFACE.plaster, // kerbs
  "#a39d90": SURFACE.plaster, // seawall, fountain
  "#b8b4ab": SURFACE.plaster, // electric poles
  // shophouse.ts: walls (cream and white are above), roofs, shutters
  "#f2c4a8": SURFACE.plaster,
  "#bfe0d0": SURFACE.plaster,
  "#a9cfe0": SURFACE.plaster,
  "#f6dc8c": SURFACE.plaster,
  "#e9b7c2": SURFACE.plaster,
  "#d9d2c3": SURFACE.plaster,
  "#b0623f": SURFACE.zinc, // rusted
  "#c4473a": SURFACE.zinc, // painted red
  "#4f8a6e": SURFACE.zinc, // painted green
  "#98a2a8": SURFACE.steel, // roll-up shutters
  // Jeepney.tsx
  "#c3cbd3": SURFACE.steel, // stainless body
  "#9da7b1": SURFACE.steel, // STEEL_DARK
  "#f2f5f8": SURFACE.steel, // CHROME
  "#7a1b26": SURFACE.cloth, // SEAT
  "#d9c79e": SURFACE.cloth, // SACK on the roof rack
};

/** The ground meshes (Town.tsx), by colour: detail laid out in world x/z. */
export const GROUND_OF: Record<string, number> = {
  "#f1d9a7": SURFACE.sand,
  "#8cc56b": SURFACE.grass,
  "#5d626d": SURFACE.asphalt,
};

export const SURFACE_GLSL = /* glsl */ `
  float surfHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float surfNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(surfHash(i), surfHash(i + vec2(1, 0)), f.x), mix(surfHash(i + vec2(0, 1)), surfHash(i + vec2(1, 1)), f.x), f.y);
  }
  // 1 where a pattern of this many cycles per metre is several pixels wide, fading to 0 as it nears pixel size:
  // fine detail melts into the flat colour in the distance instead of shimmering.
  float surfFine(vec2 uv, float perMetre) {
    vec2 w = fwidth(uv) * perMetre;
    return 1.0 - smoothstep(0.25, 0.7, max(w.x, w.y));
  }

  // The camera sees roughly 50 pixels per metre, so anything finer than ~12 cycles per metre would vanish.
  // Round specks: one in (1 - share) cells of this many per metre holds a soft dot.
  float surfSpeck(vec2 uv, float perMetre, float share) {
    vec2 p = uv * perMetre;
    return step(share, surfHash(floor(p))) * (1.0 - smoothstep(0.18, 0.32, length(fract(p) - 0.5)));
  }

  float surfaceShade(float kind, vec2 uv) {
    float f = 0.94 + 0.1 * surfNoise(uv * 1.3); // broad mottling: nothing reads as a flat plastic fill
    if (kind < 0.5) { // paint: a faint grain
      f *= 1.0 + 0.08 * (surfNoise(uv * 10.0) - 0.5) * surfFine(uv, 10.0);
    } else if (kind < 1.5) { // wood: streaks along the length, a few darker bands
      float grain = surfNoise(vec2(uv.x * 1.2, uv.y * 9.0));
      float band = surfNoise(vec2(uv.x * 0.5, uv.y * 3.0));
      f *= 1.0 - 0.18 * band + 0.3 * (grain - 0.5) * surfFine(uv, 9.0);
    } else if (kind < 2.5) { // zinc: corrugated ridges across the sheet's length, light rust blotches
      float ridge = 0.5 + 0.5 * sin(uv.x * 30.0);
      f *= mix(1.0, 0.86 + 0.2 * ridge, surfFine(uv, 5.0)) * (1.0 - 0.1 * smoothstep(0.6, 0.85, surfNoise(uv * 2.0)));
    } else if (kind < 3.5) { // brushed steel: fine streaks along the part
      f *= 1.0 + 0.14 * (surfNoise(vec2(uv.x * 1.5, uv.y * 12.0)) - 0.5) * surfFine(uv, 12.0);
    } else if (kind < 4.5) { // plaster and concrete: soft blotches and dark specks
      float speck = surfSpeck(uv, 12.0, 0.88);
      f *= (0.92 + 0.12 * surfNoise(uv * 3.0)) * (1.0 - 0.12 * speck * surfFine(uv, 12.0));
    } else if (kind < 5.5) { // rock: rough two-scale noise
      f *= 0.78 + 0.3 * surfNoise(uv * 2.5) + 0.16 * (surfNoise(uv * 8.0) - 0.5) * surfFine(uv, 8.0);
    } else if (kind < 6.5) { // leaves: streaky light and dark, like veins
      f *= 0.84 + 0.28 * surfNoise(vec2(uv.x * 2.0, uv.y * 8.0));
    } else if (kind < 7.5) { // cloth: a woven criss-cross
      float weave = sin(uv.x * 60.0) * sin(uv.y * 60.0);
      f *= 1.0 - 0.1 * (0.5 + 0.5 * weave) * surfFine(uv, 10.0);
    } else if (kind < 8.5) { // sand: grain, and wind ripples bending along the beach
      float ripple = 0.5 + 0.5 * sin(uv.x * 2.4 + uv.y * 0.8 + surfNoise(uv * 0.4) * 5.0);
      f *= (0.93 + 0.12 * surfNoise(uv * 6.0)) * (1.0 - 0.08 * ripple * surfFine(uv, 0.4));
    } else if (kind < 9.5) { // grass: lighter and darker patches, and a fine blade texture
      f *= 0.86 + 0.2 * surfNoise(uv * 0.5) + 0.14 * (surfNoise(vec2(uv.x * 12.0, uv.y * 3.0)) - 0.5) * surfFine(uv, 12.0);
    } else if (kind < 10.5) { // dirt: worn patches and pebbles
      float pebble = surfSpeck(uv, 8.0, 0.82);
      f *= (0.86 + 0.2 * surfNoise(uv * 1.5)) * (1.0 - 0.14 * pebble * surfFine(uv, 8.0));
    } else { // asphalt: fine grit, and square patches where it was dug up and resurfaced
      float grit = surfNoise(uv * 10.0) - 0.5;
      float redone = step(0.8, surfHash(floor(uv * 0.3) + 0.5));
      f *= (0.92 + 0.1 * surfNoise(uv * 0.6)) * (1.0 - 0.09 * redone) * (1.0 + 0.16 * grit * surfFine(uv, 10.0));
    }
    return f;
  }
`;
