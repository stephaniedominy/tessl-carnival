import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const ORDERS_PER_ROUND = 5;
/** The biggest the candy floss can grow. At this size it collapses and is served. */
export const MAX_SIZE = 100;
/** Size units gained per second while spinning. */
export const GROW_RATE = 40;
export const MIN_TARGET = 25;
export const MAX_TARGET = 85;
/** Points lost per size unit away from the target. */
export const POINTS_PER_UNIT = 2.5;
/** Seconds the feedback for a served order stays up before the next order. */
export const FEEDBACK_TIME = 1.2;

const FLOSS = { x: WIDTH / 2, y: 210, maxRadius: 140 } as const;
export const BUTTON = { x: WIDTH / 2 - 110, y: 420, width: 220, height: 56 } as const;

export interface OrderResult {
  target: number;
  size: number;
  points: number;
  /** True when the floss reached MAX_SIZE and collapsed. */
  collapsed: boolean;
}

export interface CandyFlossState {
  /** Target size of each order in the round. */
  orders: number[];
  /** The order being spun, or the one just served. */
  current: number;
  size: number;
  results: OrderResult[];
  score: number;
  /** Seconds the current feedback has been showing. */
  feedbackAge: number;
  scoreClaimed: boolean;
  phase: 'intro' | 'ready' | 'spinning' | 'served' | 'over';
}

/** A fresh round. It starts on the controls screen unless `phase` says otherwise. */
export function createState(
  random: () => number = Math.random,
  phase: 'intro' | 'ready' = 'intro',
): CandyFlossState {
  const orders = Array.from(
    { length: ORDERS_PER_ROUND },
    () => MIN_TARGET + Math.floor(random() * (MAX_TARGET - MIN_TARGET + 1)),
  );
  return {
    orders,
    current: 0,
    size: 0,
    results: [],
    score: 0,
    feedbackAge: 0,
    scoreClaimed: false,
    phase,
  };
}

/** A new round that skips the controls screen, for playing again. */
export function restart(random: () => number = Math.random): CandyFlossState {
  return createState(random, 'ready');
}

/** 100 points for an exact match, 2.5 fewer per size unit off, never below 0. */
export function scoreForOrder(target: number, size: number): number {
  const points = Math.round(100 - Math.abs(size - target) * POINTS_PER_UNIT);
  return Math.min(100, Math.max(0, points));
}

/**
 * Space or the button going down. Leaves the controls screen, or starts
 * spinning the current order. Returns false if the press did nothing.
 */
export function press(state: CandyFlossState): boolean {
  if (state.phase === 'intro') {
    state.phase = 'ready';
    return true;
  }
  if (state.phase === 'ready') {
    state.phase = 'spinning';
    state.size = 0;
    return true;
  }
  return false;
}

/** Space or the button coming up: serves the order being spun. */
export function release(state: CandyFlossState): boolean {
  return serve(state);
}

/** Serves the current order once. Returns false if there was nothing to serve. */
export function serve(state: CandyFlossState): boolean {
  if (state.phase !== 'spinning') return false;
  const target = state.orders[state.current];
  const size = Math.round(state.size);
  // Only reaching the cap collapses; 99.5 rounds to 100 but is still served.
  const collapsed = state.size >= MAX_SIZE;
  const points = collapsed ? 0 : scoreForOrder(target, size);
  state.results.push({ target, size, points, collapsed });
  state.score += points;
  state.feedbackAge = 0;
  state.phase = 'served';
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: CandyFlossState, dt: number): void {
  if (state.phase === 'spinning') {
    state.size = Math.min(MAX_SIZE, state.size + GROW_RATE * dt);
    // Held too long: the floss collapses and is served for 0 points.
    if (state.size >= MAX_SIZE) serve(state);
  } else if (state.phase === 'served') {
    state.feedbackAge += dt;
    if (state.feedbackAge >= FEEDBACK_TIME) {
      if (state.current + 1 >= ORDERS_PER_ROUND) {
        state.phase = 'over';
      } else {
        state.current += 1;
        state.size = 0;
        state.phase = 'ready';
      }
    }
  }
}

/** The round's total the first time it is asked for after the round ends, else undefined. */
export function claimFinalScore(state: CandyFlossState): number | undefined {
  if (state.phase !== 'over' || state.scoreClaimed) return undefined;
  state.scoreClaimed = true;
  return state.score;
}

export function feedbackFor(result: OrderResult): string {
  if (result.collapsed) return 'It collapsed!';
  if (result.points === 100) return 'Perfect!';
  if (result.points >= 80) return 'Lovely!';
  return result.size < result.target ? 'Too small' : 'Too big';
}

export function isOnButton(x: number, y: number): boolean {
  return (
    x >= BUTTON.x && x <= BUTTON.x + BUTTON.width && y >= BUTTON.y && y <= BUTTON.y + BUTTON.height
  );
}

function buttonLabel(state: CandyFlossState): string | undefined {
  switch (state.phase) {
    case 'intro':
      return 'Start';
    case 'ready':
      return 'Hold to spin';
    case 'spinning':
      return 'Let go to serve';
    case 'over':
      return 'Play again';
    default:
      return undefined;
  }
}

const radiusFor = (size: number) => (size / MAX_SIZE) * FLOSS.maxRadius;

