// Motor de RANARIA (SPEC 10), diseñado desde cero en la game jam: cruce de carretera y río
// estilo Frogger. Todo el estado mutable vive dentro de la instancia.

import type { GameFactory } from "@/games/types";

const W = 800;
const H = 600;

// ── Constants ─────────────────────────────────────────────────────────────────
const CELL = 50; // 16×12 celdas llenan el canvas de 800×600
const START_ROW = 11;
const START_CX = 400;
const MIN_CX = 25;
const MAX_CX = 775;
const FROG_SIZE = 36;
const FROG_HALF_HIT = 16; // caja de colisión horizontal: cx ± 16
const TIME_PER_FROG = 30; // s
const DYING_MS = 600;
const START_LIVES = 3;

const NEST_XS = [80, 240, 400, 560, 720] as const;
const NEST_CATCH = 35;
const NEST_RADIUS = 22;

const ROW_SCORE = 10;
const NEST_SCORE = 50;
const SECOND_BONUS = 10;
const LEVEL_BONUS = 1000;

const multFor = (level: number) => Math.min(2.2, 1 + 0.15 * (level - 1));

type LaneKind = "car" | "truck" | "log" | "turtles";
type Lane = {
  readonly row: number;
  readonly kind: LaneKind;
  readonly len: number;
  readonly count: number;
  readonly speed: number;
  readonly dir: 1 | -1;
  readonly offset: number;
};

// Valores a nivel 1; la velocidad efectiva es speed × mult.
const LANES: readonly Lane[] = Object.freeze([
  { row: 10, kind: "car", len: 50, count: 3, speed: 60, dir: -1, offset: 0 },
  { row: 9, kind: "car", len: 50, count: 3, speed: 90, dir: 1, offset: 120 },
  { row: 8, kind: "truck", len: 100, count: 2, speed: 50, dir: -1, offset: 200 },
  { row: 7, kind: "car", len: 50, count: 2, speed: 140, dir: 1, offset: 300 },
  { row: 5, kind: "log", len: 150, count: 3, speed: 50, dir: 1, offset: 0 },
  { row: 4, kind: "turtles", len: 120, count: 3, speed: 70, dir: -1, offset: 150 },
  { row: 3, kind: "log", len: 200, count: 2, speed: 80, dir: 1, offset: 250 },
  { row: 2, kind: "turtles", len: 80, count: 4, speed: 60, dir: -1, offset: 50 },
  { row: 1, kind: "log", len: 120, count: 3, speed: 100, dir: 1, offset: 100 },
] as const);

const isRiverRow = (row: number) => row >= 1 && row <= 5;
const isRoadRow = (row: number) => row >= 7 && row <= 10;

type Dir = "up" | "down" | "left" | "right";

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

const CAPTURED_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

// Ojos de la rana (desplazamiento desde el centro) según el último salto.
const EYES: Record<Dir, readonly [number, number][]> = {
  up: [[-9, -12], [9, -12]],
  down: [[-9, 12], [9, 12]],
  left: [[-12, -9], [-12, 9]],
  right: [[12, -9], [12, 9]],
};
const EYE_SIZE = 6;

type Palette = {
  green: string;
  cyan: string;
  magenta: string;
  yellow: string;
  silver: string;
  bronze: string;
  gold: string;
  ink: string;
  inkDim: string;
  line: string;
  font: string;
};

// Lee los tokens de globals.css desde el canvas (hereda las variables de fuente de <html>).
function readPalette(canvas: HTMLCanvasElement): Palette {
  const style = getComputedStyle(canvas);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    green: token("--green", "#00ff88"),
    cyan: token("--cyan", "#00f5ff"),
    magenta: token("--magenta", "#ff006e"),
    yellow: token("--yellow", "#f5ff00"),
    silver: token("--silver", "#c7d0e0"),
    bronze: token("--bronze", "#d97a3a"),
    gold: token("--gold", "#ffcf3a"),
    ink: token("--ink", "#e6e9ff"),
    inkDim: token("--ink-dim", "#8a8fb5"),
    line: token("--line-2", "rgba(255, 255, 255, 0.06)"),
    font: token("--pixel", "monospace"),
  };
}

