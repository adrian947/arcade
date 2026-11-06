// Motor de DUELO PIXEL (SPEC 20), escrito desde cero.
// Duelo de dos paletas verticales con dos mecánicas propias:
//  - Efecto: la velocidad vertical de la paleta al golpear le da "efecto" a la bola, que curva su
//    trayectoria durante el vuelo (aceleración vertical que se disipa).
//  - Remate: pulsar la tecla de remate abre una ventana corta; si la bola toca la paleta dentro de ella,
//    sale un 35 % más rápida y, si el rival falla, el punto vale doble.
// Modo solitario: una escalera de duelos contra la CPU (a 5 puntos), con 3 vidas.
// Modo 2 jugadores: exhibición local a 7 puntos que no puntúa en el ranking.
// Todo el estado mutable vive dentro de la instancia.

import { DEFAULT_SKIN, type GameFactory, type SkinId } from "@/games/types";
import { getPalette, withAlpha, type PaddleLook } from "@/games/duelo-pixel/skins";

const W = 800;
const H = 600;

// ── Constantes ────────────────────────────────────────────────────────────────
const TOP = 72; // borde superior del campo (encima va el marcador)
const BOTTOM = 584;
const WALL_H = 6;
const PADDLE_W = 12;
const PADDLE_H = 84;
const LEFT_X = 36; // borde izquierdo de la paleta izquierda
const RIGHT_X = W - 36 - PADDLE_W;
const PADDLE_SPEED = 520; // px/s
const BALL = 10; // lado de la bola (cuadrada)
const R = BALL / 2;
const MAX_ANGLE = (50 * Math.PI) / 180;
const MAX_VY = 720;

const SPIN_MAX = 950; // px/s² de curva con la paleta a velocidad máxima
const SPIN_DECAY = 0.7; // fracción de efecto que se disipa por segundo

const SMASH_WINDOW = 170; // ms
const SMASH_COOLDOWN = 600; // ms
const SMASH_BOOST = 1.35;
const SMASH_PUSH = 6; // px que la paleta avanza durante la ventana (solo visual)

const SOLO_POINTS = 5; // puntos para ganar un duelo contra la CPU
const VERSUS_POINTS = 7; // puntos para ganar la exhibición a dos jugadores
const START_LIVES = 3;
const POINT_SCORE = 100;
const RALLY_SCORE = 10;
const RALLY_CAP = 20;
const DUEL_BONUS = 500;
const MARGIN_BONUS = 100;

const SERVE_MS = 900;
const DUEL_PAUSE_MS = 1800;
const TRAIL = 6;

const baseSpeedFor = (level: number) => 340 * Math.min(1.5, 1 + 0.05 * (level - 1));
const rallySpeed = (level: number, hits: number) => baseSpeedFor(level) * Math.min(1.6, 1 + 0.04 * hits);
const cpuSpeedFor = (level: number) => Math.min(520, 250 + 30 * (level - 1));
const cpuErrorFor = (level: number) => Math.max(8, 56 - 6 * (level - 1));
const cpuReactFor = (level: number) => Math.max(50, 220 - 18 * (level - 1));
const cpuSmashChance = (level: number) => (level < 3 ? 0 : Math.min(0.4, 0.15 + 0.05 * (level - 3)));

const SOLO_UP = new Set(["ArrowUp", "KeyW"]);
const SOLO_DOWN = new Set(["ArrowDown", "KeyS"]);
const SOLO_SMASH = new Set(["Space", "KeyD"]);
const CAPTURED_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

// PRNG determinista (mulberry32): la CPU de cada nivel se comporta igual para todos los jugadores.
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

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Side = 0 | 1; // 0 = izquierda (jugador / J1), 1 = derecha (CPU / J2)

type Paddle = {
  y: number; // centro
  vel: number; // px/s del último frame (para el efecto)
  smashMs: number; // ventana de remate restante
  coolMs: number; // enfriamiento del remate
  points: number;
};

