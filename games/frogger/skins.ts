// Skins de FROGGER (SPEC 11). Solo colores y estilo de dibujo: ningún skin cambia el gameplay.

import type { SkinId } from "@/games/types";

export type Palette = {
  bg: string;
  hedgeFill: string | null; // seto de la fila 0 (entre bocas)
  hedgeStroke: string | null;
  riverFill: string | null; // filas 1–6
  riverLines: string | null; // ondas discontinuas a media fila
  safeFill: string | null; // mediana (fila 7) y salida (fila 13)
  safeStroke: string | null; // bordes superior e inferior de las franjas seguras
  laneLine: string;
  mouthFill: string;
  mouthBorder: string;
  cars: readonly string[];
  headlight: string;
  truck: string;
  truckCab: string;
  log: string;
  logGrain: string;
  turtle: string;
  turtleWarnAlpha: number; // opacidad de las tortugas a punto de hundirse (sin turtleWarnHole)
  turtleWarnHole: string | null; // si existe, el aviso es un anillo hueco de este color (sin alfa)
  frog: string;
  frogEye: string;
  frogBorder: string | null; // contorno duro para separar la rana de troncos del mismo tono
  death: string;
  timeHigh: string; // > 50 %
  timeMid: string; // > 25 %
  timeLow: string; // ≤ 25 %
  timeLowBlink: string | null; // alterna con timeLow a 4 Hz
  label: string;
  font: string;
  glow: number; // shadowBlur base; 0 = sin glow
  outline: boolean; // vehículos, troncos y tortugas solo con contorno
  pixel: boolean; // coordenadas enteras, formas sin antialiasing y sin suavizado de imagen
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

// Convierte "#rrggbb" o "#rgb" (el CSS minificado acorta tokens) a "rgba(r,g,b,a)";
// si no es hex, devuelve el color tal cual.
export function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha.toFixed(2)})`;
}

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

// Paleta de consola portátil de 4 tonos.
const GB = { darkest: "#0f380f", dark: "#306230", light: "#8bac0f", lightest: "#9bbc0f" } as const;

export function getPalette(skin: SkinId, canvas: HTMLCanvasElement): Palette {
  const t = readTokens(canvas);

  if (skin === "neon") {
    return {
      bg: "#000",
      hedgeFill: null,
      hedgeStroke: t.green,
      riverFill: null,
      riverLines: withAlpha(t.cyan, 0.35),
      safeFill: null,
      safeStroke: t.magenta,
      laneLine: withAlpha(t.cyan, 0.3),
      mouthFill: "#000",
      mouthBorder: t.gold,
      cars: [t.magenta, t.yellow, t.cyan],
      headlight: t.ink,
      truck: t.silver,
      truckCab: t.cyan,
      log: t.bronze,
      logGrain: t.gold,
      turtle: t.gold,
      turtleWarnAlpha: 0.4,
      turtleWarnHole: null,
      frog: t.green,
      frogEye: t.ink,
      frogBorder: null,
      death: t.magenta,
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
      hedgeFill: GB.dark,
      hedgeStroke: null,
      riverFill: GB.dark,
      riverLines: null,
      safeFill: GB.dark,
      safeStroke: GB.light,
      laneLine: GB.dark,
      mouthFill: GB.darkest,
      mouthBorder: GB.light,
      cars: [GB.light, GB.light, GB.light],
      headlight: GB.darkest, // faros como huecos: más legibles que lightest sobre light
      truck: GB.light,
      truckCab: GB.dark,
      log: GB.light,
      logGrain: GB.dark,
      turtle: GB.light,
      turtleWarnAlpha: 1,
      turtleWarnHole: GB.dark,
      frog: GB.lightest,
      frogEye: GB.darkest,
      frogBorder: GB.darkest,
      death: GB.lightest,
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

  // clasico: el aspecto original de SPEC 13.
  return {
    bg: "#000",
    hedgeFill: withAlpha(t.green, 0.25),
    hedgeStroke: null,
    riverFill: withAlpha(t.cyan, 0.15),
    riverLines: null,
    safeFill: withAlpha(t.magenta, 0.12),
    safeStroke: null,
    laneLine: t.line,
    mouthFill: "#000",
    mouthBorder: t.gold,
    cars: [t.magenta, t.yellow, t.cyan],
    headlight: t.ink,
    truck: t.silver,
    truckCab: t.inkDim,
    log: t.bronze,
    logGrain: t.gold,
    turtle: t.gold,
    turtleWarnAlpha: 0.4,
    turtleWarnHole: null,
    frog: t.green,
    frogEye: t.ink,
    frogBorder: null,
    death: t.magenta,
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
