// Skins de INVASORES (SPEC 18). Solo colores y estilo de dibujo: ningún skin cambia el gameplay.

import type { SkinId } from "@/games/types";

export type Palette = {
  bg: string;
  frame: string; // paredes laterales del campo
  invaders: readonly [string, string, string]; // acorazado, medusa, dron
  damaged: string; // acorazado con un impacto
  cannon: string;
  cannonEdge: string;
  shot: string; // proyectil del jugador
  bolt: string; // rayo enemigo
  scrap: string; // pixel de chatarra
  spark: string; // destello de impacto
  surface: string;
  surfaceAlert: string; // formación a menos de una fila o aterrizaje
  ammoOn: string;
  ammoOff: string;
  ammoEmpty: string; // parpadeo del cargador vacío
  label: string;
  streak: string; // texto ×N con racha > 1
  font: string;
  glow: number; // shadowBlur base; 0 = sin glow
  outline: boolean; // contorno + relleno tenue en vez de relleno sólido
  pixel: boolean; // coordenadas enteras, sin alfa ni antialiasing
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

  if (skin === "neon") {
    return {
      bg: "#000",
      frame: withAlpha(t.cyan, 0.5),
      invaders: [t.cyan, t.magenta, t.green],
      damaged: t.yellow,
      cannon: t.cyan,
      cannonEdge: t.cyan,
      shot: t.yellow,
      bolt: t.magenta,
      scrap: t.yellow,
      spark: t.ink,
      surface: withAlpha(t.green, 0.6),
      surfaceAlert: t.magenta,
      ammoOn: t.cyan,
      ammoOff: withAlpha(t.cyan, 0.15),
      ammoEmpty: t.magenta,
      label: t.cyan,
      streak: t.yellow,
      font: t.font,
      glow: 12,
      outline: true,
      pixel: false,
    };
  }

  if (skin === "retro") {
    // Los 3 tipos comparten tonos claros: se distinguen por la silueta del glifo; el dañado va hueco.
    return {
      bg: GB.darkest,
      frame: GB.dark,
      invaders: [GB.lightest, GB.light, GB.light],
      damaged: GB.dark,
      cannon: GB.lightest,
      cannonEdge: GB.dark,
      shot: GB.lightest,
      bolt: GB.lightest,
      scrap: GB.light,
      spark: GB.lightest,
      surface: GB.dark,
      surfaceAlert: GB.lightest,
      ammoOn: GB.lightest,
      ammoOff: GB.dark,
      ammoEmpty: GB.light,
      label: GB.lightest,
      streak: GB.lightest,
      font: t.font,
      glow: 0,
      outline: false,
      pixel: true,
    };
  }

  // clasico: el aspecto base de SPEC 18.
  return {
    bg: "#000",
    frame: t.inkFaint,
    invaders: [t.cyan, t.magenta, t.green],
    damaged: t.inkDim,
    cannon: t.silver,
    cannonEdge: t.inkDim,
    shot: t.yellow,
    bolt: t.magenta,
    scrap: t.gold,
    spark: t.ink,
    surface: withAlpha(t.green, 0.45),
    surfaceAlert: t.magenta,
    ammoOn: t.gold,
    ammoOff: t.inkFaint,
    ammoEmpty: t.magenta,
    label: t.inkDim,
    streak: t.gold,
    font: t.font,
    glow: 0,
    outline: false,
    pixel: false,
  };
}
