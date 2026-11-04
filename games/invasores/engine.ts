// Motor de INVASORES (SPEC 18), escrito desde cero.
// Mecánicas centrales: (1) munición de chatarra: el cañón tiene un cargador limitado; cada invasor
// destruido suelta un pixel de chatarra que, atrapado, devuelve munición, y un disparo fallado corta la
// racha; (2) la formación ondula dentro del campo y baja de forma continua, con una silueta distinta
// por oleada. Si toca la superficie, aterriza: se pierde una vida.
// Todo el estado mutable vive dentro de la instancia.

import { DEFAULT_SKIN, type GameFactory, type SkinId } from "@/games/types";
import { getPalette, withAlpha } from "@/games/invasores/skins";

const W = 800;
const H = 600;

// ── Campo ─────────────────────────────────────────────────────────────────────
const FIELD_L = 40;
const FIELD_R = 760;
const SURFACE_Y = 528;
const MARGIN = 8; // separación mínima entre la formación y las paredes

// ── Formación ─────────────────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 5;
const CELL_W = 52;
const CELL_H = 36;
const PX = 4; // tamaño de cada pixel del glifo
const INV_W = 8 * PX; // 32
const INV_H = 6 * PX; // 24
const PAD_X = (CELL_W - INV_W) / 2;
const PAD_Y = (CELL_H - INV_H) / 2;
const START_Y = 56;
const RETREAT = 3 * CELL_H; // retroceso tras aterrizar
const OFFSET_SPEED = 240; // px/s máximo del balanceo
const FRAME_MS = 450; // animación de 2 cuadros

// Tipos: 0 acorazado, 1 medusa, 2 dron.
const KIND_HP = [2, 1, 1] as const;
const KIND_POINTS = [40, 20, 10] as const;
const kindOfRow = (r: number) => (r === 0 ? 0 : r <= 2 ? 1 : 2);

// ── Cañón y disparos ──────────────────────────────────────────────────────────
const CANNON_W = 44;
const CANNON_H = 18;
const CANNON_Y = 548; // borde superior (torreta); base en y = 566
const CANNON_SPEED = 400;
const SHOT_W = 4;
const SHOT_H = 14;
const SHOT_SPEED = 640;
const SHOT_COOLDOWN = 200;
const BOLT_W = 4;
const BOLT_H = 12;
const SCRAP = 8;
const SCRAP_SPEED = 150;
const SCRAP_POINTS = 5;

const MAX_AMMO = 6;
const REGEN_MS = 3000;
const MAX_STREAK = 5;
const START_LIVES = 3;
const INVULN_MS = 1500;
const BANNER_MS = 1500;
const LAND_FLASH_MS = 600;
const EMPTY_FLASH_MS = 400;
const SPARK_MS = 260;
const WAVE_BONUS = 250;

const descentFor = (level: number, ratioDead: number) => (7 + 1.5 * (level - 1)) * (1 + 1.2 * ratioDead);
const waveSpeedFor = (ratioDead: number) => 0.9 + 1.6 * ratioDead;
const fireIntervalFor = (level: number) => Math.max(380, 1150 - 85 * (level - 1));
const boltSpeedFor = (level: number) => 200 + 15 * (level - 1);

const LEFT_KEYS = new Set(["ArrowLeft", "KeyA"]);
const RIGHT_KEYS = new Set(["ArrowRight", "KeyD"]);
const FIRE_KEYS = new Set(["Space", "ArrowUp", "KeyW"]);
const CAPTURED_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "Space"]);

// Siluetas por oleada, `(nivel − 1) mod 5`.
const SHAPES: readonly ((c: number, r: number) => boolean)[] = [
  () => true, // bloque completo
  (c, r) => Math.abs(c - 4.5) / 5 + Math.abs(r - 2) / 2.5 <= 1, // rombo
  (c, r) => Math.abs(Math.abs(c - 4.5) - (4.5 - r)) <= 1.5, // V
  (c) => c % 2 === 0, // columnas alternas
  (c, r) => c <= 2 || c >= 7 || r === 1, // dos torres + puente
];

