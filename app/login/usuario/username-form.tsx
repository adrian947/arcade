"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/user";

export function UsernameForm() {
  const router = useRouter();
  const { user, loading, needsUsername, suggestedUsername, claimUsername, logout } = useUser();
  // null = el jugador aún no editó el campo; se muestra la sugerencia del proveedor.
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const value = name ?? suggestedUsername;

  // Sin onboarding pendiente: con perfil va a /juegos, sin sesión a /login.
  useEffect(() => {
    if (loading || needsUsername || busy) return;
    router.replace(user ? "/juegos" : "/login");
  }, [loading, needsUsername, busy, user, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const err = await claimUsername(value);
    if (err) {
      setError(err);
      setBusy(false);
      return;
    }
    router.replace("/juegos");
  };

  // No se navega aquí: si /login cargara con la sesión aún viva, el guard rebotaría a /login/usuario.
  // Al cerrarse la sesión, el efecto de arriba lleva a /login.
  const exit = () => {
    logout();
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ELIGE TU NOMBRE DE JUGADOR</h2>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.16em", marginTop: 6 }}>
            ASÍ APARECERÁS EN EL SALÓN DE LA FAMA
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Usuario</label>
            <input
              value={value}
              onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 10))}
              placeholder="PX_KAI"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          {error && (
            <div role="alert" className="mono" style={{ color: "var(--red, #ff3b5c)", fontSize: 11, letterSpacing: "0.1em", marginBottom: 8, textShadow: "0 0 6px rgba(255,59,92,0.45)" }}>
              ▸ {error}
            </div>
          )}

          <button className="btn lg" type="submit" disabled={busy || loading || !needsUsername} style={{ width: "100%", marginTop: 8 }}>
            {busy ? "GUARDANDO…" : "CONFIRMAR Y JUGAR"}
          </button>
        </form>

        <button className="btn ghost" type="button" style={{ width: "100%", marginTop: 10 }} onClick={exit} disabled={busy}>
          SALIR
        </button>
      </div>
    </div>
  );
}
