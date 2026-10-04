"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";

export type User = { id: string; name: string };

// Resultado de signIn/signUp: null si todo salió bien, o el mensaje de error para mostrar.
type AuthResult = string | null;

type UserContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (username: string, email: string, password: string) => Promise<AuthResult>;
  logout: () => void;
};

export const USERNAME_RE = /^[A-Z0-9_]{3,10}$/;
export const MIN_PASSWORD = 8;

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  // El perfil se guarda junto al uid que lo originó; si el uid actual no coincide, aún se está cargando.
  const [loaded, setLoaded] = useState<{ uid: string; user: User | null } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUid(data.session?.user.id ?? null);
      setSessionReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUid(session?.user.id ?? null);
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
      .then(({ data }) => {
        if (cancelled) return;
        setLoaded({ uid, user: data ? { id: data.id, name: data.username } : null });
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
    if (!USERNAME_RE.test(name)) return "USUARIO: 3 A 10 CARACTERES (A-Z, 0-9, _)";
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

  const logout = () => {
    void supabase.auth.signOut();
  };

  const profileReady = !uid || loaded?.uid === uid;
  const user = uid && loaded?.uid === uid ? loaded.user : null;
  const loading = !sessionReady || !profileReady;

  return (
    <UserContext.Provider value={{ user, loading, signIn, signUp, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser debe usarse dentro de UserProvider");
  return ctx;
}
