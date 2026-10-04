// Contrato común de los motores de juego de Arcade Vault.

export type GameStats = { score: number; lives: number; level: number };

export type GameCallbacks = {
  onStats: (stats: GameStats) => void; // al iniciar y cada vez que cambia algún valor
  onGameOver: (finalScore: number) => void; // una sola vez por instancia
};

export type GameEngine = {
  pause: () => void;
  resume: () => void;
  end: () => number; // detiene definitivamente (botón FIN) y devuelve el score actual; no dispara onGameOver
  destroy: () => void; // cancela requestAnimationFrame y quita listeners; idempotente
};

export type GameFactory = (canvas: HTMLCanvasElement, callbacks: GameCallbacks) => GameEngine;
