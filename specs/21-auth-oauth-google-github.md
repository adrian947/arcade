# SPEC 21 — Auth: inicio de sesión con Google y GitHub

> **Status:** Aprobado
> **Depends on:** SPEC 04
> **Date:** 2026-11-15
> **Objective:** Hacer funcionar los botones GOOGLE y GITHUB de `/login` con Supabase OAuth, obligando al jugador que entra por primera vez con un proveedor a elegir su `username` antes de usar la plataforma.

---

## Por qué existe este spec

SPEC 04 dejó Supabase Auth con correo + contraseña y dejó fuera el login social: los botones `◆ GOOGLE` y `▣ GITHUB` de `app/login/login-form.tsx` existen pero no hacen nada.

El problema de fondo es el perfil. El trigger `handle_new_user` crea la fila en `profiles` leyendo `raw_user_meta_data ->> 'username'`. Un usuario OAuth no trae ese campo, así que el insert viola `username not null` y **Supabase rechaza el alta completa**. Por eso no alcanza con llamar a `signInWithOAuth`: hace falta un camino para que el jugador OAuth elija su nombre de ranking.

---

## Alcance

**Entra:**

- Login/registro con **Google** y **GitHub** vía `supabase.auth.signInWithOAuth` desde el cliente del navegador existente (`lib/supabase/client.ts`, sin cambiar su configuración).
- Migración nueva: el trigger `handle_new_user` deja de crear perfil cuando no hay `username` en los metadatos, y una policy RLS permite a cada usuario insertar **su propio** perfil.
- Pantalla nueva `/login/usuario` para elegir `username` (mismo formato `^[A-Z0-9_]{3,10}$`), precargada con una sugerencia derivada del nombre del proveedor.
- Guard global: con sesión activa y sin perfil, cualquier ruta redirige a `/login/usuario`.
- `/login` muestra los errores que devuelve el proveedor y redirige a `/juegos` si ya hay sesión con perfil.
- Vinculación automática de identidades por correo (comportamiento por defecto de Supabase): mismo correo = misma cuenta, mismo perfil, mismos scores.
- Documentación de la configuración manual (GitHub OAuth App, Google Cloud OAuth client, dashboard de Supabase) solo para `http://localhost:3000`.

**No entra:**

- Cambios al flujo de correo + contraseña (`signIn`, `signUp`, validaciones y mensajes quedan iguales).
- Recuperar contraseña, confirmación de correo, cambio de correo o contraseña, borrar cuenta.
- Cambiar el `username` después de elegirlo; pantalla de perfil.
- Otros proveedores (Discord, Apple, etc.).
- Migrar a `@supabase/ssr`, cookies, `proxy.ts` o route handler `/auth/callback`: la sesión sigue viviendo en el cliente.
- Redirigir a la página de origen (`?next=`): el destino tras login siempre es `/juegos`.
- Desvincular identidades o UI que liste los proveedores conectados.
- URLs de redirect de producción (se documenta dónde agregarlas cuando exista el dominio).

---

## Modelo de datos

Sin tablas ni columnas nuevas. `lib/supabase/database.types.ts` no cambia (policies y funciones de trigger no afectan los tipos generados).

### Migración `supabase/migrations/20261115120000_oauth_profiles.sql`

```sql
-- El perfil solo se crea automáticamente si el alta trae username (registro con correo).
-- Las altas OAuth no lo traen: el jugador lo elige en /login/usuario.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  name text := upper(nullif(trim(new.raw_user_meta_data ->> 'username'), ''));
begin
  if name is not null then
    insert into public.profiles (id, username) values (new.id, name);
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Cada usuario autenticado puede crear solo su propio perfil.
-- El CHECK de formato y el UNIQUE de username existentes siguen validando.
create policy "profiles: insertar el propio" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
```

No hay policy de `update` ni de `delete`: el `username` no se puede cambiar (fuera de alcance).

### Cambios en `lib/user.tsx` (contrato del contexto)

