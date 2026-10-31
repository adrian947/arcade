// Motor de FROGGER (SPEC 13), escrito desde cero: cruce de carretera y río con bocas destino.
// Todo el estado mutable vive dentro de la instancia.

import { DEFAULT_SKIN, type GameFactory, type SkinId } from "@/games/types";
import { getPalette } from "@/games/frogger/skins";

const W = 800;
const H = 600;

// ── Constants ─────────────────────────────────────────────────────────────────
const CELL = 40;
const COLS = 16;
const ROWS = 14;
const BOARD_X = 80; // tablero 640×560 centrado en horizontal
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;

const ROW_GOALS = 0;
const ROW_SAFE_MID = 7;
const ROW_START = 13;
const START_CX = 7 * CELL + CELL / 2; // centro de la columna 7
const MIN_CX = CELL / 2;
const MAX_CX = BOARD_W - CELL / 2;

const MOUTH_COLS = [1, 4, 7, 10, 13] as const; // cada boca ocupa esta columna y la siguiente
const HOP_MS = 120;
const DYING_MS = 500;
const START_LIVES = 3;

const TURTLE_CYCLE_MS = 4500;
const TURTLE_WARN_AT = 2600; // 3 s visibles (los últimos 400 ms con aviso)
const TURTLE_DIVE_AT = 3000; // 1,5 s bajo el agua

const ROW_SCORE = 10;
const MOUTH_SCORE = 50;
const SECOND_BONUS = 10;
const ROUND_BONUS = 200;

const multFor = (level: number) => Math.min(2.5, 1.15 ** (level - 1));
const timeFor = (level: number) => Math.max(8, 15 - (level - 1));

type Kind = "car" | "truck" | "log" | "turtles";
type Lane = {
  readonly row: number;
  readonly dir: 1 | -1;
  readonly speed: number; // px/s a nivel 1
  readonly kind: Kind;
  readonly width: number; // celdas
  readonly n: number;
  readonly sep: number; // celdas entre inicios
  readonly dives?: readonly number[]; // índices de grupos de tortugas que se sumergen
};

const LANES: readonly Lane[] = Object.freeze([
  { row: 12, dir: -1, speed: 90, kind: "car", width: 1, n: 3, sep: 6 },
  { row: 11, dir: 1, speed: 120, kind: "car", width: 1, n: 3, sep: 6 },
  { row: 10, dir: -1, speed: 150, kind: "truck", width: 2, n: 2, sep: 9 },
  { row: 9, dir: 1, speed: 200, kind: "car", width: 1, n: 2, sep: 9 },
  { row: 8, dir: -1, speed: 120, kind: "truck", width: 3, n: 2, sep: 10 },
  { row: 6, dir: 1, speed: 70, kind: "log", width: 3, n: 3, sep: 7 },
  { row: 5, dir: -1, speed: 90, kind: "turtles", width: 3, n: 3, sep: 7, dives: [0] },
  { row: 4, dir: 1, speed: 110, kind: "log", width: 4, n: 2, sep: 10 },
  { row: 3, dir: -1, speed: 80, kind: "turtles", width: 2, n: 4, sep: 5, dives: [1, 3] },
  { row: 2, dir: 1, speed: 130, kind: "log", width: 2, n: 3, sep: 6 },
  { row: 1, dir: -1, speed: 100, kind: "log", width: 3, n: 3, sep: 7 },
] as const);

const isRiverRow = (row: number) => row >= 1 && row <= 6;
const isRoadRow = (row: number) => row >= 8 && row <= 12;
const laneOf = (row: number) => LANES.findIndex((l) => l.row === row);

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
  up: [[-6, -8], [6, -8]],
  down: [[-6, 8], [6, 8]],
  left: [[-8, -6], [-8, 6]],
  right: [[8, -6], [8, 6]],
};

const mod = (a: number, n: number) => ((a % n) + n) % n;

