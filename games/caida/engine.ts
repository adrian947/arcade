// Motor de CAÍDA (SPEC 15), escrito desde cero.
// Mecánicas centrales (distintas de TETRIS):
//  1. Prensa: el techo del pozo es una prensa que baja una fila cada cierto tiempo y achica el pozo.
//     Cada línea limpiada la sube una fila. Si baja sobre bloques apilados, aplasta: fin de partida.
//  2. Cascada: al limpiar líneas, cada grupo de bloques conectados que quede sin apoyo cae como
//     una pieza rígida hasta asentarse; si eso completa nuevas líneas, se encadenan (CADENA ×N).
// Piezas geométricas de 2 a 5 celdas. Todo el estado mutable vive dentro de la instancia.

import { DEFAULT_SKIN, type GameFactory, type SkinId } from "@/games/types";
import { getPalette, withAlpha, type CellLook } from "@/games/caida/skins";

const W = 800;
const H = 600;

// ── Constantes ────────────────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 18;
const CELL = 30;
const WX = (W - COLS * CELL) / 2; // 250: pozo de 300×540
const WY = 40;
const PLATE_H = 14; // placa visible de la prensa encima del pozo

const LOCK_MS = 450;
const MAX_LOCK_RESETS = 12;
const SOFT_MS = 35;
const CLEAR_MS = 260;
const CHAIN_SHOW_MS = 1400;
const PRESS_WARN_MS = 2000;
const LINES_PER_LEVEL = 10;
const LINE_SCORE = 100;
const SOFT_SCORE = 1;
const HARD_SCORE = 2;

const fallFor = (level: number) => Math.max(70, Math.round(800 * Math.pow(0.86, level - 1)));
const pressFor = (level: number) => Math.max(6, 16 - level) * 1000;

// Piezas geométricas (2 a 5 celdas); el índice + 1 es el color de la celda en la grilla.
const PIECES: readonly (readonly (readonly number[])[])[] = [
  [[1, 1]], // dúo
  [[1, 1, 1]], // barra
  [
    [1, 0],
    [1, 1],
  ], // ángulo
  [
    [1, 1],
    [1, 1],
  ], // cuadro
  [
    [1, 1, 1],
    [0, 1, 0],
  ], // te
  [
    [1, 1, 0],
    [0, 1, 1],
  ], // escalón
  [
    [1, 0, 0],
    [1, 1, 1],
  ], // gancho
  [
    [0, 1, 0],
    [1, 1, 1],
    [0, 1, 0],
  ], // cruz
];

const KICKS: readonly [number, number][] = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [-2, 0],
  [2, 0],
  [0, 1],
];

const LEFT_KEYS = new Set(["ArrowLeft", "KeyA"]);
const RIGHT_KEYS = new Set(["ArrowRight", "KeyD"]);
const DOWN_KEYS = new Set(["ArrowDown", "KeyS"]);
const CW_KEYS = new Set(["ArrowUp", "KeyX", "KeyW"]);
const CCW_KEYS = new Set(["KeyZ"]);
const DROP_KEYS = new Set(["Space"]);
const CAPTURED_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"]);

type Shape = number[][];
type Piece = { kind: number; shape: Shape; x: number; y: number };

const rotateCW = (m: Shape): Shape => m[0].map((_, i) => m.map((row) => row[i]).reverse());
const rotateCCW = (m: Shape): Shape => m[0].map((_, i) => m.map((row) => row[row.length - 1 - i]));

