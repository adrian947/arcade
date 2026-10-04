import { supabase } from "@/lib/supabase/client";

export type LeaderboardRow = { rank: number; name: string; score: number; date: string };
export type MyBest = { rank: number; score: number; date: string };

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Guarda una partida del usuario autenticado. Devuelve null si salió bien o un mensaje de error.
export async function saveScore(userId: string, gameId: string, score: number): Promise<string | null> {
  const { error } = await supabase.from("scores").insert({ user_id: userId, game_id: gameId, score });
  if (!error) return null;
  if (error.code === "42501" || error.code === "PGRST301") return "SESIÓN EXPIRADA. VUELVE A INICIAR SESIÓN";
  return "NO SE PUDO GUARDAR LA PUNTUACIÓN. REINTENTA";
}

// Top del juego: mejor marca por jugador, de mayor a menor.
export async function fetchLeaderboard(gameId: string, limit: number): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("username, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data.map((r, i) => ({
    rank: i + 1,
    name: r.username ?? "—",
    score: r.score ?? 0,
    date: formatDate(r.created_at),
  }));
}

// Mejor marca del usuario en el juego y su rango (filas con score mayor + 1).
export async function fetchMyBest(gameId: string, userId: string): Promise<MyBest | null> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("score, created_at")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.score === null) return null;

  const { count, error: countError } = await supabase
    .from("leaderboard")
    .select("user_id", { count: "exact", head: true })
    .eq("game_id", gameId)
    .gt("score", data.score);
  if (countError) throw countError;

  return { rank: (count ?? 0) + 1, score: data.score, date: formatDate(data.created_at) };
}
