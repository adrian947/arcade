// Motor de RANARIA (SPEC 10), diseñado desde cero en la game jam: cruce de carretera y río
// estilo Frogger. Todo el estado mutable vive dentro de la instancia.

import { DEFAULT_SKIN, type GameFactory, type SkinId } from "@/games/types";
import { getPalette } from "@/games/ranaria/skins";

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

const mod = (a: number, n: number) => ((a % n) + n) % n;

export const createRanaria: GameFactory = (canvas, callbacks, options) => {
  const ctx = canvas.getContext("2d")!;
  let colors = getPalette(options?.skin ?? DEFAULT_SKIN, canvas);
  let labelSprite: HTMLCanvasElement | null = null; // rótulo umbralizado para skins "pixel"

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
  let clock = 0; // ms de mundo (parpadeos del skin); se congela en pausa
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
    clock += dt;
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
  // En skins "pixel" todo va en coordenadas enteras y sin formas curvas: solo los colores de la paleta.
  const px = (v: number) => (colors.pixel ? Math.round(v) : v);

  const withGlow = (color: string, blur: number, paint: () => void) => {
    if (colors.glow > 0 && blur > 0) {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
    }
    paint();
    ctx.shadowBlur = 0;
  };

  const fillRow = (r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, r * CELL, W, CELL);
  };

  const hLine = (y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, y - 1, W, 2);
  };

  // Círculo relleno: arco normal o, en skins "pixel", filas de rectángulos enteros.
  const fillCircle = (x: number, y: number, r: number, color: string) => {
    ctx.fillStyle = color;
    if (!colors.pixel) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const cx0 = Math.round(x);
    const cy0 = Math.round(y);
    for (let dy = -r; dy < r; dy += 2) {
      const half = Math.round(Math.sqrt(r * r - (dy + 1) * (dy + 1)));
      ctx.fillRect(cx0 - half, cy0 + dy, half * 2, 2);
    }
  };

  const drawFrogAt = (x: number, y: number, size: number, dir: Dir) => {
    const fx = px(x - size / 2);
    const fy = px(y - size / 2);
    if (colors.frogBorder) {
      ctx.fillStyle = colors.frogBorder;
      ctx.fillRect(fx - 2, fy - 2, size + 4, size + 4);
    }
    withGlow(colors.frog, colors.glow + 4, () => {
      ctx.fillStyle = colors.frog;
      ctx.fillRect(fx, fy, size, size);
    });
    const scale = size / FROG_SIZE;
    const eye = colors.pixel ? Math.round(EYE_SIZE * scale) : EYE_SIZE * scale;
    ctx.fillStyle = colors.frogEye;
    for (const [ex, ey] of EYES[dir]) ctx.fillRect(px(x + ex * scale - eye / 2), px(y + ey * scale - eye / 2), eye, eye);
  };

  const drawBackground = () => {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);
    if (colors.bankFill) fillRow(0, colors.bankFill);
    if (colors.waterFill) for (let r = 1; r <= 5; r++) fillRow(r, colors.waterFill);
    if (colors.sidewalkFill) {
      fillRow(6, colors.sidewalkFill);
      fillRow(11, colors.sidewalkFill);
    }

    if (colors.bankStroke) withGlow(colors.bankStroke, colors.glow, () => hLine(CELL, colors.bankStroke!));
    if (colors.waterLines) {
      ctx.fillStyle = colors.waterLines;
      for (let y = CELL + 12; y < 6 * CELL; y += 12) ctx.fillRect(0, y, W, 1);
    }
    if (colors.sidewalkStroke) {
      const stroke = colors.sidewalkStroke;
      withGlow(stroke, colors.glow - 4, () => {
        for (const r of [6, 11]) {
          ctx.fillStyle = stroke;
          ctx.fillRect(0, r * CELL, W, 2);
          ctx.fillRect(0, (r + 1) * CELL - 2, W, 2);
        }
      });
    }

    // Líneas discontinuas entre carriles de la carretera.
    ctx.strokeStyle = colors.laneLine;
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
      if (colors.pixel) {
        fillCircle(x, y, NEST_RADIUS + 2, colors.nestStroke);
        fillCircle(x, y, NEST_RADIUS - 2, colors.nestFill);
      } else {
        ctx.fillStyle = colors.nestFill;
        ctx.strokeStyle = colors.nestStroke;
        ctx.lineWidth = 2;
        withGlow(colors.nestStroke, colors.glow, () => {
          ctx.beginPath();
          ctx.arc(x, y, NEST_RADIUS, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
      if (nests[i]) drawFrogAt(x, y, 24, "down");
    });
  };

  // Rectángulo relleno o, con outline, solo contorno de 2 px; ambos con el glow del skin.
  const drawBody = (x: number, y: number, w: number, h: number, color: string, blur: number) => {
    withGlow(color, blur, () => {
      if (colors.outline) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
      }
    });
  };

  const vehicleColor = (r: number) => (r === 10 || r === 9 || r === 7 ? colors.cars[r] : colors.truck);

  const drawLanes = () => {
    LANES.forEach((lane, li) => {
      const top = lane.row * CELL;
      for (const ox of laneObjects(li)) {
        const x = px(ox);
        if (lane.kind === "car" || lane.kind === "truck") {
          drawBody(x + 2, top + 10, lane.len - 4, CELL - 20, vehicleColor(lane.row), colors.glow);
          if (lane.kind === "truck" && colors.truckWindow) {
            ctx.fillStyle = colors.truckWindow;
            const wx = lane.dir === 1 ? x + lane.len - 24 : x + 10;
            ctx.fillRect(wx, top + 16, 14, CELL - 32);
          }
          // Faros en el frente, según la dirección de marcha.
          ctx.fillStyle = colors.headlight;
          const fx = lane.dir === 1 ? x + lane.len - 8 : x + 2;
          ctx.fillRect(fx, top + 13, 6, 6);
          ctx.fillRect(fx, top + CELL - 19, 6, 6);
        } else if (lane.kind === "log") {
          drawBody(x, top + 8, lane.len, CELL - 16, colors.log, colors.glow - 2);
          if (colors.pixel) {
            ctx.fillStyle = colors.logGrain;
            for (let gx = x + 20; gx < x + lane.len - 10; gx += 40) {
              ctx.fillRect(gx, top + 17, 18, 2);
              ctx.fillRect(gx + 10, top + CELL - 19, 18, 2);
            }
          } else {
            ctx.strokeStyle = colors.logGrain;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let gx = x + 20; gx < x + lane.len - 10; gx += 40) {
              ctx.moveTo(gx, top + 18);
              ctx.lineTo(gx + 18, top + 18);
              ctx.moveTo(gx + 10, top + CELL - 18);
              ctx.lineTo(gx + 28, top + CELL - 18);
            }
            ctx.stroke();
          }
        } else {
          const n = Math.round(lane.len / 40);
          for (let k = 0; k < n; k++) {
            const tx = x + 20 + k * 40;
            const ty = top + CELL / 2;
            if (colors.outline) {
              withGlow(colors.turtle, colors.glow - 2, () => {
                ctx.strokeStyle = colors.turtle;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(tx, ty, 15, 0, Math.PI * 2);
                ctx.stroke();
              });
            } else {
              fillCircle(tx, ty, 16, colors.turtle);
            }
            if (colors.turtleDot) {
              ctx.fillStyle = colors.turtleDot;
              ctx.fillRect(tx - 3, ty - 3, 6, 6);
            }
          }
        }
      }
    });
  };

  const drawFrog = () => {
    const y = row * CELL + CELL / 2;
    if (phase === "dying" || phase === "over") {
      const h = FROG_SIZE / 2;
      if (colors.pixel) {
        // X escalonada con bloques de 6 px.
        ctx.fillStyle = colors.dead;
        const x0 = Math.round(cx);
        for (let d = -h; d < h; d += 4) {
          ctx.fillRect(x0 + d - 2, y + d - 2, 6, 6);
          ctx.fillRect(x0 - d - 4, y + d - 2, 6, 6);
        }
        return;
      }
      withGlow(colors.dead, colors.glow + 4, () => {
        ctx.strokeStyle = colors.dead;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cx - h, y - h);
        ctx.lineTo(cx + h, y + h);
        ctx.moveTo(cx + h, y - h);
        ctx.lineTo(cx - h, y + h);
        ctx.stroke();
      });
      return;
    }
    drawFrogAt(cx, y, FROG_SIZE, facing);
  };

  const drawTimeBar = () => {
    let color = timeLeft > 10 ? colors.timeHigh : timeLeft > 5 ? colors.timeMid : colors.timeLow;
    if (timeLeft <= 5 && colors.timeLowBlink && Math.floor(clock / 125) % 2 === 1) color = colors.timeLowBlink;
    withGlow(color, colors.glow - 4, () => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 592, px((W * Math.max(0, timeLeft)) / TIME_PER_FROG), 6);
    });
  };

  // Texto sin antialiasing para skins "pixel": se dibuja una vez en un canvas aparte y se umbraliza.
  const buildLabelSprite = (text: string) => {
    const off = document.createElement("canvas");
    off.width = W;
    off.height = CELL;
    const octx = off.getContext("2d")!;
    octx.font = `16px ${colors.font}`;
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.fillStyle = "#fff";
    octx.fillText(text, W / 2, CELL / 2);
    const img = octx.getImageData(0, 0, W, CELL);
    const m = /^#([0-9a-f]{6})$/i.exec(colors.label);
    const n = m ? parseInt(m[1], 16) : 0xffffff;
    for (let i = 0; i < img.data.length; i += 4) {
      const on = img.data[i + 3] >= 128;
      img.data[i] = (n >> 16) & 255;
      img.data[i + 1] = (n >> 8) & 255;
      img.data[i + 2] = n & 255;
      img.data[i + 3] = on ? 255 : 0;
    }
    octx.putImageData(img, 0, 0);
    return off;
  };

  const drawLabel = (text: string) => {
    if (colors.pixel) {
      if (!labelSprite) labelSprite = buildLabelSprite(text);
      ctx.drawImage(labelSprite, 0, 6 * CELL);
      return;
    }
    withGlow(colors.label, colors.glow - 4, () => {
      ctx.fillStyle = colors.label;
      ctx.font = `16px ${colors.font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, W / 2, 6 * CELL + CELL / 2); // en la mediana
    });
  };

  const draw = () => {
    ctx.imageSmoothingEnabled = !colors.pixel;
    drawBackground();
    drawNests();
    drawLanes();
    drawFrog();
    drawTimeBar();
    if (phase === "waiting") drawLabel("PULSA UNA FLECHA");
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
  // La fuente pixel puede cargar después del primer rótulo umbralizado.
  void document.fonts?.ready.then(() => {
    labelSprite = null;
  });

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
    setSkin(skin: SkinId) {
      if (destroyed) return;
      colors = getPalette(skin, canvas);
      labelSprite = null;
      draw(); // visible aunque el loop esté detenido (pausa, espera o fin)
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
    },
  };
};