function drawFloss(ctx: CanvasRenderingContext2D, size: number) {
  const { colors } = theme;
  ctx.fillStyle = colors.wood;
  ctx.fillRect(FLOSS.x - 4, FLOSS.y, 8, 170);
  const radius = radiusFor(size);
  if (radius < 1) return;
  // A cloud of overlapping puffs around the stick.
  ctx.fillStyle = colors.muted;
  ctx.beginPath();
  ctx.arc(FLOSS.x, FLOSS.y, radius * 0.8, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(
      FLOSS.x + Math.cos(angle) * radius * 0.55,
      FLOSS.y + Math.sin(angle) * radius * 0.55,
      radius * 0.45,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function draw(ctx: CanvasRenderingContext2D, state: CandyFlossState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  if (state.phase === 'intro') {
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText('Candy Floss', WIDTH / 2, 120);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    const lines = [
      `Fill ${ORDERS_PER_ROUND} orders. Each one shows a target size.`,
      'Hold Space, or press and hold the button, to spin the floss.',
      'Let go to serve it. The closer to the target, the more points.',
      'Hold too long and it collapses for 0 points.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, WIDTH / 2, 190 + i * 36));
  } else if (state.phase === 'over') {
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Round over! You scored ${state.score}`, WIDTH / 2, 100);
    ctx.font = canvasFont('body');
    state.results.forEach((result, i) => {
      ctx.fillStyle = colors.text;
      ctx.fillText(
        `Order ${i + 1}: target ${result.target}, served ${result.size}, ${result.points} points`,
        WIDTH / 2,
        160 + i * 34,
      );
    });
    ctx.fillStyle = colors.muted;
    ctx.fillText('Press Space or the button to play again', WIDTH / 2, 380);
  } else {
    // Target outline and the floss being spun.
    drawFloss(ctx, state.size);
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(FLOSS.x, FLOSS.y, radiusFor(state.orders[state.current]), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Size meter, with the target marked.
    const meter = { x: 700, y: 70, width: 30, height: 320 };
    ctx.fillStyle = colors.surface;
    ctx.fillRect(meter.x, meter.y, meter.width, meter.height);
    const filled = (state.size / MAX_SIZE) * meter.height;
    ctx.fillStyle = colors.muted;
    ctx.fillRect(meter.x, meter.y + meter.height - filled, meter.width, filled);
    const targetY =
      meter.y + meter.height - (state.orders[state.current] / MAX_SIZE) * meter.height;
    ctx.fillStyle = colors.accent;
    ctx.fillRect(meter.x - 8, targetY - 2, meter.width + 16, 4);

    ctx.textAlign = 'left';
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body', 'bold');
    ctx.fillText(`Order ${state.current + 1} of ${ORDERS_PER_ROUND}`, 24, 76);
    ctx.fillStyle = colors.accent;
    ctx.fillText(`Target ${state.orders[state.current]}`, 24, 106);
    ctx.fillStyle = colors.muted;
    ctx.fillText(`Size ${Math.round(state.size)}`, 24, 136);
    ctx.fillStyle = colors.text;
    ctx.fillText(`Score ${state.score}`, 24, 166);

    const result = state.results[state.current];
    if (state.phase === 'served' && result) {
      ctx.textAlign = 'center';
      ctx.fillStyle = result.points >= 80 ? colors.accent : colors.danger;
      ctx.font = canvasFont('title', 'bold');
      ctx.fillText(`${feedbackFor(result)} +${result.points}`, WIDTH / 2, 450);
    }
  }

  const label = buttonLabel(state);
  if (label) {
    ctx.fillStyle = state.phase === 'spinning' ? colors.stripeA : colors.accent;
    ctx.beginPath();
    ctx.roundRect(BUTTON.x, BUTTON.y, BUTTON.width, BUTTON.height, theme.radius);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = state.phase === 'spinning' ? colors.text : colors.background;
    ctx.font = canvasFont('body', 'bold');
    ctx.fillText(label, BUTTON.x + BUTTON.width / 2, BUTTON.y + BUTTON.height / 2 + 6);
  }
}

export const candyFloss: CarnivalGame = {
  id: 'candy-floss',
  name: 'Candy Floss',
  description:
    'Spin candy floss to match five orders. The closer to the target size, the more points.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    // Holding the button on a touch screen shouldn't scroll or zoom the page.
    const touchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';

    let state = createState();
    // What started the current spin: Space or a pointer id. Only it can serve.
    let holder: 'space' | number | undefined;

    const down = (source: 'space' | number) => {
      if (state.phase === 'over') state = restart();
      else press(state);
      if (state.phase === 'spinning' && holder === undefined) holder = source;
    };
    const up = (source: 'space' | number) => {
      if (source !== holder) return;
      holder = undefined;
      release(state);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      if (!event.repeat) down('space');
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') up('space');
    };
    const onPointerDown = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
      const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
      if (!isOnButton(x, y)) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      down(event.pointerId);
    };
    const onPointerUp = (event: PointerEvent) => up(event.pointerId);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't skip whole orders.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      // A collapse serves without a release, so the next spin can have a new holder.
      if (state.phase !== 'spinning') holder = undefined;
      const finalScore = claimFinalScore(state);
      if (finalScore !== undefined) {
        // A failed save (storage full or blocked) must not stop the results screen.
        try {
          recordScore(candyFloss.id, finalScore);
        } catch {
          // The round still ends; only the saved best score is missed.
        }
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.style.touchAction = touchAction;
    };
  },
};
