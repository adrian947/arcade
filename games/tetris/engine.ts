// Port de references/started-games/03-tetris/game.js.
// Todo el estado mutable vive dentro de la instancia creada por createTetris.

import type { GameFactory } from "@/games/types";

const W = 800;
const H = 600;

// ── Constants ─────────────────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const BOARD_X = (W - COLS * BLOCK) / 2; // tablero 300×600 centrado
const PANEL_X = BOARD_X + COLS * BLOCK + 30;
const PREVIEW_Y = 70;
const PREVIEW_SIZE = 4 * BLOCK;

const PIECES: number[][][] = [
  [],
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
  [[2, 2], [2, 2]], // O
  [[0, 3, 0], [3, 3, 3], [0, 0, 0]], // T
  [[0, 4, 4], [4, 4, 0], [0, 0, 0]], // S
  [[5, 5, 0], [0, 5, 5], [0, 0, 0]], // Z
  [[6, 0, 0], [6, 6, 6], [0, 0, 0]], // J
  [[0, 0, 7], [7, 7, 7], [0, 0, 0]], // L
  [[8, 8, 8], [8, 0, 8], [8, 8, 8]], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const KICKS = [0, -1, 1, -2, 2];

const CAPTURED_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);

type Piece = { type: number; shape: number[][]; x: number; y: number };

type Palette = {
  pieces: string[]; // índice 1–8
  grid: string;
  label: string;
  value: string;
  font: string;
};

// Lee los tokens de globals.css desde el canvas (hereda las variables de fuente de <html>).
function readPalette(canvas: HTMLCanvasElement): Palette {
  const style = getComputedStyle(canvas);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    pieces: [
      "",
      token("--cyan", "#00f5ff"), // I
      token("--yellow", "#f5ff00"), // O
      token("--magenta", "#ff006e"), // T
      token("--green", "#00ff88"), // S
      token("--bronze", "#d97a3a"), // Z
      token("--ink", "#e6e9ff"), // J
      token("--gold", "#ffcf3a"), // L
      token("--silver", "#c7d0e0"), // N
    ],
    grid: token("--line-2", "rgba(255, 255, 255, 0.06)"),
    label: token("--ink-dim", "#8a8fb5"),
    value: token("--ink", "#e6e9ff"),
    font: token("--pixel", "monospace"),
  };
}

function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map((row) => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

export const createTetris: GameFactory = (canvas, callbacks) => {
  const ctx = canvas.getContext("2d")!;
  const colors = readPalette(canvas);

  // ── Estado de la instancia ──────────────────────────────────────────────────
  const board: number[][] = Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
  let current: Piece = randomPiece();
  let next: Piece = randomPiece();
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropInterval = 1000;
  let dropAccum = 0;
  let phase: "playing" | "over" | "ended" = "playing";
  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId: number | null = null;
  let emitted = { score: -1, level: -1 };

  const isActive = () => !paused && !destroyed && phase === "playing";

  const emitStats = () => {
    if (emitted.score === score && emitted.level === level) return;
    emitted = { score, level };
    callbacks.onStats({ score, lives: 0, level });
  };

  // ── Lógica del tablero ──────────────────────────────────────────────────────
  const collide = (shape: number[][], ox: number, oy: number) => {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  };

  const tryRotate = () => {
    const rotated = rotateCW(current.shape);
    for (const kick of KICKS) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  };

  const merge = () => {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) board[current.y + r][current.x + c] = current.shape[r][c];
  };

  const clearLines = () => {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  };

  const ghostY = () => {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  };

  const spawn = () => {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) phase = "over";
  };

  const lockPiece = () => {
    merge();
    clearLines();
    spawn();
  };

  const hardDrop = () => {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  };

  const softDrop = () => {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  };

  // ── Draw ────────────────────────────────────────────────────────────────────
  const drawBlock = (px: number, py: number, colorIndex: number, alpha = 1) => {
    if (!colorIndex) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors.pieces[colorIndex];
    ctx.fillRect(px + 1, py + 1, BLOCK - 2, BLOCK - 2);
    // brillo superior
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(px + 1, py + 1, BLOCK - 2, 4);
    ctx.globalAlpha = 1;
  };

  const drawCell = (col: number, row: number, colorIndex: number, alpha = 1) =>
    drawBlock(BOARD_X + col * BLOCK, row * BLOCK, colorIndex, alpha);

  const drawGrid = () => {
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= COLS; c++) {
      ctx.moveTo(BOARD_X + c * BLOCK + 0.5, 0);
      ctx.lineTo(BOARD_X + c * BLOCK + 0.5, ROWS * BLOCK);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(BOARD_X, r * BLOCK + 0.5);
      ctx.lineTo(BOARD_X + COLS * BLOCK, r * BLOCK + 0.5);
    }
    ctx.stroke();
  };

  const drawPanel = () => {
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = colors.label;
    ctx.font = `12px ${colors.font}`;
    ctx.fillText("SIGUIENTE", PANEL_X, PREVIEW_Y - 16);

    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(PANEL_X + 0.5, PREVIEW_Y + 0.5, PREVIEW_SIZE, PREVIEW_SIZE);

    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(PANEL_X + (offX + c) * BLOCK, PREVIEW_Y + (offY + r) * BLOCK, shape[r][c]);

    const linesY = PREVIEW_Y + PREVIEW_SIZE + 60;
    ctx.fillStyle = colors.label;
    ctx.font = `12px ${colors.font}`;
    ctx.fillText("LÍNEAS", PANEL_X, linesY);
    ctx.fillStyle = colors.value;
    ctx.font = `20px ${colors.font}`;
    ctx.fillText(String(lines).padStart(3, "0"), PANEL_X, linesY + 32);
  };

  const draw = () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawGrid();

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) drawCell(c, r, board[r][c]);

    if (phase === "playing") {
      const gy = ghostY();
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c]) drawCell(current.x + c, gy + r, current.shape[r][c], 0.2);
    }

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) drawCell(current.x + c, current.y + r, current.shape[r][c]);

    drawPanel();
  };

  // ── Loop principal ──────────────────────────────────────────────────────────
  const stopLoop = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  };

  // Tras cada cambio de estado: refresca stats y, si la partida terminó, avisa una sola vez.
  const settle = () => {
    emitStats();
    if (phase !== "over") return false;
    stopLoop();
    draw();
    callbacks.onGameOver(score);
    return true;
  };

  const loop = (ts: number) => {
    rafId = null;
    if (!isActive()) return;
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) current.y++;
      else lockPiece();
    }
    if (settle()) return;
    draw();
    rafId = requestAnimationFrame(loop);
  };

  const startLoop = () => {
    if (rafId !== null || !isActive()) return;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  };

  // ── Input ───────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (!isActive()) return;
    if (CAPTURED_KEYS.has(e.code)) e.preventDefault();
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
      default:
        return;
    }
    if (!settle()) draw();
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
      if (phase === "playing") phase = "ended";
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
