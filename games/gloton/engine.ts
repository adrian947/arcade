// Motor de GLOTÓN (SPEC 17), escrito desde cero.
// Mecánica central: laberinto procedural por nivel y espectros con VISIÓN. Los espectros no saben dónde
// está el glotón: patrullan al azar y solo lo persiguen cuando lo ven en línea recta (o lo huelen al lado).
// Si lo pierden de vista van al último punto donde lo vieron. Cada cierto tiempo aparece una píldora en
// un lugar del laberinto; comerla invierte los papeles durante unos segundos. Terminar un nivel sin ser
// visto da un bonus de sigilo.
// Todo el estado mutable vive dentro de la instancia.

import { DEFAULT_SKIN, type GameFactory, type SkinId } from "@/games/types";
import { getPalette, withAlpha } from "@/games/gloton/skins";

const W = 800;
const H = 600;

// ── Constantes ────────────────────────────────────────────────────────────────
const COLS = 25;
const ROWS = 17;
const T = 32; // 25 × 32 = 800; 17 × 32 = 544
const OY = 28; // banda superior: barra de la píldora
const WALL = 1;
const OPEN = 0;

const NEST = { x0: 10, x1: 14, y0: 7, y1: 9 } as const; // sala abierta del nido (inclusive)
const NEST_CENTER = { x: 12, y: 8 } as const;
const SPECTRE_HOMES: readonly (readonly [number, number])[] = [
  [12, 8],
  [10, 8],
  [14, 8],
  [12, 7],
];
const SPECTRE_VISION = [12, 9, 7, 5] as const; // casillas de visión en línea recta
const SPECTRE_RELEASE_MS = [600, 2600, 4600, 6600] as const;
const PLAYER_START = { x: 11, y: 15 } as const;

const START_LIVES = 3;
const DOT_SCORE = 10;
const PILL_SCORE = 50;
const SPECTRE_SCORE = 150; // × número de espectro comido con la misma píldora
const LEVEL_BONUS = 500;
const STEALTH_BONUS = 300;

const SMELL = 1.5; // a esta distancia (casillas) el espectro detecta aunque no haya línea recta
const HIT = 0.7; // distancia de choque en casillas
const READY_MS = 1500;
const DYING_MS = 1100;
const ALERT_MS = 700;
const POPUP_MS = 800;
const PILL_FIRST_MS = 10000;
const PILL_EVERY_MS = 14000;
const PILL_TTL_MS = 8000;
const PILL_MIN_DIST = 8;
const EYES_WAIT_MS = 1000;

const playerSpeedFor = (level: number) => 5.6 * Math.min(1.25, 1 + 0.03 * (level - 1));
const spectreSpeedFor = (level: number) => 4.6 * Math.min(1.45, 1 + 0.06 * (level - 1));
const frightMsFor = (level: number) => Math.max(3000, 6500 - 400 * (level - 1));
const CHASE_BOOST = 1.1;
const FRIGHT_SLOW = 0.55;
const EYES_SPEED = 9;

// Direcciones: 0 derecha, 1 abajo, 2 izquierda, 3 arriba.
type Dir = 0 | 1 | 2 | 3;
const DX = [1, 0, -1, 0] as const;
const DY = [0, 1, 0, -1] as const;
const DIRS: readonly Dir[] = [0, 1, 2, 3];
const opposite = (d: Dir) => ((d + 2) % 4) as Dir;

