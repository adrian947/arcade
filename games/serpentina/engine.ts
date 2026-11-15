// Motor de SERPENTINA (SPEC 16), escrito desde cero.
// Mecánica central (distinta de SNAKE): la serpiente de luz no se mueve por casillas sino con giro libre
// (← → rotan el rumbo; avanza sola). Además de comer núcleos con la cabeza, puede CERCARLOS: si la cabeza
// pasa cerca de su propio cuerpo sin tocarlo, el lazo que forma se cierra y captura todo lo que encierra
// (núcleos y esporas) con multiplicador. Las esporas errantes matan al contacto con la cabeza y solo se
// destruyen encerrándolas. Tocar la pared o el propio cuerpo termina la partida.
// Todo el estado mutable vive dentro de la instancia.

import { DEFAULT_SKIN, type GameFactory, type SkinId } from "@/games/types";
import { getPalette, withAlpha } from "@/games/serpentina/skins";

const W = 800;
const H = 600;

// ── Constantes ────────────────────────────────────────────────────────────────
const ARENA_L = 16;
const ARENA_T = 16;
const ARENA_R = W - 16;
const ARENA_B = H - 16;
const GRID = 40;

const SEG = 4; // separación entre puntos del rastro (px)
const HEAD_R = 7;
const BODY_R = 5;
const HIT_D = HEAD_R + BODY_R - 3; // distancia cabeza-cuerpo que cuenta como mordida
const NECK_PTS = 6; // puntos inmediatos tras la cabeza que no cuentan para la mordida
const LOOP_D = 30; // pasar a menos de esto del propio cuerpo cierra el lazo
const HINT_D = 64; // a menos de esto se dibuja el aviso de "cerco listo"
const LOOP_MIN_PTS = 40; // el lazo debe abarcar al menos 160 px de cuerpo
const LOOP_COOLDOWN_MS = 500;
const LOOP_FLASH_MS = 350;

const TURN = 3.4; // rad/s
const START_LEN = 200; // px (una vuelta completa a giro máximo ronda 240 px)
const GROW = 24; // px por núcleo
const speedFor = (collected: number) => Math.min(280, 130 + 3 * collected); // px/s
const levelFor = (collected: number) => 1 + Math.floor(collected / 6);

const NUCLEO_R = 7;
const NUCLEOS_ON_FIELD = 3;
const ESPORA_R = 10;
const esporaTarget = (level: number) => Math.min(level, 6);
const esporaSpeed = (level: number) => Math.min(90, 40 + 5 * level);
const FIRST_ESPORA_MS = 2500;
const ESPORA_RESPAWN_MS = 4000;

const EAT_SCORE = 10; // × nivel
const LOOP_NUCLEO = 20; // × nivel × multiplicador
const LOOP_ESPORA = 100; // × nivel × multiplicador
const MAX_MULT = 5;
const HINT_TEXT_MS = 4000;

const LEFT_KEYS = new Set(["ArrowLeft", "KeyA"]);
const RIGHT_KEYS = new Set(["ArrowRight", "KeyD"]);
const CAPTURED_KEYS = new Set(["ArrowLeft", "ArrowRight"]);

type Pt = { x: number; y: number };
type Espora = { x: number; y: number; vx: number; vy: number; spin: number };