```ts
export type OAuthProvider = "google" | "github";

type UserContextValue = {
  user: User | null;              // igual que hoy
  loading: boolean;               // igual que hoy
  needsUsername: boolean;         // sesión activa y profile inexistente (fila no encontrada)
  suggestedUsername: string;      // sugerencia normalizada para /login/usuario ("" si no hay)
  signIn: (email: string, password: string) => Promise<AuthResult>;              // sin cambios
  signUp: (username: string, email: string, password: string) => Promise<AuthResult>; // sin cambios
  signInWithProvider: (provider: OAuthProvider) => Promise<AuthResult>;
  claimUsername: (username: string) => Promise<AuthResult>;
  logout: () => void;             // sin cambios
};
```

- `signInWithProvider(p)` llama a `supabase.auth.signInWithOAuth({ provider: p, options: { redirectTo: \`${window.location.origin}/login\` } })`. Si devuelve error: `"NO SE PUDO CONECTAR CON GOOGLE"` / `"NO SE PUDO CONECTAR CON GITHUB"`. Si no, el navegador sale hacia el proveedor.
- `claimUsername(name)`: normaliza (`trim().toUpperCase()`), valida `USERNAME_RE` en cliente (sin red si falla → `"USUARIO: 3 A 10 CARACTERES (A-Z, 0-9, _)"`), inserta `{ id: uid, username }` en `profiles`. Errores: código `23505` → `"USUARIO NO DISPONIBLE"`; `23514` → mensaje de formato; otro → `"NO SE PUDO GUARDAR EL USUARIO. INTÉNTALO DE NUEVO"`. En éxito actualiza el estado local (`user` pasa a `{ id, name }`, `needsUsername` a `false`) sin recargar.
- `suggestedUsername`: del `session.user.user_metadata`, primer valor no vacío entre `user_name`, `preferred_username`, `full_name`, `name`. Normalización: quitar acentos (NFD + quitar diacríticos), mayúsculas, espacios y guiones → `_`, eliminar todo lo que no sea `[A-Z0-9_]`, recortar a 10. Si queda con < 3 caracteres → `""`.
- `needsUsername` solo es `true` cuando la consulta a `profiles` terminó **sin error** y no devolvió fila. Un error de red no dispara el guard.

---

## Plan de implementación

1. **Migración.** Crear `supabase/migrations/20261115120000_oauth_profiles.sql` con el SQL de arriba y aplicarla con MCP `apply_migration`. Verificar con `get_advisors` (security) que no aparecen avisos nuevos. El registro con correo sigue funcionando igual (el trigger sigue creando perfil cuando hay `username`).
2. **Configuración manual de proveedores (la hace el usuario; el spec la documenta y la implementación la deja escrita en el resumen del PR):**
   - **Supabase → Authentication → URL Configuration:** Site URL `http://localhost:3000`; Redirect URLs `http://localhost:3000/**`.
   - **GitHub → Settings → Developer settings → OAuth Apps → New:** Homepage `http://localhost:3000`; Authorization callback URL `https://<project-ref>.supabase.co/auth/v1/callback` (valor exacto en Supabase → Providers → GitHub). Copiar Client ID + Client Secret a Supabase → Providers → GitHub y activarlo.
   - **Google Cloud Console → APIs & Services:** pantalla de consentimiento (External, modo Testing con el correo del usuario como tester); Credentials → OAuth client ID tipo *Web application*; Authorized redirect URI = la misma callback de Supabase. Copiar Client ID + Secret a Supabase → Providers → Google y activarlo.
   - Para producción: agregar el dominio a Site URL / Redirect URLs de Supabase y a "Authorized JavaScript origins" de Google. Fuera de alcance de este spec.
3. **`lib/user.tsx`.** Agregar `needsUsername`, `suggestedUsername`, `signInWithProvider`, `claimUsername` según el contrato. Guardar el `user_metadata` de la sesión para la sugerencia. Sin cambios en `signIn`, `signUp`, `logout`.
4. **`/login` funcional con OAuth (`app/login/login-form.tsx`).**
   - Botones GOOGLE / GITHUB llaman a `signInWithProvider`; mientras redirige, ambos quedan `disabled` y el botón pulsado muestra `CONECTANDO…`.
   - Al montar, si la URL trae `error` / `error_description` (query o hash), mostrar `"NO SE PUDO INICIAR SESIÓN CON EL PROVEEDOR"` en el bloque de error existente (`role="alert"`) y limpiar la URL con `router.replace("/login")`.
   - Si `!loading && user` → `router.replace("/juegos")`. (Efecto lateral aceptado: un usuario ya logueado que entra a `/login` va a `/juegos`.)
