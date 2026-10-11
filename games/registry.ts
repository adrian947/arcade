import type { EngineEntry } from "@/games/types";
import { createAsteroids } from "@/games/asteroids/engine";
import { createTetris } from "@/games/tetris/engine";
import { createArkanoid } from "@/games/arkanoid/engine";
import { createSnake } from "@/games/snake/engine";
import { createRanaria } from "@/games/ranaria/engine";

// Juegos con motor real. Los que no figuran aquí usan la arena simulada.
export const ENGINES: Partial<Record<string, EngineEntry>> = {
  asteroides: { factory: createAsteroids },
  tetris: { factory: createTetris, lives: false },
  arkanoid: { factory: createArkanoid },
  snake: { factory: createSnake, lives: false },
  ranaria: { factory: createRanaria },
};
