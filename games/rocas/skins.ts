// Skins de ROCAS (SPEC 19). Solo colores y estilo de dibujo: ningún skin cambia el gameplay.

import type { SkinId } from "@/games/types";

export type Palette = {
  bg: string;
  stars: string;
  wall: string;
  ship: string;
  shipFill: string | null; // relleno de la nave (null = solo contorno)
  bullet: string;
  rock: string; // contorno de las rocas
  rockFill: string; // relleno de las rocas
  tether: string; // cable de fusión entre fragmentos hermanos
  ufo: string;
  ufoFill: string;
  ufoBullet: string;
  debris: string;
  flash: string; // destello al fusionarse dos fragmentos
  popup: string; // rótulo "PAR +N"
  font: string;
  glow: number; // shadowBlur base; 0 = sin glow
  alpha: boolean; // false = sin transparencias (skin retro)
  pixel: boolean; // coordenadas enteras, balas cuadradas, sin antialiasing de imágenes
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
      stars: withAlpha(t.cyan, 0.35),
      wall: withAlpha(t.cyan, 0.6),
      ship: t.cyan,
      shipFill: withAlpha(t.cyan, 0.15),
      bullet: t.cyan,
      rock: t.yellow,
      rockFill: withAlpha(t.yellow, 0.1),
      tether: t.green,
      ufo: t.magenta,
      ufoFill: withAlpha(t.magenta, 0.2),
      ufoBullet: t.magenta,
      debris: t.yellow,
      flash: t.green,
      popup: t.green,
      font: t.font,
      glow: 12,
      alpha: true,
      pixel: false,
    };
  }

  if (skin === "retro") {
    // Jugador, balas y peligros en los tonos claros; las balas del OVNI son cuadros huecos
    // para distinguirlas de las propias (macizas) aunque compartan tono.
    return {
      bg: GB.darkest,
      stars: GB.dark,
      wall: GB.dark,
      ship: GB.lightest,
      shipFill: GB.darkest,
      bullet: GB.lightest,
      rock: GB.light,
      rockFill: GB.dark,
      tether: GB.light,
      ufo: GB.lightest,
      ufoFill: GB.dark,
      ufoBullet: GB.lightest,
      debris: GB.light,
      flash: GB.lightest,
      popup: GB.lightest,
      font: t.font,
      glow: 0,
      alpha: false,
      pixel: true,
    };
  }

  // clasico: el aspecto base de SPEC 19.
  return {
    bg: "#000",
    stars: t.inkFaint,
    wall: t.inkFaint,
    ship: t.ink,
    shipFill: null,
    bullet: t.yellow,
    rock: t.silver,
    rockFill: "rgba(20,22,40,0.85)",
    tether: t.cyan,
    ufo: t.magenta,
    ufoFill: withAlpha(t.magenta, 0.15),
    ufoBullet: t.magenta,
    debris: t.silver,
    flash: t.cyan,
    popup: t.gold,
    font: t.font,
    glow: 0,
    alpha: true,
    pixel: false,
  };
}