5. **Pantalla `/login/usuario`.** `app/login/usuario/page.tsx` (server, solo renderiza) + `app/login/usuario/username-form.tsx` (client). Reutiliza `av-auth-wrap`, `auth-card`, `auth-header`, `field`, `btn` existentes; sin CSS nuevo salvo que haga falta un ajuste menor en `globals.css`.
   - Título `ELIGE TU NOMBRE DE JUGADOR`, texto `ASÍ APARECERÁS EN EL SALÓN DE LA FAMA`, un campo `Usuario` precargado con `suggestedUsername` (mismo `onChange` que el registro: mayúsculas, máx 10).
   - Botón `CONFIRMAR Y JUGAR` → `claimUsername`; en éxito `router.replace("/juegos")`; en error, mensaje en el bloque `role="alert"`.
   - Botón ghost `SALIR` → `logout()` y `router.replace("/login")`.
   - Si `!loading && !needsUsername`: con `user` → `/juegos`; sin sesión → `/login`.
6. **Guard global.** `components/username-guard.tsx` (client, renderiza `null`): con `!loading && needsUsername && pathname !== "/login/usuario"` → `router.replace("/login/usuario")`. Montarlo en `app/layout.tsx` dentro de `UserProvider`.
7. **Docs.** Actualizar `CLAUDE.md` (rutas: `/login/usuario`; `lib/user.tsx`: nuevas funciones; lista de specs implementados) y marcar este spec `Implementado`.
8. **Cierre.** `npm run lint` y `npm run build` sin errores; recorrer los criterios de aceptación en `npm run dev`.

---

## Criterios de aceptación

- [ ] Migración `20261115120000_oauth_profiles.sql` aplicada; `get_advisors` (security) no muestra avisos nuevos atribuibles a ella.
- [ ] Registro con correo + contraseña sigue creando `auth.users` + `profiles` con `username` en mayúsculas y deja sesión en `/juegos` (regresión SPEC 04).
- [ ] Click en GITHUB con cuenta GitHub nueva → consentimiento de GitHub → vuelve y termina en `/login/usuario` con el campo precargado con el login de GitHub normalizado; existe fila en `auth.users` y **no** existe fila en `profiles` para ese id.
- [ ] Mismo flujo con GOOGLE: termina en `/login/usuario` con sugerencia derivada del nombre (sin acentos, mayúsculas, ≤ 10 caracteres) o campo vacío si la sugerencia queda con < 3 caracteres.
- [ ] En `/login/usuario`, confirmar un `username` válido y libre crea la fila en `profiles`, redirige a `/juegos` y el Nav muestra ese nombre sin recargar.
- [ ] Confirmar un `username` ya existente (en cualquier mayúscula) muestra `USUARIO NO DISPONIBLE` y no crea fila.
- [ ] Un `username` fuera de `^[A-Z0-9_]{3,10}$` se rechaza en cliente sin petición de red.
- [ ] Con sesión OAuth sin perfil, navegar a `/juegos`, `/salon`, `/jugar/tetris` o `/login` redirige a `/login/usuario`; cerrar la pestaña y volver a abrir la app también.
- [ ] `SALIR` en `/login/usuario` cierra sesión y deja en `/login`; volver a entrar con el mismo proveedor vuelve a `/login/usuario`.
- [ ] Segundo login con el mismo proveedor (perfil ya creado) va directo a `/juegos` sin pasar por `/login/usuario`.
- [ ] Usuario registrado con correo X + contraseña que luego entra con Google con el mismo correo X termina en `/juegos` con su `username` original y sus scores; en `auth.identities` hay dos identidades (`email`, `google`) para el mismo `user_id`.
- [ ] Cancelar el consentimiento en GitHub o Google vuelve a `/login` mostrando `NO SE PUDO INICIAR SESIÓN CON EL PROVEEDOR` y la URL queda limpia (`/login`, sin `error`).
- [ ] Un usuario OAuth con perfil puede guardar un score en cualquier juego real y aparece en `/salon`.
- [ ] Entrar a `/login` con sesión y perfil redirige a `/juegos`.
- [ ] `npm run lint` y `npm run build` pasan sin errores.

