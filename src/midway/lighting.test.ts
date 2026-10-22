import { describe, expect, it } from 'vitest';
import {
  allStrings,
  bulbLevel,
  DAWN_END,
  DAWN_START,
  DUSK_END,
  DUSK_START,
  hideBehind,
  layoutLights,
  lightingAt,
  localMinutes,
  NIGHT_SHADE,
  parseMidwayTime,
  shadeAt,
  skyAt,
  TWINKLE,
} from './lighting';
import { palette } from './palette';
import { layoutMidway, toScreen } from './world';

const at = (hours: number, minutes = 0) => hours * 60 + minutes;
const keys = ['daylight', 'warmth', 'lights'] as const;
const cssColour = (hex: string) =>
  `rgb(${[1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)).join(', ')})`;

describe('lightingAt', () => {
  it('is full daylight with the lights off in the daytime', () => {
    for (const time of [at(8), at(12), at(16, 59)]) {
      expect(lightingAt(time)).toEqual({ daylight: 1, warmth: 0, lights: 0 });
    }
  });

  it('is dark with every light on at night, either side of midnight', () => {
    for (const time of [at(20), at(23, 30), at(0), at(3), at(5, 59)]) {
      expect(lightingAt(time)).toEqual({ daylight: 0, warmth: 0, lights: 1 });
    }
  });

  it('dims through a warm dusk as the lights come on', () => {
    const early = lightingAt(at(17, 30));
    const middle = lightingAt(at(18, 30));
    const late = lightingAt(at(19, 30));
    expect(early.daylight).toBeGreaterThan(middle.daylight);
    expect(middle.daylight).toBeGreaterThan(late.daylight);
    expect(early.lights).toBeLessThan(middle.lights);
    expect(middle.lights).toBeLessThan(late.lights);
    expect(middle.warmth).toBeCloseTo(1);
    expect(lightingAt(at(19)).lights).toBe(1);
  });

  it('brightens through dawn as the lights go off', () => {
    const early = lightingAt(at(6, 30));
    const late = lightingAt(at(7, 30));
    expect(early.daylight).toBeLessThan(late.daylight);
    expect(early.lights).toBeGreaterThan(0);
    expect(lightingAt(at(7, 30)).lights).toBe(0);
    expect(lightingAt(at(7)).warmth).toBeGreaterThan(0);
    expect(lightingAt(at(7)).warmth).toBeLessThan(lightingAt(at(18, 30)).warmth);
  });

  it('changes continuously across every boundary and midnight', () => {
    const tiny = 1e-4;
    for (const edge of [DAWN_START, DAWN_END, DUSK_START, DUSK_END, at(24)]) {
      const before = lightingAt(edge - tiny);
      const after = lightingAt(edge + tiny);
      for (const key of keys) expect(Math.abs(before[key] - after[key])).toBeLessThan(0.001);
    }
  });

  it('stays between 0 and 1 all day', () => {
    for (let m = 0; m < at(24); m += 0.5) {
      const lighting = lightingAt(m);
      for (const key of keys) {
        expect(lighting[key]).toBeGreaterThanOrEqual(0);
        expect(lighting[key]).toBeLessThanOrEqual(1);
      }
      expect(shadeAt(lighting).alpha).toBeLessThanOrEqual(NIGHT_SHADE);
    }
  });

  it('reads a Date on the local clock', () => {
    const dusk = new Date(2026, 9, 22, 18, 30);
    expect(localMinutes(dusk)).toBe(at(18, 30));
    expect(lightingAt(dusk)).toEqual(lightingAt(at(18, 30)));
    expect(lightingAt(new Date(2026, 9, 22, 12))).toEqual(lightingAt(at(12)));
  });
});

