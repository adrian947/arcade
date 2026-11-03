// Skins de GLOTÓN (SPEC 17). Solo colores y estilo de dibujo: ningún skin cambia el gameplay.

import type { SkinId } from "@/games/types";

export type Palette = {
  bg: string;
  wallFill: string; // relleno de los muros
  wallEdge: string; // borde de los muros hacia los pasillos
  nestGate: string; // marco del nido de espectros
  dot: string;
  pill: string;
  player: string;
  playerEye: string;
  spectres: readonly [string, string, string, string]; // un color por espectro
  frightened: string; // espectro asustado (píldora activa)
  frightenedBlink: string; // parpadeo cuando el susto está por terminar
  eyeWhite: string;
  pupil: string;
  alert: string; // signo "!" y pupilas de un espectro en caza
  timerBar: string; // barra de la píldora en el canvas
  timerTrack: string;
  popup: string; // puntos flotantes al comer un espectro
  label: string;
  labelBg: string;
  font: string;
  glow: number; // shadowBlur base; 0 = sin glow
  outline: boolean; // figuras con contorno + relleno tenue
  pixel: boolean; // coordenadas enteras, puntos cuadrados, sin antialiasing
  hollowFrightened: boolean; // retro: el asustado se distingue por ser hueco
};

type Tokens = {
  cyan: string;
  magenta: string;
  yellow: string;
  green: string;
  silver: string;
  gold: string;
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
    silver: token("--silver", "#c7d0e0"),
    gold: token("--gold", "#ffcf3a"),
    bronze: token("--bronze", "#d97a3a"),
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
      wallFill: withAlpha(t.cyan, 0.06),
      wallEdge: t.cyan,
      nestGate: t.magenta,
      dot: t.ink,
      pill: t.gold,
      player: t.yellow,
      playerEye: "#000",
      spectres: [t.magenta, t.green, t.bronze, t.silver],
      frightened: t.cyan,
      frightenedBlink: t.ink,
      eyeWhite: t.ink,
      pupil: "#000",
      alert: t.magenta,
      timerBar: t.gold,
      timerTrack: withAlpha(t.gold, 0.12),
      popup: t.cyan,
      label: t.yellow,
      labelBg: "rgba(0,0,0,0.85)",
      font: t.font,
      glow: 12,
      outline: true,
      pixel: false,
      hollowFrightened: false,
    };
  }

  if (skin === "retro") {
    return {
      bg: GB.darkest,
      wallFill: GB.dark,
      wallEdge: GB.light,
      nestGate: GB.light,
      dot: GB.light,
      pill: GB.lightest,
      player: GB.lightest,
      playerEye: GB.darkest,
      // Los espectros comparten tono: se distinguen del jugador por la forma (rombo vs círculo).
      spectres: [GB.light, GB.light, GB.light, GB.light],
      frightened: GB.lightest,
      frightenedBlink: GB.dark,
      eyeWhite: GB.lightest,
      pupil: GB.darkest,
      alert: GB.lightest,
      timerBar: GB.lightest,
      timerTrack: GB.dark,
      popup: GB.lightest,
      label: GB.lightest,
      labelBg: GB.darkest,
      font: t.font,
      glow: 0,
      outline: false,
      pixel: true,
      hollowFrightened: true,
    };
  }

  // clasico: el aspecto base de SPEC 17.
  return {
    bg: "#000",
    wallFill: withAlpha(t.cyan, 0.12),
    wallEdge: withAlpha(t.cyan, 0.6),
    nestGate: withAlpha(t.magenta, 0.6),
    dot: t.ink,
    pill: t.gold,
    player: t.yellow,
    playerEye: "#000",
    spectres: [t.magenta, t.green, t.bronze, t.silver],
    frightened: t.cyan,
    frightenedBlink: t.ink,
    eyeWhite: t.ink,
    pupil: "#000",
    alert: t.magenta,
    timerBar: t.gold,
    timerTrack: withAlpha(t.inkDim, 0.2),
    popup: t.cyan,
    label: t.yellow,
    labelBg: "rgba(0,0,0,0.8)",
    font: t.font,
    glow: 0,
    outline: false,
    pixel: false,
    hollowFrightened: false,
  };
}