// Glifos de 8×6 pixeles, dos cuadros por tipo (diseño propio).
const GLYPHS: readonly (readonly [readonly string[], readonly string[]])[] = [
  [
    ["########", "#.####.#", "########", ".##..##.", "##....##", "#......#"],
    ["########", "#.####.#", "########", ".##..##.", ".##..##.", "##....##"],
  ],
  [
    ["...##...", "..####..", ".#.##.#.", "########", "#.#..#.#", ".#....#."],
    ["...##...", "..####..", ".#.##.#.", "########", ".#.##.#.", "#......#"],
  ],
  [
    ["..####..", ".######.", "##.##.##", "########", ".#....#.", "#......#"],
    ["..####..", ".######.", "##.##.##", "########", "..#..#..", ".#.##.#."],
  ],
];

type Shot = { x: number; y: number };
type Bolt = { x: number; y: number };
type Scrap = { x: number; y: number; amount: number };
type Spark = { x: number; y: number; color: string; t: number };

export const createInvasores: GameFactory = (canvas, callbacks, options) => {
  const ctx = canvas.getContext("2d")!;
  let colors = getPalette(options?.skin ?? DEFAULT_SKIN, canvas);

  // Un Path2D por tipo y cuadro: un solo fill por invasor (barato incluso con glow).
  const glyphPaths = GLYPHS.map((frames) =>
    frames.map((rows) => {
      const p = new Path2D();
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (row[x] === "#") p.rect(x * PX, y * PX, PX, PX);
      });
      return p;
    }),
  );

  // ── Estado de la instancia ──────────────────────────────────────────────────
  const hp = new Int8Array(ROWS * COLS); // impactos restantes; 0 = vacío
  let total = 0;
  let aliveCount = 0;
  let formY = START_Y;
  let offsetX = 0;
  let wave = 0; // fase de la onda
  let waveId = 0; // cambia con cada oleada: corta el procesamiento del frame en curso
  let animMs = 0;
  let shots: Shot[] = [];
  let bolts: Bolt[] = [];
  let scraps: Scrap[] = [];
  let sparks: Spark[] = [];
  let cannonX = W / 2;
  let ammo = MAX_AMMO;
  let regenMs = 0;
  let cooldownMs = 0;
  let fireMs = 0;
  let streak = 1;
  let invulnMs = 0;
  let bannerMs = 0;
  let landMs = 0;
  let emptyMs = 0;
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let phase: "playing" | "over" | "ended" = "playing";
  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId: number | null = null;
  const keys = new Set<string>();
  let emitted = { score: -1, lives: -1, level: -1 };

  const isRunning = () => !paused && !destroyed && phase === "playing";

  const emitStats = () => {
    if (emitted.score === score && emitted.lives === lives && emitted.level === level) return;
    emitted = { score, lives, level };
    callbacks.onStats({ score, lives, level });
  };

  // ── Formación ───────────────────────────────────────────────────────────────
  const invX = (c: number) => offsetX + c * CELL_W + PAD_X;
  const invY = (r: number) => formY + r * CELL_H + PAD_Y;
  const ratioDead = () => (total > 0 ? 1 - aliveCount / total : 0);

  // Rango de desplazamiento horizontal según las columnas vivas.
  const offsetRange = (): [number, number] => {
    let minC = COLS;
    let maxC = -1;
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (hp[r * COLS + c] > 0) {
          minC = Math.min(minC, c);
          maxC = Math.max(maxC, c);
          break;
        }
      }
    }
    if (maxC < 0) return [offsetX, offsetX];
    return [FIELD_L + MARGIN - minC * CELL_W - PAD_X, FIELD_R - MARGIN - maxC * CELL_W - PAD_X - INV_W];
  };

  const lowestRow = () => {
    for (let r = ROWS - 1; r >= 0; r--) for (let c = 0; c < COLS; c++) if (hp[r * COLS + c] > 0) return r;
    return -1;
  };

  const startWave = () => {
    waveId += 1;
    const shape = SHAPES[(level - 1) % SHAPES.length];
    total = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const on = shape(c, r);
        hp[r * COLS + c] = on ? KIND_HP[kindOfRow(r)] : 0;
        if (on) total++;
      }
    }
    aliveCount = total;
    formY = START_Y;
    wave = 0;
    const [lo, hi] = offsetRange();
    offsetX = (lo + hi) / 2;
    ammo = MAX_AMMO;
    regenMs = 0;
    shots = [];
    bolts = [];
    scraps = [];
    fireMs = fireIntervalFor(level) * 1.5;
    bannerMs = BANNER_MS;
  };

  const nextLevel = (bonus: boolean) => {
    if (bonus) score += WAVE_BONUS * level;
    level += 1;
    startWave();
    emitStats();
  };

  const addSpark = (x: number, y: number, color: string) => {
    sparks.push({ x, y, color, t: SPARK_MS });
  };

  // ── Vidas ───────────────────────────────────────────────────────────────────
  const loseLife = () => {
    lives -= 1;
    streak = 1;
    bolts = [];
    invulnMs = INVULN_MS;
    if (lives <= 0) {
      lives = 0;
      phase = "over";
    }
    emitStats();
  };

  // La formación tocó la superficie: los invasores que la tocan se eliminan y el resto retrocede.
  const land = () => {
    for (let r = 0; r < ROWS; r++) {
      if (invY(r) + INV_H < SURFACE_Y) continue;
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        if (hp[i] > 0) {
          hp[i] = 0;
          aliveCount--;
          addSpark(invX(c) + INV_W / 2, invY(r) + INV_H / 2, colors.surfaceAlert);
        }
      }
    }
    formY -= RETREAT;
    landMs = LAND_FLASH_MS;
    loseLife();
    if (phase === "playing" && aliveCount === 0) nextLevel(false);
  };

  // ── Disparo ─────────────────────────────────────────────────────────────────
  const fire = () => {
    if (cooldownMs > 0) return;
    if (ammo <= 0) {
      emptyMs = EMPTY_FLASH_MS;
      return;
    }
    ammo -= 1;
    cooldownMs = SHOT_COOLDOWN;
    shots.push({ x: cannonX, y: CANNON_Y - SHOT_H });
  };

  // Primer invasor vivo que se superpone con el rectángulo dado, o -1.
  const invaderAt = (x: number, y: number, w: number, h: number) => {
    for (let r = ROWS - 1; r >= 0; r--) {
      const iy = invY(r);
      if (y > iy + INV_H || y + h < iy) continue;
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        if (hp[i] <= 0) continue;
        const ix = invX(c);
        if (x + w > ix && x < ix + INV_W) return i;
      }
    }
    return -1;
  };

  const hitInvader = (i: number) => {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    const kind = kindOfRow(r);
    const cx = invX(c) + INV_W / 2;
    const cy = invY(r) + INV_H / 2;
    hp[i] -= 1;
    streak = Math.min(MAX_STREAK, streak + 1);
    if (hp[i] > 0) {
      addSpark(cx, cy, colors.spark);
      return;
    }
    aliveCount--;
    score += KIND_POINTS[kind] * streak;
    addSpark(cx, cy, colors.invaders[kind]);
    scraps.push({ x: cx, y: cy, amount: kind === 0 ? 2 : 1 });
    emitStats();
    if (aliveCount === 0) nextLevel(true);
  };

  const enemyFire = () => {
    const cols: number[] = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (hp[r * COLS + c] > 0) {
      cols.push(c);
      break;
    }
    if (cols.length === 0) return;
    const c = cols[Math.floor(Math.random() * cols.length)];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (hp[r * COLS + c] > 0) {
        bolts.push({ x: invX(c) + INV_W / 2, y: invY(r) + INV_H });
        return;
      }
    }
  };

  // ── Lógica ──────────────────────────────────────────────────────────────────
  const overlapsCannon = (x: number, y: number, w: number, h: number) =>
    x + w > cannonX - CANNON_W / 2 && x < cannonX + CANNON_W / 2 && y + h > CANNON_Y && y < CANNON_Y + CANNON_H;

  const update = (dt: number) => {
    const sec = dt / 1000;
    sparks = sparks.filter((s) => (s.t -= dt) > 0);
    animMs = (animMs + dt) % (FRAME_MS * 2);
    if (bannerMs > 0) bannerMs -= dt;
    if (landMs > 0) landMs -= dt;
    if (emptyMs > 0) emptyMs -= dt;
    if (invulnMs > 0) invulnMs -= dt;
    if (cooldownMs > 0) cooldownMs -= dt;

    // Cañón
    let dir = 0;
    if ([...LEFT_KEYS].some((k) => keys.has(k))) dir -= 1;
    if ([...RIGHT_KEYS].some((k) => keys.has(k))) dir += 1;
    const half = CANNON_W / 2;
    cannonX = Math.max(FIELD_L + half, Math.min(FIELD_R - half, cannonX + dir * CANNON_SPEED * sec));

    // Recarga pasiva
    if (ammo < MAX_AMMO) {
      regenMs += dt;
      if (regenMs >= REGEN_MS) {
        regenMs -= REGEN_MS;
        ammo += 1;
      }
    } else regenMs = 0;

    // Formación: onda + descenso continuo
    const dead = ratioDead();
    wave += waveSpeedFor(dead) * sec;
    const [lo, hi] = offsetRange();
    const target = (lo + hi) / 2 + ((hi - lo) / 2) * Math.sin(wave);
    const step = OFFSET_SPEED * sec;
    offsetX += Math.max(-step, Math.min(step, target - offsetX));
    formY += descentFor(level, dead) * sec;
    const low = lowestRow();
    if (low >= 0 && invY(low) + INV_H >= SURFACE_Y) {
      land();
      return; // vida perdida (y quizá oleada nueva): el resto espera al próximo frame
    }

    // Fuego enemigo
    fireMs -= dt;
    if (fireMs <= 0) {
      fireMs = fireIntervalFor(level);
      enemyFire();
    }

    // Proyectiles del jugador
    const id = waveId;
    const nextShots: Shot[] = [];
    for (const s of shots) {
      s.y -= SHOT_SPEED * sec;
      const i = invaderAt(s.x - SHOT_W / 2, s.y, SHOT_W, SHOT_H);
      if (i >= 0) {
        hitInvader(i);
        if (phase !== "playing" || waveId !== id) return; // fin de partida u oleada nueva
        continue;
      }
      if (s.y + SHOT_H < 0) {
        streak = 1; // disparo fallado
        continue;
      }
      nextShots.push(s);
    }
    shots = nextShots;

    // Rayos enemigos
    const speed = boltSpeedFor(level);
    const nextBolts: Bolt[] = [];
    for (const b of bolts) {
      b.y += speed * sec;
      if (invulnMs <= 0 && overlapsCannon(b.x - BOLT_W / 2, b.y, BOLT_W, BOLT_H)) {
        addSpark(cannonX, CANNON_Y + CANNON_H / 2, colors.bolt);
        loseLife();
        return;
      }
      if (b.y < H) nextBolts.push(b);
    }
    bolts = nextBolts;

    // Chatarra
    const nextScraps: Scrap[] = [];
    for (const s of scraps) {
      s.y += SCRAP_SPEED * sec;
      if (overlapsCannon(s.x - SCRAP / 2, s.y - SCRAP / 2, SCRAP, SCRAP)) {
        ammo = Math.min(MAX_AMMO, ammo + s.amount);
        score += SCRAP_POINTS * streak;
        addSpark(s.x, s.y, colors.scrap);
        emitStats();
        continue;
      }
      if (s.y - SCRAP / 2 < H) nextScraps.push(s);
    }
    scraps = nextScraps;
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

  const drawField = () => {
    ctx.fillStyle = colors.frame;
    ctx.fillRect(FIELD_L - 4, 24, 2, H - 24);
    ctx.fillRect(FIELD_R + 2, 24, 2, H - 24);

    const low = lowestRow();
    const near = low >= 0 && invY(low) + INV_H + CELL_H >= SURFACE_Y;
    const flashing = landMs > 0 && Math.floor(landMs / 100) % 2 === 0;
    const color = near || flashing ? colors.surfaceAlert : colors.surface;
    glow(color, 0.8);
    ctx.fillStyle = color;
    ctx.fillRect(FIELD_L, SURFACE_Y, FIELD_R - FIELD_L, 2);
    noGlow();
  };

  const drawFormation = () => {
    const frame = animMs < FRAME_MS ? 0 : 1;
    for (let r = 0; r < ROWS; r++) {
      const kind = kindOfRow(r);
      for (let c = 0; c < COLS; c++) {
        const h = hp[r * COLS + c];
        if (h <= 0) continue;
        const color = kind === 0 && h < KIND_HP[0] ? colors.damaged : colors.invaders[kind];
        ctx.save();
        ctx.translate(px(invX(c)), px(invY(r)));
        glow(color);
        ctx.fillStyle = color;
        ctx.fill(glyphPaths[kind][frame]);
        ctx.restore();
      }
    }
    noGlow();
  };

  const drawProjectiles = () => {
    glow(colors.shot);
    ctx.fillStyle = colors.shot;
    for (const s of shots) ctx.fillRect(px(s.x - SHOT_W / 2), px(s.y), SHOT_W, SHOT_H);
    glow(colors.bolt);
    ctx.fillStyle = colors.bolt;
    for (const b of bolts) {
      // Rayo en zigzag de 3 tramos.
      const x = px(b.x - BOLT_W / 2);
      const y = px(b.y);
      ctx.fillRect(x, y, BOLT_W, 4);
      ctx.fillRect(x + 2, y + 4, BOLT_W, 4);
      ctx.fillRect(x, y + 8, BOLT_W, 4);
    }
    glow(colors.scrap);
    ctx.fillStyle = colors.scrap;
    for (const s of scraps) {
      ctx.fillRect(px(s.x - SCRAP / 2), px(s.y - SCRAP / 2), SCRAP, SCRAP);
      if (s.amount > 1) {
        ctx.fillStyle = colors.bg;
        ctx.fillRect(px(s.x - 1), px(s.y - 1), 2, 2);
        ctx.fillStyle = colors.scrap;
      }
    }
    noGlow();
  };

  const drawSparks = () => {
    for (const s of sparks) {
      const a = s.t / SPARK_MS;
      if (colors.pixel && a < 0.5) continue; // sin alfa: el destello se corta a la mitad
      const rad = 6 + (1 - a) * 14;
      ctx.strokeStyle = colors.pixel ? s.color : withAlpha(s.color, a);
      ctx.lineWidth = 2;
      glow(s.color);
      ctx.strokeRect(px(s.x - rad), px(s.y - rad), px(rad * 2), px(rad * 2));
      noGlow();
    }
  };

  const drawCannon = () => {
    if (invulnMs > 0 && Math.floor(invulnMs / 100) % 2 === 0) return; // parpadeo
    const x = px(cannonX - CANNON_W / 2);
    const baseY = CANNON_Y + 8;
    const tx = px(cannonX - 6);
    if (colors.outline) {
      ctx.fillStyle = withAlpha(colors.cannon, 0.18);
      ctx.fillRect(x, baseY, CANNON_W, 10);
      ctx.fillRect(tx, CANNON_Y, 12, 8);
      glow(colors.cannon);
      ctx.strokeStyle = colors.cannon;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, baseY + 1, CANNON_W - 2, 8);
      ctx.strokeRect(tx + 1, CANNON_Y + 1, 10, 7);
      noGlow();
      return;
    }
    ctx.fillStyle = colors.cannon;
    ctx.fillRect(x, baseY, CANNON_W, 10);
    ctx.fillRect(tx, CANNON_Y, 12, 8);
    ctx.fillRect(px(cannonX - 2), CANNON_Y - 4, 4, 4);
    ctx.fillStyle = colors.cannonEdge;
    ctx.fillRect(x, baseY + 7, CANNON_W, 3);
  };

  const drawAmmo = () => {
    const y = 580;
    const empty = ammo === 0 && emptyMs > 0 && Math.floor(emptyMs / 100) % 2 === 0;
    for (let i = 0; i < MAX_AMMO; i++) {
      const on = i < ammo;
      const color = empty ? colors.ammoEmpty : on ? colors.ammoOn : colors.ammoOff;
      if (on) glow(color, 0.6);
      ctx.fillStyle = color;
      ctx.fillRect(FIELD_L + 4 + i * 18, y, 14, 8);
      noGlow();
    }
    if (streak > 1) {
      ctx.font = `12px ${colors.font}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = colors.streak;
      glow(colors.streak, 0.8);
      ctx.fillText(`×${streak}`, FIELD_R - 4, y + 4);
      noGlow();
    }
  };

  const drawBanner = () => {
    if (bannerMs <= 0) return;
    ctx.font = `20px ${colors.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = colors.label;
    glow(colors.label, 0.8);
    ctx.fillText(`OLEADA ${level}`, W / 2, 330);
    noGlow();
  };

  const draw = () => {
    ctx.imageSmoothingEnabled = !colors.pixel;
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);
    drawField();
    drawFormation();
    drawProjectiles();
    drawSparks();
    drawCannon();
    drawAmmo();
    drawBanner();
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
    const relevant = LEFT_KEYS.has(e.code) || RIGHT_KEYS.has(e.code) || FIRE_KEYS.has(e.code);
    if (!relevant) return;
    if (CAPTURED_KEYS.has(e.code)) e.preventDefault();
    if (FIRE_KEYS.has(e.code)) {
      if (!e.repeat) fire();
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
  startWave();
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
      if (phase === "playing") phase = "ended";
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
