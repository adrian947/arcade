import type { GameFactory } from "@/games/types";
import { createAsteroids } from "@/games/asteroids/engine";

// Juegos con motor real. Los que no figuran aquí usan la arena simulada.
export const ENGINES: Partial<Record<string, GameFactory>> = {
  asteroides: createAsteroids,
};
