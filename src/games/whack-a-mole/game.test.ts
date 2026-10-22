import { describe, expect, it } from 'vitest';
import {
  begin,
  claimFinalScore,
  createState,
  difficulty,
  holeAt,
  HOLES,
  ROUND_SECONDS,
  step,
  whack,
} from './game';

function playing() {
  const state = createState();
  begin(state);
  return state;
}
function target(
  state: ReturnType<typeof createState>,
  hole = 0,
  kind: 'mole' | 'inspector' = 'mole',
) {
  state.holes[hole] = { kind, born: state.time, until: state.time + 1 };
}
function seeded() {
  let seed = 42;
  return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

describe('Whack-a-mole', () => {
  it('waits on instructions with nine empty holes until started', () => {
    const s = createState();
    step(s, 10);
    expect(s.phase).toBe('intro');
    expect(s.time).toBe(0);
    expect(s.holes).toEqual(Array(9).fill(null));
    expect(whack(s, 0)).toBe(false);
    begin(s);
    expect(s.phase).toBe('playing');
    expect(s.score).toBe(0);
  });
  it('awards quick hits and increasing streak bonuses once per target', () => {
    const s = playing();
    target(s);
    whack(s, 0);
    expect(s.score).toBe(15);
    expect(whack(s, 0)).toBe(false);
    step(s, 0.15);
    target(s, 1);
    whack(s, 1);
    expect(s.score).toBe(32);
    expect(s.bestCombo).toBe(2);
    expect(s.hits).toBe(2);
  });
  it('does not award the speed bonus after 200 ms', () => {
    const s = playing();
    target(s);
    step(s, 0.21);
    whack(s, 0);
    expect(s.score).toBe(10);
  });
  it('caps the streak bonus but tracks longer streaks', () => {
    const s = playing();
    s.combo = 50;
    target(s);
    whack(s, 0);
    expect(s.score).toBe(35);
    expect(s.bestCombo).toBe(51);
  });
  it('penalizes inspectors and empty holes, resets streaks, and floors at zero', () => {
    const s = playing();
    s.score = 50;
    s.combo = 3;
    target(s, 0, 'inspector');
    whack(s, 0);
    expect(s.score).toBe(25);
    expect(s.combo).toBe(0);
    step(s, 0.15);
    whack(s, 8);
    expect(s.score).toBe(20);
    s.score = 1;
    step(s, 0.15);
    whack(s, 8);
    expect(s.score).toBe(0);
  });
  it('rejects invalid holes without consuming a swing', () => {
    const s = playing();
    for (const index of [-1, 9, 0.5, NaN]) expect(whack(s, index)).toBe(false);
    target(s);
    expect(whack(s, 0)).toBe(true);
  });
  it('resets the streak when a mole escapes, but lets inspectors leave safely', () => {
    const s = playing();
    s.nextSpawn = 10;
    s.combo = 4;
    target(s, 0, 'inspector');
    step(s, 1);
    expect(s.combo).toBe(4);
    expect(s.escaped).toBe(0);
    target(s);
    step(s, 1);
    expect(s.combo).toBe(0);
    expect(s.escaped).toBe(1);
    expect(s.holes[0]).toBeNull();
  });
  it('ramps to challenging but bounded timings', () => {
    expect(difficulty(0).lifetime).toBeCloseTo(0.9);
    expect(difficulty(30).lifetime).toBeCloseTo(0.42);
    expect(difficulty(30).interval).toBeCloseTo(0.24);
    expect(difficulty(-100)).toEqual(difficulty(0));
    expect(difficulty(100)).toEqual(difficulty(30));
  });
  it('spawns both kinds without overwriting targets or filling more than four holes', () => {
    const s = playing();
    const random = seeded();
    const seen = new Set<string>();
    for (let i = 0; i < 590; i++) {
      step(s, 0.05, random);
      expect(s.holes.filter(Boolean).length).toBeLessThanOrEqual(4);
      for (const mole of s.holes) if (mole) seen.add(mole.kind);
    }
    expect(seen).toEqual(new Set(['mole', 'inspector']));
  });
  it('processes the same events across different frame rates', () => {
    const a = playing();
    const b = playing();
    const randomA = seeded();
    const randomB = seeded();
    step(a, 12, randomA);
    for (let i = 0; i < 120; i++) step(b, 0.1, randomB);
    expect(a.escaped).toBe(b.escaped);
    expect(a.holes).toEqual(b.holes);
    expect(a.nextSpawn).toBe(b.nextSpawn);
  });
  it('ends at 30 seconds and reports the final score exactly once, including zero', () => {
    const s = playing();
    expect(claimFinalScore(s)).toBeUndefined();
    step(s, 100);
    expect(s.time).toBe(ROUND_SECONDS);
    expect(s.phase).toBe('over');
    expect(s.holes).toEqual(Array(9).fill(null));
    expect(claimFinalScore(s)).toBe(0);
    expect(claimFinalScore(s)).toBeUndefined();
    expect(whack(s, 0)).toBe(false);
    step(s, 1);
    expect(s.time).toBe(ROUND_SECONDS);
    expect(createState().scoreClaimed).toBe(false);
  });
  it('maps pointer coordinates to the nine holes and excludes gaps', () => {
    HOLES.forEach((hole, i) => expect(holeAt(hole.x, hole.y - 20)).toBe(i));
    expect(holeAt(0, 0)).toBe(-1);
    expect(holeAt(300, 190)).toBe(-1);
  });
  it('ignores invalid elapsed times', () => {
    const s = playing();
    for (const dt of [-1, NaN, Infinity]) step(s, dt);
    expect(s.time).toBe(0);
  });
});
