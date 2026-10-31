import type { EngineEntry } from "@/games/types";
import { createAsteroids } from "@/games/asteroids/engine";
import { createTetris } from "@/games/tetris/engine";
import { createArkanoid } from "@/games/arkanoid/engine";
import { createSnake } from "@/games/snake/engine";
import { createRanaria } from "@/games/ranaria/engine";
import { createFrogger } from "@/games/frogger/engine";
import { createBloqueBuster } from "@/games/bloque-buster/engine";

// Juegos con motor real. Los que no figuran aquí usan la arena simulada.
export const ENGINES: Partial<Record<string, EngineEntry>> = {
  asteroides: { factory: createAsteroids },
  tetris: { factory: createTetris, lives: false },
  arkanoid: { factory: createArkanoid },
  snake: {
    factory: createSnake,
    lives: false,
    touch: { keys: { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" } },
  },
  ranaria: { factory: createRanaria, skins: ["clasico", "neon", "retro"] },
  frogger: {
    factory: createFrogger,
    skins: ["clasico", "neon", "retro"],
    touch: { keys: { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" } },
  },
  "bloque-buster": {
    factory: createBloqueBuster,
    skins: ["clasico", "neon", "retro"],
    touch: { keys: { left: "ArrowLeft", right: "ArrowRight", a: "Space" }, labels: { a: "LANZAR" } },
  },
};
