// Port de references/started-games/04-arkanoid/game.js.
// Todo el estado mutable vive dentro de la instancia creada por createArkanoid.

import type { GameFactory } from "@/games/types";
import { LEVELS } from "@/games/arkanoid/levels";
import {
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  SPRITES,
  SPRITESHEET_URL,
  type BlockColor,
  type Frame,
} from "@/games/arkanoid/sprites";

const W = 800;
const H = 600;

// ── Constants ─────────────────────────────────────────────────────────────────
const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const START_LIVES = 3;

const BOUNCE_SOUND_URL = "/games/arkanoid/sounds/ball-bounce.mp3";
const BREAK_SOUND_URL = "/games/arkanoid/sounds/break-sound.mp3";

const CAPTURED_KEYS = new Set(["ArrowLeft", "ArrowRight"]);

type Rect = { x: number; y: number; w: number; h: number };
type Ball = Rect & { vx: number; vy: number };
type Block = Rect & { color: BlockColor; alive: boolean };
type Explosion = Rect & { color: BlockColor; elapsed: number };

export const createArkanoid: GameFactory = (canvas, callbacks) => {
  const ctx = canvas.getContext("2d")!;

  // ── Estado de la instancia ──────────────────────────────────────────────────
  const paddle: Rect = { x: (W - 81) / 2, y: 560, w: 81, h: 14 };
  const ball: Ball = { x: 0, y: 0, w: 16, h: 16, vx: BASE_BALL_VX, vy: BASE_BALL_VY };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let score = 0;
  let lives = START_LIVES;
  let currentLevel = 1;
  let phase: "loading" | "playing" | "over" | "ended" = "loading";
  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId: number | null = null;
  const keys = { ArrowLeft: false, ArrowRight: false };
  let emitted = { score: -1, lives: -1, level: -1 };

  const sheet = new Image();
  const bounceSound = new Audio(BOUNCE_SOUND_URL);
  const breakSound = new Audio(BREAK_SOUND_URL);

  const isActive = () => !paused && !destroyed && phase === "playing";

  const emitStats = () => {
    if (emitted.score === score && emitted.lives === lives && emitted.level === currentLevel) return;
    emitted = { score, lives, level: currentLevel };
    callbacks.onStats({ score, lives, level: currentLevel });
  };

  // cloneNode permite solapar sonidos; el autoplay bloqueado se ignora.
  const play = (sound: HTMLAudioElement) => {
    const clone = sound.cloneNode() as HTMLAudioElement;
    clone.play().catch(() => {});
  };

  // ── Lógica ──────────────────────────────────────────────────────────────────
  const resetBall = () => {
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  };

  const loadLevel = (n: number) => {
    currentLevel = n;
    blocks = LEVELS[n - 1].blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    resetBall();
  };

  const collideAABB = (r: Rect) =>
    ball.x < r.x + r.w && ball.x + ball.w > r.x && ball.y < r.y + r.h && ball.y + ball.h > r.y;

  const update = (dt: number) => {
    // Paddle
    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.ArrowRight) paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    // Ball movement
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Wall bounces (left, right, top)
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      play(bounceSound);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
      play(bounceSound);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      play(bounceSound);
    }

    // Paddle bounce
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      play(bounceSound);
    }

    // Block collisions (un bloque por frame)
    for (const block of blocks) {
      if (!block.alive || !collideAABB(block)) continue;
      block.alive = false;
      explosions.push({ x: block.x, y: block.y, w: block.w, h: block.h, color: block.color, elapsed: 0 });
      score += 10;
      ball.vy = -ball.vy;
      play(breakSound);
      if (blocks.every((b) => !b.alive)) {
        if (currentLevel < LEVELS.length) loadLevel(currentLevel + 1);
        else phase = "over";
      }
      break;
    }

    // Explosions
    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    // Ball lost
    if (phase === "playing" && ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        phase = "over";
      } else {
        resetBall();
      }
    }
  };

  // ── Draw ────────────────────────────────────────────────────────────────────
  const drawFrame = (f: Frame, x: number, y: number, w: number, h: number) =>
    ctx.drawImage(sheet, f.sx, f.sy, f.sw, f.sh, x, y, w, h);

  const draw = () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (phase === "loading") return;

    for (const block of blocks) if (block.alive) drawFrame(SPRITES.blocks[block.color], block.x, block.y, block.w, block.h);

    for (const exp of explosions) {
      const frameIndex = Math.min(Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4), 3);
      drawFrame(EXPLOSION_FRAMES[exp.color][frameIndex], exp.x, exp.y, exp.w, exp.h);
    }

    drawFrame(SPRITES.paddle, paddle.x, paddle.y, paddle.w, paddle.h);
    drawFrame(SPRITES.ball, ball.x, ball.y, ball.w, ball.h);
  };

  // ── Loop principal ──────────────────────────────────────────────────────────
  const stopLoop = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  };

  const loop = (ts: number) => {
    rafId = null;
    if (!isActive()) return;
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50) / 1000;
    lastTime = ts;
    update(dt);
    emitStats();
    draw();
    if (phase === "over") {
      callbacks.onGameOver(score);
      return;
    }
    rafId = requestAnimationFrame(loop);
  };

  const startLoop = () => {
    if (rafId !== null || !isActive()) return;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  };

  // ── Input ───────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (!isActive() || !CAPTURED_KEYS.has(e.code)) return;
    e.preventDefault();
    keys[e.code as keyof typeof keys] = true;
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (CAPTURED_KEYS.has(e.code)) keys[e.code as keyof typeof keys] = false;
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isActive()) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (W / rect.width);
    paddle.x = Math.max(0, Math.min(W - paddle.w, mouseX - paddle.w / 2));
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("mousemove", onMouseMove);

  // ── Inicio ──────────────────────────────────────────────────────────────────
  sheet.onload = () => {
    if (destroyed || phase !== "loading") return;
    phase = "playing";
    draw();
    startLoop();
  };
  sheet.onerror = () => console.error("No se pudo cargar el spritesheet de ARKANOID");
  sheet.src = SPRITESHEET_URL;

  loadLevel(1);
  draw();
  emitStats();

  return {
    pause() {
      if (paused || destroyed) return;
      paused = true;
      keys.ArrowLeft = false;
      keys.ArrowRight = false;
      stopLoop();
    },
    resume() {
      if (!paused || destroyed) return;
      paused = false;
      startLoop();
    },
    end() {
      if (phase === "playing" || phase === "loading") phase = "ended";
      stopLoop();
      return score;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      sheet.onload = null;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouseMove);
    },
  };
};