---

## Decisiones tomadas y descartadas

- **Sí: solo OAuth en este spec.** Email + contraseña ya está en SPEC 04; recuperar contraseña y confirmación de correo van en specs propios si se necesitan.
- **Sí: el jugador OAuth elige su `username` en una pantalla.** El ranking muestra nombres elegidos, no derivados.
  - **Descartado: autogenerar** (`ADRIAN_4F2`) en el trigger: sin pantalla extra, pero nombres feos y no editables.
  - **Descartado: autogenerar + pantalla de edición:** más alcance (policy de update, pantalla de perfil).
- **Sí: precargar sugerencia del proveedor**, editable. Menos fricción que campo vacío.
- **Sí: trigger condicional** (crea perfil solo si viene `username`) en vez de quitar el trigger: el registro con correo queda idéntico.
- **Sí: insert directo con RLS** (`id = auth.uid()`) en vez de RPC `claim_username`. CHECK + UNIQUE ya validan formato y duplicados; cero funciones nuevas.
  - **Descartado: RPC security definer:** más SQL para el mismo resultado.
- **Sí: guard global** en el layout. Atrapa también al jugador que cerró la pestaña a mitad del onboarding; sin él, un usuario logueado sin nombre tendría que tratarse como invitado en Nav y guardado de scores.
- **Sí: vinculación automática por correo** (default de Supabase). Mismo jugador = misma cuenta.
  - **Descartado: cuentas separadas:** dos perfiles para la misma persona, confuso.
- **Sí: `redirectTo` = `/login`, que reenvía a `/juegos`.** El destino final para el jugador es `/juegos`, pero aterrizar en `/login` permite mostrar errores del proveedor en la pantalla correcta.
  - **Descartado: volver a la página de origen (`?next=`):** requiere validar la URL para evitar open redirect; fuera de alcance.
- **Sí: sesión en el cliente, sin `/auth/callback` ni `@supabase/ssr`.** `supabase-js` detecta la sesión en la URL de vuelta (`detectSessionInUrl`, activo por defecto). Ninguna parte del proyecto lee la sesión en el servidor.
- **Sí: solo `localhost:3000`** en la configuración de redirect. No hay dominio de producción confirmado.

---

## Riesgos identificados

- **Vinculación con correo no verificado.** Supabase solo vincula automáticamente si el correo de la identidad existente está confirmado. Con "Confirm email" desactivado (SPEC 04) las altas por correo quedan autoconfirmadas, pero si no fuera así se crearía otro usuario sin perfil. Mitigación: el criterio de aceptación de vinculación lo verifica; si falla, revisar `email_confirmed_at` en `auth.users`.
- **Metadatos con clave `username`.** Si algún proveedor enviara `username` en `user_metadata`, el trigger intentaría crear perfil con ese valor y, si no cumple el CHECK, el alta fallaría. GitHub y Google usan `user_name` / `preferred_username` / `name`, no `username`. Mitigación: probar ambos proveedores en los criterios.
- **Usuarios OAuth huérfanos.** Quien sale en `/login/usuario` queda en `auth.users` sin perfil. No rompe nada (no aparece en ranking, no puede guardar scores porque `scores.user_id` referencia `profiles`) y vuelve al onboarding en el siguiente login. Sin limpieza en este spec.
- **Google en modo Testing.** La pantalla de consentimiento en Testing solo acepta usuarios agregados como testers. Para abrirlo a cualquiera hay que publicar la app en Google Cloud (fuera de alcance).
- **Carrera de `username`.** Dos jugadores confirmando el mismo nombre a la vez: el UNIQUE rechaza al segundo con `23505` → `USUARIO NO DISPONIBLE`. Cubierto.
- **Parpadeo del guard.** Entre que carga la sesión y la consulta a `profiles`, la página destino puede pintarse un instante antes del redirect. Aceptado: el guard espera `!loading` y no hay datos sensibles en juego.
