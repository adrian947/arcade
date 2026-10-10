// Coordenadas del spritesheet, portadas de references/started-games/04-arkanoid/assets/spritesheet.js.

export type BlockColor = "gray" | "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green";
export type Frame = { sx: number; sy: number; sw: number; sh: number };

export const SPRITESHEET_URL = "/games/arkanoid/spritesheet-breakout.png";

// 4 frames de 32×16 en una fila del spritesheet.
const explosionRow = (sy: number): readonly Frame[] => [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));

export const EXPLOSION_FRAMES: Readonly<Record<BlockColor, readonly Frame[]>> = {
  red: explosionRow(176),
  cyan: explosionRow(192),
  green: explosionRow(208),
  magenta: explosionRow(224),
  yellow: explosionRow(240),
  hotpink: explosionRow(256),
  gray: explosionRow(176), // el original reutiliza los frames rojos
};

export const EXPLOSION_DURATION = 150; // ms

export const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  } satisfies Record<BlockColor, Frame>,
} as const;
