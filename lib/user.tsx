"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";

export type User = { id: string; name: string };
export type OAuthProvider = "google" | "github";

// Resultado de signIn/signUp: null si todo salió bien, o el mensaje de error para mostrar.
type AuthResult = string | null;

type UserContextValue = {
  user: User | null;
  loading: boolean;
  needsUsername: boolean;
  suggestedUsername: string;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (username: string, email: string, password: string) => Promise<AuthResult>;
  signInWithProvider: (provider: OAuthProvider) => Promise<AuthResult>;
  claimUsername: (username: string) => Promise<AuthResult>;
  logout: () => void;
};

export const USERNAME_RE = /^[A-Z0-9_]{3,10}$/;
export const MIN_PASSWORD = 8;

const PROVIDER_LABEL: Record<OAuthProvider, string> = { google: "GOOGLE", github: "GITHUB" };
const USERNAME_FORMAT_ERROR = "USUARIO: 3 A 10 CARACTERES (A-Z, 0-9, _)";

// Sugerencia de username a partir de los metadatos del proveedor OAuth ("" si no sirve).
function suggestFrom(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const raw = ["user_name", "preferred_username", "full_name", "name"]
    .map((k) => meta[k])
    .find((v): v is string => typeof v === "string" && v.trim() !== "");
  if (!raw) return "";
  const name = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, 10);
  return name.length >= 3 ? name : "";
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  // El perfil se guarda junto al uid que lo originó; si el uid actual no coincide, aún se está cargando.
  // missing = la consulta terminó sin error y no hay fila en profiles (falta elegir username).
  const [loaded, setLoaded] = useState<{ uid: string; user: User | null; missing: boolean } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUid(data.session?.user.id ?? null);
      setMeta(data.session?.user.user_metadata ?? null);
      setSessionReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUid(session?.user.id ?? null);
      setMeta(session?.user.user_metadata ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionReady || !uid) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, username")
      .eq("id", uid)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoaded({ uid, user: data ? { id: data.id, name: data.username } : null, missing: !error && !data });
      });
    return () => {
      cancelled = true;
    };
  }, [uid, sessionReady]);

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (!error) return null;
    if (error.code === "invalid_credentials") return "CORREO O CONTRASEÑA INCORRECTOS";
    if (error.code === "email_not_confirmed") return "CONFIRMA TU CORREO ANTES DE ENTRAR";
    return "NO SE PUDO INICIAR SESIÓN. INTÉNTALO DE NUEVO";
  };

  const signUp = async (username: string, email: string, password: string): Promise<AuthResult> => {
    const name = username.trim().toUpperCase();
    if (!USERNAME_RE.test(name)) return USERNAME_FORMAT_ERROR;
    if (password.length < MIN_PASSWORD) return `LA CONTRASEÑA DEBE TENER AL MENOS ${MIN_PASSWORD} CARACTERES`;

    const { data: taken, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", name)
      .maybeSingle();
    if (checkError) return "NO SE PUDO COMPROBAR EL USUARIO. INTÉNTALO DE NUEVO";
    if (taken) return "USUARIO NO DISPONIBLE";

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: name } },
    });
    if (error) {
      if (error.code === "user_already_exists" || error.code === "email_exists") return "ESE CORREO YA ESTÁ REGISTRADO";
      if (error.code === "weak_password") return "CONTRASEÑA DEMASIADO DÉBIL";
      if (error.code === "validation_failed" || error.code === "email_address_invalid") return "CORREO NO VÁLIDO";
      // Si el trigger de perfil falla (usuario duplicado en una carrera), Supabase devuelve un error genérico.
      if (error.message.toLowerCase().includes("database error")) return "USUARIO NO DISPONIBLE";
      return "NO SE PUDO CREAR LA CUENTA. INTÉNTALO DE NUEVO";
    }
    if (!data.session) return "CUENTA CREADA. CONFIRMA TU CORREO PARA ENTRAR";
    return null;
  };

  const signInWithProvider = async (provider: OAuthProvider): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/login` },
    });
    return error ? `NO SE PUDO CONECTAR CON ${PROVIDER_LABEL[provider]}` : null;
  };

  const claimUsername = async (username: string): Promise<AuthResult> => {
    const name = username.trim().toUpperCase();
    if (!USERNAME_RE.test(name)) return USERNAME_FORMAT_ERROR;
    if (!uid) return "NO SE PUDO GUARDAR EL USUARIO. INTÉNTALO DE NUEVO";
    const { error } = await supabase.from("profiles").insert({ id: uid, username: name });
    if (error) {
      if (error.code === "23505") return "USUARIO NO DISPONIBLE";
      if (error.code === "23514") return USERNAME_FORMAT_ERROR;
      return "NO SE PUDO GUARDAR EL USUARIO. INTÉNTALO DE NUEVO";
    }
    setLoaded({ uid, user: { id: uid, name }, missing: false });
    return null;
  };

  const logout = () => {
    void supabase.auth.signOut();
  };

  const profileReady = !uid || loaded?.uid === uid;
  const user = uid && loaded?.uid === uid ? loaded.user : null;
  const loading = !sessionReady || !profileReady;
  const needsUsername = !!uid && loaded?.uid === uid && loaded.missing;
  const suggestedUsername = needsUsername ? suggestFrom(meta) : "";

  return (
    <UserContext.Provider value={{ user, loading, needsUsername, suggestedUsername, signIn, signUp, signInWithProvider, claimUsername, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser debe usarse dentro de UserProvider");
  return ctx;
}
