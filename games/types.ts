// Contrato común de los motores de juego de Arcade Vault.

export type SkinId = "clasico" | "neon" | "retro";
export const DEFAULT_SKIN: SkinId = "clasico";

export type GameOptions = { skin: SkinId };

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
  setSkin?: (skin: SkinId) => void; // aplica el skin en vivo y redibuja; opcional
};

export type GameFactory = (canvas: HTMLCanvasElement, callbacks: GameCallbacks, options?: GameOptions) => GameEngine;

// Botones del gamepad táctil de plataforma.
export type TouchButton = "up" | "down" | "left" | "right" | "a" | "b";

// Mapeo táctil: cada botón simula un KeyboardEvent.code que el motor ya escucha en window.
export type TouchControls = {
  keys: Partial<Record<TouchButton, string>>; // botón → code simulado (ej. "ArrowUp", "Space"); nunca KeyP / Escape
  labels?: Partial<Record<"a" | "b", string>>; // texto del botón A/B, mayúsculas, ≤ 8 caracteres (ej. "ROTAR")
  repeat?: readonly TouchButton[]; // botones que re-disparan keydown mientras se mantienen
};

// Entrada del registro: fábrica más metadatos que la plataforma usa para el HUD.
export type EngineEntry = {
  factory: GameFactory;
  lives?: boolean; // false oculta el stat de Vidas en el HUD de plataforma
  skins?: readonly SkinId[]; // skins implementados; ausente = solo "clasico"
  touch?: TouchControls; // mapeo táctil; ausente = "REQUIERE TECLADO" en dispositivos táctiles
};
