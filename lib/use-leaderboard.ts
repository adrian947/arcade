"use client";

import { useEffect, useState } from "react";
import { fetchLeaderboard, fetchMyBest, type LeaderboardRow, type MyBest } from "@/lib/scores";

export type Status = "loading" | "ok" | "error";

// El resultado se guarda junto a la clave que lo originó; si la clave actual no coincide, sigue "loading".
export function useLeaderboard(gameId: string, limit: number): { rows: LeaderboardRow[]; status: Status } {
  const key = `${gameId}:${limit}`;
  const [result, setResult] = useState<{ key: string; rows: LeaderboardRow[] | null }>({ key: "", rows: null });

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard(gameId, limit)
      .then((rows) => !cancelled && setResult({ key, rows }))
      .catch(() => !cancelled && setResult({ key, rows: null }));
    return () => {
      cancelled = true;
    };
  }, [gameId, limit, key]);

  if (result.key !== key) return { rows: [], status: "loading" };
  return result.rows ? { rows: result.rows, status: "ok" } : { rows: [], status: "error" };
}

export function useMyBest(gameId: string, userId: string | null): MyBest | null {
  const key = userId ? `${gameId}:${userId}` : "";
  const [result, setResult] = useState<{ key: string; best: MyBest | null }>({ key: "", best: null });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchMyBest(gameId, userId)
      .then((best) => !cancelled && setResult({ key, best }))
      .catch(() => !cancelled && setResult({ key, best: null }));
    return () => {
      cancelled = true;
    };
  }, [gameId, userId, key]);

  return key && result.key === key ? result.best : null;
}