const KEY_DIRS: Readonly<Record<string, Dir>> = {
  ArrowRight: 0,
  KeyD: 0,
  ArrowDown: 1,
  KeyS: 1,
  ArrowLeft: 2,
  KeyA: 2,
  ArrowUp: 3,
  KeyW: 3,
};
const CAPTURED_KEYS = new Set(["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]);

// PRNG determinista (mulberry32): cada nivel genera siempre el mismo laberinto.
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

const idx = (x: number, y: number) => y * COLS + x;
const inNest = (x: number, y: number) => x >= NEST.x0 && x <= NEST.x1 && y >= NEST.y0 && y <= NEST.y1;

// Laberinto: backtracker sobre los nodos impares, sin callejones sin salida (braid) y con lazos extra.
function buildMaze(level: number): Uint8Array {
  const rnd = rngFor(level * 7919 + 101);
  const grid = new Uint8Array(COLS * ROWS).fill(WALL);
  const NX = (COLS - 1) / 2; // 12
  const NY = (ROWS - 1) / 2; // 8
  const nodeX = (i: number) => 2 * i + 1;
  const nodeY = (j: number) => 2 * j + 1;
  const visited = new Uint8Array(NX * NY);
  const stack: [number, number][] = [[0, NY - 1]];
  visited[(NY - 1) * NX] = 1;
  grid[idx(nodeX(0), nodeY(NY - 1))] = OPEN;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const options = DIRS.filter((d) => {
      const ni = i + DX[d];
      const nj = j + DY[d];
      return ni >= 0 && ni < NX && nj >= 0 && nj < NY && !visited[nj * NX + ni];
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const d = options[Math.floor(rnd() * options.length)];
    const ni = i + DX[d];
    const nj = j + DY[d];
    visited[nj * NX + ni] = 1;
    grid[idx(nodeX(i) + DX[d], nodeY(j) + DY[d])] = OPEN;
    grid[idx(nodeX(ni), nodeY(nj))] = OPEN;
    stack.push([ni, nj]);
  }

  const isOpen = (x: number, y: number) => x >= 0 && x < COLS && y >= 0 && y < ROWS && grid[idx(x, y)] === OPEN;

  // Braid: cada callejón sin salida abre una pared más hacia un nodo vecino.
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const x = nodeX(i);
      const y = nodeY(j);
      const exits = DIRS.filter((d) => isOpen(x + DX[d], y + DY[d])).length;
      if (exits > 1) continue;
      const walls = DIRS.filter((d) => {
        const ni = i + DX[d];
        const nj = j + DY[d];
        return ni >= 0 && ni < NX && nj >= 0 && nj < NY && !isOpen(x + DX[d], y + DY[d]);
      });
      if (walls.length) {
        const d = walls[Math.floor(rnd() * walls.length)];
        grid[idx(x + DX[d], y + DY[d])] = OPEN;
      }
    }
  }

  // Lazos extra: más rutas de escape cuantas más paredes interiores se abren.
  const loops = Math.min(0.14, 0.06 + 0.01 * (level - 1));
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (grid[idx(x, y)] === OPEN || (x % 2 === 1) === (y % 2 === 1)) continue; // solo paredes entre nodos
      if (rnd() < loops) grid[idx(x, y)] = OPEN;
    }
  }

  // Nido: sala abierta en el centro.
  for (let y = NEST.y0; y <= NEST.y1; y++) for (let x = NEST.x0; x <= NEST.x1; x++) grid[idx(x, y)] = OPEN;
  return grid;
}

type Ent = { tx: number; ty: number; dir: Dir | null; t: number }; // casilla base, dirección y avance 0..1

type Spectre = {
  e: Ent;
  mode: "wait" | "normal" | "eyes";
  waitMs: number;
  home: readonly [number, number];
  vision: number;
  frightened: boolean;
  lastSeen: number | null; // índice de casilla donde vio al glotón por última vez
  alertMs: number;
};

type Popup = { x: number; y: number; text: string; t: number };

