// Motor de SNAKE (SPEC 09), escrito desde cero con los sprites de fruta de
// references/started-games/05-snake-assets/. Todo el estado mutable vive dentro de la instancia.

import type { GameFactory } from "@/games/types";
import { FRUIT_FRAMES, FRUIT_URL } from "@/games/snake/sprites";

const W = 800;
const H = 600;

// ── Constants ─────────────────────────────────────────────────────────────────
const COLS = 32;
const ROWS = 24;
const CELL = 25; // 32×24 celdas llenan el canvas de 800×600
const MAX_QUEUED_TURNS = 2;
const FRUITS_PER_LEVEL = 5;

const tickMsFor = (level: number) => Math.max(60, 150 - (level - 1) * 10);

type Dir = "up" | "down" | "left" | "right";
type Cell = { x: number; y: number };

const DELTAS: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

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

// Ojos de la cabeza (posición relativa a la celda) según la dirección.
const EYES: Record<Dir, readonly [number, number][]> = {
  right: [[15, 6], [15, 15]],
  left: [[6, 6], [6, 15]],
  up: [[6, 6], [15, 6]],
  down: [[6, 15], [15, 15]],
};
const EYE_SIZE = 4;

type Palette = {
  body: string;
  head: string;
  eye: string;
  label: string;
  grid: string;
  font: string;
};

// Lee los tokens de globals.css desde el canvas (hereda las variables de fuente de <html>).
function readPalette(canvas: HTMLCanvasElement): Palette {
  const style = getComputedStyle(canvas);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    body: token("--green", "#00ff88"),
    head: token("--yellow", "#f5ff00"),
    eye: token("--ink", "#e6e9ff"),
    label: token("--ink-dim", "#8a8fb5"),
    grid: token("--line-2", "rgba(255, 255, 255, 0.06)"),
    font: token("--pixel", "monospace"),
  };
}

const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

