"use client";

import Link from "next/link";
import type { Game } from "@/lib/data";
import { useLeaderboard } from "@/lib/use-leaderboard";

export function GameDetail({ game }: { game: Game }) {
  const { rows: scores, status } = useLeaderboard(game.id, 10);

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={`cover-bg ${game.cover}`}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div><div className="l">Partidas</div><div className="v">{game.plays}</div></div>
            <div><div className="l">Mejor global</div><div className="v" style={{ color: "var(--magenta)", textShadow: "0 0 6px rgba(255,0,110,0.5)" }}>{game.best.toLocaleString("es-ES")}</div></div>
            <div><div className="l">Dificultad</div><div className="v" style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}>★ ★ ★ ☆ ☆</div></div>
          </div>
          <div className="detail-actions">
            <Link href={`/jugar/${game.id}`} className="btn xl pulse">▶  JUGAR AHORA</Link>
            <Link href="/juegos" className="btn ghost lg">VOLVER AL VAULT</Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {status === "loading" && <div className="lb-row"><div className="pl">CARGANDO RANKING…</div></div>}
          {status === "error" && <div className="lb-row"><div className="pl" role="alert" style={{ color: "var(--red, #ff3b5c)" }}>▸ NO SE PUDO CARGAR EL RANKING</div></div>}
          {status === "ok" && scores.length === 0 && <div className="lb-row"><div className="pl">SÉ EL PRIMERO EN EL VAULT</div></div>}
          {scores.map((r, i) => (
            <div key={r.name} className={"lb-row" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}>
              <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
              <div className="pl">{r.name}<div style={{ fontSize: 10, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>{r.date}</div></div>
              <div className="sc">{r.score.toLocaleString("es-ES")}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
