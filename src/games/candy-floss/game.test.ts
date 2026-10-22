import { describe, expect, it } from 'vitest';
import {
  BUTTON,
  DEFAULT_COLOUR,
  FEEDBACK_TIME,
  FLOSS_COLOURS,
  GROW_RATE,
  MAX_SIZE,
  MAX_TARGET,
  MIN_TARGET,
  ORDERS_PER_ROUND,
  chooseColour,
  claimFinalScore,
  createState,
  cycleColour,
  feedbackFor,
  flossFill,
  isOnButton,
  press,
  release,
  restart,
  scoreForOrder,
  step,
  swatchAt,
  type CandyFlossState,
} from './game';
import { theme } from '../../carnival';

/** A round whose every order has the same target, already past the controls screen. */
function roundOf(target: number): CandyFlossState {
  const state = createState(Math.random, 'ready');
  state.orders = Array(ORDERS_PER_ROUND).fill(target);
  return state;
}

/** Holds until the floss reaches `size`, then lets go. */
function spinTo(state: CandyFlossState, size: number) {
  press(state);
  step(state, size / GROW_RATE);
  release(state);
}

function nextOrder(state: CandyFlossState) {
  step(state, FEEDBACK_TIME);
}

describe('candy floss', () => {
  it('starts on the controls screen with five orders and no score', () => {
    const state = createState();
    expect(state.phase).toBe('intro');
    expect(state.orders).toHaveLength(ORDERS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.results).toEqual([]);
  });

  it('picks every target inside the allowed range', () => {
    expect(createState(() => 0).orders).toEqual(Array(ORDERS_PER_ROUND).fill(MIN_TARGET));
    expect(createState(() => 0.9999).orders).toEqual(Array(ORDERS_PER_ROUND).fill(MAX_TARGET));
  });

  it('leaves the controls screen on the first press without spinning', () => {
    const state = createState();
    expect(press(state)).toBe(true);
    expect(state.phase).toBe('ready');
    step(state, 1);
    expect(state.size).toBe(0);
  });

  it('scores 100 for an exact match and less the further off it is', () => {
    expect(scoreForOrder(50, 50)).toBe(100);
    expect(scoreForOrder(50, 46)).toBe(90);
    expect(scoreForOrder(50, 54)).toBe(90);
    expect(scoreForOrder(50, 30)).toBe(50);
  });

  it('never scores an order below 0 or above 100', () => {
    expect(scoreForOrder(25, 100)).toBe(0);
    expect(scoreForOrder(85, 0)).toBe(0);
    expect(scoreForOrder(60, 60.1)).toBe(100);
  });

  it('grows only while held and serves on release', () => {
    const state = roundOf(50);
    press(state);
    step(state, 1);
    expect(state.size).toBeCloseTo(GROW_RATE);
    expect(release(state)).toBe(true);
    expect(state.phase).toBe('served');
    expect(state.results[0]).toMatchObject({ target: 50, size: GROW_RATE, points: 75 });
    expect(state.score).toBe(75);
  });

  it('collapses an oversized floss at the size cap and serves it for 0', () => {
    const state = roundOf(MAX_TARGET);
    press(state);
    step(state, 60);
    expect(state.size).toBe(MAX_SIZE);
    expect(state.phase).toBe('served');
    expect(state.results[0]).toMatchObject({ size: MAX_SIZE, points: 0, collapsed: true });
    expect(feedbackFor(state.results[0])).toBe('It collapsed!');
    // Letting go afterwards doesn't serve it again, and the round moves on.
    expect(release(state)).toBe(false);
    nextOrder(state);
    expect(state.phase).toBe('ready');
    expect(state.current).toBe(1);
  });

  it('scores a floss just under the cap that rounds to it, without collapsing', () => {
    const state = roundOf(MAX_TARGET);
    press(state);
    state.size = 99.6;
    expect(release(state)).toBe(true);
    expect(state.results[0]).toMatchObject({ size: MAX_SIZE, collapsed: false });
    expect(state.results[0].points).toBe(scoreForOrder(MAX_TARGET, MAX_SIZE));
  });

  it('ignores a second press while spinning and a second release after serving', () => {
    const state = roundOf(50);
    press(state);
    step(state, 0.5);
    expect(press(state)).toBe(false);
    expect(state.size).toBeCloseTo(GROW_RATE * 0.5);
    release(state);
    expect(release(state)).toBe(false);
    expect(press(state)).toBe(false);
    expect(state.results).toHaveLength(1);
  });

  it('ignores a release before anything is spinning', () => {
    const state = roundOf(50);
    expect(release(state)).toBe(false);
    expect(state.results).toEqual([]);
    expect(state.phase).toBe('ready');
  });

  it('moves through five orders and then ends the round', () => {
    const state = roundOf(40);
    for (let i = 0; i < ORDERS_PER_ROUND; i++) {
      expect(state.current).toBe(i);
      expect(state.phase).toBe('ready');
      spinTo(state, 40);
      nextOrder(state);
    }
    expect(state.phase).toBe('over');
    expect(state.results).toHaveLength(ORDERS_PER_ROUND);
    expect(state.score).toBe(500);
  });

  it('starts each order from an empty stick', () => {
    const state = roundOf(40);
    spinTo(state, 30);
    nextOrder(state);
    expect(state.size).toBe(0);
  });

  it('hands out the final score exactly once, and only when the round is over', () => {
    const state = roundOf(40);
    spinTo(state, 40);
    expect(claimFinalScore(state)).toBeUndefined();
    for (let i = 0; i < ORDERS_PER_ROUND; i++) {
      if (i > 0) spinTo(state, 20);
      nextOrder(state);
    }
    expect(claimFinalScore(state)).toBe(100 + 4 * 50);
    expect(claimFinalScore(state)).toBeUndefined();
  });

  it('ignores input once the round is over', () => {
    const state = roundOf(40);
    for (let i = 0; i < ORDERS_PER_ROUND; i++) {
      spinTo(state, 40);
      nextOrder(state);
    }
    expect(press(state)).toBe(false);
    expect(release(state)).toBe(false);
    step(state, 10);
    expect(state.phase).toBe('over');
    expect(state.results).toHaveLength(ORDERS_PER_ROUND);
  });

  it('restarts with a fresh round on the colour screen', () => {
    const state = restart(() => 0.5);
    expect(state.phase).toBe('intro');
    expect(state.colour).toBe(DEFAULT_COLOUR);
    expect(state.current).toBe(0);
    expect(state.score).toBe(0);
    expect(state.results).toEqual([]);
    expect(state.scoreClaimed).toBe(false);
    expect(state.orders).toHaveLength(ORDERS_PER_ROUND);
  });

  it('starts on Lavender and offers the four theme colours', () => {
    expect(createState().colour).toBe('lavender');
    expect(FLOSS_COLOURS.map((option) => option.name)).toEqual([
      'Lavender',
      'Rose',
      'Blue',
      'Gold',
    ]);
    expect(flossFill('lavender')).toBe(theme.colors.muted);
    expect(flossFill('rose')).toBe(theme.colors.danger);
    expect(flossFill('blue')).toBe(theme.colors.water);
    expect(flossFill('gold')).toBe(theme.colors.accent);
  });

  it('chooses a colour on the pre-round screen and keeps it for the round', () => {
    const state = createState();
    expect(chooseColour(state, 'blue')).toBe(true);
    expect(state.colour).toBe('blue');
    press(state);
    expect(state.colour).toBe('blue');
  });

  it('cycles through the colours with wrapping', () => {
    const state = createState();
    expect(cycleColour(state, -1)).toBe(true);
    expect(state.colour).toBe('gold');
    cycleColour(state, 1);
    cycleColour(state, 1);
    expect(state.colour).toBe('rose');
  });

  it('refuses colour changes once the round has started', () => {
    const state = createState(Math.random, 'intro', 'rose');
    press(state);
    expect(chooseColour(state, 'gold')).toBe(false);
    expect(cycleColour(state, 1)).toBe(false);
    press(state);
    expect(chooseColour(state, 'gold')).toBe(false);
    expect(state.colour).toBe('rose');
  });

  it('scores the same whatever the colour', () => {
    const totals = FLOSS_COLOURS.map((option) => {
      const state = createState(() => 0.5, 'intro', option.id);
      press(state);
      for (let i = 0; i < ORDERS_PER_ROUND; i++) {
        spinTo(state, 30);
        nextOrder(state);
      }
      return state.score;
    });
    expect(new Set(totals).size).toBe(1);
  });

  it('plays again on the colour screen with the last colour selected', () => {
    const state = createState(Math.random, 'intro', 'gold');
    press(state);
    for (let i = 0; i < ORDERS_PER_ROUND; i++) {
      spinTo(state, 40);
      nextOrder(state);
    }
    const next = restart(Math.random, state.colour);
    expect(next.phase).toBe('intro');
    expect(next.colour).toBe('gold');
    expect(chooseColour(next, 'blue')).toBe(true);
  });

  it('finds the swatch under a point, and nothing between swatches', () => {
    const hits = [80, 200, 320, 460].map((x) => swatchAt(x, 300));
    expect(hits).toEqual(['lavender', 'rose', 'blue', 'gold']);
    expect(swatchAt(175, 300)).toBeUndefined();
    expect(swatchAt(80, 200)).toBeUndefined();
  });

  it('only counts presses on the button', () => {
    expect(isOnButton(BUTTON.x + 1, BUTTON.y + 1)).toBe(true);
    expect(isOnButton(BUTTON.x - 1, BUTTON.y + 1)).toBe(false);
    expect(isOnButton(BUTTON.x + 1, BUTTON.y + BUTTON.height + 1)).toBe(false);
  });

  it('says whether a miss was too small or too big', () => {
    expect(feedbackFor({ target: 50, size: 20, points: 25, collapsed: false })).toBe('Too small');
    expect(feedbackFor({ target: 50, size: 80, points: 25, collapsed: false })).toBe('Too big');
    expect(feedbackFor({ target: 50, size: 50, points: 100, collapsed: false })).toBe('Perfect!');
  });
});
