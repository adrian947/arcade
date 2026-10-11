// Skins visuales de los motores (SPEC 11): orden del selector y etiquetas visibles.

import type { SkinId } from "@/games/types";

export const SKIN_ORDER: readonly SkinId[] = ["clasico", "neon", "retro"];
export const SKIN_LABELS: Record<SkinId, string> = { clasico: "CLÁSICO", neon: "NEÓN", retro: "RETRO" };
export const isSkinId = (v: unknown): v is SkinId => typeof v === "string" && (SKIN_ORDER as readonly string[]).includes(v);