// Punto dentro de polígono (ray casting).
function inside(poly: readonly Pt[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

export const createSerpentina: GameFactory = (canvas, callbacks, options) => {
  const ctx = canvas.getContext("2d")!;
  let colors = getPalette(options?.skin ?? DEFAULT_SKIN, canvas);

  // ── Estado de la instancia ──────────────────────────────────────────────────
  let hx = 260;
  let hy = H / 2;
  let angle = 0;
  let length = START_LEN;
  const pts: Pt[] = []; // rastro, del más viejo al más nuevo (sin la cabeza)
  for (let x = hx - START_LEN; x < hx; x += SEG) pts.push({ x, y: hy });
  let nucleos: Pt[] = [];
  let esporas: Espora[] = [];
  let collected = 0;
  let score = 0;
  let level = 1;
  let elapsed = 0;
  let esporaTimer = FIRST_ESPORA_MS;
  let loopCooldown = 0;
  let flash: { poly: Pt[]; t: number } | null = null;
  let hint: { to: Pt; poly: Pt[] } | null = null;
  let phase: "playing" | "over" | "ended" = "playing";
  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId: number | null = null;
  const keys = new Set<string>();
  let emitted = { score: -1, level: -1 };

  const isRunning = () => !paused && !destroyed && phase === "playing";

  const emitStats = () => {
    if (emitted.score === score && emitted.level === level) return;
    emitted = { score, level };
    callbacks.onStats({ score, lives: phase === "over" ? 0 : 1, level });
  };

  // ── Aparición de núcleos y esporas ──────────────────────────────────────────
  const farFromAll = (x: number, y: number, head: number, body: number, items: number) => {
    if (Math.hypot(x - hx, y - hy) < head) return false;
    for (const p of pts) if (Math.hypot(x - p.x, y - p.y) < body) return false;
    for (const n of nucleos) if (Math.hypot(x - n.x, y - n.y) < items) return false;
    for (const e of esporas) if (Math.hypot(x - e.x, y - e.y) < items) return false;
    return true;
  };

  const randomPoint = (margin: number) => ({
    x: ARENA_L + margin + Math.random() * (ARENA_R - ARENA_L - 2 * margin),
    y: ARENA_T + margin + Math.random() * (ARENA_B - ARENA_T - 2 * margin),
  });

  const spawnNucleo = () => {
    let p = randomPoint(40);
    for (let i = 0; i < 40 && !farFromAll(p.x, p.y, 120, 24, 48); i++) p = randomPoint(40);
    nucleos.push(p);
  };

  const spawnEspora = () => {
    let p = randomPoint(40);
    for (let i = 0; i < 40 && !farFromAll(p.x, p.y, 240, 48, 48); i++) p = randomPoint(40);
    const dir = Math.random() * Math.PI * 2;
    const s = esporaSpeed(level);
    esporas.push({ x: p.x, y: p.y, vx: Math.cos(dir) * s, vy: Math.sin(dir) * s, spin: Math.random() * 6 });
  };

  // ── Reglas ──────────────────────────────────────────────────────────────────
  const collect = (n: number) => {
    collected += n;
    length += GROW * n;
    level = levelFor(collected);
  };

  const die = () => {
    phase = "over";
    keys.clear();
    emitted = { score: -1, level: -1 };
    emitStats();
  };

  // Polígono del lazo: cuerpo desde el punto j hasta la cabeza.
  const loopPoly = (j: number): Pt[] => [...pts.slice(j), { x: hx, y: hy }];

  const capturedBy = (poly: Pt[]) => ({
    n: nucleos.filter((p) => inside(poly, p.x, p.y)),
    e: esporas.filter((p) => inside(poly, p.x, p.y)),
  });

  const closeLoop = (j: number) => {
    const poly = loopPoly(j);
    const got = capturedBy(poly);
    const count = got.n.length + got.e.length;
    if (count === 0) return;
    const mult = Math.min(count, MAX_MULT);
    score += (got.n.length * LOOP_NUCLEO + got.e.length * LOOP_ESPORA) * level * mult;
    nucleos = nucleos.filter((p) => !got.n.includes(p));
    esporas = esporas.filter((p) => !got.e.includes(p));
    collect(got.n.length);
    loopCooldown = LOOP_COOLDOWN_MS;
    flash = { poly, t: LOOP_FLASH_MS };
    emitStats();
  };

  // Un subpaso de la cabeza. Devuelve false si la partida terminó.
  const stepHead = (dist: number, dAngle: number) => {
    angle += dAngle;
    hx += Math.cos(angle) * dist;
    hy += Math.sin(angle) * dist;
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(hx - last.x, hy - last.y) >= SEG) pts.push({ x: hx, y: hy });
    const maxPts = Math.ceil(length / SEG);
    while (pts.length > maxPts) pts.shift();

    // Pared
    if (hx - HEAD_R < ARENA_L || hx + HEAD_R > ARENA_R || hy - HEAD_R < ARENA_T || hy + HEAD_R > ARENA_B) {
      die();
      return false;
    }
    // Mordida y punto más cercano del cuerpo para el lazo
    const n = pts.length;
    let nearJ = -1;
    let nearD = Infinity;
    for (let j = 0; j <= n - 1 - NECK_PTS; j++) {
      const d = Math.hypot(hx - pts[j].x, hy - pts[j].y);
      if (d < HIT_D) {
        die();
        return false;
      }
      if (j <= n - 1 - LOOP_MIN_PTS && d < nearD) {
        nearD = d;
        nearJ = j;
      }
    }
    // Esporas
    for (const e of esporas) {
      if (Math.hypot(hx - e.x, hy - e.y) < HEAD_R + ESPORA_R - 2) {
        die();
        return false;
      }
    }
    // Comer núcleos con la cabeza
    const eaten = nucleos.filter((p) => Math.hypot(hx - p.x, hy - p.y) < HEAD_R + NUCLEO_R);
    if (eaten.length) {
      nucleos = nucleos.filter((p) => !eaten.includes(p));
      score += EAT_SCORE * level * eaten.length;
      collect(eaten.length);
      emitStats();
    }
    // Cerrar el lazo
    if (loopCooldown <= 0 && nearJ >= 0 && nearD < LOOP_D) closeLoop(nearJ);
    return true;
  };

  const updateHint = () => {
    hint = null;
    const n = pts.length;
    let nearJ = -1;
    let nearD = HINT_D;
    for (let j = 0; j <= n - 1 - LOOP_MIN_PTS; j++) {
      const d = Math.hypot(hx - pts[j].x, hy - pts[j].y);
      if (d < nearD) {
        nearD = d;
        nearJ = j;
      }
    }
    if (nearJ < 0) return;
    const poly = loopPoly(nearJ);
    const got = capturedBy(poly);
    if (got.n.length + got.e.length > 0) hint = { to: pts[nearJ], poly };
  };

  const update = (dt: number) => {
    const sec = dt / 1000;
    elapsed += dt;
    if (loopCooldown > 0) loopCooldown -= dt;
    if (flash && (flash.t -= dt) <= 0) flash = null;

    let turn = 0;
    if ([...LEFT_KEYS].some((k) => keys.has(k))) turn -= 1;
    if ([...RIGHT_KEYS].some((k) => keys.has(k))) turn += 1;

    // Esporas: deriva y rebote en las paredes.
    for (const e of esporas) {
      e.x += e.vx * sec;
      e.y += e.vy * sec;
      e.spin += sec * 2;
      if (e.x - ESPORA_R < ARENA_L || e.x + ESPORA_R > ARENA_R) {
        e.vx = -e.vx;
        e.x = Math.max(ARENA_L + ESPORA_R, Math.min(ARENA_R - ESPORA_R, e.x));
      }
      if (e.y - ESPORA_R < ARENA_T || e.y + ESPORA_R > ARENA_B) {
        e.vy = -e.vy;
        e.y = Math.max(ARENA_T + ESPORA_R, Math.min(ARENA_B - ESPORA_R, e.y));
      }
    }

    // Cabeza en subpasos de ≤ 2 px para que ninguna colisión se salte.
    const dist = speedFor(collected) * sec;
    const steps = Math.max(1, Math.ceil(dist / 2));
    for (let i = 0; i < steps; i++) {
      if (!stepHead(dist / steps, (turn * TURN * sec) / steps)) return;
    }

    while (nucleos.length < NUCLEOS_ON_FIELD) spawnNucleo();
    if (esporas.length < esporaTarget(level)) {
      esporaTimer -= dt;
      if (esporaTimer <= 0) {
        spawnEspora();
        esporaTimer = ESPORA_RESPAWN_MS;
      }
    } else esporaTimer = ESPORA_RESPAWN_MS; // tras capturar una espora, la siguiente tarda en aparecer
    updateHint();
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

  const tracePoly = (poly: readonly Pt[]) => {
    ctx.beginPath();
    poly.forEach((p, i) => (i === 0 ? ctx.moveTo(px(p.x), px(p.y)) : ctx.lineTo(px(p.x), px(p.y))));
    ctx.closePath();
  };

  const drawArena = () => {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);
    if (colors.grid !== colors.bg) {
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = ARENA_L + GRID; x < ARENA_R; x += GRID) {
        ctx.moveTo(x + 0.5, ARENA_T);
        ctx.lineTo(x + 0.5, ARENA_B);
      }
      for (let y = ARENA_T + GRID; y < ARENA_B; y += GRID) {
        ctx.moveTo(ARENA_L, y + 0.5);
        ctx.lineTo(ARENA_R, y + 0.5);
      }
      ctx.stroke();
    }
    glow(colors.frame, 0.6);
    ctx.strokeStyle = colors.frame;
    ctx.lineWidth = 3;
    ctx.strokeRect(ARENA_L - 1.5, ARENA_T - 1.5, ARENA_R - ARENA_L + 3, ARENA_B - ARENA_T + 3);
    noGlow();
  };

  const drawLoops = () => {
    if (flash && (!colors.pixel || flash.t > LOOP_FLASH_MS / 2)) {
      ctx.fillStyle = colors.loopFill;
      tracePoly(flash.poly);
      ctx.fill();
    }
    if (!hint) return;
    if (!colors.pixel) {
      ctx.fillStyle = colors.hintFill;
      tracePoly(hint.poly);
      ctx.fill();
    }
    ctx.strokeStyle = colors.hint;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(px(hx), px(hy));
    ctx.lineTo(px(hint.to.x), px(hint.to.y));
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const drawNucleos = () => {
    const pulse = Math.sin(elapsed / 180) * 1.5;
    for (const p of nucleos) {
      if (colors.pixel) {
        const x = Math.round(p.x) - 6;
        const y = Math.round(p.y) - 6;
        ctx.fillStyle = colors.nucleo;
        ctx.fillRect(x, y, 12, 12);
        ctx.fillStyle = colors.nucleoCore;
        ctx.fillRect(x + 4, y + 4, 4, 4);
        continue;
      }
      const r = NUCLEO_R + pulse;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      glow(colors.nucleo);
      if (colors.outline) {
        ctx.fillStyle = withAlpha(colors.nucleo, 0.2);
        ctx.fill();
        ctx.strokeStyle = colors.nucleo;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = colors.nucleo;
        ctx.fill();
      }
      noGlow();
      ctx.fillStyle = colors.nucleoCore;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawEsporas = () => {
    for (const e of esporas) {
      if (colors.pixel) {
        const x = Math.round(e.x);
        const y = Math.round(e.y);
        ctx.fillStyle = colors.espora;
        ctx.fillRect(x - 7, y - 7, 14, 14); // cuerpo
        ctx.fillRect(x - 2, y - 11, 4, 22); // púas en cruz
        ctx.fillRect(x - 11, y - 2, 22, 4);
        ctx.fillStyle = colors.esporaCore;
        ctx.fillRect(x - 3, y - 3, 6, 6); // hueco: la distingue del cuerpo de la serpiente
        continue;
      }
      ctx.beginPath();
      const spikes = 8;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? ESPORA_R + 3 : ESPORA_R - 3;
        const a = e.spin + (i * Math.PI) / spikes;
        const x = e.x + Math.cos(a) * r;
        const y = e.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      glow(colors.espora);
      if (colors.outline) {
        ctx.strokeStyle = colors.espora;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = colors.espora;
        ctx.fill();
      }
      noGlow();
      ctx.fillStyle = colors.esporaCore;
      ctx.beginPath();
      ctx.arc(e.x, e.y, colors.outline ? 2.5 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawSerpent = () => {
    const dead = phase === "over";
    if (colors.pixel) {
      ctx.fillStyle = colors.bodyEdge;
      for (let i = 0; i < pts.length; i += 2) {
        ctx.fillRect(Math.round(pts[i].x) - 5, Math.round(pts[i].y) - 5, 10, 10);
      }
      ctx.fillStyle = colors.body;
      for (let i = 0; i < pts.length; i += 2) {
        ctx.fillRect(Math.round(pts[i].x) - 3, Math.round(pts[i].y) - 3, 6, 6);
      }
      const x = Math.round(hx);
      const y = Math.round(hy);
      ctx.fillStyle = dead ? colors.bodyEdge : colors.head;
      ctx.fillRect(x - 7, y - 7, 14, 14);
      ctx.fillStyle = colors.eye;
      ctx.fillRect(Math.round(x + Math.cos(angle) * 3) - 1, Math.round(y + Math.sin(angle) * 3) - 1, 3, 3);
      return;
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.lineTo(hx, hy);
    ctx.strokeStyle = colors.bodyEdge;
    ctx.lineWidth = BODY_R * 2 + 6;
    ctx.stroke();
    glow(colors.body);
    ctx.strokeStyle = colors.body;
    ctx.lineWidth = BODY_R * 2;
    ctx.stroke();
    noGlow();
    if (colors.outline) {
      ctx.strokeStyle = colors.bg;
      ctx.lineWidth = BODY_R;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(hx, hy, HEAD_R, 0, Math.PI * 2);
    glow(dead ? colors.nucleo : colors.head);
    ctx.fillStyle = dead ? colors.nucleo : colors.head;
    ctx.fill();
    noGlow();
    ctx.fillStyle = colors.eye;
    ctx.beginPath();
    ctx.arc(hx + Math.cos(angle) * 3, hy + Math.sin(angle) * 3, 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawLabel = () => {
    if (elapsed > HINT_TEXT_MS || phase !== "playing") return;
    ctx.font = `12px ${colors.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = colors.label;
    glow(colors.label, 0.5);
    ctx.fillText("← → GIRAR · CERCA LOS NÚCLEOS", W / 2, ARENA_B - 28);
    noGlow();
  };

  const draw = () => {
    ctx.imageSmoothingEnabled = !colors.pixel;
    noGlow();
    drawArena();
    drawLoops();
    drawNucleos();
    drawEsporas();
    drawSerpent();
    drawLabel();
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
    if (!LEFT_KEYS.has(e.code) && !RIGHT_KEYS.has(e.code)) return;
    if (CAPTURED_KEYS.has(e.code)) e.preventDefault();
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
  while (nucleos.length < NUCLEOS_ON_FIELD) spawnNucleo();
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
