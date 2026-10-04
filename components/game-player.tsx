"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/user";
import { saveScore } from "@/lib/scores";
import type { Game } from "@/lib/data";
import { ENGINES } from "@/games/registry";
import type { GameEngine, GameStats } from "@/games/types";

const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";

function subscribeTouch(onChange: () => void) {
  const mq = window.matchMedia(TOUCH_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

// Dispositivo táctil sin teclado físico (en servidor se asume que no).
function useTouchOnly() {
  return useSyncExternalStore(
    subscribeTouch,
    () => window.matchMedia(TOUCH_QUERY).matches,
    () => false,
  );
}

export function GamePlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user } = useUser();
  const factory = ENGINES[game.id];
  const touchOnly = useTouchOnly();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [runId, setRunId] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [engineLevel, setEngineLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const name = user ? user.name : "INVITADO";
  const level = factory ? engineLevel : Math.floor(score / 2500) + 1;
  const engineEnabled = !!factory && !touchOnly;

  // Arena simulada para juegos sin motor real.
  useEffect(() => {
    if (factory || over || paused) return;
    const t = setInterval(() => setScore((s) => s + Math.floor(10 + Math.random() * 90)), 220);
    return () => clearInterval(t);
  }, [factory, over, paused]);

  // Motor real: se crea por partida (runId) y se destruye al salir o reiniciar.
  useEffect(() => {
    const canvas = canvasRef.current;
    // matchMedia directo: en la hidratación touchOnly aún vale el snapshot del servidor (false).
    if (!factory || !engineEnabled || !canvas || window.matchMedia(TOUCH_QUERY).matches) return;
    const engine = factory(canvas, {
      onStats: (s: GameStats) => {
        setScore(s.score);
        setLives(s.lives);
        setEngineLevel(s.level);
      },
      onGameOver: (finalScore) => {
        setScore(finalScore);
        setOver(true);
      },
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [factory, engineEnabled, runId]);

  // Sincroniza la pausa de React con el motor.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || over) return;
    if (paused) engine.pause();
    else engine.resume();
  }, [paused, over, runId]);

  // Teclas P / Escape y auto-pausa al perder foco (solo motor real en juego).
  useEffect(() => {
    if (!engineEnabled || over) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyP" || e.code === "Escape") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    const autoPause = () => setPaused(true);
    const onVisibility = () => {
      if (document.hidden) autoPause();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", autoPause);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", autoPause);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [engineEnabled, over]);

  const endGame = () => {
    if (engineRef.current) setScore(engineRef.current.end());
    setOver(true);
  };
  const restart = () => {
    setScore(0);
    setLives(3);
    setEngineLevel(1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaveError(null);
    setRunId((r) => r + 1);
  };

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);
    setSaveError(null);
    const err = await saveScore(user.id, game.id, score);
    setSaving(false);
    if (err) {
      setSaveError(err);
      return;
    }
    setSaved(true);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat"><div className="l">Jugador</div><div className="v" style={{ color: "var(--ink)" }}>{name}</div></div>
          <div className="hud-stat"><div className="l">Puntuación</div><div className="v">{score.toLocaleString("es-ES")}</div></div>
          <div className="hud-stat lives"><div className="l">Vidas</div><div className="v">{"♥ ".repeat(lives).trim() || "—"}</div></div>
          <div className="hud-stat level"><div className="l">Nivel</div><div className="v">{String(level).padStart(2, "0")}</div></div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>{paused ? "REANUDAR" : "PAUSA"}</button>
          <button className="btn magenta" onClick={endGame}>FIN</button>
          <button className="btn ghost" onClick={() => router.push(`/juego/${game.id}`)}>SALIR</button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {factory ? (
            <canvas key={runId} ref={canvasRef} className="game-canvas" width={800} height={600} />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {factory && touchOnly && (
            <div className="crt-content" style={{ zIndex: 5 }}>
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 18 }}>REQUIERE TECLADO</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 10, letterSpacing: "0.16em" }}>JUEGA DESDE UN COMPUTADOR</div>
              </div>
            </div>
          )}
          {paused && (
            <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>EN PAUSA</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 10, letterSpacing: "0.16em" }}>PULSA REANUDAR PARA CONTINUAR</div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {saved ? (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            ) : user ? (
              <div>
                <div className="input-row">
                  <button className="btn yellow" onClick={handleSave} disabled={saving}>
                    {saving ? "GUARDANDO…" : saveError ? "REINTENTAR" : "GUARDAR PUNTUACIÓN"}
                  </button>
                </div>
                {saveError && (
                  <div role="alert" className="mono" style={{ color: "var(--red, #ff3b5c)", fontSize: 11, letterSpacing: "0.1em", marginTop: 8 }}>
                    ▸ {saveError}
                  </div>
                )}
              </div>
            ) : (
              <Link className="btn yellow" href="/login">INICIA SESIÓN PARA GUARDAR</Link>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>JUGAR DE NUEVO</button>
              <button className="btn magenta" onClick={() => router.push("/juegos")}>VOLVER AL VAULT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