export const createFrogger: GameFactory = (canvas, callbacks, options) => {
  const ctx = canvas.getContext("2d")!;
  let colors = getPalette(options?.skin ?? DEFAULT_SKIN, canvas);
  let labelSprite: HTMLCanvasElement | null = null; // rótulo umbralizado para skins "pixel"

  // ── Estado de la instancia ──────────────────────────────────────────────────
  let cx = START_CX; // centro de la rana en px del tablero
  let row = ROW_START;
  let facing: Dir = "up";
  let hopping = false;
  let hopT = 0;
  let fromCx = cx;
  let fromRow = row;
  let pendingDir: Dir | null = null;
  let bestRow = ROW_START;
  let level = 1;
  let mult = multFor(level);
  let timeLeft = timeFor(level);
  const goals = [false, false, false, false, false];
  const laneShift = LANES.map(() => 0); // desplazamiento acumulado de cada carril (px)
  let score = 0;
  let lives = START_LIVES;
  let phase: "waiting" | "playing" | "dying" | "over" | "ended" = "waiting";
  let dyingMs = 0;
  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId: number | null = null;
  let clock = 0; // ms de mundo (ciclo de tortugas); se congela en pausa
  let emitted = { score: -1, lives: -1, level: -1 };

  const isRunning = () => !paused && !destroyed && (phase === "waiting" || phase === "playing" || phase === "dying");
  const acceptsInput = () => !paused && !destroyed && (phase === "waiting" || phase === "playing");

  const emitStats = () => {
    if (emitted.score === score && emitted.lives === lives && emitted.level === level) return;
    emitted = { score, lives, level };
    callbacks.onStats({ score, lives, level });
  };

  // ── Carriles ────────────────────────────────────────────────────────────────
  // Borde izquierdo (px del tablero) de cada entidad del carril; el patrón se repite cada n × sep celdas.
  const laneXs = (li: number) => {
    const lane = LANES[li];
    const period = lane.n * lane.sep * CELL;
    const w = lane.width * CELL;
    const xs: number[] = [];
    for (let i = 0; i < lane.n; i++) xs.push(mod(i * lane.sep * CELL + laneShift[li], period) - w);
    return xs;
  };

  // Estado de un grupo de tortugas: "up" (sostiene), "warn" (sostiene, a punto de hundirse) o "down".
  const turtleState = (li: number, group: number): "up" | "warn" | "down" => {
    if (!LANES[li].dives?.includes(group)) return "up";
    const t = mod(clock + li * 900 + group * 1500, TURTLE_CYCLE_MS);
    if (t < TURTLE_WARN_AT) return "up";
    return t < TURTLE_DIVE_AT ? "warn" : "down";
  };

  // ¿Hay un tronco o tortugas a flote bajo el centro de la rana?
  const hasSupport = () => {
    const li = laneOf(row);
    if (li < 0) return false;
    const w = LANES[li].width * CELL;
    return laneXs(li).some((x, g) => cx >= x && cx < x + w && turtleState(li, g) !== "down");
  };

  const hitByVehicle = () => {
    const li = laneOf(row);
    if (li < 0) return false;
    const w = LANES[li].width * CELL;
    return laneXs(li).some((x) => cx >= x && cx < x + w);
  };

  // ── Lógica ──────────────────────────────────────────────────────────────────
  const respawn = () => {
    cx = START_CX;
    row = ROW_START;
    facing = "up";
    hopping = false;
    pendingDir = null;
    bestRow = ROW_START;
    timeLeft = timeFor(level);
  };

  const die = () => {
    phase = "dying";
    dyingMs = DYING_MS;
    hopping = false;
    pendingDir = null;
  };

  const completeRound = () => {
    score += ROUND_BONUS;
    level += 1;
    mult = multFor(level);
    goals.fill(false);
    laneShift.fill(0);
  };

  const reachGoal = () => {
    const col = Math.floor(cx / CELL);
    const i = MOUTH_COLS.findIndex((c) => col === c || col === c + 1);
    if (i < 0 || goals[i]) {
      die();
      return;
    }
    goals[i] = true;
    score += MOUTH_SCORE + SECOND_BONUS * Math.floor(timeLeft);
    if (goals.every(Boolean)) completeRound();
    emitStats();
    respawn();
  };

  // Resuelve la celda donde acaba de caer la rana.
  const land = () => {
    if (row === ROW_GOALS) {
      reachGoal();
      return;
    }
    if (row < bestRow) {
      score += ROW_SCORE * (bestRow - row);
      bestRow = row;
      emitStats();
    }
    if (isRoadRow(row) && hitByVehicle()) die();
    else if (isRiverRow(row) && !hasSupport()) die();
  };

  // Inicia un salto; devuelve false si la rana no se movió.
  const startHop = (d: Dir) => {
    facing = d;
    let nextCx = cx;
    let nextRow = row;
    if (d === "up") nextRow -= 1;
    else if (d === "down") nextRow += 1;
    else nextCx = Math.min(MAX_CX, Math.max(MIN_CX, cx + (d === "left" ? -CELL : CELL)));
    if (nextRow > ROW_START || (nextRow === row && nextCx === cx)) return false;
    fromCx = cx;
    fromRow = row;
    cx = nextCx;
    row = nextRow;
    hopping = true;
    hopT = 0;
    return true;
  };

  const update = (dt: number) => {
    const sec = dt / 1000;
    clock += dt;
    LANES.forEach((lane, i) => {
      laneShift[i] += lane.dir * lane.speed * mult * sec;
    });

    if (phase === "dying") {
      dyingMs -= dt;
      if (dyingMs <= 0) {
        lives -= 1;
        emitStats();
        if (lives <= 0) phase = "over";
        else {
          respawn();
          phase = "playing";
        }
      }
      return;
    }
    if (phase !== "playing") return;

    timeLeft -= sec;
    if (timeLeft <= 0) {
      timeLeft = 0;
      die();
      return;
    }

    if (hopping) {
      hopT += dt;
      if (hopT < HOP_MS) return;
      hopping = false;
      land();
      if (phase === "playing" && pendingDir) {
        const d = pendingDir;
        pendingDir = null;
        startHop(d);
      }
      return;
    }

    // Quieta: el río la arrastra; la carretera la puede atropellar.
    if (isRiverRow(row)) {
      const li = laneOf(row);
      cx += LANES[li].dir * LANES[li].speed * mult * sec;
      if (cx < 0 || cx > BOARD_W || !hasSupport()) die();
    } else if (isRoadRow(row) && hitByVehicle()) die();
  };

  // ── Draw ────────────────────────────────────────────────────────────────────
  // Todo color sale de la paleta del skin activo (games/frogger/skins.ts).
  const rowY = (r: number) => r * CELL;

  // En skins "pixel" todo va en coordenadas enteras y sin formas curvas antialiasadas.
  const px = (v: number) => (colors.pixel ? Math.round(v) : v);

  // Aplica el glow del skin a una pieza y lo apaga al terminar para no contaminar otros dibujos.
  const withGlow = (color: string, blur: number, paint: () => void) => {
    if (colors.glow > 0 && blur > 0) {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
    }
    paint();
    ctx.shadowBlur = 0;
  };

  // Elipse rellena: arco normal o, en skins "pixel", filas de rectángulos enteros de 2 px.
  const fillEllipse = (x: number, y: number, rx: number, ry: number, color: string) => {
    ctx.fillStyle = color;
    if (!colors.pixel) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    for (let dy = -ry; dy < ry; dy += 2) {
      const k = (dy + 1) / ry;
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - k * k)));
      ctx.fillRect(x0 - half, y0 + dy, half * 2, 2);
    }
  };

  // Rectángulo relleno o, con outline, solo contorno de 2 px; ambos con el glow del skin.
  const drawBody = (x: number, y: number, w: number, h: number, color: string) => {
    withGlow(color, colors.glow, () => {
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

  const hLine = (y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, y - 1, BOARD_W, 2);
  };

  // Franjas de zona y líneas de carril (coordenadas del tablero).
  const drawZones = () => {
    if (colors.hedgeFill) {
      ctx.fillStyle = colors.hedgeFill;
      ctx.fillRect(0, rowY(ROW_GOALS), BOARD_W, CELL);
    }
    if (colors.riverFill) {
      ctx.fillStyle = colors.riverFill;
      ctx.fillRect(0, rowY(1), BOARD_W, 6 * CELL);
    }
    if (colors.safeFill) {
      ctx.fillStyle = colors.safeFill;
      ctx.fillRect(0, rowY(ROW_SAFE_MID), BOARD_W, CELL);
      ctx.fillRect(0, rowY(ROW_START), BOARD_W, CELL);
    }

    const hedgeStroke = colors.hedgeStroke;
    if (hedgeStroke) withGlow(hedgeStroke, colors.glow - 4, () => hLine(rowY(1), hedgeStroke));
    const safeStroke = colors.safeStroke;
    if (safeStroke) {
      withGlow(safeStroke, colors.glow - 4, () => {
        for (const r of [ROW_SAFE_MID, ROW_START]) {
          hLine(rowY(r) + 1, safeStroke);
          hLine(rowY(r + 1) - 1, safeStroke);
        }
      });
    }

    if (colors.riverLines) {
      ctx.strokeStyle = colors.riverLines;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 22]);
      for (let r = 1; r <= 6; r++) {
        ctx.beginPath();
        ctx.moveTo(0, rowY(r) + CELL / 2);
        ctx.lineTo(BOARD_W, rowY(r) + CELL / 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = colors.laneLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 12]);
    for (let r = 9; r <= 12; r++) {
      ctx.beginPath();
      ctx.moveTo(0, rowY(r));
      ctx.lineTo(BOARD_W, rowY(r));
      ctx.stroke();
    }
    ctx.setLineDash([]);
  };

  const drawFrogAt = (fx: number, fy: number, dir: Dir, legs: boolean, color: string) => {
    const x = px(fx);
    const y = px(fy);
    const border = colors.frogBorder;
    if (border) {
      // Contorno duro (skins sin glow): separa la rana de troncos o tortugas de tono parecido.
      ctx.fillStyle = border;
      if (legs) {
        ctx.fillRect(x - 19, y - 14, 10, 10);
        ctx.fillRect(x + 9, y - 14, 10, 10);
        ctx.fillRect(x - 19, y + 4, 10, 10);
        ctx.fillRect(x + 9, y + 4, 10, 10);
      }
      fillEllipse(x, y, 16, 14, border);
    }
    withGlow(color, colors.glow + 4, () => {
      ctx.fillStyle = color;
      if (legs) {
        ctx.fillRect(x - 17, y - 12, 6, 6);
        ctx.fillRect(x + 11, y - 12, 6, 6);
        ctx.fillRect(x - 17, y + 6, 6, 6);
        ctx.fillRect(x + 11, y + 6, 6, 6);
      }
      fillEllipse(x, y, 14, 12, color);
    });
    ctx.fillStyle = colors.frogEye;
    for (const [ex, ey] of EYES[dir]) ctx.fillRect(x + ex - 2, y + ey - 2, 4, 4);
  };

  const drawGoals = () => {
    MOUTH_COLS.forEach((c, i) => {
      const x = c * CELL;
      ctx.fillStyle = colors.mouthFill;
      ctx.fillRect(x + 2, 4, 2 * CELL - 4, CELL - 4);
      withGlow(colors.mouthBorder, colors.glow - 4, () => {
        ctx.strokeStyle = colors.mouthBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, 4, 2 * CELL - 4, CELL - 4);
      });
      if (goals[i]) drawFrogAt(x + CELL, CELL / 2 + 2, "down", false, colors.frog);
    });
  };

  const drawVehicle = (lane: Lane, li: number, x: number) => {
    const y = rowY(lane.row);
    const w = lane.width * CELL;
    const front = lane.dir === 1 ? x + w - 8 : x + 4;
    if (lane.kind === "car") {
      drawBody(x + 4, y + 8, w - 8, CELL - 16, colors.cars[li % colors.cars.length]);
    } else {
      drawBody(x + 3, y + 6, w - 6, CELL - 12, colors.truck);
      drawBody(lane.dir === 1 ? x + w - 15 : x + 3, y + 6, 12, CELL - 12, colors.truckCab);
    }
    ctx.fillStyle = colors.headlight;
    ctx.fillRect(front, y + 10, 4, 4);
    ctx.fillRect(front, y + CELL - 14, 4, 4);
  };

  const drawLog = (lane: Lane, x: number) => {
    const y = rowY(lane.row);
    const w = lane.width * CELL;
    drawBody(x + 2, y + 6, w - 4, CELL - 12, colors.log);
    ctx.fillStyle = colors.logGrain;
    ctx.fillRect(x + 10, y + 14, px(w * 0.4), 2);
    ctx.fillRect(px(x + w * 0.45), y + 24, px(w * 0.4), 2);
  };

  const drawTurtle = (x: number, y: number, color: string) => {
    if (colors.outline) {
      withGlow(color, colors.glow, () => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.stroke();
      });
      return;
    }
    fillEllipse(x, y, 15, 15, color);
  };

  const drawTurtles = (lane: Lane, li: number, x: number, group: number) => {
    const state = turtleState(li, group);
    if (state === "down") return;
    const y = rowY(lane.row) + CELL / 2;
    const hole = state === "warn" ? colors.turtleWarnHole : null;
    if (state === "warn" && !hole) ctx.globalAlpha = colors.turtleWarnAlpha;
    for (let k = 0; k < lane.width; k++) {
      const tx = x + k * CELL + CELL / 2;
      drawTurtle(tx, y, colors.turtle);
      if (hole) fillEllipse(tx, y, 9, 9, hole); // aviso sin alfa: anillo hueco
    }
    ctx.globalAlpha = 1;
  };

  const drawLanes = () => {
    LANES.forEach((lane, li) => {
      laneXs(li).forEach((lx, g) => {
        if (lx >= BOARD_W) return;
        const x = px(lx);
        if (lane.kind === "car" || lane.kind === "truck") drawVehicle(lane, li, x);
        else if (lane.kind === "log") drawLog(lane, x);
        else drawTurtles(lane, li, x, g);
      });
    });
  };

  const drawFrog = () => {
    let x = cx;
    let y = rowY(row) + CELL / 2;
    if (hopping) {
      const t = Math.min(1, hopT / HOP_MS);
      x = fromCx + (cx - fromCx) * t;
      y = rowY(fromRow) + CELL / 2 + (row - fromRow) * CELL * t;
    }
    if (phase === "dying") {
      if (Math.floor(dyingMs / 100) % 2 === 0) drawFrogAt(x, y, facing, false, colors.death);
      return;
    }
    drawFrogAt(x, y, facing, hopping, colors.frog);
  };

  const drawTimeBar = () => {
    const ratio = Math.max(0, timeLeft / timeFor(level));
    let color = ratio > 0.5 ? colors.timeHigh : ratio > 0.25 ? colors.timeMid : colors.timeLow;
    if (ratio <= 0.25 && colors.timeLowBlink && Math.floor(clock / 125) % 2 === 1) color = colors.timeLowBlink;
    withGlow(color, colors.glow - 4, () => {
      ctx.fillStyle = color;
      ctx.fillRect(BOARD_X, BOARD_H + 12, px(BOARD_W * ratio), 16);
    });
  };

  // Texto sin antialiasing para skins "pixel": se dibuja una vez en un canvas aparte y se umbraliza.
  const buildLabelSprite = (text: string) => {
    const off = document.createElement("canvas");
    off.width = BOARD_W;
    off.height = CELL;
    const octx = off.getContext("2d")!;
    octx.font = `16px ${colors.font}`;
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.fillStyle = "#fff";
    octx.fillText(text, BOARD_W / 2, CELL / 2);
    const img = octx.getImageData(0, 0, BOARD_W, CELL);
    const m = /^#([0-9a-f]{6})$/i.exec(colors.label);
    const n = m ? parseInt(m[1], 16) : 0xffffff;
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = (n >> 16) & 255;
      img.data[i + 1] = (n >> 8) & 255;
      img.data[i + 2] = n & 255;
      img.data[i + 3] = img.data[i + 3] >= 128 ? 255 : 0;
    }
    octx.putImageData(img, 0, 0);
    return off;
  };

  const drawLabel = (text: string) => {
    if (colors.pixel) {
      labelSprite ??= buildLabelSprite(text);
      ctx.drawImage(labelSprite, 0, rowY(ROW_SAFE_MID));
      return;
    }
    withGlow(colors.label, colors.glow - 4, () => {
      ctx.font = `16px ${colors.font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = colors.label;
      ctx.fillText(text, BOARD_W / 2, rowY(ROW_SAFE_MID) + CELL / 2);
    });
  };

  const draw = () => {
    ctx.imageSmoothingEnabled = !colors.pixel;
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(BOARD_X, 0);
    ctx.beginPath();
    ctx.rect(0, 0, BOARD_W, BOARD_H);
    ctx.clip();
    drawZones();
    drawGoals();
    drawLanes();
    drawFrog();
    if (phase === "waiting") drawLabel("PULSA UNA FLECHA");
    ctx.restore();
    drawTimeBar();
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

    if (hopping) {
      pendingDir = d; // una sola dirección en cola durante la animación
      return;
    }
    const moved = startHop(d);
    if (moved && phase === "waiting") phase = "playing";
  };

  window.addEventListener("keydown", onKeyDown);
  // La fuente pixel puede cargar después del primer dibujo del rótulo.
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