describe('skyAt and shadeAt', () => {
  it('uses the daytime sky with no shade by day', () => {
    expect(skyAt(lightingAt(at(12)))).toEqual({
      high: cssColour(palette.skyHigh),
      low: cssColour(palette.sky),
    });
    expect(shadeAt(lightingAt(at(12))).alpha).toBe(0);
  });

  it('turns deep blue under the full shade at night', () => {
    expect(skyAt(lightingAt(at(23)))).toEqual({
      high: cssColour(palette.nightHigh),
      low: cssColour(palette.nightLow),
    });
    expect(shadeAt(lightingAt(at(23))).alpha).toBe(NIGHT_SHADE);
  });
});

describe('parseMidwayTime', () => {
  it('reads a preview time from the query string', () => {
    expect(parseMidwayTime('?midwayTime=19:30')).toBe(at(19, 30));
    expect(parseMidwayTime('?midwayTime=7:05')).toBe(at(7, 5));
    expect(parseMidwayTime('?a=1&midwayTime=00:00')).toBe(0);
    expect(parseMidwayTime('?midwayTime=23:59')).toBe(at(23, 59));
  });

  it('ignores a missing or invalid time', () => {
    for (const search of [
      '',
      '?midwayTime=',
      '?midwayTime=24:00',
      '?midwayTime=12:60',
      '?midwayTime=noon',
      '?midwayTime=12',
      '?midwayTime=12:3',
      '?midwayTime=-1:00',
      '?midwayTime=12:30pm',
    ]) {
      expect(parseMidwayTime(search)).toBeUndefined();
    }
  });
});

describe('bulbLevel', () => {
  const bulb = { phase: 1, speed: 2, switchOn: 0.5 };

  it('is off in the daytime and on at night', () => {
    expect(bulbLevel(0, bulb, 3, false)).toBe(0);
    expect(bulbLevel(1, bulb, 3, true)).toBe(1);
  });

  it('comes on bulb by bulb as the lights rise', () => {
    const first = { ...bulb, switchOn: 0 };
    const last = { ...bulb, switchOn: 1 };
    expect(bulbLevel(0.3, first, 0, true)).toBeGreaterThan(0);
    expect(bulbLevel(0.3, last, 0, true)).toBe(0);
  });

  it('holds steady for reduced motion, but twinkles otherwise', () => {
    const steady = new Set<number>();
    const twinkly = new Set<number>();
    for (let t = 0; t < 10; t += 0.1) {
      steady.add(bulbLevel(1, bulb, t, true));
      const level = bulbLevel(1, bulb, t, false);
      twinkly.add(Math.round(level * 1000));
      expect(level).toBeGreaterThanOrEqual(1 - TWINKLE - 1e-9);
      expect(level).toBeLessThanOrEqual(1);
    }
    expect([...steady]).toEqual([1]);
    expect(twinkly.size).toBeGreaterThan(10);
  });

  it('twinkles bulbs out of step with each other', () => {
    const lights = layoutLights(layoutMidway(['water-cannon']));
    const levels = lights.booths[0].front[0].bulbs.map((b) => bulbLevel(1, b, 5, false));
    expect(new Set(levels.map((l) => l.toFixed(3))).size).toBeGreaterThan(3);
  });
});

