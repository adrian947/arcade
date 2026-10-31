// Skins de BLOQUE BUSTER (SPEC 14). Solo colores y estilo de dibujo: ningún skin cambia el gameplay.

import type { SkinId } from "@/games/types";

// Cómo se rellena un bloque: el skin retro distingue los 4 colores también por patrón.
export type BlockStyle = "solid" | "hollow" | "striped" | "dotted";

export type BlockLook = { fill: string; style: BlockStyle; mark: string }; // mark = borde / rayas / puntos

export type Palette = {
  bg: string;
  frame: string; // paredes laterales y techo del campo
  blocks: readonly [BlockLook, BlockLook, BlockLook, BlockLook]; // un look por color cromático
  blockShade: string | null; // franja inferior de volumen (null = sin franja)
  danger: string; // línea de peligro
  dangerAlert: string; // línea de peligro cuando el muro está a ≤ 2 filas
  paddle: string;
  paddleEdge: string;
  ballCore: string; // brillo / contorno de la bola sobre el color de su carga
  timerBar: string; // barra de tiempo hasta el próximo descenso
  timerWarn: string; // últimos 2 s
  timerTrack: string;
  spark: string; // destello al recargar la bola con otro color
  label: string;
  font: string;
  glow: number; // shadowBlur base; 0 = sin glow
  outline: boolean; // bloques y paleta solo con contorno + relleno tenue
  pixel: boolean; // coordenadas enteras, bola cuadrada, sin antialiasing
};

type Tokens = {
  cyan: string;
  magenta: string;
  yellow: string;
  green: string;
  silver: string;
  gold: string;
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
    silver: token("--silver", "#c7d0e0"),
    gold: token("--gold", "#ffcf3a"),
    ink: token("--ink", "#e6e9ff"),
    inkDim: token("--ink-dim", "#8a8fb5"),
    inkFaint: token("--ink-faint", "#4a4f70"),
    font: token("--pixel", "monospace"),
  };
}

// Paleta de consola portátil de 4 tonos.
const GB = { darkest: "#0f380f", dark: "#306230", light: "#8bac0f", lightest: "#9bbc0f" } as const;

export function getPalette(skin: SkinId, canvas: HTMLCanvasElement): Palette {
  const t = readTokens(canvas);
  const solid = (fill: string, mark: string): BlockLook => ({ fill, style: "solid", mark });

  if (skin === "neon") {
    return {
      bg: "#000",
      frame: withAlpha(t.cyan, 0.6),
      blocks: [solid(t.cyan, t.cyan), solid(t.magenta, t.magenta), solid(t.yellow, t.yellow), solid(t.green, t.green)],
      blockShade: null,
      danger: withAlpha(t.magenta, 0.55),
      dangerAlert: t.magenta,
      paddle: t.cyan,
      paddleEdge: t.cyan,
      ballCore: t.ink,
      timerBar: t.cyan,
      timerWarn: t.magenta,
      timerTrack: withAlpha(t.cyan, 0.12),
      spark: t.ink,
      label: t.cyan,
      font: t.font,
      glow: 12,
      outline: true,
      pixel: false,
    };
  }

  if (skin === "retro") {
    return {
      bg: GB.darkest,
      frame: GB.dark,
      // Mismo tono para dos colores → se separan por patrón (relleno, hueco, rayas, puntos).
      blocks: [
        { fill: GB.light, style: "solid", mark: GB.darkest },
        { fill: GB.lightest, style: "dotted", mark: GB.darkest },
        { fill: GB.dark, style: "hollow", mark: GB.lightest },
        { fill: GB.light, style: "striped", mark: GB.darkest },
      ],
      blockShade: null,
      danger: GB.dark,
      dangerAlert: GB.lightest,
      paddle: GB.lightest,
      paddleEdge: GB.darkest,
      ballCore: GB.darkest,
      timerBar: GB.light,
      timerWarn: GB.lightest,
      timerTrack: GB.dark,
      spark: GB.lightest,
      label: GB.lightest,
      font: t.font,
      glow: 0,
      outline: false,
      pixel: true,
    };
  }

  // clasico: el aspecto base de SPEC 14.
  return {
    bg: "#000",
    frame: t.inkFaint,
    blocks: [solid(t.cyan, t.ink), solid(t.magenta, t.ink), solid(t.yellow, t.ink), solid(t.green, t.ink)],
    blockShade: "rgba(0,0,0,0.35)",
    danger: withAlpha(t.magenta, 0.4),
    dangerAlert: t.magenta,
    paddle: t.silver,
    paddleEdge: t.inkDim,
    ballCore: t.ink,
    timerBar: t.gold,
    timerWarn: t.magenta,
    timerTrack: withAlpha(t.inkDim, 0.2),
    spark: t.ink,
    label: t.inkDim,
    font: t.font,
    glow: 0,
    outline: false,
    pixel: false,
  };
}
