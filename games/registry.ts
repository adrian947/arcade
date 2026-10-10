import type { EngineEntry } from "@/games/types";
import { createAsteroids } from "@/games/asteroids/engine";
import { createTetris } from "@/games/tetris/engine";

// Juegos con motor real. Los que no figuran aquí usan la arena simulada.
export const ENGINES: Partial<Record<string, EngineEntry>> = {
  asteroides: { factory: createAsteroids },
  tetris: { factory: createTetris, lives: false },
};
