// Skins de RANARIA (SPEC 11). Solo colores y estilo de dibujo: ningún skin cambia el gameplay.

import type { SkinId } from "@/games/types";

export type Palette = {
  bg: string;
  bankFill: string | null; // orilla (fila 0)
  bankStroke: string | null;
  nestFill: string;
  nestStroke: string;
  waterFill: string | null; // filas 1–5
  waterLines: string | null;
  sidewalkFill: string | null; // filas 6 y 11
  sidewalkStroke: string | null;
  laneLine: string;
  cars: { 10: string; 9: string; 7: string };
  truck: string;
  truckWindow: string | null;
  headlight: string;
  log: string;
  logGrain: string;
  turtle: string;
  turtleDot: string | null;
  frog: string;
  frogEye: string;
  frogBorder: string | null;
  dead: string;
  timeHigh: string; // > 10 s
  timeMid: string; // > 5 s
  timeLow: string; // ≤ 5 s
  timeLowBlink: string | null; // alterna con timeLow a 4 Hz
  label: string;
  font: string;
  glow: number; // shadowBlur base; 0 = sin glow
  outline: boolean; // vehículos, troncos y tortugas solo con contorno
  pixel: boolean; // coordenadas enteras y formas sin antialiasing (solo 4 tonos)
};

type Tokens = {
  green: string;
  cyan: string;
  magenta: string;
  yellow: string;
  silver: string;
  bronze: string;
  gold: string;
  ink: string;
  inkDim: string;
  line: string;
  font: string;
};

// Lee los tokens de globals.css desde el canvas (hereda las variables de fuente de <html>).
function readTokens(canvas: HTMLCanvasElement): Tokens {
  const style = getComputedStyle(canvas);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    green: token("--green", "#00ff88"),
    cyan: token("--cyan", "#00f5ff"),
    magenta: token("--magenta", "#ff006e"),
    yellow: token("--yellow", "#f5ff00"),
    silver: token("--silver", "#c7d0e0"),
    bronze: token("--bronze", "#d97a3a"),
    gold: token("--gold", "#ffcf3a"),
    ink: token("--ink", "#e6e9ff"),
    inkDim: token("--ink-dim", "#8a8fb5"),
    line: token("--line-2", "rgba(255, 255, 255, 0.06)"),
    font: token("--pixel", "monospace"),
  };
}

export function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha.toFixed(2)})`;
}

// Paleta de consola portátil de 4 tonos.
const GB = { darkest: "#0f380f", dark: "#306230", light: "#8bac0f", lightest: "#9bbc0f" } as const;

export function getPalette(skin: SkinId, canvas: HTMLCanvasElement): Palette {
  const t = readTokens(canvas);

  if (skin === "neon") {
    return {
      bg: "#000",
      bankFill: null,
      bankStroke: t.green,
      nestFill: "#000",
      nestStroke: t.green,
      waterFill: null,
      waterLines: withAlpha(t.cyan, 0.35),
      sidewalkFill: null,
      sidewalkStroke: t.magenta,
      laneLine: withAlpha(t.cyan, 0.3),
      cars: { 10: t.magenta, 9: t.yellow, 7: t.cyan },
      truck: t.silver,
      truckWindow: null,
      headlight: t.ink,
      log: t.bronze,
      logGrain: t.gold,
      turtle: t.gold,
      turtleDot: null,
      frog: t.green,
      frogEye: t.ink,
      frogBorder: null,
      dead: t.magenta,
      timeHigh: t.green,
      timeMid: t.yellow,
      timeLow: t.magenta,
      timeLowBlink: null,
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
      bankFill: GB.dark,
      bankStroke: null,
      nestFill: GB.darkest,
      nestStroke: GB.light,
      waterFill: GB.dark,
      waterLines: null,
      sidewalkFill: GB.dark,
      sidewalkStroke: GB.light,
      laneLine: GB.dark,
      cars: { 10: GB.light, 9: GB.light, 7: GB.light },
      truck: GB.light,
      truckWindow: GB.darkest,
      headlight: GB.lightest,
      log: GB.light,
      logGrain: GB.dark,
      turtle: GB.light,
      turtleDot: GB.dark,
      frog: GB.lightest,
      frogEye: GB.darkest,
      frogBorder: GB.darkest,
      dead: GB.lightest,
      timeHigh: GB.lightest,
      timeMid: GB.light,
      timeLow: GB.lightest,
      timeLowBlink: GB.dark,
      label: GB.lightest,
      font: t.font,
      glow: 0,
      outline: false,
      pixel: true,
    };
  }

  // clasico: el aspecto original de SPEC 10.
  return {
    bg: "#000",
    bankFill: withAlpha(t.green, 0.25),
    bankStroke: null,
    nestFill: "#000",
    nestStroke: t.green,
    waterFill: withAlpha(t.cyan, 0.15),
    waterLines: null,
    sidewalkFill: withAlpha(t.magenta, 0.12),
    sidewalkStroke: null,
    laneLine: t.line,
    cars: { 10: t.magenta, 9: t.yellow, 7: t.cyan },
    truck: t.silver,
    truckWindow: null,
    headlight: t.ink,
    log: t.bronze,
    logGrain: t.gold,
    turtle: t.gold,
    turtleDot: null,
    frog: t.green,
    frogEye: t.ink,
    frogBorder: null,
    dead: t.magenta,
    timeHigh: t.green,
    timeMid: t.yellow,
    timeLow: t.magenta,
    timeLowBlink: null,
    label: t.inkDim,
    font: t.font,
    glow: 0,
    outline: false,
    pixel: false,
  };
}
