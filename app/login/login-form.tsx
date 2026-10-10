"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MIN_PASSWORD, useUser } from "@/lib/user";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useUser();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchTab = (t: "in" | "up") => {
    setTab(t);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const err = tab === "in" ? await signIn(email, pass) : await signUp(user, email, pass);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    router.push("/juegos");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.16em", marginTop: 6 }}>ACCESO AL SISTEMA · v2.6</div>
        </div>

        <div className="auth-tabs">
          <button className={tab === "in" ? "on" : ""} type="button" onClick={() => switchTab("in")}>INICIAR SESIÓN</button>
          <button className={tab === "up" ? "on" : ""} type="button" onClick={() => switchTab("up")}>CREAR CUENTA</button>
        </div>

        <form onSubmit={submit}>
          {tab === "up" && (
            <div className="field slide-in">
              <label>Usuario</label>
              <input value={user} onChange={(e) => setUser(e.target.value.toUpperCase().slice(0, 10))} placeholder="PX_KAI" autoComplete="username" required />
            </div>
          )}
          <div className="field">
            <label>Correo electrónico</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jugador@vault.gg" autoComplete="email" required />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" autoComplete={tab === "in" ? "current-password" : "new-password"} minLength={tab === "up" ? MIN_PASSWORD : undefined} required />
          </div>

          {error && (
            <div role="alert" className="mono" style={{ color: "var(--red, #ff3b5c)", fontSize: 11, letterSpacing: "0.1em", marginBottom: 8, textShadow: "0 0 6px rgba(255,59,92,0.45)" }}>
              ▸ {error}
            </div>
          )}

          <button className="btn lg" type="submit" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
            {busy ? "CONECTANDO…" : tab === "in" ? "ENTRAR AL VAULT" : "CREAR Y JUGAR"}
          </button>
        </form>

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => router.push("/juegos")}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button className="btn ghost" type="button">◆  GOOGLE</button>
          <button className="btn ghost" type="button">▣  GITHUB</button>
        </div>

        <div style={{ marginTop: 18, textAlign: "center", fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
