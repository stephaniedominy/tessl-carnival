/**
 * The midway's sky and lights, by the visitor's local wall clock. Plain
 * functions with no canvas or DOM, so Vitest can run them.
 *
 * Times are minutes after local midnight. The schedule is fixed clock times,
 * not astronomical sunrise and sunset: dawn 06:00 to 08:00, day 08:00 to 17:00,
 * dusk 17:00 to 20:00 and night 20:00 to 06:00.
 */

import { palette } from './palette';
import { seededRandom, toScreen, type MidwayMap, type Point, type Prop, type Rect } from './world';

export const DAWN_START = 6 * 60;
export const DAWN_END = 8 * 60;
export const DUSK_START = 17 * 60;
export const DUSK_END = 20 * 60;
const DAY = 24 * 60;
/** Minutes after dusk starts that every light is on. */
const LIGHTS_ON = 120;
/** Minutes after dawn starts that every light is off. */
const LIGHTS_OFF = 90;
/** How warm the dawn sky gets, next to dusk's 1. */
const DAWN_WARMTH = 0.6;
/** How dark the scene gets at night, as the alpha of the shade laid over it. */
export const NIGHT_SHADE = 0.5;
/** How much of the dusk ramp the bulbs' switch-on times spread over. */
const SWITCH_SPREAD = 0.6;
/** How far a twinkling bulb dims at its faintest. */
export const TWINKLE = 0.35;

export interface Lighting {
  /** 1 in full daylight, 0 at night. */
  daylight: number;
  /** How far the sky leans to sunset colours, 0 to 1. */
  warmth: number;
  /** How far the carnival lights are switched on, 0 to 1. */
  lights: number;
}

const clamp01 = (s: number) => Math.max(0, Math.min(1, s));
const smooth = (s: number) => {
  const c = clamp01(s);
  return c * c * (3 - 2 * c);
};

/** Minutes after local midnight, with seconds, on the device's clock. */
export function localMinutes(date: Date): number {
  return (
    date.getHours() * 60 +
    date.getMinutes() +
    date.getSeconds() / 60 +
    date.getMilliseconds() / 60_000
  );
}

/** The sky and lights for a local time, as a Date or minutes after midnight. */
export function lightingAt(time: Date | number): Lighting {
  const raw = typeof time === 'number' ? time : localMinutes(time);
  const m = ((raw % DAY) + DAY) % DAY;
  if (m < DAWN_START || m >= DUSK_END) return { daylight: 0, warmth: 0, lights: 1 };
  if (m < DAWN_END) {
    const p = (m - DAWN_START) / (DAWN_END - DAWN_START);
    return {
      daylight: smooth(p),
      warmth: Math.sin(Math.PI * p) * DAWN_WARMTH,
      lights: 1 - smooth((m - DAWN_START) / LIGHTS_OFF),
    };
  }
  if (m < DUSK_START) return { daylight: 1, warmth: 0, lights: 0 };
  const p = (m - DUSK_START) / (DUSK_END - DUSK_START);
  return {
    daylight: 1 - smooth(p),
    warmth: Math.sin(Math.PI * p),
    lights: smooth((m - DUSK_START) / LIGHTS_ON),
  };
}

/**
 * The preview time in a page's query string, e.g. `?midwayTime=19:30`, in
 * minutes after midnight. Undefined when it's missing or isn't a real time.
 */
export function parseMidwayTime(search: string): number | undefined {
  const match = new URLSearchParams(search).get('midwayTime')?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : undefined;
}

type Rgb = [number, number, number];

const rgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: Rgb, b: Rgb, s: number): Rgb => [
  a[0] + (b[0] - a[0]) * s,
  a[1] + (b[1] - a[1]) * s,
  a[2] + (b[2] - a[2]) * s,
];
const css = (c: Rgb) => `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;

/** Night blended to day by daylight, then towards sunset by warmth. */
function tone(lighting: Lighting, day: string, dusk: string, night: string): string {
  return css(mix(mix(rgb(night), rgb(day), lighting.daylight), rgb(dusk), lighting.warmth));
}

/** The sky's colours, high overhead and down at the horizon. */
export function skyAt(lighting: Lighting): { high: string; low: string } {
  return {
    high: tone(lighting, palette.skyHigh, palette.duskHigh, palette.nightHigh),
    low: tone(lighting, palette.sky, palette.duskLow, palette.nightLow),
  };
}

/** The shade laid over the whole scene, darkening everything together. */
export function shadeAt(lighting: Lighting): { color: string; alpha: number } {
  return {
    color: css(mix(rgb(palette.nightShade), rgb(palette.duskShade), lighting.warmth)),
    alpha: (1 - lighting.daylight) * NIGHT_SHADE,
  };
}

// ── Strings of bulbs ──────────────────────────────────────────────────────

export interface Bulb {
  /** Tile position, and height above the ground in pixels. */
  x: number;
  y: number;
  z: number;
  /** World-pixel screen position, lifted by z. */
  sx: number;
  sy: number;
  color: string;
  /** Where in the twinkle this bulb starts, and how fast it twinkles. */
  phase: number;
  speed: number;
  /** 0 to 1: how late in the dusk ramp this bulb comes on. */
  switchOn: number;
  /** True when scenery in front covers it, so its glow stays off. */
  hidden: boolean;
}

/** A pole holding up a string, from the ground at (sx, sy) up `height` pixels. */
export interface Post {
  sx: number;
  sy: number;
  height: number;
}

/** One sagging span of wire between two posts, with its bulbs. */
export interface LightString {
  wire: { sx: number; sy: number }[];
  bulbs: Bulb[];
  posts: Post[];
  /** Where it sorts among the scenery: the midpoint of its span, in x + y. */
  depth: number;
  /** The world-pixel box it's drawn in, for culling. */
  box: { left: number; right: number; top: number; bottom: number };
}

/** The lights round one plot: the far sides go behind it, the near sides in front. */
export interface PlotLights {
  back: LightString[];
  front: LightString[];
}

export interface MidwayLights {
  /** Along the hedge's far sides, behind everything on the midway. */
  perimeterBack: LightString[];
  /** Along the hedge's near sides, in front of everything. */
  perimeterFront: LightString[];
  /** One per booth, in the same order as map.booths. */
  booths: PlotLights[];
  /** One per tent: round and peaked tents, the big top and the ticket booth. */
  tents: Map<Prop, PlotLights>;
}

const TENT_KINDS: ReadonlySet<Prop['kind']> = new Set([
  'round-tent',
  'peaked-tent',
  'big-top',
  'ticket-booth',
]);
const PLOT_INSET = 0.08;
const PLOT_HEIGHT = 12;
const PLOT_SAG = 3;
const PLOT_SPACING = 0.32;
const PERIMETER_INSET = 0.5;
const PERIMETER_HEIGHT = 17;
const PERIMETER_SAG = 4;
const PERIMETER_SPACING = 0.5;
const PERIMETER_SPAN = 2;

interface StrandOptions {
  height: number;
  sag: number;
  spacing: number;
  colors: readonly string[];
  random: () => number;
  /** Leave out the bulbs and posts at both ends, when another strand has them. */
  skipEnds?: boolean;
}

/** Strings of bulbs hung between posts at each of `points`, one string per span. */
function strand(points: readonly Point[], options: StrandOptions): LightString[] {
  const { height, sag, spacing, colors, random, skipEnds = false } = options;
  const strings: LightString[] = [];
  let n = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const count = Math.max(2, Math.round(length / spacing));
    const last = i === points.length - 2;
    const wire: { sx: number; sy: number }[] = [];
    const bulbs: Bulb[] = [];
    for (let k = 0; k <= count; k++) {
      const s = k / count;
      const x = a.x + (b.x - a.x) * s;
      const y = a.y + (b.y - a.y) * s;
      const z = height - sag * 4 * s * (1 - s);
      const p = toScreen(x, y);
      wire.push({ sx: p.x, sy: p.y - z });
      const end = (i === 0 && k === 0) || (last && k === count);
      if ((k === count && !last) || (skipEnds && end)) continue;
      bulbs.push({
        x,
        y,
        z,
        sx: p.x,
        sy: p.y - z,
        color: colors[n++ % colors.length],
        phase: random() * Math.PI * 2,
        speed: 1.2 + random() * 1.6,
        switchOn: random(),
        hidden: false,
      });
    }
    const posts: Post[] = [];
    for (const [k, point] of [a, b].entries()) {
      const end = (i === 0 && k === 0) || (last && k === 1);
      // Each span shares its far post with the next one, so only the last span draws it.
      if ((k === 1 && !last) || (skipEnds && end)) continue;
      const p = toScreen(point.x, point.y);
      posts.push({ sx: p.x, sy: p.y, height });
    }
    const xs = wire.map((w) => w.sx);
    const ys = [...wire.map((w) => w.sy), ...posts.map((p) => p.sy)];
    strings.push({
      wire,
      bulbs,
      posts,
      depth: (a.x + a.y + b.x + b.y) / 2,
      box: {
        left: Math.min(...xs) - 6,
        right: Math.max(...xs) + 6,
        top: Math.min(...ys) - 6,
        bottom: Math.max(...ys) + 6,
      },
    });
  }
  return strings;
}

/** Points from a to b, at most `step` tiles apart. */
function along(a: Point, b: Point, step: number): Point[] {
  const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
  return Array.from({ length: count + 1 }, (_, k) => ({
    x: a.x + ((b.x - a.x) * k) / count,
    y: a.y + ((b.y - a.y) * k) / count,
  }));
}

/** Joins several runs of points that meet end to start into one. */
function chain(...runs: Point[][]): Point[] {
  return runs.flatMap((run, i) => (i === 0 ? run : run.slice(1)));
}

/** Bulbs round the edge of a plot, on short posts at its corners. */
export function plotLights(plot: Rect, seed: number, colors: readonly string[]): PlotLights {
  const x0 = plot.x + PLOT_INSET;
  const y0 = plot.y + PLOT_INSET;
  const x1 = plot.x + plot.w - PLOT_INSET;
  const y1 = plot.y + plot.h - PLOT_INSET;
  // Corners by where they sit on screen: west (left), north (top), east, south.
  const west = { x: x0, y: y1 };
  const north = { x: x0, y: y0 };
  const east = { x: x1, y: y0 };
  const south = { x: x1, y: y1 };
  const random = seededRandom(seed);
  const options = { height: PLOT_HEIGHT, sag: PLOT_SAG, spacing: PLOT_SPACING, colors, random };
  return {
    back: strand([west, north, east], options),
    front: strand([west, south, east], { ...options, skipEnds: true }),
  };
}

/**
 * Where every light on the midway hangs. Scenery never moves, so this runs
 * once per map; strings follow the hedge and each plot, so they grow with
 * the map.
 */
export function layoutLights(map: MidwayMap): MidwayLights {
  const i = PERIMETER_INSET;
  const w = map.width - i;
  const h = map.height - i;
  const random = seededRandom(map.width * 1000 + map.height);
  const options = {
    height: PERIMETER_HEIGHT,
    sag: PERIMETER_SAG,
    spacing: PERIMETER_SPACING,
    colors: palette.perimeterBulbs,
    random,
  };
  const corner = (x: number, y: number) => ({ x, y });
  const run = (a: Point, b: Point) => along(a, b, PERIMETER_SPAN);
  // The gate leaves a gap in the hedge, so the near side stops either side of it.
  const gateLeft = map.avenueX - 0.15;
  const gateRight = map.avenueX + 2.15;

  const tents = new Map<Prop, PlotLights>();
  map.props.forEach((prop, n) => {
    if (TENT_KINDS.has(prop.kind)) tents.set(prop, plotLights(prop, 7919 * (n + 1), palette.bulbs));
  });

  return {
    perimeterBack: strand(
      chain(run(corner(i, h), corner(i, i)), run(corner(i, i), corner(w, i))),
      options,
    ),
    perimeterFront: [
      ...strand(chain(run(corner(w, i), corner(w, h)), run(corner(w, h), corner(gateRight, h))), {
        ...options,
        skipEnds: true,
      }),
      ...strand(run(corner(gateLeft, h), corner(i, h)), { ...options, skipEnds: true }),
    ],
    booths: map.booths.map((booth) => plotLights(booth, 104729 * (booth.index + 1), palette.bulbs)),
    tents,
  };
}

/** Every string of lights on the midway. */
export function allStrings(lights: MidwayLights): LightString[] {
  const plots = [...lights.booths, ...lights.tents.values()];
  return [
    ...lights.perimeterBack,
    ...lights.perimeterFront,
    ...plots.flatMap((plot) => [...plot.back, ...plot.front]),
  ];
}

export interface Occluder {
  box: { left: number; right: number; top: number; bottom: number };
  /** Its x + y depth; anything with a smaller depth is behind it. */
  depth: number;
  /** Its own lights, whose near side hangs in front of it whatever the depth. */
  lights?: PlotLights;
}

/** How much of each side of a plot's box its far corner bulbs show past. */
const OWN_INSET = 0.2;

/** Marks the bulbs that sit behind scenery, so their glow doesn't shine through it. */
export function hideBehind(strings: readonly LightString[], occluders: readonly Occluder[]) {
  for (const string of strings) {
    for (const bulb of string.bulbs) {
      bulb.hidden = occluders.some(({ box, depth, lights }) => {
        if (lights?.front.includes(string)) return false;
        // A plot's far corners peek out either side of its own structure.
        const inset = lights?.back.includes(string) ? (box.right - box.left) * OWN_INSET : 0;
        return (
          bulb.x + bulb.y < depth &&
          bulb.sx > box.left + inset &&
          bulb.sx < box.right - inset &&
          bulb.sy > box.top &&
          bulb.sy < box.bottom
        );
      });
    }
  }
}

/**
 * How bright a bulb is, 0 to 1. Bulbs come on one by one as the lights
 * level rises, then twinkle gently out of step, or hold steady when the
 * visitor prefers reduced motion.
 */
export function bulbLevel(
  lights: number,
  bulb: Pick<Bulb, 'phase' | 'speed' | 'switchOn'>,
  t: number,
  calm: boolean,
): number {
  const on = clamp01((lights - bulb.switchOn * SWITCH_SPREAD) / (1 - SWITCH_SPREAD));
  if (calm || on === 0) return on;
  return on * (1 - TWINKLE * (0.5 - 0.5 * Math.cos(t * bulb.speed + bulb.phase)));
}
