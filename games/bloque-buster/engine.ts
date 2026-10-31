// Motor de BLOQUE BUSTER (SPEC 14), escrito desde cero.
// Mecánica central: la bola ("núcleo de plasma") lleva una carga de color. Solo destruye bloques de su
// mismo color, y al hacerlo pulveriza todo el grupo conectado de ese color (cascada). Tocar un bloque de
// otro color no lo rompe: la bola rebota y adopta ese color. El muro desciende una fila cada cierto
// tiempo; si cruza la línea de peligro se pierde una vida.
// Todo el estado mutable vive dentro de la instancia.

import { DEFAULT_SKIN, type GameFactory, type SkinId } from "@/games/types";
import { getPalette, withAlpha, type BlockLook } from "@/games/bloque-buster/skins";

const W = 800;
const H = 600;

// ── Constantes ────────────────────────────────────────────────────────────────
const FIELD_L = 40;
const FIELD_R = 760;
const TOP = 24; // techo del campo (encima va la barra de descenso)
const COLS = 12;
const BW = 60; // 12 × 60 = 720 = ancho del campo
const BH = 22;
const TOTAL_ROWS = 16; // filas del muro por nivel
const START_VISIBLE = 7; // filas visibles al empezar el nivel; el resto entra al descender
const DANGER_Y = 470;
const BREACH_ROWS = 3; // filas inferiores que se retiran al cruzar la línea de peligro

const PADDLE_Y = 556;
const PADDLE_W = 112;
const PADDLE_H = 14;
const PADDLE_SPEED = 560; // px/s
const BALL_R = 7;
const MAX_BOUNCE = (60 * Math.PI) / 180;
const LAUNCH_ANGLE = (20 * Math.PI) / 180;

const START_LIVES = 3;
const BLOCK_SCORE = 10;
const MAX_COMBO = 10;
const LEVEL_BONUS = 500;
const COLORS = 4;
const SPARK_MS = 300;
const BREACH_FLASH_MS = 600;

const ballSpeedFor = (level: number) => 380 * Math.min(1.6, 1 + 0.06 * (level - 1));
const descentFor = (level: number) => Math.max(4, 10 - 0.75 * (level - 1)) * 1000;

const LEFT_KEYS = new Set(["ArrowLeft", "KeyA"]);
const RIGHT_KEYS = new Set(["ArrowRight", "KeyD"]);
const LAUNCH_KEYS = new Set(["Space", "ArrowUp", "KeyW"]);
const CAPTURED_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "Space"]);

