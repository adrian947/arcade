// Skins de DUELO PIXEL (SPEC 20). Solo colores y estilo de dibujo: ningún skin cambia el gameplay.

import type { SkinId } from "@/games/types";

export type PaddleLook = { fill: string; hollow: boolean }; // hollow = solo contorno (retro distingue lados por patrón)

export type Palette = {
  bg: string;
  wall: string; // bandas superior e inferior del campo
  net: string; // red central discontinua
  left: PaddleLook; // paleta izquierda (jugador / J1)
  right: PaddleLook; // paleta derecha (CPU / J2)
  ball: string;
  ballSmash: string; // bola durante un remate
  trail: string; // estela de la bola
  marker: string; // marcador del duelo (dígitos grandes)
  markerDim: string; // rótulos TÚ / CPU / J1 / J2
  label: string; // rótulos del centro (menú, RIVAL N…)
  font: string;
  glow: number; // shadowBlur base; 0 = sin glow
  outline: boolean; // paletas en contorno + relleno tenue
  pixel: boolean; // coordenadas enteras, sin antialiasing
};

type Tokens = {
  cyan: string;
  magenta: string;
  yellow: string;
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
      wall: withAlpha(t.cyan, 0.7),
      net: withAlpha(t.magenta, 0.7),
      left: { fill: t.cyan, hollow: false },
      right: { fill: t.magenta, hollow: false },
      ball: t.yellow,
      ballSmash: t.ink,
      trail: withAlpha(t.yellow, 0.25),
      marker: t.cyan,
      markerDim: withAlpha(t.cyan, 0.6),
      label: t.magenta,
      font: t.font,
      glow: 14,
      outline: true,
      pixel: false,
    };
  }

  if (skin === "retro") {
    return {
      bg: GB.darkest,
      wall: GB.dark,
      net: GB.dark,
      // Mismo tono en ambos lados: la paleta rival se distingue por ser hueca.
      left: { fill: GB.lightest, hollow: false },
      right: { fill: GB.lightest, hollow: true },
      ball: GB.lightest,
      ballSmash: GB.light,
      trail: GB.dark,
      marker: GB.light,
      markerDim: GB.dark,
      label: GB.lightest,
      font: t.font,
      glow: 0,
      outline: false,
      pixel: true,
    };
  }

  // clasico: el aspecto base de SPEC 20 (colores de la portada .cover-duelo).
  return {
    bg: "#0a0a18",
    wall: t.inkFaint,
    net: withAlpha(t.ink, 0.55),
    left: { fill: t.cyan, hollow: false },
    right: { fill: t.magenta, hollow: false },
    ball: t.yellow,
    ballSmash: t.gold,
    trail: withAlpha(t.yellow, 0.18),
    marker: t.ink,
    markerDim: t.inkDim,
    label: t.inkDim,
    font: t.font,
    glow: 0,
    outline: false,
    pixel: false,
  };
}