export const createSnake: GameFactory = (canvas, callbacks) => {
  const ctx = canvas.getContext("2d")!;
  const colors = readPalette(canvas);

  // ── Estado de la instancia ──────────────────────────────────────────────────
  const snake: Cell[] = [
    { x: 16, y: 12 },
    { x: 15, y: 12 },
    { x: 14, y: 12 },
  ];
  let dir: Dir = "right";
  const queue: Dir[] = [];
  let fruit: Cell & { frame: number } = { x: 0, y: 0, frame: 0 };
  let fruits = 0;
  let score = 0;
  let level = 1;
  let tickAccum = 0;
  let phase: "waiting" | "playing" | "over" | "ended" = "waiting";
  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId: number | null = null;
  let imgLoaded = false;
  let emitted = { score: -1, level: -1 };

  const img = new Image();

  const isActive = () => !paused && !destroyed && (phase === "waiting" || phase === "playing");

  const emitStats = () => {
    if (emitted.score === score && emitted.level === level) return;
    emitted = { score, level };
    callbacks.onStats({ score, lives: 0, level });
  };

  // ── Lógica ──────────────────────────────────────────────────────────────────
  // Coloca la fruta en una celda libre al azar; false si el tablero está lleno.
  const spawnFruit = () => {
    const free: Cell[] = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
    if (free.length === 0) return false;
    const cell = free[Math.floor(Math.random() * free.length)];
    fruit = { ...cell, frame: Math.floor(Math.random() * FRUIT_FRAMES.length) };
    return true;
  };

  // Encola un giro si no repite ni invierte la última dirección prevista.
  const enqueueTurn = (next: Dir) => {
    if (queue.length >= MAX_QUEUED_TURNS) return;
    const last = queue.length ? queue[queue.length - 1] : dir;
    if (next === last || next === OPPOSITE[last]) return;
    queue.push(next);
  };

  // La cola que se libera en este tick no cuenta, salvo que la serpiente crezca.
  const hitsBody = (cell: Cell, growing: boolean) => {
    const body = growing ? snake : snake.slice(0, -1);
    return body.some((s) => sameCell(s, cell));
  };

  const step = () => {
    const turn = queue.shift();
    if (turn) dir = turn;
    const head = snake[0];
    const next = { x: head.x + DELTAS[dir].x, y: head.y + DELTAS[dir].y };

    if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
      phase = "over";
      return;
    }
    const growing = sameCell(next, fruit);
    if (hitsBody(next, growing)) {
      phase = "over";
      return;
    }

    snake.unshift(next);
    if (!growing) {
      snake.pop();
      return;
    }
    fruits++;
    score += 10 * level;
    level = Math.floor(fruits / FRUITS_PER_LEVEL) + 1;
    if (!spawnFruit()) phase = "over";
  };

  // ── Draw ────────────────────────────────────────────────────────────────────
  const drawGrid = () => {
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(c * CELL + 0.5, 0);
      ctx.lineTo(c * CELL + 0.5, H);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(0, r * CELL + 0.5);
      ctx.lineTo(W, r * CELL + 0.5);
    }
    ctx.stroke();
  };

  // Sprite escalado con su proporción dentro de la celda, centrado y sin suavizado.
  const drawFruit = () => {
    if (!imgLoaded) return;
    const f = FRUIT_FRAMES[fruit.frame];
    const scale = Math.min((CELL - 2) / f.sw, (CELL - 2) / f.sh);
    const dw = f.sw * scale;
    const dh = f.sh * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, f.sx, f.sy, f.sw, f.sh, fruit.x * CELL + (CELL - dw) / 2, fruit.y * CELL + (CELL - dh) / 2, dw, dh);
  };

  const drawSnake = () => {
    ctx.fillStyle = colors.body;
    for (let i = snake.length - 1; i > 0; i--) ctx.fillRect(snake[i].x * CELL + 2, snake[i].y * CELL + 2, CELL - 4, CELL - 4);

    const head = snake[0];
    const hx = head.x * CELL;
    const hy = head.y * CELL;
    ctx.fillStyle = colors.head;
    ctx.fillRect(hx + 2, hy + 2, CELL - 4, CELL - 4);
    ctx.fillStyle = colors.eye;
    for (const [ex, ey] of EYES[dir]) ctx.fillRect(hx + ex, hy + ey, EYE_SIZE, EYE_SIZE);
  };

  const draw = () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawGrid();
    drawFruit();
    drawSnake();

    if (phase === "waiting") {
      ctx.fillStyle = colors.label;
      ctx.font = `16px ${colors.font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PULSA UNA FLECHA", W / 2, H / 2 + 100); // bajo la serpiente
    }
  };

  // ── Loop principal ──────────────────────────────────────────────────────────
  const stopLoop = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  };

  const loop = (ts: number) => {
    rafId = null;
    if (!isActive()) return;
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;

    if (phase === "playing") {
      tickAccum += dt;
      const tickMs = tickMsFor(level);
      if (tickAccum >= tickMs) {
        tickAccum -= tickMs;
        step();
        emitStats();
      }
    }

    draw();
    if (phase === "over") {
      callbacks.onGameOver(score);
      return;
    }
    rafId = requestAnimationFrame(loop);
  };

  const startLoop = () => {
    if (rafId !== null || !imgLoaded || !isActive()) return;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  };

  // ── Input ───────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (!isActive()) return;
    const next = KEY_DIRS[e.code];
    if (!next) return;
    if (CAPTURED_KEYS.has(e.code)) e.preventDefault();

    if (phase === "waiting") {
      if (next === OPPOSITE[dir]) return; // reversa: no arranca
      phase = "playing";
      tickAccum = 0;
    }
    enqueueTurn(next);
  };

  window.addEventListener("keydown", onKeyDown);

  // ── Inicio ──────────────────────────────────────────────────────────────────
  img.onload = () => {
    if (destroyed) return;
    imgLoaded = true;
    draw();
    startLoop();
  };
  img.onerror = () => console.error("No se pudo cargar el spritesheet de frutas de SNAKE");
  img.src = FRUIT_URL;

  spawnFruit();
  draw();
  emitStats();

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
      if (phase === "waiting" || phase === "playing") phase = "ended";
      stopLoop();
      return score;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      img.onload = null;
      window.removeEventListener("keydown", onKeyDown);
    },
  };
};