// PRNG determinista (mulberry32): cada nivel genera siempre el mismo muro.
function rngFor(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cuatro patrones base que rotan por nivel; cada nivel baraja los colores y agrega ruido y huecos.
const PATTERNS: readonly ((c: number, r: number) => number)[] = [
  (c, r) => Math.floor((c + r) / 2), // franjas diagonales
  (c, r) => (((c >> 1) + (r >> 1)) % 2) + 2 * ((r >> 2) % 2), // ajedrez 2×2 en bandas
  (c, r) => Math.floor(Math.max(Math.abs(c - 5.5), Math.abs(r - 7.5))), // anillos concéntricos
  (c, r) => r + Math.abs((c % 6) - 3), // zigzag
];

function buildWall(level: number): Int8Array {
  const rnd = rngFor(level * 9973 + 17);
  const perm = [0, 1, 2, 3];
  for (let i = perm.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const pattern = PATTERNS[(level - 1) % PATTERNS.length];
  const noise = Math.min(0.25, 0.08 + 0.02 * (level - 1));
  const holes = Math.min(0.15, 0.05 + 0.01 * (level - 1));
  const grid = new Int8Array(TOTAL_ROWS * COLS);
  for (let r = 0; r < TOTAL_ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const roll = rnd();
      let k = perm[pattern(c, r) % COLORS];
      if (roll < holes) k = -1;
      else if (roll < holes + noise) k = Math.floor(rnd() * COLORS);
      grid[r * COLS + c] = k;
    }
  }
  return grid;
}

type Spark = { x: number; y: number; w: number; h: number; color: number; t: number };

export const createBloqueBuster: GameFactory = (canvas, callbacks, options) => {
  const ctx = canvas.getContext("2d")!;
  let colors = getPalette(options?.skin ?? DEFAULT_SKIN, canvas);

  // ── Estado de la instancia ──────────────────────────────────────────────────
  let level = 1;
  let grid = buildWall(level);
  let shift = START_VISIBLE - TOTAL_ROWS; // fila de pantalla = r + shift (negativa = aún oculta)
  let descentMs = descentFor(level);
  let paddleX = W / 2; // centro
  let lastDir: -1 | 1 = 1;
  let ballX = 0;
  let ballY = 0;
  let vx = 0;
  let vy = 0;
  let charge = 0; // color de la bola
  let score = 0;
  let lives = START_LIVES;
  let phase: "serve" | "playing" | "over" | "ended" = "serve";
  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId: number | null = null;
  let breachMs = 0;
  let sparks: Spark[] = [];
  const keys = new Set<string>();
  let emitted = { score: -1, lives: -1, level: -1 };

  const isRunning = () => !paused && !destroyed && (phase === "serve" || phase === "playing");

  const emitStats = () => {
    if (emitted.score === score && emitted.lives === lives && emitted.level === level) return;
    emitted = { score, lives, level };
    callbacks.onStats({ score, lives, level });
  };

  // ── Muro ────────────────────────────────────────────────────────────────────
  const at = (c: number, r: number) => grid[r * COLS + c];
  const isVisible = (r: number) => r + shift >= 0;
  const rowTop = (r: number) => TOP + (r + shift) * BH;

  // Celda (c, r) con bloque visible bajo el punto, o null.
  const cellAt = (px: number, py: number): [number, number] | null => {
    if (px < FIELD_L || px >= FIELD_R || py < TOP) return null;
    const r = Math.floor((py - TOP) / BH) - shift;
    if (r < 0 || r >= TOTAL_ROWS) return null;
    const c = Math.floor((px - FIELD_L) / BW);
    return at(c, r) >= 0 ? [c, r] : null;
  };

  const countBlocks = (visibleOnly: boolean) => {
    let n = 0;
    for (let r = 0; r < TOTAL_ROWS; r++) {
      if (visibleOnly && !isVisible(r)) continue;
      for (let c = 0; c < COLS; c++) if (at(c, r) >= 0) n++;
    }
    return n;
  };

  const lowestRow = () => {
    for (let r = TOTAL_ROWS - 1; r >= 0; r--) for (let c = 0; c < COLS; c++) if (at(c, r) >= 0) return r;
    return -1;
  };

  // Color más frecuente entre los bloques visibles (carga inicial de cada saque).
  const commonColor = () => {
    const n = [0, 0, 0, 0];
    for (let r = 0; r < TOTAL_ROWS; r++) {
      if (!isVisible(r)) continue;
      for (let c = 0; c < COLS; c++) if (at(c, r) >= 0) n[at(c, r)]++;
    }
    return n.indexOf(Math.max(...n));
  };

  // Grupo conectado (4 vecinos) del mismo color, solo entre bloques visibles.
  const groupOf = (c0: number, r0: number) => {
    const k = at(c0, r0);
    const seen = new Set<number>([r0 * COLS + c0]);
    const stack: [number, number][] = [[c0, r0]];
    const out: [number, number][] = [];
    while (stack.length) {
      const [c, r] = stack.pop()!;
      out.push([c, r]);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= TOTAL_ROWS || !isVisible(nr)) continue;
        const id = nr * COLS + nc;
        if (seen.has(id) || at(nc, nr) !== k) continue;
        seen.add(id);
        stack.push([nc, nr]);
      }
    }
    return out;
  };

  const addSpark = (c: number, r: number, color: number) => {
    sparks.push({ x: FIELD_L + c * BW, y: rowTop(r), w: BW, h: BH, color, t: SPARK_MS });
  };

  // ── Bola y saque ────────────────────────────────────────────────────────────
  const resetBall = () => {
    ballX = paddleX;
    ballY = PADDLE_Y - BALL_R - 1;
    vx = 0;
    vy = 0;
    charge = commonColor();
    phase = "serve";
  };

  const launch = () => {
    const s = ballSpeedFor(level);
    vx = Math.sin(LAUNCH_ANGLE) * s * lastDir;
    vy = -Math.cos(LAUNCH_ANGLE) * s;
    phase = "playing";
  };

  const loseLife = () => {
    lives -= 1;
    keys.clear();
    if (lives <= 0) {
      lives = 0;
      phase = "over";
    } else resetBall();
    emitStats();
  };

  const nextLevel = () => {
    score += LEVEL_BONUS * level;
    level += 1;
    grid = buildWall(level);
    shift = START_VISIBLE - TOTAL_ROWS;
    descentMs = descentFor(level);
    sparks = [];
    emitStats();
    resetBall();
  };

  // ── Descenso del muro ───────────────────────────────────────────────────────
  const descend = () => {
    shift += 1;
    descentMs = descentFor(level);

    const low = lowestRow();
    if (low >= 0 && rowTop(low) + BH > DANGER_Y) {
      // Brecha: se retiran las filas inferiores ocupadas y se pierde una vida.
      for (let r = low; r > low - BREACH_ROWS && r >= 0; r--) {
        for (let c = 0; c < COLS; c++) grid[r * COLS + c] = -1;
      }
      breachMs = BREACH_FLASH_MS;
      loseLife();
      return;
    }

    // Si el muro baja sobre la bola, la bola queda justo debajo y sale hacia abajo.
    if (phase === "playing") {
      const hit = cellAt(ballX, ballY - BALL_R) ?? cellAt(ballX, ballY) ?? cellAt(ballX, ballY + BALL_R);
      if (hit) {
        ballY = rowTop(hit[1]) + BH + BALL_R + 1;
        vy = Math.abs(vy);
      }
    }
  };

  // ── Impactos ────────────────────────────────────────────────────────────────
  const hitBlock = (c: number, r: number) => {
    const k = at(c, r);
    if (k !== charge) {
      charge = k; // recarga: no rompe, solo cambia el color de la bola
      addSpark(c, r, -1);
      return;
    }
    const group = groupOf(c, r);
    for (const [gc, gr] of group) {
      addSpark(gc, gr, k);
      grid[gr * COLS + gc] = -1;
    }
    score += BLOCK_SCORE * group.length * Math.min(group.length, MAX_COMBO);
    emitStats();
    if (countBlocks(false) === 0) nextLevel();
  };

  // Primer bloque visible en el borde de avance de la bola (centro y dos puntos laterales).
  const probe = (px: number, py: number, ox: number, oy: number) =>
    cellAt(px, py) ?? cellAt(px + ox, py + oy) ?? cellAt(px - ox, py - oy);

  const moveBall = (sec: number) => {
    const dist = Math.hypot(vx, vy) * sec;
    const steps = Math.max(1, Math.ceil(dist / (BALL_R * 0.8)));
    const h = sec / steps;
    for (let i = 0; i < steps && phase === "playing"; i++) {
      // Eje X
      ballX += vx * h;
      if (ballX - BALL_R < FIELD_L) {
        ballX = FIELD_L + BALL_R;
        vx = Math.abs(vx);
      } else if (ballX + BALL_R > FIELD_R) {
        ballX = FIELD_R - BALL_R;
        vx = -Math.abs(vx);
      } else {
        const cell = probe(ballX + Math.sign(vx) * BALL_R, ballY, 0, BALL_R - 2);
        if (cell) {
          ballX -= vx * h;
          vx = -vx;
          hitBlock(cell[0], cell[1]);
          if (phase !== "playing") return;
        }
      }

      // Eje Y
      ballY += vy * h;
      if (ballY - BALL_R < TOP) {
        ballY = TOP + BALL_R;
        vy = Math.abs(vy);
      } else {
        const cell = probe(ballX, ballY + Math.sign(vy) * BALL_R, BALL_R - 2, 0);
        if (cell) {
          ballY -= vy * h;
          vy = -vy;
          hitBlock(cell[0], cell[1]);
          if (phase !== "playing") return;
        }
      }

      // Paleta: el ángulo de salida depende del punto de impacto.
      if (
        vy > 0 &&
        ballY + BALL_R >= PADDLE_Y &&
        ballY - BALL_R <= PADDLE_Y + PADDLE_H &&
        Math.abs(ballX - paddleX) <= PADDLE_W / 2 + BALL_R
      ) {
        const rel = Math.max(-1, Math.min(1, (ballX - paddleX) / (PADDLE_W / 2)));
        const s = ballSpeedFor(level);
        vx = Math.sin(rel * MAX_BOUNCE) * s;
        vy = -Math.cos(rel * MAX_BOUNCE) * s;
        ballY = PADDLE_Y - BALL_R;
      }

      if (ballY - BALL_R > H) {
        loseLife();
        return;
      }
    }
  };

  // ── Lógica ──────────────────────────────────────────────────────────────────
  const update = (dt: number) => {
    const sec = dt / 1000;
    sparks = sparks.filter((s) => (s.t -= dt) > 0);
    if (breachMs > 0) breachMs -= dt;

    let dir = 0;
    if ([...LEFT_KEYS].some((k) => keys.has(k))) dir -= 1;
    if ([...RIGHT_KEYS].some((k) => keys.has(k))) dir += 1;
    if (dir !== 0) lastDir = dir as -1 | 1;
    paddleX = Math.max(FIELD_L + PADDLE_W / 2, Math.min(FIELD_R - PADDLE_W / 2, paddleX + dir * PADDLE_SPEED * sec));

    if (phase === "serve") {
      ballX = paddleX;
      return; // el muro no baja mientras la bola espera en la paleta
    }
    if (phase !== "playing") return;

    // Sin bloques visibles pero con filas ocultas: el muro baja de inmediato.
    if (countBlocks(true) === 0) descend();
    else {
      descentMs -= dt;
      if (descentMs <= 0) descend();
    }
    if (phase !== "playing") return;

    moveBall(sec);
  };

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  const px = (v: number) => (colors.pixel ? Math.round(v) : v);

  const glow = (color: string, k = 1) => {
    ctx.shadowColor = color;
    ctx.shadowBlur = colors.glow * k;
  };
  const noGlow = () => {
    ctx.shadowBlur = 0;
  };

  const drawBlock = (x: number, y: number, look: BlockLook) => {
    const bx = px(x + 2);
    const by = px(y + 2);
    const bw = BW - 4;
    const bh = BH - 4;
    if (colors.outline) {
      ctx.fillStyle = withAlpha(look.fill, 0.18);
      ctx.fillRect(bx, by, bw, bh);
      glow(look.fill);
      ctx.strokeStyle = look.fill;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
      noGlow();
      return;
    }
    ctx.fillStyle = look.fill;
    ctx.fillRect(bx, by, bw, bh);
    if (look.style === "hollow") {
      ctx.fillStyle = look.mark;
      ctx.fillRect(bx, by, bw, 2);
      ctx.fillRect(bx, by + bh - 2, bw, 2);
      ctx.fillRect(bx, by, 2, bh);
      ctx.fillRect(bx + bw - 2, by, 2, bh);
    } else if (look.style === "striped") {
      ctx.fillStyle = look.mark;
      for (let sx = 4; sx < bw; sx += 8) ctx.fillRect(bx + sx, by + 2, 2, bh - 4);
    } else if (look.style === "dotted") {
      ctx.fillStyle = look.mark;
      for (let sx = 6; sx < bw - 2; sx += 10) ctx.fillRect(bx + sx, by + bh / 2 - 1, 2, 2);
    }
    if (colors.blockShade) {
      ctx.fillStyle = colors.blockShade;
      ctx.fillRect(bx, by + bh - 4, bw, 4);
    }
  };

  const drawFrame = () => {
    ctx.fillStyle = colors.frame;
    ctx.fillRect(FIELD_L - 4, TOP - 4, 4, H - TOP + 4);
    ctx.fillRect(FIELD_R, TOP - 4, 4, H - TOP + 4);
    ctx.fillRect(FIELD_L - 4, TOP - 4, FIELD_R - FIELD_L + 8, 4);
  };

  const drawTimer = () => {
    const y = 8;
    const h = 6;
    const w = FIELD_R - FIELD_L;
    ctx.fillStyle = colors.timerTrack;
    ctx.fillRect(FIELD_L, y, w, h);
    const total = descentFor(level);
    const frac = Math.max(0, Math.min(1, descentMs / total));
    const warn = descentMs <= 2000;
    const color = warn ? colors.timerWarn : colors.timerBar;
    glow(color, 0.6);
    ctx.fillStyle = color;
    ctx.fillRect(FIELD_L, y, px(w * frac), h);
    noGlow();
  };

  const drawDanger = () => {
    const low = lowestRow();
    const near = low >= 0 && rowTop(low) + BH + 2 * BH > DANGER_Y;
    const flashing = breachMs > 0 && Math.floor(breachMs / 100) % 2 === 0;
    const color = near || flashing ? colors.dangerAlert : colors.danger;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    glow(color, 0.8);
    ctx.beginPath();
    ctx.moveTo(FIELD_L, DANGER_Y + 0.5);
    ctx.lineTo(FIELD_R, DANGER_Y + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    noGlow();
  };

  const drawWall = () => {
    for (let r = 0; r < TOTAL_ROWS; r++) {
      if (!isVisible(r)) continue;
      for (let c = 0; c < COLS; c++) {
        const k = at(c, r);
        if (k >= 0) drawBlock(FIELD_L + c * BW, rowTop(r), colors.blocks[k]);
      }
    }
  };

  const drawSparks = () => {
    for (const s of sparks) {
      const a = s.t / SPARK_MS;
      const color = s.color < 0 ? colors.spark : colors.blocks[s.color].fill;
      ctx.strokeStyle = colors.pixel ? color : withAlpha(color, a);
      ctx.lineWidth = 2;
      const grow = (1 - a) * 6;
      if (colors.pixel && a < 0.5) continue; // sin alfa: el destello se corta a la mitad
      glow(color);
      ctx.strokeRect(px(s.x + 2 - grow), px(s.y + 2 - grow), px(s.w - 4 + grow * 2), px(s.h - 4 + grow * 2));
      noGlow();
    }
  };

  const drawPaddle = () => {
    const x = px(paddleX - PADDLE_W / 2);
    if (colors.outline) {
      ctx.fillStyle = withAlpha(colors.paddle, 0.18);
      ctx.fillRect(x, PADDLE_Y, PADDLE_W, PADDLE_H);
      glow(colors.paddle);
      ctx.strokeStyle = colors.paddle;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, PADDLE_Y + 1, PADDLE_W - 2, PADDLE_H - 2);
      noGlow();
    } else {
      ctx.fillStyle = colors.paddle;
      ctx.fillRect(x, PADDLE_Y, PADDLE_W, PADDLE_H);
      ctx.fillStyle = colors.paddleEdge;
      ctx.fillRect(x, PADDLE_Y + PADDLE_H - 3, PADDLE_W, 3);
    }
    // Indicador de carga: mini bloque con el color (y patrón) de la bola en el centro de la nave.
    const look = colors.blocks[charge];
    const ix = px(paddleX - 18);
    const iy = PADDLE_Y + 3;
    ctx.fillStyle = look.fill;
    glow(look.fill, 0.6);
    ctx.fillRect(ix, iy, 36, 7);
    noGlow();
    if (look.style !== "solid") {
      ctx.fillStyle = look.mark;
      ctx.fillRect(ix + 17, iy + 2, 2, 3);
    }
  };

  const drawBall = () => {
    const look = colors.blocks[charge];
    if (colors.pixel) {
      const x = Math.round(ballX - BALL_R);
      const y = Math.round(ballY - BALL_R);
      ctx.fillStyle = colors.ballCore;
      ctx.fillRect(x, y, BALL_R * 2, BALL_R * 2);
      ctx.fillStyle = look.fill;
      ctx.fillRect(x + 2, y + 2, BALL_R * 2 - 4, BALL_R * 2 - 4);
      if (look.style !== "solid") {
        ctx.fillStyle = look.mark;
        ctx.fillRect(x + BALL_R - 1, y + BALL_R - 1, 2, 2);
      }
      return;
    }
    glow(look.fill, 1.2);
    ctx.fillStyle = look.fill;
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    noGlow();
    ctx.fillStyle = colors.ballCore;
    ctx.beginPath();
    ctx.arc(ballX - 2, ballY - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawLabel = (text: string) => {
    ctx.font = `14px ${colors.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = colors.label;
    glow(colors.label, 0.8);
    ctx.fillText(text, W / 2, 512);
    noGlow();
  };

  const draw = () => {
    ctx.imageSmoothingEnabled = !colors.pixel;
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);
    drawFrame();
    drawTimer();
    drawDanger();
    drawWall();
    drawSparks();
    drawPaddle();
    drawBall();
    if (phase === "serve") drawLabel("ESPACIO PARA LANZAR");
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
    if (!isRunning()) return;
    const relevant = LEFT_KEYS.has(e.code) || RIGHT_KEYS.has(e.code) || LAUNCH_KEYS.has(e.code);
    if (!relevant) return;
    if (CAPTURED_KEYS.has(e.code)) e.preventDefault();
    if (LAUNCH_KEYS.has(e.code)) {
      if (!e.repeat && phase === "serve") launch();
      return;
    }
    keys.add(e.code);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  // La fuente pixel puede cargar después del primer dibujo del rótulo.
  void document.fonts?.ready.then(() => {
    if (!destroyed && rafId === null) draw();
  });

  // ── Inicio ──────────────────────────────────────────────────────────────────
  resetBall();
  draw();
  emitStats();
  startLoop();

  return {
    pause() {
      if (paused || destroyed) return;
      paused = true;
      keys.clear();
      stopLoop();
    },
    resume() {
      if (!paused || destroyed) return;
      paused = false;
      startLoop();
    },
    end() {
      if (phase === "serve" || phase === "playing") phase = "ended";
      keys.clear();
      stopLoop();
      return score;
    },
    setSkin(skin: SkinId) {
      if (destroyed) return;
      colors = getPalette(skin, canvas);
      draw(); // visible aunque el loop esté detenido (pausa o fin)
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      keys.clear();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
};
