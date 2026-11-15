// Skins de SERPENTINA (SPEC 16). Solo colores y estilo de dibujo: ningún skin cambia el gameplay.

import type { SkinId } from "@/games/types";

export type Palette = {
  bg: string;
  grid: string; // retícula de fondo
  frame: string; // borde de la arena (pared letal)
  body: string;
  bodyEdge: string; // contorno / segunda pasada del cuerpo
  head: string;
  eye: string;
  nucleo: string; // núcleos magenta
  nucleoCore: string;
  espora: string; // esporas errantes (peligro)
  esporaCore: string;
  hint: string; // línea punteada de "cerco listo"
  hintFill: string; // relleno del lazo que se cerraría
  loopFill: string; // destello del lazo al cerrarse
  label: string;
  font: string;
  glow: number; // shadowBlur base; 0 = sin glow
  outline: boolean; // núcleos y esporas en contorno + relleno tenue
  pixel: boolean; // cuerpo en bloques, coordenadas enteras, sin alfa ni antialiasing
};

type Tokens = {
  cyan: string;
  magenta: string;
  yellow: string;
  green: string;
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

  if (skin === "neon") {
    return {
      bg: "#000",
      grid: withAlpha(t.cyan, 0.06),
      frame: t.cyan,
      body: t.green,
      bodyEdge: withAlpha(t.green, 0.25),
      head: t.ink,
      eye: "#000",
      nucleo: t.magenta,
      nucleoCore: t.ink,
      espora: t.yellow,
      esporaCore: t.yellow,
      hint: t.cyan,
      hintFill: withAlpha(t.cyan, 0.08),
      loopFill: withAlpha(t.green, 0.3),
      label: t.cyan,
      font: t.font,
      glow: 14,
      outline: true,
      pixel: false,
    };
  }

  if (skin === "retro") {
    // Serpiente y esporas en el tono más claro; las esporas se distinguen por sus púas y su hueco.
    return {
      bg: GB.darkest,
      grid: GB.darkest,
      frame: GB.dark,
      body: GB.lightest,
      bodyEdge: GB.light,
      head: GB.lightest,
      eye: GB.darkest,
      nucleo: GB.light,
      nucleoCore: GB.darkest,
      espora: GB.lightest,
      esporaCore: GB.darkest,
      hint: GB.light,
      hintFill: GB.darkest,
      loopFill: GB.dark,
      label: GB.lightest,
      font: t.font,
      glow: 0,
      outline: false,
      pixel: true,
    };
  }

  // clasico: el aspecto base de SPEC 16.
  return {
    bg: "#000",
    grid: withAlpha(t.inkFaint, 0.35),
    frame: t.inkFaint,
    body: t.green,
    bodyEdge: withAlpha(t.green, 0.35),
    head: t.ink,
    eye: "#000",
    nucleo: t.magenta,
    nucleoCore: t.ink,
    espora: t.yellow,
    esporaCore: "#000",
    hint: t.inkDim,
    hintFill: withAlpha(t.green, 0.08),
    loopFill: withAlpha(t.green, 0.25),
    label: t.inkDim,
    font: t.font,
    glow: 6,
    outline: false,
    pixel: false,
  };
}
