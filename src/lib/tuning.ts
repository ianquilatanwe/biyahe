/**
 * Every number that shapes how driving and the camera feel, in one object.
 * In development the Leva panel (TuningPanel.tsx) edits it live while you drive;
 * the live site just uses these values. When a value feels right, copy it back here.
 */
export const tuning = {
  // driving
  accel: 14, // units/s² when speeding up
  brake: 24, // units/s² when pressing against the current direction
  maxForward: 15,
  maxReverse: 5,
  drag: 2.2, // how fast it coasts to a stop with no throttle
  turn: 2.3, // radians/s at full lock and speed
  // body
  lean: 0.005, // how far the body leans out of turns
  bounce: 0.03, // suspension jiggle at speed
  // camera
  cameraHeight: 22, // steeper than the island (12 / 20): the town has rooftops to see over
  cameraDistance: 25, // was 16 / 18: pulled back ~1.4x to show more of the bigger town
  fadeRadius: 4, // metres round the jeepney where buildings in front of it dither away
  lookAhead: 0.3, // seconds of travel the camera looks ahead
  cameraFollow: 4, // higher = the camera catches up faster
};

export type Tuning = typeof tuning;
