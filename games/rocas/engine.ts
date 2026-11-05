// Motor de ROCAS (SPEC 19), escrito desde cero.
// Mecánicas centrales: (1) la nave no tiene propulsor — solo se mueve por el retroceso de sus disparos
// y puede frenar; (2) al partir una roca, sus dos fragmentos quedan enlazados y, si sobreviven 4 s,
// se atraen y se vuelven a fundir en la roca anterior. Destruir ambos hermanos casi a la vez da un
// bonus PAR. La arena es cerrada: todo rebota en las paredes. Desde el nivel 2 cruzan OVNIs por arriba.
// Todo el estado mutable vive dentro de la instancia.

import { DEFAULT_SKIN, type GameFactory, type SkinId } from "@/games/types";
import { getPalette, withAlpha } from "@/games/rocas/skins";

const W = 800;
const H = 600;

// ── Constantes ────────────────────────────────────────────────────────────────
const WALL = 6; // paredes a 6 px del borde
const AL = WALL;
const AT = WALL;
const AR = W - WALL;
const AB = H - WALL;

const SHIP_R = 12; // radio de dibujo
const SHIP_HIT_R = 10; // radio de colisión
const ROT_SPEED = 3.6; // rad/s
const RECOIL = 42; // px/s por disparo
const MAX_SPEED = 300;
const DRAG = 0.08; // fracción por segundo
const BRAKE = 220; // px/s²
const WALL_BOUNCE = 0.7;

const FIRE_MS = 170;
const BULLET_SPEED = 540;
const BULLET_MS = 1000;
const MAX_BULLETS = 8;

const ROCK_R = [44, 26, 14] as const; // grande, mediana, pequeña
const ROCK_SPEED = [45, 70, 100] as const;
const ROCK_POINTS = [10, 30, 60] as const;
const PAIR_BONUS = [0, 100, 200] as const; // por tamaño del par destruido
const PAIR_WINDOW = 1500;
const TETHER_WARN = 2500; // edad desde la que se dibuja el cable punteado
const FUSE_DELAY = 4000; // edad desde la que los hermanos se atraen
const FUSE_ACCEL = 70; // px/s²
const FUSE_DIST = 0.7; // se funden a menos de 0,7 × (r1 + r2)
const ROCK_VERTS = 10;

const UFO_RX = 18;
const UFO_RY = 8;
const UFO_HIT_R = 16;
const UFO_SPEED = 120;
const UFO_FIRE_MS = 1500;
const UFO_BULLET_SPEED = 260;
const UFO_BULLET_MS = 2500;
const UFO_SPREAD = 0.15;
const UFO_POINTS = 300;
const UFO_FROM_LEVEL = 2;

const START_LIVES = 3;
const DYING_MS = 900;
const INVULN_MS = 2500;
const WAVE_DELAY_MS = 1200;
const SAFE_SPAWN = 200;
const FLASH_MS = 400;
const POPUP_MS = 900;
const STAR_COUNT = 90;

const speedFactor = (level: number) => Math.min(1.8, 1 + 0.08 * (level - 1));
const waveSize = (level: number) => Math.min(9, 2 + level);
const ufoDelay = (level: number) => Math.max(8, 14 - 0.8 * (level - UFO_FROM_LEVEL)) * 1000;

const LEFT_KEYS = new Set(["ArrowLeft", "KeyA"]);
const RIGHT_KEYS = new Set(["ArrowRight", "KeyD"]);
const FIRE_KEYS = new Set(["Space"]);
const BRAKE_KEYS = new Set(["ArrowDown", "KeyS"]);
const CAPTURED_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"]);

type Rock = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: 0 | 1 | 2;
  angle: number;
  spin: number;
  shape: number[]; // factor de radio por vértice
  siblingId: number | null;
  age: number; // ms desde que nació
  pairDeadAt: number | null; // reloj de juego en que murió su hermano
};

