// Skins de CAÍDA (SPEC 15). Solo colores y estilo de dibujo: ningún skin cambia el gameplay.

import type { SkinId } from "@/games/types";

// Cómo se rellena una celda: el skin retro distingue las 8 piezas también por patrón.
export type CellStyle = "solid" | "hollow" | "striped" | "dotted";

export type CellLook = { fill: string; style: CellStyle; mark: string }; // mark = borde / rayas / puntos

export type Palette = {
  bg: string;
  wellBg: string;
  grid: string; // líneas de la grilla del pozo
  frame: string; // marco del pozo y del panel de vista previa
  pieces: readonly CellLook[]; // 8 looks, uno por pieza
  shade: string | null; // franja inferior de volumen de cada celda (null = sin franja)
  ghost: string; // contorno de la pieza fantasma
  flash: string; // destello de las filas que se limpian
  press: string; // placa de la prensa
  pressEdge: string; // dientes y borde inferior de la prensa
  hazard: string; // franjas de peligro de la prensa
  hazardWarn: string; // franjas cuando la prensa está por bajar
  timerBar: string;
  timerWarn: string;
  timerTrack: string;
  label: string;
  value: string;
  chain: string; // rótulo CADENA ×N
  font: string;
  glow: number; // shadowBlur base; 0 = sin glow
  outline: boolean; // celdas solo con contorno + relleno tenue
  pixel: boolean; // coordenadas enteras, sin antialiasing
};

type Tokens = {
  cyan: string;
  magenta: string;
  yellow: string;
  green: string;
  gold: string;
  silver: string;
  bronze: string;
  ink: string;
  inkDim: string;
  inkFaint: string;
  font: string;
};

// Convierte "#rrggbb" o "#rgb" a "rgba(r,g,b,a)"; si no es hex, devuelve el color tal cual.
export function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha.toFixed(2)})`;
}

// Lee los tokens de globals.css desde el canvas (patrón readPalette de games/asteroids/engine.ts).
function readTokens(canvas: HTMLCanvasElement): Tokens {
  const style = getComputedStyle(canvas);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    cyan: token("--cyan", "#00f5ff"),
    magenta: token("--magenta", "#ff006e"),
    yellow: token("--yellow", "#f5ff00"),
    green: token("--green", "#00ff88"),
    gold: token("--gold", "#ffcf3a"),
    silver: token("--silver", "#c7d0e0"),
    bronze: token("--bronze", "#d97a3a"),
    ink: token("--ink", "#e6e9ff"),
    inkDim: token("--ink-dim", "#8a8fb5"),
    inkFaint: token("--ink-faint", "#4a4f70"),
    font: token("--pixel", "monospace"),
  };
}

// Paleta de consola portátil de 4 tonos.
const GB = { darkest: "#0f380f", dark: "#306230", light: "#8bac0f", lightest: "#9bbc0f" } as const;

// Las 8 piezas en el orden de PIECES (engine.ts): dúo, barra, ángulo, cuadro, te, escalón, gancho, cruz.
const pieceColors = (t: Tokens) => [t.inkDim, t.cyan, t.green, t.yellow, t.magenta, t.bronze, t.gold, t.ink];

export function getPalette(skin: SkinId, canvas: HTMLCanvasElement): Palette {
  const t = readTokens(canvas);
  const solid = (fill: string, mark: string): CellLook => ({ fill, style: "solid", mark });

  if (skin === "neon") {
    return {
      bg: "#000",
      wellBg: "#000",
      grid: withAlpha(t.cyan, 0.07),
      frame: withAlpha(t.cyan, 0.7),
      pieces: [t.cyan, t.magenta, t.yellow, t.green, t.magenta, t.cyan, t.green, t.yellow].map((c, i) =>
        // Mismo tono en dos piezas → la segunda va rayada para distinguirlas.
        i < 4 ? solid(c, c) : { fill: c, style: "striped" as const, mark: c },
      ),
      shade: null,
      ghost: withAlpha(t.ink, 0.45),
      flash: t.ink,
      press: withAlpha(t.magenta, 0.12),
      pressEdge: t.magenta,
      hazard: withAlpha(t.magenta, 0.55),
      hazardWarn: t.magenta,
      timerBar: t.cyan,
      timerWarn: t.magenta,
      timerTrack: withAlpha(t.cyan, 0.12),
      label: t.cyan,
      value: t.ink,
      chain: t.magenta,
      font: t.font,
      glow: 12,
      outline: true,
      pixel: false,
    };
  }

  if (skin === "retro") {
    return {
      bg: GB.darkest,
      wellBg: GB.darkest,
      grid: GB.dark,
      frame: GB.light,
      // 8 piezas con 3 tonos de relleno → se separan por patrón (relleno, hueco, rayas, puntos).
      pieces: [
        { fill: GB.light, style: "solid", mark: GB.darkest },
        { fill: GB.lightest, style: "striped", mark: GB.darkest },
        { fill: GB.light, style: "dotted", mark: GB.darkest },
        { fill: GB.dark, style: "hollow", mark: GB.lightest },
        { fill: GB.lightest, style: "solid", mark: GB.darkest },
        { fill: GB.light, style: "striped", mark: GB.darkest },
        { fill: GB.lightest, style: "dotted", mark: GB.darkest },
        { fill: GB.dark, style: "hollow", mark: GB.light },
      ],
      shade: null,
      ghost: GB.dark,
      flash: GB.lightest,
      press: GB.dark,
      pressEdge: GB.lightest,
      hazard: GB.light,
      hazardWarn: GB.lightest,
      timerBar: GB.light,
      timerWarn: GB.lightest,
      timerTrack: GB.dark,
      label: GB.light,
      value: GB.lightest,
      chain: GB.lightest,
      font: t.font,
      glow: 0,
      outline: false,
      pixel: true,
    };
  }

  // clasico: el aspecto base de SPEC 15.
  return {
    bg: "#000",
    wellBg: "#05050c",
    grid: withAlpha(t.inkFaint, 0.35),
    frame: t.inkFaint,
    pieces: pieceColors(t).map((c) => solid(c, withAlpha(t.ink, 0.5))),
    shade: "rgba(0,0,0,0.3)",
    ghost: withAlpha(t.inkDim, 0.6),
    flash: t.ink,
    press: "#1b1d2c",
    pressEdge: t.silver,
    hazard: t.gold,
    hazardWarn: t.magenta,
    timerBar: t.gold,
    timerWarn: t.magenta,
    timerTrack: withAlpha(t.inkDim, 0.2),
    label: t.inkDim,
    value: t.ink,
    chain: t.magenta,
    font: t.font,
    glow: 0,
    outline: false,
    pixel: false,
  };
}
