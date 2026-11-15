"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/lib/user";

// Sesión activa sin perfil (alta OAuth sin username): toda ruta lleva a elegir nombre.
export function UsernameGuard() {
  const { loading, needsUsername } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && needsUsername && pathname !== "/login/usuario") router.replace("/login/usuario");
  }, [loading, needsUsername, pathname, router]);

  return null;
}