export const createDueloPixel: GameFactory = (canvas, callbacks, options) => {
  const ctx = canvas.getContext("2d")!;
  let colors = getPalette(options?.skin ?? DEFAULT_SKIN, canvas);

  // ── Estado de la instancia ──────────────────────────────────────────────────
  let mode: "solo" | "versus" = "solo";
  let phase: "menu" | "serve" | "playing" | "over" | "ended" = "menu";
  let level = 1;
  let score = 0;
  let lives = START_LIVES;
  let rng = rngFor(level * 7919 + 3);
  const mid = (TOP + BOTTOM) / 2;
  const paddles: [Paddle, Paddle] = [
    { y: mid, vel: 0, smashMs: 0, coolMs: 0, points: 0 },
    { y: mid, vel: 0, smashMs: 0, coolMs: 0, points: 0 },
  ];
  let ballX = W / 2;
  let ballY = mid;
  let vx = 0;
  let vy = 0;
  let spin = 0;
  let smashed = false; // la bola viaja rematada
  let lastHitter: Side | null = null;
  let lastSmashBy: Side | null = null;
  let rallyHits = 0;
  let serveMs = 0;
  let serveDir: -1 | 1 = -1; // la primera bola va hacia el jugador
  let banner = ""; // rótulo central durante el saque
  const trail: { x: number; y: number }[] = [];
  // CPU
  let cpuTracking = false;
  let cpuReactMs = 0;
  let cpuError = 0;
  let cpuWillSmash = false;

  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId: number | null = null;
  const keys = new Set<string>();
  let emitted = { score: -1, lives: -1, level: -1 };

  const isRunning = () => !paused && !destroyed && (phase === "menu" || phase === "serve" || phase === "playing");

  const emitStats = () => {
    if (emitted.score === score && emitted.lives === lives && emitted.level === level) return;
    emitted = { score, lives, level };
    callbacks.onStats({ score, lives, level });
  };

  // ── Saque y puntos ──────────────────────────────────────────────────────────
  const prepareServe = (dir: -1 | 1, wait: number, text: string) => {
    phase = "serve";
    serveDir = dir;
    serveMs = wait;
    banner = text;
    ballX = W / 2;
    ballY = mid;
    vx = 0;
    vy = 0;
    spin = 0;
    smashed = false;
    lastHitter = null;
    lastSmashBy = null;
    rallyHits = 0;
    trail.length = 0;
    cpuTracking = false;
  };

  const launch = () => {
    phase = "playing";
    banner = "";
    const angle = (rng() * 2 - 1) * ((25 * Math.PI) / 180);
    const speed = baseSpeedFor(level);
    vx = serveDir * speed * Math.cos(angle);
    vy = speed * Math.sin(angle);
  };

  const startMatch = (m: "solo" | "versus") => {
    mode = m;
    paddles[0].points = 0;
    paddles[1].points = 0;
    prepareServe(-1, SERVE_MS, m === "solo" ? "RIVAL 1" : "J1 VS J2");
  };

  const awardPoint = (winner: Side) => {
    const w = paddles[winner];
    const loserSide: Side = winner === 0 ? 1 : 0;
    w.points++;
    const loserDir: -1 | 1 = loserSide === 0 ? -1 : 1;

    if (mode === "versus") {
      if (w.points >= VERSUS_POINTS) {
        phase = "over";
        banner = winner === 0 ? "GANA J1" : "GANA J2";
        return;
      }
      prepareServe(loserDir, SERVE_MS, "");
      return;
    }

    // Solitario: solo puntúan los puntos del jugador.
    if (winner === 0) {
      const base = POINT_SCORE * level + RALLY_SCORE * Math.min(rallyHits, RALLY_CAP);
      score += lastSmashBy === 0 && lastHitter === 0 ? base * 2 : base;
    }

    if (w.points < SOLO_POINTS) {
      prepareServe(loserDir, SERVE_MS, "");
      emitStats();
      return;
    }

    if (winner === 0) {
      // Duelo ganado: bono, siguiente rival.
      score += DUEL_BONUS * level + MARGIN_BONUS * (SOLO_POINTS - paddles[1].points);
      level++;
      rng = rngFor(level * 7919 + 3);
      paddles[0].points = 0;
      paddles[1].points = 0;
      prepareServe(-1, DUEL_PAUSE_MS, `RIVAL ${level}`);
    } else {
      lives--;
      if (lives <= 0) {
        phase = "over";
        banner = "";
      } else {
        rng = rngFor(level * 7919 + 3); // la revancha repite el mismo rival
        paddles[0].points = 0;
        paddles[1].points = 0;
        prepareServe(-1, DUEL_PAUSE_MS, "REVANCHA");
      }
    }
    emitStats();
  };

  // ── Paletas ─────────────────────────────────────────────────────────────────
  const movePaddle = (p: Paddle, dir: number, speed: number, dt: number) => {
    const prev = p.y;
    p.y = clamp(p.y + dir * speed * (dt / 1000), TOP + PADDLE_H / 2, BOTTOM - PADDLE_H / 2);
    p.vel = dt > 0 ? (p.y - prev) / (dt / 1000) : 0;
  };

  const trySmash = (side: Side) => {
    const p = paddles[side];
    if (p.coolMs > 0 || phase === "menu") return;
    p.smashMs = SMASH_WINDOW;
    p.coolMs = SMASH_COOLDOWN;
  };

  const heldDir = (up: Set<string> | string, down: Set<string> | string) => {
    const has = (k: Set<string> | string) => (typeof k === "string" ? keys.has(k) : [...k].some((c) => keys.has(c)));
    return (has(down) ? 1 : 0) - (has(up) ? 1 : 0);
  };

  // y de la bola al llegar a x (rebotes en las bandas, sin contar el efecto).
  const predictY = (x: number) => {
    if (vx === 0) return ballY;
    const t = (x - ballX) / vx;
    if (t < 0) return mid;
    const lo = TOP + R;
    const span = BOTTOM - R - lo;
    let y = ballY + vy * t - lo;
    const period = span * 2;
    y = ((y % period) + period) % period;
    if (y > span) y = period - y;
    return y + lo;
  };

  const updateCpu = (dt: number) => {
    const p = paddles[1];
    const towards = phase === "playing" && vx > 0;
    if (towards && !cpuTracking) {
      cpuTracking = true;
      cpuReactMs = cpuReactFor(level);
      cpuError = (rng() * 2 - 1) * cpuErrorFor(level);
      cpuWillSmash = rng() < cpuSmashChance(level);
    } else if (!towards) {
      cpuTracking = false;
    }
    let target = mid;
    if (cpuTracking) {
      cpuReactMs -= dt;
      target = cpuReactMs > 0 ? p.y : predictY(RIGHT_X - R) + cpuError;
      if (cpuWillSmash && RIGHT_X - ballX < 70 && Math.abs(ballY - p.y) < PADDLE_H / 2 + 20) {
        trySmash(1);
        cpuWillSmash = false;
      }
    }
    const diff = target - p.y;
    movePaddle(p, Math.abs(diff) < 4 ? 0 : Math.sign(diff), Math.min(cpuSpeedFor(level), Math.abs(diff) * 12), dt);
  };

  // ── Bola ────────────────────────────────────────────────────────────────────
  const hitPaddle = (side: Side) => {
    const p = paddles[side];
    rallyHits++;
    const rel = clamp((ballY - p.y) / (PADDLE_H / 2 + R), -1, 1);
    const angle = rel * MAX_ANGLE;
    const isSmash = p.smashMs > 0;
    const speed = rallySpeed(level, rallyHits) * (isSmash ? SMASH_BOOST : 1);
    const dir = side === 0 ? 1 : -1;
    vx = dir * speed * Math.cos(angle);
    vy = speed * Math.sin(angle);
    spin = clamp(p.vel / PADDLE_SPEED, -1, 1) * SPIN_MAX;
    smashed = isSmash;
    lastHitter = side;
    lastSmashBy = isSmash ? side : null;
    if (isSmash) p.smashMs = 0;
  };

  const stepBall = (dt: number) => {
    const s = dt / 1000;
    vy = clamp(vy + spin * s, -MAX_VY, MAX_VY);
    spin -= spin * Math.min(1, SPIN_DECAY * s);
    const dist = Math.hypot(vx, vy) * s;
    const steps = Math.max(1, Math.ceil(dist / 4));
    const sx = (vx * s) / steps;
    for (let i = 0; i < steps; i++) {
      ballX += sx;
      ballY += (vy * s) / steps;
      // Bandas superior e inferior.
      if (ballY - R < TOP) {
        ballY = TOP + R;
        vy = Math.abs(vy);
        spin *= -0.5;
      } else if (ballY + R > BOTTOM) {
        ballY = BOTTOM - R;
        vy = -Math.abs(vy);
        spin *= -0.5;
      }
      // Paletas: solo si la bola va hacia ellas y cruza su cara.
      const reach = PADDLE_H / 2 + R;
      if (vx < 0 && ballX - R <= LEFT_X + PADDLE_W && ballX - R >= LEFT_X - 6 && Math.abs(ballY - paddles[0].y) <= reach) {
        ballX = LEFT_X + PADDLE_W + R;
        hitPaddle(0);
        return;
      }
      if (vx > 0 && ballX + R >= RIGHT_X && ballX + R <= RIGHT_X + PADDLE_W + 6 && Math.abs(ballY - paddles[1].y) <= reach) {
        ballX = RIGHT_X - R;
        hitPaddle(1);
        return;
      }
    }
    if (ballX < -BALL) awardPoint(1);
    else if (ballX > W + BALL) awardPoint(0);
  };

  // ── Update ──────────────────────────────────────────────────────────────────
  const update = (dt: number) => {
    for (const p of paddles) {
      p.smashMs = Math.max(0, p.smashMs - dt);
      p.coolMs = Math.max(0, p.coolMs - dt);
    }
    if (phase === "menu") return;

    if (mode === "solo") {
      movePaddle(paddles[0], heldDir(SOLO_UP, SOLO_DOWN), PADDLE_SPEED, dt);
      updateCpu(dt);
    } else {
      movePaddle(paddles[0], heldDir("KeyW", "KeyS"), PADDLE_SPEED, dt);
      movePaddle(paddles[1], heldDir("ArrowUp", "ArrowDown"), PADDLE_SPEED, dt);
    }

    if (phase === "serve") {
      serveMs -= dt;
      if (serveMs <= 0) launch();
      return;
    }
    if (phase !== "playing") return;
    trail.push({ x: ballX, y: ballY });
    if (trail.length > TRAIL) trail.shift();
    stepBall(dt);
  };

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  const glow = (color: string, k = 1) => {
    if (colors.glow <= 0) return;
    ctx.shadowColor = color;
    ctx.shadowBlur = colors.glow * k;
  };
  const noGlow = () => {
    ctx.shadowBlur = 0;
  };
  const px = (v: number) => (colors.pixel ? Math.round(v) : v);

  const drawField = () => {
    ctx.fillStyle = colors.wall;
    glow(colors.wall, 0.6);
    ctx.fillRect(0, TOP - WALL_H, W, WALL_H);
    ctx.fillRect(0, BOTTOM, W, WALL_H);
    noGlow();
    // Red central: segmentos de píxel.
    ctx.fillStyle = colors.net;
    glow(colors.net, 0.5);
    for (let y = TOP + 6; y < BOTTOM - 6; y += 24) ctx.fillRect(W / 2 - 3, y, 6, 12);
    noGlow();
  };

  const drawMarker = () => {
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = `36px ${colors.font}`;
    ctx.fillStyle = colors.marker;
    glow(colors.marker, 0.8);
    ctx.fillText(String(paddles[0].points), W / 2 - 80, 34);
    ctx.fillText(String(paddles[1].points), W / 2 + 80, 34);
    noGlow();
    ctx.font = `10px ${colors.font}`;
    ctx.fillStyle = colors.markerDim;
    const [l, r] = mode === "versus" ? ["J1", "J2"] : ["TÚ", "CPU"];
    ctx.fillText(l, W / 2 - 180, 34);
    ctx.fillText(r, W / 2 + 180, 34);
  };

  const drawPaddle = (side: Side, look: PaddleLook) => {
    const p = paddles[side];
    const push = p.smashMs > 0 ? SMASH_PUSH * (side === 0 ? 1 : -1) : 0;
    const x = px((side === 0 ? LEFT_X : RIGHT_X) + push);
    const y = px(p.y - PADDLE_H / 2);
    glow(look.fill, p.smashMs > 0 ? 1.6 : 1);
    if (look.hollow || colors.outline) {
      if (colors.outline && !look.hollow) {
        ctx.fillStyle = withAlpha(look.fill, 0.25);
        ctx.fillRect(x, y, PADDLE_W, PADDLE_H);
      }
      ctx.strokeStyle = look.fill;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, PADDLE_W - 3, PADDLE_H - 3);
      if (look.hollow) {
        // Patrón de muescas para distinguirla de la paleta sólida en retro.
        ctx.fillStyle = look.fill;
        for (let k = 12; k < PADDLE_H - 8; k += 14) ctx.fillRect(x + 4, y + k, PADDLE_W - 8, 4);
      }
    } else {
      ctx.fillStyle = look.fill;
      ctx.fillRect(x, y, PADDLE_W, PADDLE_H);
    }
    noGlow();
  };

  const drawBall = () => {
    if (phase === "menu") return;
    ctx.fillStyle = colors.trail;
    for (const t of trail) ctx.fillRect(px(t.x - R + 2), px(t.y - R + 2), BALL - 4, BALL - 4);
    if (phase === "serve" && Math.floor(serveMs / 150) % 2 === 1) return; // parpadeo antes del saque
    const c = smashed ? colors.ballSmash : colors.ball;
    ctx.fillStyle = c;
    glow(c, smashed ? 1.8 : 1.1);
    ctx.fillRect(px(ballX - R), px(ballY - R), BALL, BALL);
    noGlow();
  };

  const drawLabel = (text: string, y: number, size = 14) => {
    ctx.font = `${size}px ${colors.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = colors.label;
    glow(colors.label, 0.8);
    ctx.fillText(text, W / 2, y);
    noGlow();
  };

  const draw = () => {
    ctx.imageSmoothingEnabled = !colors.pixel;
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);
    drawField();
    drawMarker();
    drawPaddle(0, colors.left);
    drawPaddle(1, colors.right);
    drawBall();
    if (phase === "menu") {
      // Fondo opaco detrás de los textos para que la red no los cruce.
      ctx.fillStyle = colors.bg;
      ctx.fillRect(W / 2 - 300, mid - 70, 600, 140);
      drawLabel("ESPACIO · 1 JUGADOR VS CPU", mid - 30);
      drawLabel("TECLA 2 · 2 JUGADORES", mid + 14);
      drawLabel("EXHIBICIÓN · NO PUNTÚA", mid + 40, 10);
    } else if (banner) {
      ctx.fillStyle = colors.bg;
      ctx.fillRect(W / 2 - 140, mid - 104, 280, 32);
      drawLabel(banner, mid - 88);
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
      callbacks.onGameOver(mode === "versus" ? 0 : score);
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
    if (CAPTURED_KEYS.has(e.code)) e.preventDefault();
    if (phase === "menu") {
      if (e.repeat) return;
      if (e.code === "Space" || e.code === "Digit1" || e.code === "Numpad1") startMatch("solo");
      else if (e.code === "Digit2" || e.code === "Numpad2") startMatch("versus");
      return;
    }
    if (!e.repeat) {
      if (mode === "solo" && SOLO_SMASH.has(e.code)) trySmash(0);
      else if (mode === "versus" && e.code === "KeyD") trySmash(0);
      else if (mode === "versus" && e.code === "ArrowLeft") trySmash(1);
    }
    keys.add(e.code);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  // La fuente pixel puede cargar después del primer dibujo de los rótulos.
  void document.fonts?.ready.then(() => {
    if (!destroyed && rafId === null) draw();
  });

  // ── Inicio ──────────────────────────────────────────────────────────────────
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
      if (phase === "menu" || phase === "serve" || phase === "playing") phase = "ended";
      keys.clear();
      stopLoop();
      return mode === "versus" ? 0 : score;
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