export const createGloton: GameFactory = (canvas, callbacks, options) => {
  const ctx = canvas.getContext("2d")!;
  let colors = getPalette(options?.skin ?? DEFAULT_SKIN, canvas);

  // ── Estado de la instancia ──────────────────────────────────────────────────
  let level = 1;
  let grid = buildMaze(level);
  let dots = new Uint8Array(COLS * ROWS);
  let dotsLeft = 0;
  let rnd = rngFor(level * 131 + 7);
  const player: Ent = { tx: PLAYER_START.x, ty: PLAYER_START.y, dir: null, t: 0 };
  let desired: Dir | null = null;
  let spectres: Spectre[] = [];
  let pill: { tx: number; ty: number; ttl: number } | null = null;
  let pillSpawnMs = PILL_FIRST_MS;
  let frightMs = 0;
  let chain = 0;
  let detected = false; // algún espectro vio al glotón en este nivel
  let score = 0;
  let lives = START_LIVES;
  let phase: "ready" | "playing" | "dying" | "over" | "ended" = "ready";
  let phaseMs = READY_MS;
  let readyText = "LISTO";
  let mouth = 0; // fase de la animación de la boca
  let clock = 0; // ms acumulados de juego (parpadeos)
  let popups: Popup[] = [];
  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId: number | null = null;
  let emitted = { score: -1, lives: -1, level: -1 };
  let bfsCache = new Map<number, Int16Array>();

  const isRunning = () => !paused && !destroyed && (phase === "ready" || phase === "playing" || phase === "dying");

  const emitStats = () => {
    if (emitted.score === score && emitted.lives === lives && emitted.level === level) return;
    emitted = { score, lives, level };
    callbacks.onStats({ score, lives, level });
  };

  // ── Laberinto ───────────────────────────────────────────────────────────────
  const isOpen = (x: number, y: number) => x >= 0 && x < COLS && y >= 0 && y < ROWS && grid[idx(x, y)] === OPEN;
  const canGo = (e: Ent, d: Dir) => isOpen(e.tx + DX[d], e.ty + DY[d]);

  // Distancia en pasos desde una casilla a todas las demás (cacheada por frame).
  const bfs = (target: number) => {
    const cached = bfsCache.get(target);
    if (cached) return cached;
    const dist = new Int16Array(COLS * ROWS).fill(-1);
    const queue = [target];
    dist[target] = 0;
    for (let q = 0; q < queue.length; q++) {
      const cur = queue[q];
      const x = cur % COLS;
      const y = (cur - x) / COLS;
      for (const d of DIRS) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (!isOpen(nx, ny)) continue;
        const n = idx(nx, ny);
        if (dist[n] >= 0) continue;
        dist[n] = dist[cur] + 1;
        queue.push(n);
      }
    }
    bfsCache.set(target, dist);
    return dist;
  };

  const fillDots = () => {
    dots = new Uint8Array(COLS * ROWS);
    dotsLeft = 0;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[idx(x, y)] !== OPEN || inNest(x, y) || (x === PLAYER_START.x && y === PLAYER_START.y)) continue;
        dots[idx(x, y)] = 1;
        dotsLeft++;
      }
    }
  };

  // Posición continua (en casillas) del centro de una entidad.
  const posOf = (e: Ent): [number, number] => {
    if (e.dir === null) return [e.tx, e.ty];
    return [e.tx + DX[e.dir] * e.t, e.ty + DY[e.dir] * e.t];
  };
  const nearestTile = (e: Ent) => {
    const [x, y] = posOf(e);
    return [Math.round(x), Math.round(y)] as const;
  };

  const reverse = (e: Ent) => {
    if (e.dir === null) return;
    if (e.t === 0 && !canGo(e, opposite(e.dir))) return; // en el centro: no girar contra un muro
    if (e.t > 0) {
      e.tx += DX[e.dir];
      e.ty += DY[e.dir];
      e.t = 1 - e.t;
    }
    e.dir = opposite(e.dir);
  };

  // Avanza una entidad `dist` casillas; `choose` decide en cada centro de casilla (null = se detiene).
  const advance = (e: Ent, dist: number, choose: (e: Ent) => Dir | null, arrive?: (e: Ent) => void) => {
    let guard = 0;
    while (dist > 0 && guard++ < 8) {
      if (e.dir === null) {
        const d = choose(e);
        if (d === null) return;
        e.dir = d;
        e.t = 0;
      }
      const remain = 1 - e.t;
      if (dist < remain) {
        e.t += dist;
        return;
      }
      dist -= remain;
      e.tx += DX[e.dir];
      e.ty += DY[e.dir];
      e.t = 0;
      arrive?.(e);
      const d = choose(e);
      e.dir = d;
      if (d === null) return;
    }
  };

  // ── Glotón ──────────────────────────────────────────────────────────────────
  const choosePlayer = (e: Ent): Dir | null => {
    if (desired !== null && canGo(e, desired)) return desired;
    if (e.dir !== null && canGo(e, e.dir)) return e.dir;
    return null;
  };

  const eatAt = (x: number, y: number) => {
    const i = idx(x, y);
    if (!dots[i]) return;
    dots[i] = 0;
    dotsLeft--;
    score += DOT_SCORE;
  };

  // ── Espectros ───────────────────────────────────────────────────────────────
  const resetSpectres = () => {
    spectres = SPECTRE_HOMES.map((home, i) => ({
      e: { tx: home[0], ty: home[1], dir: null, t: 0 },
      mode: "wait",
      waitMs: SPECTRE_RELEASE_MS[i],
      home,
      vision: SPECTRE_VISION[i],
      frightened: false,
      lastSeen: null,
      alertMs: 0,
    }));
  };

  const exitsOf = (e: Ent) => {
    const all = DIRS.filter((d) => canGo(e, d));
    if (e.dir === null) return all;
    const back = opposite(e.dir);
    const forward = all.filter((d) => d !== back);
    return forward.length ? forward : all;
  };

  const pickBy = (e: Ent, opts: Dir[], field: Int16Array, sign: 1 | -1) => {
    let best: Dir[] = [];
    let bestV = Infinity;
    for (const d of opts) {
      const v = field[idx(e.tx + DX[d], e.ty + DY[d])] * sign;
      if (v < bestV) {
        bestV = v;
        best = [d];
      } else if (v === bestV) best.push(d);
    }
    return best[Math.floor(rnd() * best.length)] ?? null;
  };

  const chooseSpectre = (s: Spectre) => (e: Ent): Dir | null => {
    if (s.mode === "wait") return null;
    const opts = exitsOf(e);
    if (!opts.length) return null;
    if (s.mode === "eyes") return pickBy(e, opts, bfs(idx(NEST_CENTER.x, NEST_CENTER.y)), 1);
    if (s.frightened) {
      const [px, py] = nearestTile(player);
      return pickBy(e, opts, bfs(idx(px, py)), -1);
    }
    if (s.lastSeen !== null) {
      if (idx(e.tx, e.ty) === s.lastSeen) s.lastSeen = null; // llegó y no lo ve: vuelve a patrullar
      else return pickBy(e, opts, bfs(s.lastSeen), 1);
    }
    // Patrulla: tiende a seguir recto, si no gira al azar.
    if (e.dir !== null && opts.includes(e.dir) && rnd() < 0.6) return e.dir;
    return opts[Math.floor(rnd() * opts.length)];
  };

  const arriveSpectre = (s: Spectre) => (e: Ent) => {
    if (s.mode === "eyes" && e.tx === NEST_CENTER.x && e.ty === NEST_CENTER.y) {
      s.mode = "wait";
      s.waitMs = EYES_WAIT_MS;
      e.dir = null;
    }
  };

  // ¿El espectro ve al glotón? Línea recta sin muros dentro de su alcance, o muy cerca (olfato).
  const sees = (s: Spectre) => {
    const [sx, sy] = posOf(s.e);
    const [px, py] = posOf(player);
    if (Math.hypot(sx - px, sy - py) <= SMELL) return true;
    const [ax, ay] = nearestTile(s.e);
    const [bx, by] = nearestTile(player);
    if (ax !== bx && ay !== by) return false;
    const steps = Math.abs(ax - bx) + Math.abs(ay - by);
    if (steps > s.vision) return false;
    const stepX = Math.sign(bx - ax);
    const stepY = Math.sign(by - ay);
    for (let k = 1; k < steps; k++) if (!isOpen(ax + stepX * k, ay + stepY * k)) return false;
    return true;
  };

  // ── Píldora ─────────────────────────────────────────────────────────────────
  const spawnPill = () => {
    const [px, py] = nearestTile(player);
    const dist = bfs(idx(px, py));
    const candidates: number[] = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      const x = i % COLS;
      const y = (i - x) / COLS;
      if (grid[i] === OPEN && !inNest(x, y) && dist[i] >= PILL_MIN_DIST) candidates.push(i);
    }
    if (!candidates.length) return;
    const i = candidates[Math.floor(rnd() * candidates.length)];
    pill = { tx: i % COLS, ty: Math.floor(i / COLS), ttl: PILL_TTL_MS };
  };

  const eatPill = () => {
    pill = null;
    pillSpawnMs = PILL_EVERY_MS;
    score += PILL_SCORE;
    frightMs = frightMsFor(level);
    chain = 0;
    for (const s of spectres) {
      if (s.mode !== "normal") continue;
      s.frightened = true;
      s.lastSeen = null;
      reverse(s.e);
    }
  };

  // ── Ciclo de vida ───────────────────────────────────────────────────────────
  const resetActors = () => {
    player.tx = PLAYER_START.x;
    player.ty = PLAYER_START.y;
    player.dir = null;
    player.t = 0;
    desired = null;
    resetSpectres();
    pill = null;
    pillSpawnMs = PILL_FIRST_MS;
    frightMs = 0;
    chain = 0;
    popups = [];
    mouth = 0;
  };

  const startLevel = () => {
    grid = buildMaze(level);
    rnd = rngFor(level * 131 + 7);
    bfsCache = new Map();
    fillDots();
    detected = false;
    resetActors();
    phase = "ready";
    phaseMs = READY_MS;
  };

  const levelComplete = () => {
    let bonus = LEVEL_BONUS * level;
    readyText = `NIVEL ${level + 1}`;
    if (!detected) {
      bonus += STEALTH_BONUS * level;
      readyText = `SIGILO +${STEALTH_BONUS * level}`;
    }
    score += bonus;
    level += 1;
    startLevel();
    emitStats();
  };

  const loseLife = () => {
    lives -= 1;
    if (lives <= 0) {
      lives = 0;
      phase = "over";
    } else {
      resetActors();
      readyText = "LISTO";
      phase = "ready";
      phaseMs = READY_MS;
    }
    emitStats();
  };

  // ── Actualización ───────────────────────────────────────────────────────────
  const update = (dt: number) => {
    clock += dt;
    bfsCache = new Map();
    popups = popups.filter((p) => (p.t -= dt) > 0);

    if (phase === "ready") {
      phaseMs -= dt;
      if (phaseMs <= 0) phase = "playing";
      return;
    }
    if (phase === "dying") {
      phaseMs -= dt;
      if (phaseMs <= 0) loseLife();
      return;
    }

    const sec = dt / 1000;

    // Glotón: giro inmediato hacia atrás a mitad de casilla.
    if (desired !== null && player.dir !== null && desired === opposite(player.dir)) reverse(player);
    const [bx, by] = posOf(player);
    advance(player, playerSpeedFor(level) * sec, choosePlayer, (e) => eatAt(e.tx, e.ty));
    const [ax, ay] = posOf(player);
    if (ax !== bx || ay !== by) mouth += dt; // la boca solo se mueve mientras avanza

    // Píldora.
    if (pill) {
      pill.ttl -= dt;
      if (pill.ttl <= 0) {
        pill = null;
        pillSpawnMs = PILL_EVERY_MS;
      }
    } else if (frightMs <= 0) {
      pillSpawnMs -= dt;
      if (pillSpawnMs <= 0) spawnPill();
    }
    if (pill) {
      const [px, py] = posOf(player);
      if (Math.hypot(px - pill.tx, py - pill.ty) < 0.5) eatPill();
    }

    // Susto.
    if (frightMs > 0) {
      frightMs -= dt;
      if (frightMs <= 0) {
        frightMs = 0;
        for (const s of spectres) s.frightened = false;
      }
    }

    // Espectros.
    const base = spectreSpeedFor(level);
    for (const s of spectres) {
      s.alertMs = Math.max(0, s.alertMs - dt);
      if (s.mode === "wait") {
        s.waitMs -= dt;
        if (s.waitMs <= 0) s.mode = "normal";
        else continue;
      }
      if (s.mode === "normal" && !s.frightened && sees(s)) {
        if (s.lastSeen === null) s.alertMs = ALERT_MS;
        const [px, py] = nearestTile(player);
        s.lastSeen = idx(px, py);
        detected = true;
      }
      const speed =
        s.mode === "eyes"
          ? EYES_SPEED
          : s.frightened
            ? base * FRIGHT_SLOW
            : s.lastSeen !== null
              ? base * CHASE_BOOST
              : base;
      advance(s.e, speed * sec, chooseSpectre(s), arriveSpectre(s));
    }

    // Choques.
    const [px, py] = posOf(player);
    for (const s of spectres) {
      if (s.mode === "eyes") continue;
      const [sx, sy] = posOf(s.e);
      if (Math.hypot(sx - px, sy - py) >= HIT) continue;
      if (s.frightened) {
        s.frightened = false;
        s.mode = "eyes";
        s.lastSeen = null;
        chain += 1;
        const pts = SPECTRE_SCORE * chain;
        score += pts;
        popups.push({ x: sx, y: sy, text: String(pts), t: POPUP_MS });
      } else {
        phase = "dying";
        phaseMs = DYING_MS;
        break;
      }
    }

    if (phase === "playing" && dotsLeft <= 0) levelComplete();
    emitStats();
  };

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  const px = (v: number) => (colors.pixel ? Math.round(v) : v);
  const cx = (x: number) => px(x * T + T / 2);
  const cy = (y: number) => px(OY + y * T + T / 2);

  const glow = (color: string, k = 1) => {
    if (!colors.glow) return;
    ctx.shadowColor = color;
    ctx.shadowBlur = colors.glow * k;
  };
  const noGlow = () => {
    ctx.shadowBlur = 0;
  };

  const drawTimer = () => {
    const x = 40;
    const w = W - 80;
    const y = 10;
    ctx.fillStyle = colors.timerTrack;
    ctx.fillRect(x, y, w, 8);
    let ratio = 0;
    if (frightMs > 0) ratio = frightMs / frightMsFor(level);
    else if (pill) ratio = pill.ttl / PILL_TTL_MS;
    if (ratio <= 0) return;
    glow(colors.timerBar, 0.6);
    ctx.fillStyle = colors.timerBar;
    ctx.fillRect(x, y, px(w * ratio), 8);
    noGlow();
  };

  const drawWalls = () => {
    ctx.fillStyle = colors.wallFill;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) if (grid[idx(x, y)] === WALL) ctx.fillRect(x * T, OY + y * T, T, T);
    }
    glow(colors.wallEdge, 0.6);
    ctx.strokeStyle = colors.wallEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[idx(x, y)] !== WALL) continue;
        const l = x * T;
        const t = OY + y * T;
        if (isOpen(x, y - 1)) {
          ctx.moveTo(l, t + 1);
          ctx.lineTo(l + T, t + 1);
        }
        if (isOpen(x, y + 1)) {
          ctx.moveTo(l, t + T - 1);
          ctx.lineTo(l + T, t + T - 1);
        }
        if (isOpen(x - 1, y)) {
          ctx.moveTo(l + 1, t);
          ctx.lineTo(l + 1, t + T);
        }
        if (isOpen(x + 1, y)) {
          ctx.moveTo(l + T - 1, t);
          ctx.lineTo(l + T - 1, t + T);
        }
      }
    }
    ctx.stroke();
    noGlow();
    // Marco del nido.
    ctx.strokeStyle = colors.nestGate;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(NEST.x0 * T + 3, OY + NEST.y0 * T + 3, (NEST.x1 - NEST.x0 + 1) * T - 6, (NEST.y1 - NEST.y0 + 1) * T - 6);
    ctx.setLineDash([]);
  };

  const drawDots = () => {
    ctx.fillStyle = colors.dot;
    for (let i = 0; i < COLS * ROWS; i++) {
      if (!dots[i]) continue;
      const x = i % COLS;
      const y = (i - x) / COLS;
      if (colors.pixel) ctx.fillRect(cx(x) - 2, cy(y) - 2, 4, 4);
      else {
        ctx.beginPath();
        ctx.arc(cx(x), cy(y), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const drawPill = () => {
    if (!pill) return;
    if (pill.ttl < 2000 && Math.floor(clock / 150) % 2 === 0) return; // parpadea antes de desaparecer
    const r = 8 + Math.sin(clock / 120) * (colors.pixel ? 0 : 1.5);
    glow(colors.pill, 1.2);
    ctx.fillStyle = colors.pill;
    if (colors.pixel) ctx.fillRect(cx(pill.tx) - 8, cy(pill.ty) - 8, 16, 16);
    else {
      ctx.beginPath();
      ctx.arc(cx(pill.tx), cy(pill.ty), r, 0, Math.PI * 2);
      ctx.fill();
    }
    noGlow();
  };

  const drawPlayer = () => {
    const [x, y] = posOf(player);
    const X = cx(x);
    const Y = cy(y);
    const R = 13;
    const facing = player.dir ?? desired ?? 0;
    const angle = (facing * Math.PI) / 2;
    let open = 0.08 + 0.32 * Math.abs(Math.sin(mouth / 70));
    let radius = R;
    if (phase === "dying") {
      const k = 1 - phaseMs / DYING_MS;
      open = 0.4 + 0.6 * k;
      radius = R * (1 - 0.3 * k);
    }
    const a = open * Math.PI;
    ctx.beginPath();
    ctx.moveTo(X, Y);
    ctx.arc(X, Y, radius, angle + a / 2, angle + Math.PI * 2 - a / 2);
    ctx.closePath();
    if (colors.outline) {
      ctx.fillStyle = withAlpha(colors.player, 0.2);
      ctx.fill();
      glow(colors.player);
      ctx.strokeStyle = colors.player;
      ctx.lineWidth = 2;
      ctx.stroke();
      noGlow();
    } else {
      ctx.fillStyle = colors.player;
      ctx.fill();
    }
    if (phase === "dying" && open > 0.9) return;
    // Ojo: perpendicular a la boca, del lado "de arriba".
    const ex = X + Math.cos(angle - Math.PI / 2.6) * 7;
    const ey = Y + Math.sin(angle - Math.PI / 2.6) * 7;
    ctx.fillStyle = colors.outline ? colors.player : colors.playerEye;
    ctx.fillRect(px(ex - 1.5), px(ey - 1.5), 3, 3);
  };

  const drawEyes = (X: number, Y: number, dir: Dir | null, pupil: string) => {
    const lx = dir === null ? 0 : DX[dir] * 2;
    const ly = dir === null ? 0 : DY[dir] * 2;
    for (const side of [-1, 1]) {
      ctx.fillStyle = colors.eyeWhite;
      ctx.fillRect(px(X + side * 5 - 3), px(Y - 5), 6, 6);
      ctx.fillStyle = pupil;
      ctx.fillRect(px(X + side * 5 - 1 + lx), px(Y - 3 + ly), 2, 2);
    }
  };

  const drawSpectres = () => {
    const ending = frightMs > 0 && frightMs < 1500 && Math.floor(clock / 160) % 2 === 0;
    spectres.forEach((s, i) => {
      const [x, y] = posOf(s.e);
      const X = cx(x);
      const Y = cy(y);
      if (s.mode === "eyes") {
        drawEyes(X, Y, s.e.dir, colors.pupil);
        return;
      }
      const color = s.frightened ? (ending ? colors.frightenedBlink : colors.frightened) : colors.spectres[i];
      const R = 13;
      // Rombo cristalino con una "cola" inferior en dientes.
      ctx.beginPath();
      ctx.moveTo(X, Y - R);
      ctx.lineTo(X + R, Y);
      ctx.lineTo(X + R * 0.5, Y + R);
      ctx.lineTo(X, Y + R * 0.6);
      ctx.lineTo(X - R * 0.5, Y + R);
      ctx.lineTo(X - R, Y);
      ctx.closePath();
      const hollow = s.frightened && colors.hollowFrightened;
      if (colors.outline || hollow) {
        if (!hollow) {
          ctx.fillStyle = withAlpha(color, 0.2);
          ctx.fill();
        }
        glow(color);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        noGlow();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
      }
      if (s.frightened) {
        // Boca temblorosa en vez de ojos que miran.
        ctx.fillStyle = colors.eyeWhite;
        ctx.fillRect(px(X - 5), px(Y - 4), 3, 3);
        ctx.fillRect(px(X + 2), px(Y - 4), 3, 3);
        ctx.fillRect(px(X - 6), px(Y + 3), 12, 2);
      } else {
        drawEyes(X, Y, s.e.dir, s.lastSeen !== null ? colors.alert : colors.pupil);
      }
      if (s.alertMs > 0) {
        ctx.font = `14px ${colors.font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = colors.alert;
        glow(colors.alert);
        ctx.fillText("!", X, Y - R - 2);
        noGlow();
      }
    });
  };

  const drawPopups = () => {
    ctx.font = `10px ${colors.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const p of popups) {
      ctx.fillStyle = colors.popup;
      ctx.fillText(p.text, cx(p.x), cy(p.y) - (1 - p.t / POPUP_MS) * 16);
    }
  };

  const drawLabel = (text: string) => {
    ctx.font = `14px ${colors.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = ctx.measureText(text).width + 24;
    const y = cy(NEST.y1 + 2);
    ctx.fillStyle = colors.labelBg;
    ctx.fillRect(px(W / 2 - w / 2), y - 14, px(w), 28);
    ctx.fillStyle = colors.label;
    glow(colors.label, 0.8);
    ctx.fillText(text, W / 2, y + 1);
    noGlow();
  };

  const draw = () => {
    ctx.imageSmoothingEnabled = !colors.pixel;
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);
    drawTimer();
    drawWalls();
    drawDots();
    drawPill();
    if (phase !== "dying") drawSpectres();
    drawPlayer();
    drawPopups();
    if (phase === "ready") drawLabel(readyText);
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
  // Por pulsación: la dirección queda en cola hasta que se pueda girar (no hace falta mantener).
  const onKeyDown = (e: KeyboardEvent) => {
    if (!isRunning()) return;
    const d = KEY_DIRS[e.code];
    if (d === undefined) return;
    if (CAPTURED_KEYS.has(e.code)) e.preventDefault();
    desired = d;
  };

  window.addEventListener("keydown", onKeyDown);
  // La fuente pixel puede cargar después del primer dibujo del rótulo.
  void document.fonts?.ready.then(() => {
    if (!destroyed && rafId === null) draw();
  });

  // ── Inicio ──────────────────────────────────────────────────────────────────
  startLevel();
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
      if (phase !== "over") phase = "ended";
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
      window.removeEventListener("keydown", onKeyDown);
    },
  };
};