describe('layoutLights', () => {
  const map = layoutMidway(['water-cannon', 'candy-floss', 'ring-toss']);
  const lights = layoutLights(map);

  it('strings lights round every booth, open or coming soon', () => {
    expect(lights.booths).toHaveLength(map.booths.length);
    expect(map.booths.some((b) => !b.gameId)).toBe(true);
    for (const plot of lights.booths) {
      expect(plot.back.flatMap((s) => s.bulbs).length).toBeGreaterThan(4);
      expect(plot.front.flatMap((s) => s.bulbs).length).toBeGreaterThan(4);
    }
  });

  it('strings lights round every tent plot and the ticket booth', () => {
    const tents = map.props.filter((p) =>
      ['round-tent', 'peaked-tent', 'big-top', 'ticket-booth'].includes(p.kind),
    );
    expect(tents.map((p) => p.kind)).toEqual(
      expect.arrayContaining(['round-tent', 'peaked-tent', 'big-top', 'ticket-booth']),
    );
    expect([...lights.tents.keys()]).toEqual(tents);
  });

  it('keeps each plot’s bulbs on the edge of its plot', () => {
    map.booths.forEach((booth, n) => {
      const plot = lights.booths[n];
      for (const bulb of [...plot.back, ...plot.front].flatMap((s) => s.bulbs)) {
        expect(bulb.x).toBeGreaterThanOrEqual(booth.x);
        expect(bulb.x).toBeLessThanOrEqual(booth.x + booth.w);
        expect(bulb.y).toBeGreaterThanOrEqual(booth.y);
        expect(bulb.y).toBeLessThanOrEqual(booth.y + booth.h);
        const onEdge =
          Math.min(
            Math.abs(bulb.x - booth.x),
            Math.abs(bulb.x - booth.x - booth.w),
            Math.abs(bulb.y - booth.y),
            Math.abs(bulb.y - booth.y - booth.h),
          ) < 0.1;
        expect(onEdge).toBe(true);
        const screen = toScreen(bulb.x, bulb.y);
        expect(bulb.sx).toBe(screen.x);
        expect(bulb.sy).toBe(screen.y - bulb.z);
      }
    });
  });

  it('runs round the whole perimeter, and grows with the map', () => {
    const perimeter = [...lights.perimeterBack, ...lights.perimeterFront].flatMap((s) => s.bulbs);
    const xs = perimeter.map((b) => b.x);
    const ys = perimeter.map((b) => b.y);
    expect(Math.min(...xs)).toBeLessThan(1);
    expect(Math.max(...xs)).toBeGreaterThan(map.width - 1);
    expect(Math.min(...ys)).toBeLessThan(1);
    expect(Math.max(...ys)).toBeGreaterThan(map.height - 1);

    const bigger = layoutMidway(Array.from({ length: 9 }, (_, i) => `game-${i}`));
    const more = layoutLights(bigger);
    const count = (l: typeof lights) =>
      [...l.perimeterBack, ...l.perimeterFront].flatMap((s) => s.bulbs).length;
    expect(more.booths).toHaveLength(bigger.booths.length);
    expect(count(more)).toBeGreaterThan(count(lights));
    expect(
      Math.max(...more.perimeterFront.flatMap((s) => s.bulbs).map((b) => b.y)),
    ).toBeGreaterThan(bigger.height - 1);
  });

  it('leaves the gate open', () => {
    const gate = lights.perimeterFront
      .flatMap((s) => s.bulbs)
      .filter((b) => b.y > map.height - 1 && b.x > map.avenueX && b.x < map.avenueX + 2);
    expect(gate).toEqual([]);
  });

  it('lays out the same lights every time for the same map', () => {
    expect(layoutLights(map)).toEqual(lights);
  });
});

describe('hideBehind', () => {
  it('hides the glow of bulbs behind scenery, not of bulbs in front of it', () => {
    const map = layoutMidway(['water-cannon']);
    const lights = layoutLights(map);
    const strings = allStrings(lights);
    const everywhere = { left: -1e6, right: 1e6, top: -1e6, bottom: 1e6 };
    hideBehind(strings, [{ box: everywhere, depth: 15, lights: lights.booths[0] }]);
    const bulbs = strings.flatMap((s) => s.bulbs);
    expect(bulbs.filter((b) => b.x + b.y < 15).every((b) => b.hidden || isFront(b))).toBe(true);
    expect(bulbs.filter((b) => b.x + b.y >= 15).every((b) => !b.hidden)).toBe(true);
    expect(lights.booths[0].front.flatMap((s) => s.bulbs).every((b) => !b.hidden)).toBe(true);

    function isFront(b: (typeof bulbs)[number]) {
      return lights.booths[0].front.some((s) => s.bulbs.includes(b));
    }
  });
});
