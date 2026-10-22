import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;
export const ROUND_SECONDS = 30;
export const KEYS = ['q', 'w', 'e', 'a', 's', 'd', 'z', 'x', 'c'];
export const HOLES = KEYS.map((key, i) => ({
  x: 200 + (i % 3) * 200,
  y: 190 + Math.floor(i / 3) * 108,
  key,
}));
export interface Mole {
  kind: 'mole' | 'inspector';
  born: number;
  until: number;
}
export interface MoleState {
  phase: 'intro' | 'playing' | 'over';
  time: number;
  nextSpawn: number;
  holes: (Mole | null)[];
  score: number;
  combo: number;
  bestCombo: number;
  hits: number;
  misses: number;
  escaped: number;
  readyAt: number;
  message: string;
  flash: { hole: number; until: number; good: boolean } | null;
  scoreClaimed: boolean;
}
export function createState(): MoleState {
  return {
    phase: 'intro',
    time: 0,
    nextSpawn: 0.3,
    holes: Array(9).fill(null),
    score: 0,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    misses: 0,
    escaped: 0,
    readyAt: 0,
    message: 'The moles have unionised. Good luck.',
    flash: null,
    scoreClaimed: false,
  };
}
export function begin(state: MoleState): void {
  if (state.phase === 'intro') state.phase = 'playing';
}
/** Late-round targets last only 420 ms, with a new arrival every 240 ms. */
export function difficulty(time: number) {
  const progress = Math.max(0, Math.min(1, time / ROUND_SECONDS));
  return { interval: 0.52 - progress * 0.28, lifetime: 0.9 - progress * 0.48 };
}
/** Process events in time order so results do not depend on animation frame rate. */
export function step(state: MoleState, dt: number, random: () => number = Math.random): void {
  if (state.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
  const end = Math.min(ROUND_SECONDS, state.time + dt);
  while (state.time < end) {
    const expiry = Math.min(...state.holes.map((m) => m?.until ?? Infinity));
    state.time = Math.min(end, state.nextSpawn, expiry);
    for (let i = 0; i < state.holes.length; i++) {
      const mole = state.holes[i];
      if (mole && mole.until <= state.time) {
        if (mole.kind === 'mole') {
          state.escaped++;
          state.combo = 0;
          state.message = [
            'Too slow. He has a train to catch.',
            'Promoted to head of evasion.',
            'That mole works remotely now.',
          ][state.escaped % 3];
        }
        state.holes[i] = null;
      }
    }
    if (state.time >= ROUND_SECONDS) {
      state.phase = 'over';
      state.holes.fill(null);
      break;
    }
    if (state.nextSpawn <= state.time) {
      const pace = difficulty(state.time);
      const available = state.holes.flatMap((m, i) => (m ? [] : [i]));
      if (available.length && state.holes.filter(Boolean).length < 4) {
        const index =
          available[Math.min(available.length - 1, Math.floor(random() * available.length))];
        state.holes[index] = {
          kind: random() < 0.22 ? 'inspector' : 'mole',
          born: state.time,
          until: state.time + pace.lifetime,
        };
      }
      state.nextSpawn += pace.interval;
    }
  }
}
/** One deliberate tap per 140 ms. Empty holes and inspectors break the combo. */
export function whack(state: MoleState, hole: number): boolean {
  if (
    state.phase !== 'playing' ||
    !Number.isInteger(hole) ||
    hole < 0 ||
    hole >= 9 ||
    state.time < state.readyAt
  )
    return false;
  state.readyAt = state.time + 0.14;
  const target = state.holes[hole];
  const good = target?.kind === 'mole';
  state.flash = { hole, until: state.time + 0.18, good };
  if (good) {
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const quick = state.time - target.born <= 0.2;
    const points = 10 + 2 * Math.min(state.combo - 1, 10) + (quick ? 5 : 0);
    state.score += points;
    state.hits++;
    state.message = quick
      ? `+${points} Express bonk! No forwarding address.`
      : `+${points} Complaint filed. Mole mildly inconvenienced.`;
  } else {
    const fine = target ? 25 : 5;
    state.score = Math.max(0, state.score - fine);
    state.combo = 0;
    state.misses++;
    state.message = target
      ? '−25! That is the safety inspector. Awkward.'
      : '−5! Excellent work. You defeated some air.';
  }
  state.holes[hole] = null;
  return true;
}
export function claimFinalScore(state: MoleState): number | undefined {
  if (state.phase !== 'over' || state.scoreClaimed) return undefined;
  state.scoreClaimed = true;
  return state.score;
}
export function holeAt(x: number, y: number): number {
  return HOLES.findIndex((hole) => ((x - hole.x) / 68) ** 2 + ((y - (hole.y - 15)) / 54) ** 2 <= 1);
}
export function verdict(hits: number): string {
  return hits >= 40
    ? 'The moles request a restraining order.'
    : hits >= 25
      ? 'Certified menace to middle management.'
      : hits >= 12
        ? 'The moles are writing a strongly worded letter.'
        : 'The moles have offered you an internship.';
}

export const whackAMole: CarnivalGame = {
  id: 'whack-a-mole',
  name: 'Whack-a-mole',
  description: 'Fast fingers, smug moles. Build a bonking streak; spare the safety inspector!',
  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const originalTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';
    let state = createState();
    const c = theme.colors;
    const ellipse = (x: number, y: number, rx: number, ry: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    const text = (
      label: string,
      x: number,
      y: number,
      color: string = c.text,
      size: 'small' | 'body' | 'title' = 'body',
    ) => {
      ctx.fillStyle = color;
      ctx.font = canvasFont(size, 'bold');
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y);
    };
    const drawMole = (x: number, y: number, inspector: boolean, age: number) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 70, y - 90, 140, 120);
      ctx.clip();
      const top = y - 24 + Math.max(0, 1 - age / 0.07) * 65;
      ellipse(x - 31, top - 14, 13, 15, c.wood);
      ellipse(x + 31, top - 14, 13, 15, c.wood);
      ellipse(x, top, 43, 38, c.wood);
      ellipse(x, top + 13, 30, 20, c.paperEdge);
      ellipse(x - 14, top - 5, 4, 5, c.background);
      ellipse(x + 14, top - 5, 4, 5, c.background);
      ellipse(x, top + 9, 9, 6, c.danger);
      ctx.fillStyle = c.paper;
      ctx.fillRect(x - 8, top + 21, 7, 10);
      ctx.fillRect(x + 1, top + 21, 7, 10);
      ctx.strokeStyle = c.background;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 22, top - 15);
      ctx.lineTo(x - 7, top - 12);
      ctx.moveTo(x + 7, top - 12);
      ctx.lineTo(x + 22, top - 18);
      ctx.stroke();
      if (inspector) {
        ellipse(x, top - 30, 33, 15, c.water);
        ctx.fillStyle = c.water;
        ctx.fillRect(x - 40, top - 29, 80, 7);
        text('!', x, top - 28, c.background, 'small');
        ctx.fillStyle = c.paper;
        ctx.fillRect(x - 38, top + 23, 76, 20);
        text('NO BONK', x, top + 38, c.paperInk, 'small');
      }
      ctx.restore();
    };
    const draw = () => {
      ctx.fillStyle = c.background;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = i % 2 ? c.stripeA : c.stripeB;
        ctx.fillRect(i * 40, 0, 40, 26);
      }
      text('The Bonking Bureau', WIDTH / 2, 64, c.accent, 'title');
      text(`Score ${state.score}`, 140, 101);
      text(`Streak ${state.combo}`, 400, 101, c.accent);
      text(`${Math.ceil(ROUND_SECONDS - state.time)}s left`, 665, 101);
      ctx.fillStyle = c.surface;
      ctx.beginPath();
      ctx.roundRect(76, 124, 648, 323, theme.radius);
      ctx.fill();
      HOLES.forEach((hole, i) => {
        ellipse(hole.x, hole.y + 9, 72, 23, c.wood);
        ellipse(hole.x, hole.y + 5, 62, 19, c.background);
        const target = state.holes[i];
        if (target) drawMole(hole.x, hole.y, target.kind === 'inspector', state.time - target.born);
        ctx.strokeStyle = c.wood;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(hole.x, hole.y + 6, 64, 19, 0, 0, Math.PI);
        ctx.stroke();
        text(hole.key.toUpperCase(), hole.x + 82, hole.y + 14, c.text, 'small');
        if (state.flash?.hole === i && state.flash.until > state.time) {
          text(
            state.flash.good ? 'BONK!' : 'OOPS!',
            hole.x,
            hole.y - 54,
            state.flash.good ? c.accent : c.danger,
          );
        }
      });
      text(state.message, WIDTH / 2, 478, c.text, 'small');
      if (state.phase !== 'playing') {
        ctx.globalAlpha = 1;
        ctx.fillStyle = c.background;
        ctx.fillRect(70, 114, 660, 340);
        ctx.globalAlpha = 1;
        if (state.phase === 'intro') {
          text('Moles behaving badly.', 400, 163, c.accent, 'title');
          text('30 seconds. Nine holes. Zero professional courtesy.', 400, 200);
          drawMole(245, 273, false, 1);
          drawMole(555, 273, true, 1);
          text('BONK THESE', 245, 309, c.accent, 'small');
          text('SPARE THE BLUE HAT', 555, 309, c.water, 'small');
          text('Click / tap holes, or use Q W E · A S D · Z X C.', 400, 348);
          text(
            'Quick hits +5. Streaks score more. Wrong bonks cost points.',
            400,
            378,
            c.text,
            'small',
          );
          text('Click here or press Space to clock in', 400, 424, c.accent);
        } else {
          text('Your shift is over.', 400, 169, c.accent, 'title');
          text(
            `${state.score} points · ${state.hits} bonks · best streak ${state.bestCombo}`,
            400,
            219,
          );
          text(verdict(state.hits), 400, 269, c.accent);
          text(`${state.escaped} escaped · ${state.misses} questionable decisions`, 400, 313);
          text('Click here or press Space for another shift', 400, 402);
        }
      }
    };
    const activate = () => {
      if (state.phase === 'over') state = createState();
      begin(state);
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      if (state.phase !== 'playing') {
        activate();
        return;
      }
      const rect = canvas.getBoundingClientRect();
      whack(
        state,
        holeAt(
          ((event.clientX - rect.left) / rect.width) * WIDTH,
          ((event.clientY - rect.top) / rect.height) * HEIGHT,
        ),
      );
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const hole = KEYS.indexOf(event.key.toLowerCase());
      if (event.code === 'Space') {
        event.preventDefault();
        if (state.phase !== 'playing') activate();
      } else if (hole >= 0 && state.phase === 'playing') {
        event.preventDefault();
        whack(state, hole);
      }
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      step(state, Math.min((now - last) / 1000, 0.05));
      last = now;
      const score = claimFinalScore(state);
      if (score !== undefined) recordScore(whackAMole.id, score);
      draw();
      frame = requestAnimationFrame(loop);
    };
    draw();
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
      canvas.style.touchAction = originalTouchAction;
    };
  },
};
