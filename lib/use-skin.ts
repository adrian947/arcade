"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { DEFAULT_SKIN, type SkinId } from "@/games/types";
import { isSkinId } from "@/games/skins";

const keyFor = (gameId: string) => `av:skin:${gameId}`;
const SKIN_EVENT = "av:skin-change";

function readStored(gameId: string): string | null {
  try {
    return window.localStorage.getItem(keyFor(gameId));
  } catch {
    return null; // storage bloqueado (modo privado, políticas)
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SKIN_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SKIN_EVENT, onChange);
  };
}

// Skin elegido para un juego, recordado en localStorage (av:skin:<gameId>).
// En servidor y en la hidratación vale "clasico"; un valor desconocido o no declarado también.
export function useSkin(gameId: string, available: readonly SkinId[]): [SkinId, (skin: SkinId) => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => readStored(gameId),
    () => null,
  );
  // Elección de esta sesión de página: cubre el caso de storage que no permite escribir.
  const [chosen, setChosen] = useState<{ gameId: string; skin: SkinId } | null>(null);

  const candidate = chosen?.gameId === gameId ? chosen.skin : stored;
  const skin = isSkinId(candidate) && available.includes(candidate) ? candidate : DEFAULT_SKIN;

  const setSkin = useCallback(
    (next: SkinId) => {
      setChosen({ gameId, skin: next });
      try {
        window.localStorage.setItem(keyFor(gameId), next);
        window.dispatchEvent(new Event(SKIN_EVENT));
      } catch {
        // sin persistencia: el cambio vale solo para esta página
      }
    },
    [gameId],
  );

  return [skin, setSkin];
}