function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha.toFixed(2)})`;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

export const createRanaria: GameFactory = (canvas, callbacks) => {
  const ctx = canvas.getContext("2d")!;
  const colors = readPalette(canvas);

  // ── Estado de la instancia ──────────────────────────────────────────────────
  let row = START_ROW;
  let cx = START_CX;
  let facing: Dir = "up";
  let bestRow = START_ROW;
  let timeLeft = TIME_PER_FROG;
  const nests = [false, false, false, false, false];
  const laneShift = LANES.map(() => 0); // desplazamiento acumulado de cada carril (px)
  let mult = 1;
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let phase: "waiting" | "playing" | "dying" | "over" | "ended" = "waiting";
  let dyingMs = 0;
  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId: number | null = null;
  let emitted = { score: -1, lives: -1, level: -1 };

  const isRunning = () => !paused && !destroyed && (phase === "waiting" || phase === "playing" || phase === "dying");
  const acceptsInput = () => !paused && !destroyed && (phase === "waiting" || phase === "playing");

  const emitStats = () => {
    if (emitted.score === score && emitted.lives === lives && emitted.level === level) return;
    emitted = { score, lives, level };
    callbacks.onStats({ score, lives, level });
  };

  // ── Carriles ────────────────────────────────────────────────────────────────
  // Borde izquierdo de cada objeto del carril, equiespaciados en un bucle de 800 + len.
  const laneObjects = (index: number) => {
    const lane = LANES[index];
    const loop = W + lane.len;
    const xs: number[] = [];
    for (let i = 0; i < lane.count; i++) xs.push(mod(lane.offset + (i * loop) / lane.count + laneShift[index], loop) - lane.len);
    return xs;
  };

  const laneIndexOf = (r: number) => LANES.findIndex((l) => l.row === r);

  // Índice del carril de río cuyo objeto sostiene a la rana, o -1.
  const ridingLane = () => {
    const li = laneIndexOf(row);
    if (li < 0 || !isRiverRow(row)) return -1;
    const len = LANES[li].len;
    return laneObjects(li).some((x) => cx >= x && cx <= x + len) ? li : -1;
  };

  // ── Lógica ──────────────────────────────────────────────────────────────────
  const respawn = () => {
    row = START_ROW;
    cx = START_CX;
    facing = "up";
    bestRow = START_ROW;
    timeLeft = TIME_PER_FROG;
  };

  const die = () => {
    lives -= 1;
    emitStats();
    phase = "dying";
    dyingMs = DYING_MS;
  };

  const completeLevel = () => {
    score += LEVEL_BONUS;
    level += 1;
    nests.fill(false);
    mult = multFor(level);
  };

  const tryNest = () => {
    const i = NEST_XS.findIndex((x) => Math.abs(cx - x) <= NEST_CATCH);
    if (i < 0 || nests[i]) {
      die();
      return;
    }
    nests[i] = true;
    score += NEST_SCORE + SECOND_BONUS * Math.floor(timeLeft);
    if (nests.every(Boolean)) completeLevel();
    emitStats();
    respawn();
  };

  const checkRoad = () => {
    const li = laneIndexOf(row);
    if (li < 0 || !isRoadRow(row)) return;
    const len = LANES[li].len;
    if (laneObjects(li).some((x) => cx + FROG_HALF_HIT > x && cx - FROG_HALF_HIT < x + len)) die();
  };

  const checkRiver = () => {
    if (!isRiverRow(row)) return;
    if (cx < 0 || cx > W || ridingLane() < 0) die();
  };

  // Aplica un salto; devuelve false si la rana no se movió.
  const hop = (d: Dir) => {
    facing = d;
    if (d === "down" && row >= START_ROW) return false;
    if (d === "up") row -= 1;
    else if (d === "down") row += 1;
    else {
      const next = Math.min(MAX_CX, Math.max(MIN_CX, cx + (d === "left" ? -CELL : CELL)));
      if (next === cx) return false;
      cx = next;
    }

    if (row === 0) {
      tryNest();
      return true;
    }
    if (row < bestRow) {
      score += ROW_SCORE * (bestRow - row);
      bestRow = row;
      emitStats();
    }
    checkRoad();
    if (phase === "playing" || phase === "waiting") checkRiver();
    return true;
  };

  const update = (dt: number) => {
    const sec = dt / 1000;
    const riding = phase === "playing" ? ridingLane() : -1;

    LANES.forEach((lane, i) => {
      laneShift[i] += lane.dir * lane.speed * mult * sec;
    });

    if (phase === "dying") {
      dyingMs -= dt;
      if (dyingMs <= 0) {
        if (lives <= 0) phase = "over";
        else {
          respawn();
          phase = "playing";
        }
      }
      return;
    }
    if (phase !== "playing") return;

    if (riding >= 0) cx += LANES[riding].dir * LANES[riding].speed * mult * sec;

    timeLeft -= sec;
    if (timeLeft <= 0) {
      timeLeft = 0;
      die();
      return;
    }
    checkRoad();
    if (phase === "playing") checkRiver();
  };

  // ── Draw ────────────────────────────────────────────────────────────────────
  const fillRow = (r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, r * CELL, W, CELL);
  };

  const drawFrogAt = (x: number, y: number, size: number, dir: Dir) => {
    ctx.fillStyle = colors.green;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    const scale = size / FROG_SIZE;
    const eye = EYE_SIZE * scale;
    ctx.fillStyle = colors.ink;
    for (const [ex, ey] of EYES[dir]) ctx.fillRect(x + ex * scale - eye / 2, y + ey * scale - eye / 2, eye, eye);
  };

  const drawBackground = () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    fillRow(0, withAlpha(colors.green, 0.25));
    for (let r = 1; r <= 5; r++) fillRow(r, withAlpha(colors.cyan, 0.15));
    fillRow(6, withAlpha(colors.magenta, 0.12));
    fillRow(11, withAlpha(colors.magenta, 0.12));

    // Líneas discontinuas entre carriles de la carretera.
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 16]);
    ctx.beginPath();
    for (let r = 8; r <= 10; r++) {
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(W, r * CELL);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const drawNests = () => {
    NEST_XS.forEach((x, i) => {
      const y = CELL / 2;
      ctx.fillStyle = "#000";
      ctx.strokeStyle = colors.green;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, NEST_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (nests[i]) drawFrogAt(x, y, 24, "down");
    });
  };

  const vehicleColor = (r: number) =>
    r === 10 ? colors.magenta : r === 9 ? colors.yellow : r === 7 ? colors.cyan : colors.silver;

  const drawLanes = () => {
    LANES.forEach((lane, li) => {
      const top = lane.row * CELL;
      for (const x of laneObjects(li)) {
        if (lane.kind === "car" || lane.kind === "truck") {
          ctx.fillStyle = vehicleColor(lane.row);
          ctx.fillRect(x + 2, top + 10, lane.len - 4, CELL - 20);
          // Faros en el frente, según la dirección de marcha.
          ctx.fillStyle = colors.ink;
          const fx = lane.dir === 1 ? x + lane.len - 8 : x + 2;
          ctx.fillRect(fx, top + 13, 6, 6);
          ctx.fillRect(fx, top + CELL - 19, 6, 6);
        } else if (lane.kind === "log") {
          ctx.fillStyle = colors.bronze;
          ctx.fillRect(x, top + 8, lane.len, CELL - 16);
          ctx.strokeStyle = colors.gold;
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let gx = x + 20; gx < x + lane.len - 10; gx += 40) {
            ctx.moveTo(gx, top + 18);
            ctx.lineTo(gx + 18, top + 18);
            ctx.moveTo(gx + 10, top + CELL - 18);
            ctx.lineTo(gx + 28, top + CELL - 18);
          }
          ctx.stroke();
        } else {
          const n = Math.round(lane.len / 40);
          ctx.fillStyle = colors.gold;
          for (let k = 0; k < n; k++) {
            ctx.beginPath();
            ctx.arc(x + 20 + k * 40, top + CELL / 2, 16, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    });
  };

  const drawFrog = () => {
    const y = row * CELL + CELL / 2;
    if (phase === "dying" || phase === "over") {
      const h = FROG_SIZE / 2;
      ctx.strokeStyle = colors.magenta;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - h, y - h);
      ctx.lineTo(cx + h, y + h);
      ctx.moveTo(cx + h, y - h);
      ctx.lineTo(cx - h, y + h);
      ctx.stroke();
      return;
    }
    drawFrogAt(cx, y, FROG_SIZE, facing);
  };

  const drawTimeBar = () => {
    ctx.fillStyle = timeLeft > 10 ? colors.green : timeLeft > 5 ? colors.yellow : colors.magenta;
    ctx.fillRect(0, 592, (W * Math.max(0, timeLeft)) / TIME_PER_FROG, 6);
  };

  const draw = () => {
    drawBackground();
    drawNests();
    drawLanes();
    drawFrog();
    drawTimeBar();

    if (phase === "waiting") {
      ctx.fillStyle = colors.inkDim;
      ctx.font = `16px ${colors.font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PULSA UNA FLECHA", W / 2, 6 * CELL + CELL / 2); // en la mediana
    }
  };

  // ── Loop principal ──────────────────────────────────────────────────────────
  const stopLoop = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  };

  const loop = (ts: number) => {
    rafId = null;
    if (!isRunning()) return;
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;

    update(dt);
    draw();
    if (phase === "over") {
      callbacks.onGameOver(score);
      return;
    }
    rafId = requestAnimationFrame(loop);
  };

  const startLoop = () => {
    if (rafId !== null || !isRunning()) return;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  };

  // ── Input ───────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (!acceptsInput()) return;
    const d = KEY_DIRS[e.code];
    if (!d) return;
    if (CAPTURED_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) return;

    const wasWaiting = phase === "waiting";
    const moved = hop(d);
    if (wasWaiting && moved && phase === "waiting") phase = "playing";
  };

  window.addEventListener("keydown", onKeyDown);

  // ── Inicio ──────────────────────────────────────────────────────────────────
  draw();
  emitStats();
  startLoop();

  return {
    pause() {
      if (paused || destroyed) return;
      paused = true;
      stopLoop();
    },
    resume() {
      if (!paused || destroyed) return;
      paused = false;
      startLoop();
    },
    end() {
      if (phase === "waiting" || phase === "playing" || phase === "dying") phase = "ended";
      stopLoop();
      return score;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
    },
  };
};