export const createCaida: GameFactory = (canvas, callbacks, options) => {
  const ctx = canvas.getContext("2d")!;
  let colors = getPalette(options?.skin ?? DEFAULT_SKIN, canvas);

  // ── Estado de la instancia ──────────────────────────────────────────────────
  const grid = new Int8Array(ROWS * COLS); // 0 = vacío, 1..8 = pieza
  let bag: number[] = [];
  let piece: Piece | null = null;
  let next = 0;
  let pressRows = 0; // filas del pozo ocupadas por la prensa
  let pressMs = pressFor(1);
  let pressPending = false; // la prensa debe bajar al fijarse la pieza actual
  let fallMs = 0;
  let lockMs = 0;
  let lockResets = 0;
  let clearRows: number[] = [];
  let clearMs = 0;
  let chain = 0;
  let chainShow = 0; // cadena a mostrar en el panel
  let chainShowMs = 0;
  let lines = 0;
  let score = 0;
  let level = 1;
  let phase: "falling" | "clearing" | "over" | "ended" = "falling";
  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId: number | null = null;
  const keys = new Set<string>();
  let emitted = { score: -1, level: -1 };
  let overFired = false;

  const isOver = () => phase === "over"; // función: TS no ve que shift/rotate/hardDrop cambian phase
  const isRunning = () => !paused && !destroyed && (phase === "falling" || phase === "clearing");

  const emitStats = () => {
    if (emitted.score === score && emitted.level === level) return;
    emitted = { score, level };
    callbacks.onStats({ score, lives: 0, level });
  };

  // ── Grilla y piezas ─────────────────────────────────────────────────────────
  const at = (c: number, r: number) => grid[r * COLS + c];

  const takeFromBag = () => {
    if (bag.length === 0) {
      bag = PIECES.map((_, i) => i);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop()!;
  };

  const collides = (shape: Shape, x: number, y: number) => {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const gx = x + c;
        const gy = y + r;
        if (gx < 0 || gx >= COLS || gy >= ROWS || gy < pressRows) return true;
        if (at(gx, gy)) return true;
      }
    }
    return false;
  };

  const spawn = () => {
    const kind = next;
    next = takeFromBag();
    const shape = PIECES[kind].map((row) => [...row]);
    const x = Math.floor((COLS - shape[0].length) / 2);
    const y = pressRows;
    fallMs = 0;
    lockMs = 0;
    lockResets = 0;
    if (collides(shape, x, y)) {
      piece = { kind, shape, x, y };
      phase = "over"; // sin lugar bajo la prensa
      return;
    }
    piece = { kind, shape, x, y };
  };

  const grounded = () => !!piece && collides(piece.shape, piece.x, piece.y + 1);

  const onMoved = () => {
    if (grounded() && lockResets < MAX_LOCK_RESETS) {
      lockMs = 0;
      lockResets++;
    }
  };

  const shift = (dx: number) => {
    if (!piece || collides(piece.shape, piece.x + dx, piece.y)) return;
    piece.x += dx;
    onMoved();
  };

  const rotate = (dir: 1 | -1) => {
    if (!piece) return;
    const shape = dir === 1 ? rotateCW(piece.shape) : rotateCCW(piece.shape);
    const bx = piece.x + Math.floor((piece.shape[0].length - shape[0].length) / 2);
    const by = piece.y + Math.floor((piece.shape.length - shape.length) / 2);
    for (const [dx, dy] of KICKS) {
      if (!collides(shape, bx + dx, by + dy)) {
        piece.shape = shape;
        piece.x = bx + dx;
        piece.y = by + dy;
        onMoved();
        return;
      }
    }
  };

  const dropDistance = () => {
    if (!piece) return 0;
    let d = 0;
    while (!collides(piece.shape, piece.x, piece.y + d + 1)) d++;
    return d;
  };

  const hardDrop = () => {
    if (!piece) return;
    const d = dropDistance();
    piece.y += d;
    score += d * HARD_SCORE;
    lock();
  };

  // ── Prensa ──────────────────────────────────────────────────────────────────
  // Baja una fila. Devuelve false si aplasta bloques (fin de partida).
  const lowerPress = () => {
    pressMs = pressFor(level);
    pressPending = false;
    pressRows += 1;
    for (let c = 0; c < COLS; c++) if (at(c, pressRows - 1)) return false;
    return pressRows < ROWS;
  };

  // ── Líneas y cascada ────────────────────────────────────────────────────────
  const fullRows = () => {
    const out: number[] = [];
    for (let r = pressRows; r < ROWS; r++) {
      let full = true;
      for (let c = 0; c < COLS && full; c++) if (!at(c, r)) full = false;
      if (full) out.push(r);
    }
    return out;
  };

  // Cada grupo conectado (4 vecinos, cualquier color) sin apoyo cae como bloque rígido hasta asentarse.
  const settle = () => {
    const label = new Int16Array(ROWS * COLS);
    for (let guard = 0; guard < 2000; guard++) {
      label.fill(0);
      const groups: number[][] = [];
      for (let i = 0; i < grid.length; i++) {
        if (!grid[i] || label[i]) continue;
        const id = groups.length + 1;
        const cells: number[] = [];
        const stack = [i];
        label[i] = id;
        while (stack.length) {
          const k = stack.pop()!;
          cells.push(k);
          const c = k % COLS;
          const r = (k - c) / COLS;
          const near = [c > 0 ? k - 1 : -1, c < COLS - 1 ? k + 1 : -1, r > 0 ? k - COLS : -1, r < ROWS - 1 ? k + COLS : -1];
          for (const n of near) {
            if (n < 0 || !grid[n] || label[n]) continue;
            label[n] = id;
            stack.push(n);
          }
        }
        groups.push(cells);
      }
      // Baja el primer grupo que pueda bajar una fila y vuelve a etiquetar.
      const falling = groups.find((cells, gi) =>
        cells.every((k) => k + COLS < grid.length && (!grid[k + COLS] || label[k + COLS] === gi + 1)),
      );
      if (!falling) return;
      const values = falling.map((k) => grid[k]);
      for (const k of falling) grid[k] = 0;
      falling.forEach((k, i) => (grid[k + COLS] = values[i]));
    }
  };

  // Tras fijar una pieza o terminar una cascada: más líneas, o prensa pendiente y pieza nueva.
  const resolve = () => {
    const rows = fullRows();
    if (rows.length > 0) {
      chain += 1;
      clearRows = rows;
      clearMs = CLEAR_MS;
      phase = "clearing";
      return;
    }
    if (chain > 1) {
      chainShow = chain;
      chainShowMs = CHAIN_SHOW_MS;
    }
    chain = 0;
    if (pressPending && !lowerPress()) {
      phase = "over";
      return;
    }
    phase = "falling";
    spawn();
  };

  const finishClear = () => {
    const n = clearRows.length;
    for (const r of clearRows) for (let c = 0; c < COLS; c++) grid[r * COLS + c] = 0;
    clearRows = [];
    score += LINE_SCORE * n * n * chain * level;
    lines += n;
    pressRows = Math.max(0, pressRows - n); // cada línea sube la prensa una fila
    const newLevel = 1 + Math.floor(lines / LINES_PER_LEVEL);
    if (newLevel !== level) level = newLevel;
    settle();
    emitStats();
    resolve();
  };

  const lock = () => {
    if (!piece) return;
    const { shape, x, y, kind } = piece;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) if (shape[r][c]) grid[(y + r) * COLS + x + c] = kind + 1;
    }
    piece = null;
    emitStats();
    resolve();
  };

  // ── Update ──────────────────────────────────────────────────────────────────
  const update = (dt: number) => {
    if (chainShowMs > 0) chainShowMs = Math.max(0, chainShowMs - dt);

    if (phase === "clearing") {
      clearMs -= dt;
      if (clearMs <= 0) finishClear();
      return;
    }
    if (phase !== "falling" || !piece) return;

    // Prensa: si la pieza está pegada al techo, baja al fijarse.
    if (!pressPending) {
      pressMs -= dt;
      if (pressMs <= 0) {
        if (piece.y <= pressRows) pressPending = true;
        else if (!lowerPress()) {
          phase = "over";
          return;
        }
      }
    }

    const soft = [...DOWN_KEYS].some((k) => keys.has(k));
    const interval = soft ? Math.min(SOFT_MS, fallFor(level)) : fallFor(level);
    if (grounded()) {
      fallMs = 0;
      lockMs += dt;
      if (lockMs >= LOCK_MS) lock();
      return;
    }
    fallMs += dt;
    while (fallMs >= interval && piece && !grounded()) {
      fallMs -= interval;
      piece.y += 1;
      lockMs = 0;
      if (soft) score += SOFT_SCORE;
    }
    if (soft) emitStats();
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

  const drawCellAt = (px: number, py: number, size: number, look: CellLook) => {
    const x = colors.pixel ? Math.round(px) : px;
    const y = colors.pixel ? Math.round(py) : py;
    const s = size - 2;
    if (colors.outline) {
      ctx.fillStyle = withAlpha(look.fill, 0.18);
      ctx.fillRect(x + 1, y + 1, s, s);
      glow(look.fill);
      ctx.strokeStyle = look.fill;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, s - 2, s - 2);
      noGlow();
      if (look.style === "striped") {
        ctx.beginPath();
        ctx.moveTo(x + 6, y + s - 4);
        ctx.lineTo(x + s - 4, y + 6);
        ctx.stroke();
      }
      return;
    }
    if (look.style === "hollow") {
      ctx.fillStyle = look.fill;
      ctx.fillRect(x + 1, y + 1, s, s);
      ctx.fillStyle = look.mark;
      ctx.fillRect(x + 1, y + 1, s, 3);
      ctx.fillRect(x + 1, y + s - 2, s, 3);
      ctx.fillRect(x + 1, y + 1, 3, s);
      ctx.fillRect(x + s - 2, y + 1, 3, s);
      return;
    }
    ctx.fillStyle = look.fill;
    ctx.fillRect(x + 1, y + 1, s, s);
    if (look.style === "striped") {
      ctx.fillStyle = look.mark;
      for (let i = 4; i < s; i += 6) ctx.fillRect(x + 1, y + 1 + i, s, 2);
    } else if (look.style === "dotted") {
      ctx.fillStyle = look.mark;
      for (let i = 5; i < s - 2; i += 8) for (let j = 5; j < s - 2; j += 8) ctx.fillRect(x + i, y + j, 3, 3);
    } else if (colors.pixel) {
      ctx.fillStyle = look.mark;
      ctx.fillRect(x + 3, y + 3, 4, 4);
    } else {
      ctx.strokeStyle = look.mark;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1.5, y + 1.5, s - 1, s - 1);
    }
    if (colors.shade) {
      ctx.fillStyle = colors.shade;
      ctx.fillRect(x + 1, y + s - 5, s, 6);
    }
  };

  const look = (kind: number) => colors.pieces[kind % colors.pieces.length];

  const drawWell = () => {
    ctx.fillStyle = colors.wellBg;
    ctx.fillRect(WX, WY, COLS * CELL, ROWS * CELL);
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(WX + c * CELL + 0.5, WY);
      ctx.lineTo(WX + c * CELL + 0.5, WY + ROWS * CELL);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(WX, WY + r * CELL + 0.5);
      ctx.lineTo(WX + COLS * CELL, WY + r * CELL + 0.5);
    }
    ctx.stroke();
    glow(colors.frame, 0.8);
    ctx.strokeStyle = colors.frame;
    ctx.lineWidth = 2;
    ctx.strokeRect(WX - 2, WY - PLATE_H - 2, COLS * CELL + 4, ROWS * CELL + PLATE_H + 4);
    noGlow();
  };

  const drawStack = () => {
    const blink = phase === "clearing" && Math.floor(clearMs / 65) % 2 === 0;
    for (let r = pressRows; r < ROWS; r++) {
      const clearing = clearRows.includes(r);
      for (let c = 0; c < COLS; c++) {
        const v = at(c, r);
        if (!v) continue;
        if (clearing && blink) {
          glow(colors.flash, 1.2);
          ctx.fillStyle = colors.flash;
          ctx.fillRect(WX + c * CELL + 1, WY + r * CELL + 1, CELL - 2, CELL - 2);
          noGlow();
        } else drawCellAt(WX + c * CELL, WY + r * CELL, CELL, look(v - 1));
      }
    }
  };

  const drawPiece = () => {
    if (!piece || phase !== "falling") return;
    const { shape, x, y, kind } = piece;
    const gy = y + dropDistance();
    ctx.strokeStyle = colors.ghost;
    ctx.lineWidth = 1;
    if (colors.pixel) ctx.setLineDash([4, 4]);
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        ctx.strokeRect(WX + (x + c) * CELL + 3.5, WY + (gy + r) * CELL + 3.5, CELL - 7, CELL - 7);
      }
    }
    ctx.setLineDash([]);
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) drawCellAt(WX + (x + c) * CELL, WY + (y + r) * CELL, CELL, look(kind));
      }
    }
  };

  const drawPress = () => {
    const top = WY - PLATE_H;
    const bottom = WY + pressRows * CELL;
    const warn = pressPending || (phase === "falling" && pressMs <= PRESS_WARN_MS);
    ctx.fillStyle = colors.press;
    ctx.fillRect(WX, top, COLS * CELL, bottom - top);
    // Franjas de peligro sobre el borde inferior.
    const band = 8;
    const stripe = warn ? colors.hazardWarn : colors.hazard;
    ctx.save();
    ctx.beginPath();
    ctx.rect(WX, bottom - band - 4, COLS * CELL, band);
    ctx.clip();
    ctx.fillStyle = stripe;
    for (let x = WX - band * 2; x < WX + COLS * CELL + band; x += band * 2) {
      ctx.beginPath();
      ctx.moveTo(x, bottom - 4);
      ctx.lineTo(x + band, bottom - band - 4);
      ctx.lineTo(x + band * 2, bottom - band - 4);
      ctx.lineTo(x + band, bottom - 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // Borde inferior con dientes.
    glow(colors.pressEdge, 0.8);
    ctx.fillStyle = colors.pressEdge;
    ctx.fillRect(WX, bottom - 4, COLS * CELL, 2);
    for (let c = 0; c < COLS; c++) {
      const cx = WX + c * CELL + CELL / 2;
      ctx.beginPath();
      ctx.moveTo(cx - 6, bottom - 2);
      ctx.lineTo(cx + 6, bottom - 2);
      ctx.lineTo(cx, bottom + 4);
      ctx.closePath();
      ctx.fill();
    }
    noGlow();
  };

  const text = (s: string, x: number, y: number, color: string, size = 12) => {
    ctx.font = `${size}px ${colors.font}`;
    ctx.fillStyle = color;
    glow(color, 0.6);
    ctx.fillText(s, x, y);
    noGlow();
  };

  const drawPanels = () => {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Panel izquierdo: temporizador de la prensa.
    const lx = WX / 2;
    text("PRENSA", lx, 90, colors.label);
    const barX = lx - 10;
    const barY = 115;
    const barH = 300;
    const frac = pressPending ? 0 : Math.max(0, Math.min(1, pressMs / pressFor(level)));
    const warn = pressPending || pressMs <= PRESS_WARN_MS;
    ctx.fillStyle = colors.timerTrack;
    ctx.fillRect(barX, barY, 20, barH);
    const fill = warn ? colors.timerWarn : colors.timerBar;
    glow(fill, 0.8);
    ctx.fillStyle = fill;
    const h = colors.pixel ? Math.round(barH * frac) : barH * frac;
    ctx.fillRect(barX, barY + barH - h, 20, h);
    noGlow();
    const secs = pressPending ? 0 : Math.ceil(pressMs / 1000);
    text(String(secs).padStart(2, "0"), lx, barY + barH + 28, warn ? colors.timerWarn : colors.value, 16);
    text(`${pressRows}/${ROWS}`, lx, barY + barH + 62, colors.label, 10);

    // Panel derecho: siguiente pieza, líneas y cadena.
    const rx = WX + COLS * CELL + (W - WX - COLS * CELL) / 2;
    text("SIGUIENTE", rx, 90, colors.label);
    const box = 120;
    const bx = rx - box / 2;
    const by = 110;
    ctx.strokeStyle = colors.frame;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, box, box);
    const shape = PIECES[next];
    const s = 24;
    const ox = bx + (box - shape[0].length * s) / 2;
    const oy = by + (box - shape.length * s) / 2;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) if (shape[r][c]) drawCellAt(ox + c * s, oy + r * s, s, look(next));
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    text("LÍNEAS", rx, 290, colors.label);
    text(String(lines).padStart(3, "0"), rx, 320, colors.value, 18);
    if ((phase === "clearing" && chain > 1) || chainShowMs > 0) {
      const n = phase === "clearing" && chain > 1 ? chain : chainShow;
      text("CADENA", rx, 390, colors.chain, 14);
      text(`×${n}`, rx, 422, colors.chain, 22);
    }
  };

  const draw = () => {
    ctx.imageSmoothingEnabled = !colors.pixel;
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);
    drawWell();
    drawStack();
    drawPiece();
    drawPress();
    drawPanels();
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
      finish();
      return;
    }
    rafId = requestAnimationFrame(loop);
  };

  // Fin de partida (prensa que aplasta o pieza sin lugar): una sola vez por instancia.
  const finish = () => {
    if (overFired) return;
    overFired = true;
    keys.clear();
    stopLoop();
    draw();
    emitStats();
    callbacks.onGameOver(score);
  };

  const startLoop = () => {
    if (rafId !== null || !isRunning()) return;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  };

  // ── Input ───────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (!isRunning()) return;
    const code = e.code;
    const relevant =
      LEFT_KEYS.has(code) ||
      RIGHT_KEYS.has(code) ||
      DOWN_KEYS.has(code) ||
      CW_KEYS.has(code) ||
      CCW_KEYS.has(code) ||
      DROP_KEYS.has(code);
    if (!relevant) return;
    if (CAPTURED_KEYS.has(code)) e.preventDefault();
    if (DOWN_KEYS.has(code)) {
      keys.add(code);
      return;
    }
    if (phase !== "falling" || !piece) return;
    // Mover acepta la auto-repetición del teclado; rotar y soltar, una vez por pulsación.
    if (LEFT_KEYS.has(code)) shift(-1);
    else if (RIGHT_KEYS.has(code)) shift(1);
    else if (e.repeat) return;
    else if (CW_KEYS.has(code)) rotate(1);
    else if (CCW_KEYS.has(code)) rotate(-1);
    else if (DROP_KEYS.has(code)) hardDrop();
    emitStats();
    if (isOver()) finish();
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
  next = takeFromBag();
  spawn();
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
      if (phase === "falling" || phase === "clearing") phase = "ended";
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
