"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/lib/user";

export function Nav() {
  const pathname = usePathname();
  const { user, loading, logout } = useUser();
  const [open, setOpen] = useState(false);

  const isActive = (name: "home" | "biblioteca" | "salon" | "about" | "auth") => {
    if (name === "home") return pathname === "/";
    if (name === "biblioteca") return pathname.startsWith("/juegos") || pathname.startsWith("/juego/") || pathname.startsWith("/jugar");
    if (name === "salon") return pathname.startsWith("/salon");
    if (name === "about") return pathname.startsWith("/about");
    return pathname.startsWith("/login");
  };

  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo">
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={isActive("home") ? "active" : ""}>Inicio</Link>
          <Link href="/juegos" className={isActive("biblioteca") ? "active" : ""}>Biblioteca</Link>
          <Link href="/salon" className={isActive("salon") ? "active" : ""}>Salón de la Fama</Link>
          <Link href="/about" className={isActive("about") ? "active" : ""}>Acerca de</Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {loading ? (
          <span className="btn ghost auth-btn" aria-hidden style={{ visibility: "hidden" }}>···</span>
        ) : user ? (
          <button className="btn ghost auth-btn" onClick={logout}>{user.name} ▾</button>
        ) : (
          <Link href="/login" className="btn auth-btn">Iniciar Sesión</Link>
        )}
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">≡</button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={close}></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>MENÚ</div>
        <Link href="/" onClick={close} className={isActive("home") ? "active" : ""}>Inicio</Link>
        <Link href="/juegos" onClick={close} className={isActive("biblioteca") ? "active" : ""}>Biblioteca</Link>
        <Link href="/salon" onClick={close} className={isActive("salon") ? "active" : ""}>Salón de la Fama</Link>
        <Link href="/about" onClick={close} className={isActive("about") ? "active" : ""}>Acerca de</Link>
        <Link href="/login" onClick={close} className={isActive("auth") ? "active" : ""}>{user ? "Cuenta" : "Iniciar Sesión"}</Link>
        <div style={{ flex: 1 }}></div>
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>CRÉDITOS · 03</div>
      </aside>
    </>
  );
}
