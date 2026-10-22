import { describe, expect, it } from 'vitest';
import {
  BUTTON,
  FEEDBACK_TIME,
  GROW_RATE,
  MAX_SIZE,
  MAX_TARGET,
  MIN_TARGET,
  ORDERS_PER_ROUND,
  claimFinalScore,
  createState,
  feedbackFor,
  isOnButton,
  press,
  release,
  restart,
  scoreForOrder,
  step,
  type CandyFlossState,
} from './game';

/** A round whose every order has the same target, already past the controls screen. */
function roundOf(target: number): CandyFlossState {
  const state = restart();
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

  it('restarts with a fresh round ready to spin', () => {
    const state = restart(() => 0.5);
    expect(state.phase).toBe('ready');
    expect(state.current).toBe(0);
    expect(state.score).toBe(0);
    expect(state.results).toEqual([]);
    expect(state.scoreClaimed).toBe(false);
    expect(state.orders).toHaveLength(ORDERS_PER_ROUND);
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
