// The town's sound, made in code with the Web Audio API: no audio files to download or license.
// A diesel engine that pulls through three gears, the sea that swells as you near the bay, and the horn: "beep-beep"
// on arriving at a stop, H to honk. Under it the town: a far rumble of traffic, the odd distant horn, chatter that
// rises near the plaza, and a toot from any tricycle or jeepney you hold up.
// Nothing is made until the visitor clicks, taps or presses a key (browsers only allow audio after that).
// Nothing here touches the page or the 3D scene: callers pass numbers in, so it stays easy to test by ear.

// Speeds (units/s) where each gear starts and tops out. Top speed is tuning.maxForward (15).
const GEAR_BOTTOM = [0, 4.5, 9.5];
const GEAR_TOP = [5.5, 10.5, 15];

function createSound() {
  let ctx: AudioContext | null = null;
  let enabled = false, audible = true;
  let master: GainNode, engine: GainNode, engineTone: BiquadFilterNode, firing: OscillatorNode, knock: OscillatorNode;
  let sub: OscillatorNode, subGain: GainNode, exhaust: GainNode, road: GainNode;
  let sea: GainNode, seaPan: StereoPannerNode;
  let chatter: GainNode;
  let nextFarHorn = 0;
  let gear = 0;
  // Updates go out about 20 times a second, not every frame: 60 changes a second per parameter
  // only piles up automation events you can't hear.
  let lastUpdate = 0;

  const running = () => !!ctx && enabled && audible;
  const ease = (param: AudioParam, value: number) => param.setTargetAtTime(value, ctx!.currentTime, 0.08);

  function start() {
    const c = (ctx = new AudioContext());
    master = new GainNode(c, { gain: 0.8 });
    master.connect(new DynamicsCompressorNode(c, { threshold: -12, ratio: 6 })).connect(c.destination);

    // Brown noise (a random walk): the rumble under the engine and the body of the sea.
    const brown = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
    const d = brown.getChannelData(0);
    for (let i = 0, last = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const noise = () => {
      const src = new AudioBufferSourceNode(c, { buffer: brown, loop: true });
      src.start(0, Math.random() * brown.duration);
      return src;
    };

    // Engine: a diesel's beat is one knock per firing, so a sawtooth at the firing rate, darkened by a lowpass,
    // plus noise chopped by a square wave at the same rate (the rattle). Speed raises the rate and opens the tone.
    engine = new GainNode(c, { gain: 0 });
    engine.connect(master);
    engineTone = new BiquadFilterNode(c, { type: "lowpass", frequency: 300, Q: 2 });
    engineTone.connect(engine);
    firing = new OscillatorNode(c, { type: "sawtooth", frequency: 28 });
    firing.connect(engineTone);
    const rattle = new GainNode(c, { gain: 0.5 }); // 0.5 ± 0.5 from the square wave below: on, off, on, off
    noise().connect(new GainNode(c, { gain: 2.5 })).connect(new BiquadFilterNode(c, { type: "bandpass", frequency: 500, Q: 1.2 })).connect(rattle).connect(engineTone);
    knock = new OscillatorNode(c, { type: "square", frequency: 28 });
    const chop = new GainNode(c, { gain: 0.5 });
    knock.connect(chop).connect(rattle.gain);

    // Only once the jeepney moves (silent at idle, so idling sounds exactly as above):
    // a deep chug an octave under the firing rate, the body of a big diesel pulling;
    // (A triangle, not a sawtooth: a sawtooth's sudden drop each cycle ticks audibly at this low pitch.)
    sub = new OscillatorNode(c, { type: "triangle", frequency: 14 });
    subGain = new GainNode(c, { gain: 0 });
    sub.connect(new BiquadFilterNode(c, { type: "lowpass", frequency: 140 })).connect(subGain).connect(engine);
    // the exhaust: low noise chopped by the same knock, a "putt-putt" that thickens when you press on;
    const puff = new GainNode(c, { gain: 0.5 });
    chop.connect(puff.gain);
    exhaust = new GainNode(c, { gain: 0 });
    // Chopped first, smoothed after: the square wave's on/off edges are clicks, and the lowpass rounds them off.
    noise().connect(new GainNode(c, { gain: 3 })).connect(puff).connect(new BiquadFilterNode(c, { type: "lowpass", frequency: 190 })).connect(exhaust).connect(master);
    // and the tyres on the dirt road, rising with speed.
    road = new GainNode(c, { gain: 0 });
    noise().connect(new BiquadFilterNode(c, { type: "bandpass", frequency: 320, Q: 0.6 })).connect(road).connect(master);
    for (const o of [firing, knock, sub]) o.start();

    // Sea: brown noise, lowpassed, swelling slowly like waves rolling in (a 9 s sine on its level).
    sea = new GainNode(c, { gain: 0 });
    seaPan = new StereoPannerNode(c);
    const swell = new GainNode(c, { gain: 0.7 });
    noise().connect(new BiquadFilterNode(c, { type: "lowpass", frequency: 650 })).connect(swell).connect(sea).connect(seaPan).connect(master);
    const wave = new OscillatorNode(c, { frequency: 0.11 });
    wave.connect(new GainNode(c, { gain: 0.3 })).connect(swell.gain);
    wave.start();

    // The town, far off: brown noise kept very low (traffic a few streets away), breathing slowly as it comes and goes.
    const rumble = new GainNode(c, { gain: 0.05 });
    noise().connect(new BiquadFilterNode(c, { type: "lowpass", frequency: 170 })).connect(rumble).connect(master);
    const busier = new OscillatorNode(c, { frequency: 0.045 });
    busier.connect(new GainNode(c, { gain: 0.018 })).connect(rumble.gain);
    busier.start();

    // Plaza chatter: a few "voices", each a band of white noise at a voice's pitch, its loudness rising and falling
    // at a syllable's pace (sine waves only, so nothing clicks) inside slower phrases. No words: just a crowd's murmur.
    const white = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
    const w = white.getChannelData(0);
    for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;
    chatter = new GainNode(c, { gain: 0 });
    chatter.connect(new BiquadFilterNode(c, { type: "lowpass", frequency: 1800 })).connect(master);
    for (const [pitch, syllables, phrases] of [[420, 4.3, 0.23], [610, 5.1, 0.31], [520, 3.7, 0.17], [780, 5.6, 0.41]]) {
      const src = new AudioBufferSourceNode(c, { buffer: white, loop: true });
      src.start(0, Math.random() * white.duration);
      const voice = new GainNode(c, { gain: 0.5 }); // 0.5 ± up to 0.5: quiet between syllables, loud on them
      src.connect(new BiquadFilterNode(c, { type: "bandpass", frequency: pitch, Q: 3 })).connect(voice).connect(chatter);
      const depth = new GainNode(c, { gain: 0.25 }); // the phrase swings the syllables' depth between 0 and 0.5
      const syllable = new OscillatorNode(c, { frequency: syllables });
      const phrase = new OscillatorNode(c, { frequency: phrases });
      syllable.connect(depth).connect(voice.gain);
      phrase.connect(new GainNode(c, { gain: 0.25 })).connect(depth.gain);
      syllable.start();
      phrase.start();
    }
    nextFarHorn = c.currentTime + 6;
  }

  /**
   * A short horn: `tones` played together through a bandpass at `colour` Hz, `times` beeps of `length` seconds, at
   * `level`. A lowpass at `far` Hz dulls it, as if it came from a few streets away.
   */
  function beep(tones: number[], colour: number, level: number, times: number, length: number, far?: number) {
    const c = ctx!;
    const env = new GainNode(c, { gain: 0 });
    const tone = env.connect(new BiquadFilterNode(c, { type: "bandpass", frequency: colour, Q: 0.8 }));
    (far ? tone.connect(new BiquadFilterNode(c, { type: "lowpass", frequency: far })) : tone).connect(master);
    const oscs = tones.map((frequency) => new OscillatorNode(c, { type: "square", frequency }));
    let t = c.currentTime + 0.02;
    for (let i = 0; i < times; i++, t += length + 0.07) {
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(level, t + 0.015);
      env.gain.setValueAtTime(level, t + length - 0.03);
      env.gain.linearRampToValueAtTime(0, t + length);
    }
    for (const o of oscs) {
      o.connect(env);
      o.start();
      o.stop(t);
    }
  }

  function sync() {
    if (!ctx) return;
    if (running()) ctx.resume();
    else ctx.suspend();
  }

  return {
    setEnabled(on: boolean) {
      enabled = on;
      if (on && !ctx) start();
      sync();
    },
    /** False while the island is scrolled away or the tab is hidden: everything pauses. */
    setAudible(on: boolean) {
      audible = on;
      sync();
    },

    /**
     * Every frame. speed in units/s (signed), throttle 0..1 (pressing on), shore 0..1 (1 at the water's edge),
     * pan -1..1: which side the nearest water is on, plaza 0..1 (1 beside the plaza).
     */
    update(speed: number, throttle: number, shore: number, pan: number, plaza = 0) {
      if (!running()) return;
      const now = ctx!.currentTime;
      if (now - lastUpdate < 0.05) return;
      lastUpdate = now;
      // Three gears: the revs climb within a gear and drop back at each change (the bands overlap, so
      // speeding up and slowing down change gear at different speeds and it never hunts between two).
      const v = Math.abs(speed);
      if (gear < 2 && v > GEAR_TOP[gear]) gear++;
      else if (gear > 0 && v < GEAR_BOTTOM[gear]) gear--;
      const revs = Math.min(Math.max((v - GEAR_BOTTOM[gear]) / (GEAR_TOP[gear] - GEAR_BOTTOM[gear]), 0), 1);
      const moving = Math.min(v / 1.5, 1); // 0 parked: everything below falls back to the idle values
      const rate = 26 + (14 + 4 * gear) * revs + 3 * throttle; // knocks per second: 26 idling, ~48 at the top of third
      ease(firing.frequency, rate);
      ease(knock.frequency, rate);
      ease(sub.frequency, rate / 2);
      // Kept dark: a diesel under load gets louder and rougher, not brighter. Opening the filter high is what made it buzz.
      ease(engineTone.frequency, 220 + 160 * revs + 240 * throttle);
      ease(engineTone.Q, 2 - 1.1 * moving);
      ease(engine.gain, 0.12 + 0.03 * revs + 0.05 * throttle);
      ease(subGain.gain, 0.3 * moving * (0.5 + 0.5 * throttle));
      ease(exhaust.gain, moving * (0.05 + 0.16 * throttle));
      ease(road.gain, 0.09 * Math.min(v / 15, 1));
      ease(sea.gain, 0.05 + 0.3 * shore * shore);
      ease(seaPan.pan, Math.max(-1, Math.min(1, pan)) * 0.8);
      ease(chatter.gain, 0.015 + 0.11 * plaza);
      // Now and then, somebody honks a few streets away.
      if (now > nextFarHorn) {
        nextFarHorn = now + 7 + Math.random() * 13;
        const tricycle = Math.random() < 0.5;
        beep(tricycle ? [740, 932] : [370, 466], tricycle ? 1500 : 900, 0.035 + Math.random() * 0.03, 1 + Math.floor(Math.random() * 2), tricycle ? 0.11 : 0.16, 1100);
      }
    },

    /** The jeepney's dual-tone horn, `times` short beeps. */
    horn(times = 1) {
      if (running()) beep([415, 523], 1000, 0.22, times, 0.17);
    },

    /** A tricycle's thin "meep" or another jeepney's horn, close by: one held up behind (or facing) yours. */
    toot(kind: "jeepney" | "tricycle") {
      if (!running()) return;
      if (kind === "tricycle") beep([740, 932], 1500, 0.1, 2, 0.1);
      else beep([370, 466], 900, 0.14, 1, 0.3);
    },
  };
}

/** One sound for the page: the header's toggle switches it, the island's frame loop feeds it. */
export const sound = createSound();
