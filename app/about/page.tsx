"use client";

import { useState } from "react";
import { HighlightIcon } from "@/components/about/highlight-icon";
import { useReveal } from "@/components/home/use-reveal";

type Status = "idle" | "sending" | "sent" | "error";
type Form = { name: string; email: string; msg: string; website: string };

const EMPTY: Form = { name: "", email: "", msg: "", website: "" };

const HIGHLIGHTS = [
  { i: "HEART", t: "HECHO CON ❤️ PARA JUGADORES", c: "magenta" },
  { i: "BROWSER", t: "JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR", c: "cyan" },
  { i: "PLANT", t: "PROYECTO EN CONSTANTE CRECIMIENTO", c: "green" },
] as const;

export default function AboutPage() {
  useReveal();

  const [form, setForm] = useState<Form>(EMPTY);
  const [status, setStatus] = useState<Status>("idle");
  const [sentName, setSentName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [shake, setShake] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    if (!form.name.trim() || !form.email.trim() || !form.msg.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          message: form.msg.trim(),
          website: form.website,
        }),
      });
      const data: { ok: boolean; error?: string } = await res.json().catch(() => ({ ok: false }));
      if (res.ok && data.ok) {
        setSentName(form.name.trim());
        setStatus("sent");
      } else {
        setErrorMsg(data.error ?? "No se pudo enviar el mensaje. Inténtalo de nuevo.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("No se pudo conectar con el servidor. Inténtalo de nuevo.");
      setStatus("error");
    }
  };

  return (
    <div className="about fade-in">
      <section className="about-hero">
        <div className="kicker pixel neon-yellow">▸ ACERCA DE</div>
        <h1 className="about-title">ACERCA DE ARCADE VAULT</h1>
        <p className="about-mission">
          ARCADE VAULT nació del amor por los videojuegos clásicos. Nuestra misión es preservar y celebrar
          los arcades que definieron una generación, haciéndolos accesibles para todos, en cualquier lugar
          y sin costo.
        </p>

        <div className="highlight-row">
          {HIGHLIGHTS.map((h, i) => (
            <div key={h.i} className={"highlight " + h.c} style={{ transitionDelay: i * 80 + "ms" }}>
              <HighlightIcon kind={h.i} />
              <div className="hl-text pixel">{h.t}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="about-divider reveal" aria-hidden="true">
        <div className="div-bar"></div>
        <div className="div-pixels">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} style={{ animationDelay: i * 80 + "ms" }}></span>
          ))}
        </div>
        <div className="div-bar"></div>
      </div>

      <section className="about-contact reveal">
        <div className="contact-grid">
          <div className="contact-intro">
            <div className="kicker pixel neon-cyan">▸ CONTACTO</div>
            <h2 className="contact-title">CONTÁCTANOS</h2>
            <p className="contact-sub">
              ¿Tienes alguna sugerencia, quieres proponer un juego, o simplemente quieres saludar? Escríbenos.
            </p>
            <div className="contact-tips">
              <div className="tip"><span className="tip-led"></span>RESPUESTA EN 24-48H</div>
              <div className="tip"><span className="tip-led y"></span>SUGERENCIAS BIENVENIDAS</div>
              <div className="tip"><span className="tip-led m"></span>SIN SPAM, JAMÁS</div>
            </div>
          </div>

          <form className={"contact-form" + (shake ? " shake" : "")} onSubmit={onSubmit} noValidate>
            {status === "sent" ? (
              <div className="terminal-success">
                <div className="term-bar">
                  <span className="dot r"></span><span className="dot y"></span><span className="dot g"></span>
                  <span className="term-title">VAULT-OS // TERMINAL</span>
                </div>
                <div className="term-body">
                  <div className="line"><span className="prompt">vault@arcade:~$</span> ./send_message --to=team</div>
                  <div className="line dim">[OK] Conectando con servidor…</div>
                  <div className="line dim">[OK] Validando contenido…</div>
                  <div className="line dim">[OK] Transmitiendo paquete…</div>
                  <div className="line success">
                    &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {sentName.toUpperCase()}.<span className="caret">_</span>
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => {
                        setStatus("idle");
                        setForm(EMPTY);
                      }}
                    >
                      ENVIAR OTRO MENSAJE
                    </button>
                  </div>
                </div>
              </div>
            ) : status === "error" ? (
              <div className="terminal-error" role="alert">
                <div className="term-bar">
                  <span className="dot r"></span><span className="dot y"></span><span className="dot g"></span>
                  <span className="term-title">VAULT-OS // TERMINAL</span>
                </div>
                <div className="term-body">
                  <div className="line"><span className="prompt">vault@arcade:~$</span> ./send_message --to=team</div>
                  <div className="line dim">[ERR] Transmisión fallida.</div>
                  <div className="line error">&gt; {errorMsg}<span className="caret">_</span></div>
                  <div style={{ marginTop: 18 }}>
                    <button className="btn ghost" type="button" onClick={() => setStatus("idle")}>
                      REINTENTAR
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="c-name">NOMBRE</label>
                  <input id="c-name" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="px_kai" />
                </div>
                <div className="field">
                  <label htmlFor="c-email">CORREO ELECTRÓNICO</label>
                  <input id="c-email" type="email" value={form.email} maxLength={254} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jugador@vault.gg" />
                </div>
                <div className="field">
                  <label htmlFor="c-msg">MENSAJE</label>
                  <textarea id="c-msg" rows={5} value={form.msg} maxLength={2000} onChange={(e) => setForm({ ...form, msg: e.target.value })} placeholder="Cuéntanos qué tienes en mente…"></textarea>
                </div>
                <div className="hp-field" aria-hidden="true">
                  <label htmlFor="c-website">WEBSITE</label>
                  <input id="c-website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                </div>
                <button className="btn xl press" type="submit" disabled={status === "sending"} style={{ width: "100%" }}>
                  {status === "sending" ? "ENVIANDO…" : "▶  ENVIAR MENSAJE"}
                </button>
              </>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
