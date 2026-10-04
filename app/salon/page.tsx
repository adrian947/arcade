"use client";

import { useState } from "react";
import Link from "next/link";
import { GAMES } from "@/lib/data";
import { useLeaderboard, useMyBest } from "@/lib/use-leaderboard";
import { useUser } from "@/lib/user";

export default function SalonPage() {
  const { user } = useUser();
  const [tab, setTab] = useState(GAMES[0].id);
  const { rows, status } = useLeaderboard(tab, 12);
  const mine = useMyBest(tab, user?.id ?? null);
  const game = GAMES.find((g) => g.id === tab)!;
  const slot = (i: number) => rows[i] ?? { rank: i + 1, name: "---", score: 0, date: "" };
  const scoreText = (i: number) => (rows[i] ? rows[i].score.toLocaleString("es-ES") : "---");

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA</p>
      </div>

      <div className="hall-tabs">
        {GAMES.map((g) => (
          <button key={g.id} className={"chip" + (tab === g.id ? " active" : "")} onClick={() => setTab(g.id)}>{g.title}</button>
        ))}
      </div>

      <div className="podium">
        <div className="podium-slot silver">
          <div className="rank-num">02</div>
          <div className="name">{slot(1).name}</div>
          <div className="score">{scoreText(1)}</div>
          <div className="date">{slot(1).date}</div>
        </div>
        <div className="podium-slot gold">
          <div className="pixel" style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}>CAMPEÓN</div>
          <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>01</div>
          <div className="name">{slot(0).name}</div>
          <div className="score" style={{ fontSize: 20 }}>{scoreText(0)}</div>
          <div className="date">{slot(0).date}</div>
        </div>
        <div className="podium-slot bronze">
          <div className="rank-num">03</div>
          <div className="name">{slot(2).name}</div>
          <div className="score">{scoreText(2)}</div>
          <div className="date">{slot(2).date}</div>
        </div>
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {status === "loading" && (
          <div className="tr"><div className="pl" style={{ gridColumn: "1 / -1", textAlign: "center" }}>CARGANDO RANKING…</div></div>
        )}
        {status === "error" && (
          <div className="tr"><div className="pl" role="alert" style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--red, #ff3b5c)" }}>▸ NO SE PUDO CARGAR EL RANKING</div></div>
        )}
        {status === "ok" && rows.length === 0 && (
          <div className="tr"><div className="pl" style={{ gridColumn: "1 / -1", textAlign: "center" }}>SÉ EL PRIMERO EN EL VAULT</div></div>
        )}
        {rows.map((r, i) => (
          <div
            key={r.name + i}
            className={"tr" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">{r.name}</div>
            <div className="sc">{r.score.toLocaleString("es-ES")}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}
        {user && mine && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
            <div className="tr you" style={{ animationDelay: `${rows.length * 50 + 50}ms` }}>
              <div className="rk" style={{ color: "var(--yellow)" }}>#{String(mine.rank).padStart(2, "0")}</div>
              <div className="pl" style={{ color: "var(--yellow)" }}>{user.name}</div>
              <div className="sc" style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}>{mine.score.toLocaleString("es-ES")}</div>
              <div className="dt">{mine.date}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link className="btn lg" href="/juegos">VOLVER A LA BIBLIOTECA</Link>
      </div>
    </div>
  );
}