type Bullet = { x: number; y: number; vx: number; vy: number; t: number };
type Ufo = { x: number; y: number; dir: -1 | 1; fireMs: number };
type Debris = { x: number; y: number; vx: number; vy: number; angle: number; spin: number; len: number; t: number; max: number };
type Flash = { x: number; y: number; r: number; t: number };
type Popup = { x: number; y: number; text: string; t: number };

export const createRocas: GameFactory = (canvas, callbacks, options) => {
  const ctx = canvas.getContext("2d")!;
  let colors = getPalette(options?.skin ?? DEFAULT_SKIN, canvas);

  // Fondo estrellado fijo de la instancia.
  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x: AL + Math.random() * (AR - AL),
    y: AT + Math.random() * (AB - AT),
    s: Math.random() < 0.2 ? 2 : 1,
  }));

  // ── Estado de la instancia ──────────────────────────────────────────────────
  const ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2 };
  let invulnMs = INVULN_MS;
  let fireMs = 0;
  let bullets: Bullet[] = [];
  let rocks: Rock[] = [];
  let ufo: Ufo | null = null;
  let ufoBullets: Bullet[] = [];
  let debris: Debris[] = [];
  let flashes: Flash[] = [];
  let popups: Popup[] = [];
  let nextId = 1;
  let clock = 0; // ms de juego (no avanza en pausa)
  let waveMs = 0; // > 0: cuenta atrás hasta la próxima oleada
  let ufoMs = ufoDelay(UFO_FROM_LEVEL) + Math.random() * 6000;
  let dyingMs = 0;
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let phase: "playing" | "dying" | "over" | "ended" = "playing";
  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId: number | null = null;
  const keys = new Set<string>();
  let emitted = { score: -1, lives: -1, level: -1 };

  const isRunning = () => !paused && !destroyed && (phase === "playing" || phase === "dying");

  const emitStats = () => {
    if (emitted.score === score && emitted.lives === lives && emitted.level === level) return;
    emitted = { score, lives, level };
    callbacks.onStats({ score, lives, level });
  };

  // ── Rocas ───────────────────────────────────────────────────────────────────
  const makeRock = (x: number, y: number, size: 0 | 1 | 2, dirAngle: number, baseVx = 0, baseVy = 0): Rock => {
    const sp = ROCK_SPEED[size] * speedFactor(level) * (0.8 + Math.random() * 0.4);
    return {
      id: nextId++,
      x,
      y,
      vx: baseVx + Math.cos(dirAngle) * sp,
      vy: baseVy + Math.sin(dirAngle) * sp,
      size,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.6,
      shape: Array.from({ length: ROCK_VERTS }, () => 0.75 + Math.random() * 0.35),
      siblingId: null,
      age: 0,
      pairDeadAt: null,
    };
  };

  const spawnWave = () => {
    const n = waveSize(level);
    for (let i = 0; i < n; i++) {
      let x = 0;
      let y = 0;
      for (let tries = 0; tries < 20; tries++) {
        // Junto a una pared al azar, lejos de la nave.
        const side = Math.floor(Math.random() * 4);
        const r = ROCK_R[0] + 4;
        x = side === 0 ? AL + r : side === 1 ? AR - r : AL + r + Math.random() * (AR - AL - 2 * r);
        y = side === 2 ? AT + r : side === 3 ? AB - r : AT + r + Math.random() * (AB - AT - 2 * r);
        if (Math.hypot(x - ship.x, y - ship.y) > SAFE_SPAWN) break;
      }
      rocks.push(makeRock(x, y, 0, Math.random() * Math.PI * 2));
    }
  };

  const addDebris = (x: number, y: number, count: number, spread: number) => {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = spread * (0.4 + Math.random() * 0.8);
      const max = 500 + Math.random() * 500;
      debris.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 8,
        len: 3 + Math.random() * 6,
        t: max,
        max,
      });
    }
  };

  // Destruye la roca (por bala): puntos, bonus PAR, enlace con el hermano y fragmentos.
  const destroyRock = (rock: Rock, shotAngle: number) => {
    score += ROCK_POINTS[rock.size];
    if (rock.pairDeadAt !== null && clock - rock.pairDeadAt <= PAIR_WINDOW) {
      const bonus = PAIR_BONUS[rock.size];
      score += bonus;
      popups.push({ x: rock.x, y: rock.y, text: `PAR +${bonus}`, t: POPUP_MS });
    }
    if (rock.siblingId !== null) {
      const sib = rocks.find((r) => r.id === rock.siblingId);
      if (sib) {
        sib.siblingId = null;
        sib.pairDeadAt = clock;
      }
    }
    rocks = rocks.filter((r) => r !== rock);
    addDebris(rock.x, rock.y, 6 + (2 - rock.size) * 4, 90);

    if (rock.size < 2) {
      const size = (rock.size + 1) as 1 | 2;
      const off = ROCK_R[size] * 0.6;
      const a1 = shotAngle + Math.PI / 2;
      const a2 = shotAngle - Math.PI / 2;
      const f1 = makeRock(rock.x + Math.cos(a1) * off, rock.y + Math.sin(a1) * off, size, a1, rock.vx * 0.4, rock.vy * 0.4);
      const f2 = makeRock(rock.x + Math.cos(a2) * off, rock.y + Math.sin(a2) * off, size, a2, rock.vx * 0.4, rock.vy * 0.4);
      f1.siblingId = f2.id;
      f2.siblingId = f1.id;
      rocks.push(f1, f2);
    }
    emitStats();
  };

  // Atracción y fusión de hermanos.
  const updateFusion = (sec: number) => {
    const merged: Rock[] = [];
    const gone = new Set<Rock>();
    for (const a of rocks) {
      if (a.siblingId === null || a.id > a.siblingId || gone.has(a)) continue; // cada par una sola vez
      const b = rocks.find((r) => r.id === a.siblingId);
      if (!b) {
        a.siblingId = null;
        continue;
      }
      if (a.age < FUSE_DELAY || b.age < FUSE_DELAY) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < FUSE_DIST * (ROCK_R[a.size] + ROCK_R[b.size])) {
        gone.add(a);
        gone.add(b);
        const size = (a.size - 1) as 0 | 1;
        const fused = makeRock((a.x + b.x) / 2, (a.y + b.y) / 2, size, 0);
        fused.vx = (a.vx + b.vx) / 2;
        fused.vy = (a.vy + b.vy) / 2;
        // No puede nacer metida en una pared.
        const r = ROCK_R[size];
        fused.x = Math.max(AL + r, Math.min(AR - r, fused.x));
        fused.y = Math.max(AT + r, Math.min(AB - r, fused.y));
        merged.push(fused);
        flashes.push({ x: fused.x, y: fused.y, r, t: FLASH_MS });
        continue;
      }
      const ax = (dx / d) * FUSE_ACCEL * sec;
      const ay = (dy / d) * FUSE_ACCEL * sec;
      a.vx += ax;
      a.vy += ay;
      b.vx -= ax;
      b.vy -= ay;
    }
    if (gone.size) rocks = rocks.filter((r) => !gone.has(r)).concat(merged);
  };

  // ── Nave ────────────────────────────────────────────────────────────────────
  const resetShip = () => {
    ship.x = W / 2;
    ship.y = H / 2;
    ship.vx = 0;
    ship.vy = 0;
    ship.angle = -Math.PI / 2;
    invulnMs = INVULN_MS;
    fireMs = 0;
  };

  const killShip = () => {
    addDebris(ship.x, ship.y, 18, 140);
    flashes.push({ x: ship.x, y: ship.y, r: SHIP_R * 2, t: FLASH_MS });
    lives -= 1;
    keys.clear();
    phase = "dying";
    dyingMs = DYING_MS;
    emitStats();
  };

  const fire = () => {
    const cos = Math.cos(ship.angle);
    const sin = Math.sin(ship.angle);
    bullets.push({
      x: ship.x + cos * SHIP_R,
      y: ship.y + sin * SHIP_R,
      vx: cos * BULLET_SPEED,
      vy: sin * BULLET_SPEED,
      t: BULLET_MS,
    });
    // Retroceso: única forma de moverse.
    ship.vx -= cos * RECOIL;
    ship.vy -= sin * RECOIL;
    const sp = Math.hypot(ship.vx, ship.vy);
    if (sp > MAX_SPEED) {
      ship.vx *= MAX_SPEED / sp;
      ship.vy *= MAX_SPEED / sp;
    }
    fireMs = FIRE_MS;
  };

  const anyKey = (set: Set<string>) => [...set].some((k) => keys.has(k));

  const updateShip = (dt: number, sec: number) => {
    if (anyKey(LEFT_KEYS)) ship.angle -= ROT_SPEED * sec;
    if (anyKey(RIGHT_KEYS)) ship.angle += ROT_SPEED * sec;

    fireMs = Math.max(0, fireMs - dt);
    if (anyKey(FIRE_KEYS) && fireMs <= 0 && bullets.length < MAX_BULLETS) fire();

    const sp = Math.hypot(ship.vx, ship.vy);
    if (anyKey(BRAKE_KEYS) && sp > 0) {
      const k = Math.max(0, sp - BRAKE * sec) / sp;
      ship.vx *= k;
      ship.vy *= k;
    }
    const drag = Math.exp(-DRAG * sec);
    ship.vx *= drag;
    ship.vy *= drag;

    ship.x += ship.vx * sec;
    ship.y += ship.vy * sec;
    if (ship.x - SHIP_HIT_R < AL) {
      ship.x = AL + SHIP_HIT_R;
      ship.vx = Math.abs(ship.vx) * WALL_BOUNCE;
    } else if (ship.x + SHIP_HIT_R > AR) {
      ship.x = AR - SHIP_HIT_R;
      ship.vx = -Math.abs(ship.vx) * WALL_BOUNCE;
    }
    if (ship.y - SHIP_HIT_R < AT) {
      ship.y = AT + SHIP_HIT_R;
      ship.vy = Math.abs(ship.vy) * WALL_BOUNCE;
    } else if (ship.y + SHIP_HIT_R > AB) {
      ship.y = AB - SHIP_HIT_R;
      ship.vy = -Math.abs(ship.vy) * WALL_BOUNCE;
    }
    if (invulnMs > 0) invulnMs -= dt;
  };

  // ── OVNI ────────────────────────────────────────────────────────────────────
  const updateUfo = (dt: number, sec: number) => {
    if (!ufo) {
      if (level < UFO_FROM_LEVEL) return;
      ufoMs -= dt;
      if (ufoMs <= 0) {
        const dir: -1 | 1 = Math.random() < 0.5 ? 1 : -1;
        ufo = { x: dir === 1 ? -UFO_RX : W + UFO_RX, y: 40 + Math.random() * 40, dir, fireMs: UFO_FIRE_MS * 0.6 };
      }
      return;
    }
    ufo.x += ufo.dir * UFO_SPEED * sec;
    ufo.y += Math.sin(clock / 400) * 14 * sec; // leve vaivén en el horizonte
    if ((ufo.dir === 1 && ufo.x - UFO_RX > W) || (ufo.dir === -1 && ufo.x + UFO_RX < 0)) {
      ufo = null;
      ufoMs = ufoDelay(level) + Math.random() * 6000;
      return;
    }
    ufo.fireMs -= dt;
    if (ufo.fireMs <= 0 && phase === "playing" && ufo.x > AL && ufo.x < AR) {
      ufo.fireMs = UFO_FIRE_MS;
      const a = Math.atan2(ship.y - ufo.y, ship.x - ufo.x) + (Math.random() * 2 - 1) * UFO_SPREAD;
      ufoBullets.push({ x: ufo.x, y: ufo.y, vx: Math.cos(a) * UFO_BULLET_SPEED, vy: Math.sin(a) * UFO_BULLET_SPEED, t: UFO_BULLET_MS });
    }
  };

  const destroyUfo = () => {
    if (!ufo) return;
    score += UFO_POINTS;
    popups.push({ x: ufo.x, y: ufo.y + 18, text: `+${UFO_POINTS}`, t: POPUP_MS });
    addDebris(ufo.x, ufo.y, 14, 120);
    ufo = null;
    ufoMs = ufoDelay(level) + Math.random() * 6000;
    emitStats();
  };

  // ── Lógica ──────────────────────────────────────────────────────────────────
  const inArena = (b: Bullet) => b.x > AL && b.x < AR && b.y > AT && b.y < AB;

  const update = (dt: number) => {
    const sec = dt / 1000;
    clock += dt;

    // Efectos
    debris = debris.filter((d) => {
      d.x += d.vx * sec;
      d.y += d.vy * sec;
      d.angle += d.spin * sec;
      return (d.t -= dt) > 0;
    });
    flashes = flashes.filter((f) => (f.t -= dt) > 0);
    popups = popups.filter((p) => {
      p.y -= 24 * sec;
      return (p.t -= dt) > 0;
    });

    // Nave o reaparición
    if (phase === "playing") updateShip(dt, sec);
    else if (phase === "dying") {
      dyingMs -= dt;
      if (dyingMs <= 0) {
        if (lives <= 0) {
          phase = "over";
          return;
        }
        phase = "playing";
        resetShip();
      }
    }

    // Rocas
    for (const r of rocks) {
      r.age += dt;
      r.x += r.vx * sec;
      r.y += r.vy * sec;
      r.angle += r.spin * sec;
      const rad = ROCK_R[r.size];
      if (r.x - rad < AL) {
        r.x = AL + rad;
        r.vx = Math.abs(r.vx);
      } else if (r.x + rad > AR) {
        r.x = AR - rad;
        r.vx = -Math.abs(r.vx);
      }
      if (r.y - rad < AT) {
        r.y = AT + rad;
        r.vy = Math.abs(r.vy);
      } else if (r.y + rad > AB) {
        r.y = AB - rad;
        r.vy = -Math.abs(r.vy);
      }
      // La atracción no debe acelerar sin límite.
      const sp = Math.hypot(r.vx, r.vy);
      const max = ROCK_SPEED[r.size] * speedFactor(level) * 2;
      if (sp > max) {
        r.vx *= max / sp;
        r.vy *= max / sp;
      }
    }
    updateFusion(sec);

    // Balas de la nave
    bullets = bullets.filter((b) => {
      b.x += b.vx * sec;
      b.y += b.vy * sec;
      if ((b.t -= dt) <= 0 || !inArena(b)) return false;
      if (ufo && Math.hypot(b.x - ufo.x, b.y - ufo.y) < UFO_HIT_R) {
        destroyUfo();
        return false;
      }
      const hit = rocks.find((r) => Math.hypot(b.x - r.x, b.y - r.y) < ROCK_R[r.size]);
      if (hit) {
        destroyRock(hit, Math.atan2(b.vy, b.vx));
        return false;
      }
      return true;
    });

    // OVNI y sus balas
    updateUfo(dt, sec);
    ufoBullets = ufoBullets.filter((b) => {
      b.x += b.vx * sec;
      b.y += b.vy * sec;
      return (b.t -= dt) > 0 && inArena(b);
    });

    // Colisiones con la nave
    if (phase === "playing" && invulnMs <= 0) {
      const hitRock = rocks.some((r) => Math.hypot(ship.x - r.x, ship.y - r.y) < ROCK_R[r.size] * 0.9 + SHIP_HIT_R);
      const hitUfo = ufo !== null && Math.hypot(ship.x - ufo.x, ship.y - ufo.y) < UFO_HIT_R + SHIP_HIT_R;
      const shotIdx = ufoBullets.findIndex((b) => Math.hypot(ship.x - b.x, ship.y - b.y) < SHIP_HIT_R + 2);
      if (shotIdx >= 0) ufoBullets.splice(shotIdx, 1);
      if (hitRock || hitUfo || shotIdx >= 0) killShip();
    }

    // Oleadas
    if (rocks.length === 0) {
      if (waveMs <= 0) waveMs = WAVE_DELAY_MS;
      else {
        waveMs -= dt;
        if (waveMs <= 0) {
          waveMs = 0;
          level += 1;
          emitStats();
          spawnWave();
        }
      }
    }
  };

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  const px = (v: number) => (colors.pixel ? Math.round(v) : v);
  const fade = (color: string, a: number) => (colors.alpha ? withAlpha(color, a) : color);

  const glow = (color: string, k = 1) => {
    ctx.shadowColor = color;
    ctx.shadowBlur = colors.glow * k;
  };
  const noGlow = () => {
    ctx.shadowBlur = 0;
  };

  const drawBackground = () => {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = colors.stars;
    for (const s of stars) ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s);
    ctx.strokeStyle = colors.wall;
    ctx.lineWidth = 2;
    glow(colors.wall, 0.6);
    ctx.strokeRect(AL - 1, AT - 1, AR - AL + 2, AB - AT + 2);
    noGlow();
  };

  const drawTethers = () => {
    ctx.lineWidth = 2;
    for (const a of rocks) {
      if (a.siblingId === null || a.id > a.siblingId || a.age < TETHER_WARN) continue;
      const b = rocks.find((r) => r.id === a.siblingId);
      if (!b) continue;
      const active = a.age >= FUSE_DELAY;
      const k = Math.min(1, (a.age - TETHER_WARN) / (FUSE_DELAY - TETHER_WARN));
      ctx.strokeStyle = active ? colors.tether : fade(colors.tether, 0.25 + 0.5 * k);
      ctx.setLineDash(active ? [] : [6, 6]);
      if (active) glow(colors.tether);
      ctx.beginPath();
      ctx.moveTo(px(a.x), px(a.y));
      ctx.lineTo(px(b.x), px(b.y));
      ctx.stroke();
      noGlow();
    }
    ctx.setLineDash([]);
  };

  const drawRock = (r: Rock) => {
    const rad = ROCK_R[r.size];
    ctx.beginPath();
    for (let i = 0; i < ROCK_VERTS; i++) {
      const a = r.angle + (i / ROCK_VERTS) * Math.PI * 2;
      const x = px(r.x + Math.cos(a) * rad * r.shape[i]);
      const y = px(r.y + Math.sin(a) * rad * r.shape[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = colors.rockFill;
    ctx.fill();
    glow(colors.rock);
    ctx.strokeStyle = colors.rock;
    ctx.lineWidth = 2;
    ctx.stroke();
    noGlow();
  };

  const drawShip = () => {
    if (phase !== "playing") return;
    if (invulnMs > 0 && Math.floor(invulnMs / 120) % 2 === 0) return; // parpadeo
    const { x, y, angle } = ship;
    const pt = (a: number, d: number): [number, number] => [px(x + Math.cos(angle + a) * d), px(y + Math.sin(angle + a) * d)];
    ctx.beginPath();
    ctx.moveTo(...pt(0, SHIP_R + 4));
    ctx.lineTo(...pt(2.5, SHIP_R));
    ctx.lineTo(...pt(Math.PI, SHIP_R * 0.45));
    ctx.lineTo(...pt(-2.5, SHIP_R));
    ctx.closePath();
    if (colors.shipFill) {
      ctx.fillStyle = colors.shipFill;
      ctx.fill();
    }
    glow(colors.ship);
    ctx.strokeStyle = colors.ship;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Fogonazo de retroceso justo después de disparar.
    if (fireMs > FIRE_MS - 60) {
      ctx.strokeStyle = colors.bullet;
      ctx.beginPath();
      ctx.moveTo(...pt(Math.PI - 0.35, SHIP_R * 0.9));
      ctx.lineTo(...pt(Math.PI, SHIP_R * 1.6));
      ctx.lineTo(...pt(Math.PI + 0.35, SHIP_R * 0.9));
      ctx.stroke();
    }
    noGlow();
  };

  const drawBullets = () => {
    ctx.fillStyle = colors.bullet;
    glow(colors.bullet, 0.8);
    for (const b of bullets) {
      if (colors.pixel) ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4);
      else {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    noGlow();
    // Balas del OVNI: rombos (cuadros huecos en retro) para no confundirlas con las propias.
    ctx.strokeStyle = colors.ufoBullet;
    ctx.fillStyle = colors.ufoBullet;
    ctx.lineWidth = 2;
    glow(colors.ufoBullet, 0.8);
    for (const b of ufoBullets) {
      if (colors.pixel) ctx.strokeRect(Math.round(b.x) - 3, Math.round(b.y) - 3, 6, 6);
      else {
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - 4);
        ctx.lineTo(b.x + 4, b.y);
        ctx.lineTo(b.x, b.y + 4);
        ctx.lineTo(b.x - 4, b.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    noGlow();
  };

  const drawUfo = () => {
    if (!ufo) return;
    const x = px(ufo.x);
    const y = px(ufo.y);
    glow(colors.ufo);
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.ufo;
    ctx.fillStyle = colors.ufoFill;
    ctx.beginPath();
    ctx.ellipse(x, y, UFO_RX, UFO_RY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y - UFO_RY + 1, 7, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - UFO_RX, y);
    ctx.lineTo(x + UFO_RX, y);
    ctx.stroke();
    noGlow();
  };

  const drawEffects = () => {
    ctx.lineWidth = 2;
    for (const d of debris) {
      const a = d.t / d.max;
      if (!colors.alpha && a < 0.4) continue;
      ctx.strokeStyle = fade(colors.debris, a);
      const cx = Math.cos(d.angle) * d.len;
      const cy = Math.sin(d.angle) * d.len;
      ctx.beginPath();
      ctx.moveTo(px(d.x - cx), px(d.y - cy));
      ctx.lineTo(px(d.x + cx), px(d.y + cy));
      ctx.stroke();
    }
    for (const f of flashes) {
      const a = f.t / FLASH_MS;
      if (!colors.alpha && a < 0.5) continue;
      ctx.strokeStyle = fade(colors.flash, a);
      glow(colors.flash);
      ctx.beginPath();
      ctx.arc(px(f.x), px(f.y), f.r * (1.6 - 0.6 * a), 0, Math.PI * 2);
      ctx.stroke();
      noGlow();
    }
    ctx.font = `12px ${colors.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const p of popups) {
      const a = p.t / POPUP_MS;
      ctx.fillStyle = fade(colors.popup, Math.min(1, a * 1.5));
      glow(colors.popup, 0.8);
      ctx.fillText(p.text, px(p.x), px(p.y));
      noGlow();
    }
  };

  const draw = () => {
    ctx.imageSmoothingEnabled = !colors.pixel;
    drawBackground();
    drawTethers();
    for (const r of rocks) drawRock(r);
    drawUfo();
    drawBullets();
    drawShip();
    drawEffects();
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
    const relevant = LEFT_KEYS.has(e.code) || RIGHT_KEYS.has(e.code) || FIRE_KEYS.has(e.code) || BRAKE_KEYS.has(e.code);
    if (CAPTURED_KEYS.has(e.code)) e.preventDefault();
    if (relevant) keys.add(e.code);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  // La fuente pixel puede cargar después del primer dibujo de un rótulo.
  void document.fonts?.ready.then(() => {
    if (!destroyed && rafId === null) draw();
  });

  // ── Inicio ──────────────────────────────────────────────────────────────────
  spawnWave();
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
      if (phase === "playing" || phase === "dying") phase = "ended";
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
