# SPEC 22 — Checklist de seguridad básico

> **Status:** Aprobado
> **Depends on:** SPEC 04
> **Date:** 2026-11-15
> **Objective:** Aplicar el checklist de seguridad básico de `security/` (RLS, política de contraseñas, rate limit de signups, headers HTTP y avisos de seguridad de Supabase) y dejarlo como documento vivo en `security/checklist.md`.

---

## Por qué existe este spec

`security/securiy-checlist.md` (nombre con typos) lista medidas mínimas sin aplicar ni verificar. Estado actual relevado:

- **RLS:** ya habilitado en `profiles`, `scores` y `games`, todas con policies. Solo falta verificarlo y dejarlo registrado.
- **Contraseña mínima:** el cliente exige 8 caracteres (`MIN_PASSWORD` en `lib/user.tsx`), pero el servidor de Supabase Auth usa su valor por defecto (6). Un signup directo contra la API saltea la validación del cliente.
- **Rate limit de signups:** valor por defecto de Supabase (30 por 5 min por IP).
- **Headers:** `next.config.ts` está vacío; no se envía ningún header de seguridad.
- **Advisors de seguridad de Supabase** (3 avisos):
  1. `anon_security_definer_function_executable`: `public.rls_auto_enable()`
  2. `authenticated_security_definer_function_executable`: `public.rls_auto_enable()`
  3. `auth_leaked_password_protection`: protección de contraseñas filtradas desactivada.

`public.rls_auto_enable()` es la función del event trigger `ensure_rls` (`ddl_command_end`, owner `postgres`) que habilita RLS en tablas nuevas. No está en `supabase/migrations/`: la creó la plataforma. Hoy anon y authenticated tienen `EXECUTE` y la función queda expuesta en `/rest/v1/rpc/rls_auto_enable`.

---

## Alcance

**Entra:**

- Renombrar `security/securiy-checlist.md` → `security/checklist.md`, corregir typos y convertirlo en documento vivo: cada ítem marcado `[x]` con valor aplicado y fecha, o `[-]` no aplicable con justificación.
- Verificar RLS en `profiles`, `scores` y `games` (consulta SQL) y registrar el resultado.
- **Manual en el dashboard de Supabase** (lo hace el usuario; el spec da ruta y valor):
  - Minimum password length = **8**.
  - Rate limit de sign-ups y sign-ins = **10 por 5 minutos por IP**.
- Leaked password protection: **no aplicable** (requiere plan Pro; el proyecto está en Free). Se documenta y el aviso se acepta.
- Migración que revoca `EXECUTE` sobre `public.rls_auto_enable()` a `public`, `anon` y `authenticated`.
- Headers de seguridad para todas las rutas en `next.config.ts`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Referencia a `security/checklist.md` en `CLAUDE.md`.

**No entra:**

- `Content-Security-Policy` y `Strict-Transport-Security` (CSP puede romper Supabase, fuentes y estilos inline; HSTS solo tiene sentido con dominio HTTPS de producción). Van en su propio spec.
- Advisors de **performance** y **health**.
- Rate limit propio en la app (`/api/contact`, middleware/`proxy.ts`), CAPTCHA en signup.
- Pasar a plan Pro o un reemplazo casero de leaked password protection.
- Cambios en la validación de cliente de `lib/user.tsx` (ya exige 8 y ya mapea `weak_password` → `CONTRASEÑA DEMASIADO DÉBIL`).
- Mover `rls_auto_enable` a otro schema o tocar el event trigger `ensure_rls`.
- Automatizar la configuración de Auth vía Management API.

---

## Modelo de datos

Sin tablas, columnas ni tipos nuevos. Solo cambian privilegios.

### Migración `supabase/migrations/20261115130000_revoke_rls_auto_enable.sql`

```sql
-- rls_auto_enable() es la función del event trigger ensure_rls (creada por la plataforma).
-- Ningún rol de la API necesita llamarla: el event trigger la ejecuta igual.
-- Quitar EXECUTE la saca de /rest/v1/rpc y resuelve los avisos 0028 y 0029.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
```

### `next.config.ts`

```ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// headers: async () => [{ source: "/(.*)", headers: securityHeaders }]
```

(Confirmar la forma de `headers` en `node_modules/next/dist/docs/` antes de escribirla: Next.js 16.3.5.)

### `security/checklist.md` (estructura final)

```md
## Checklist de seguridad básico

- [x] RLS habilitado en `profiles`, `scores` y `games` — verificado 2026-11-15 (SQL `pg_class.relrowsecurity`)
- [x] Minimum password length = 8 — dashboard Supabase, aplicado <fecha>
- [-] Leaked password protection — no aplicable: requiere plan Pro (proyecto en Free). Aviso aceptado.
- [x] Rate limit sign-ups/sign-ins = 10 / 5 min / IP — dashboard Supabase, aplicado <fecha>
- [x] Headers de seguridad en Next.js — `next.config.ts` (nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy)

## Supabase: avisos de seguridad (advisors)

- [x] `rls_auto_enable()` ejecutable por anon/authenticated — revocado en migración 20261115130000
- [-] `auth_leaked_password_protection` — ver arriba

## Pendiente (otros specs)

- CSP y HSTS
- Advisors de performance / health
```

---

## Plan de implementación

1. **Renombrar el checklist.** `security/securiy-checlist.md` → `security/checklist.md` (el archivo no está versionado: `mv`). Corregir typos ("ladod e" → "lado de", "el warning 4" → nombre real del aviso). Todos los ítems siguen `[ ]` hasta su paso.
2. **Verificar RLS.** Con MCP `execute_sql`: `relrowsecurity = true` y al menos una policy en `profiles`, `scores`, `games`. Marcar el ítem en el checklist.
3. **Migración.** Crear `supabase/migrations/20261115130000_revoke_rls_auto_enable.sql`, aplicarla con MCP `apply_migration`. Verificar:
   - `get_advisors` (security) ya no muestra los avisos 0028/0029.
   - El event trigger sigue funcionando: dentro de un bloque `do $$ … raise exception … $$` (se revierte solo) crear una tabla en `public` y comprobar que queda con `relrowsecurity = true`.
   - Marcar el ítem.
4. **Headers.** Leer la guía de `headers` en `node_modules/next/dist/docs/`, escribir `next.config.ts` según el modelo. Verificar con `npm run build && npm run start` y `curl -sI` sobre `/`, `/juegos`, `/jugar/tetris` y `/api/contact` (este último con `curl -sI -X POST`): los 4 headers presentes. Marcar el ítem.
5. **Configuración manual en el dashboard (la hace el usuario).** La implementación se detiene a pedirla, con estas rutas (los nombres del menú pueden variar levemente según la versión del dashboard):
   - **Authentication → Sign In / Providers → Email → Minimum password length:** `8`. Guardar.
   - **Authentication → Rate Limits → Rate limit for sign-ups and sign-ins:** `10` (por 5 minutos por IP). Guardar.
   - **Authentication → Passwords → Leaked password protection:** comprobar que está bloqueado por plan Free; no se activa.
   - Tras confirmar el usuario: verificar contraseña mínima con un signup de 7 caracteres contra la API de Auth (ver criterio) y marcar los ítems con la fecha.
6. **Leaked password.** Marcar `[-]` con la justificación en el checklist.
7. **Docs.** En `CLAUDE.md`, sección de arquitectura: línea que apunte a `security/checklist.md` y mencione los headers de `next.config.ts`. Marcar este spec `Implementado` cuando pasen los criterios.
8. **Cierre.** `npm run lint` y `npm run build` sin errores; `get_advisors` (security) final.

---

## Criterios de aceptación

- [ ] Existe `security/checklist.md`; no existe `security/securiy-checlist.md`.
- [ ] Cada ítem del checklist está `[x]` con valor/fecha o `[-]` con justificación; ninguno queda `[ ]`.
- [ ] Consulta SQL muestra `relrowsecurity = true` y ≥ 1 policy en `profiles`, `scores` y `games`.
- [ ] `get_advisors` (security) no muestra `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable`; el único aviso restante es `auth_leaked_password_protection` (aceptado).
- [ ] `has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')` y el mismo para `authenticated` devuelven `false`.
- [ ] Una tabla creada en `public` (en bloque que se revierte) queda con RLS habilitado: el event trigger `ensure_rls` sigue funcionando.
- [ ] `curl -sI http://localhost:3000/` (build de producción) muestra `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy: camera=(), microphone=(), geolocation=()`; lo mismo en `/juegos`, `/jugar/tetris` y `/api/contact`.
- [ ] `POST {SUPABASE_URL}/auth/v1/signup` con contraseña de 7 caracteres responde error `weak_password` y no crea fila en `auth.users`.
- [ ] Registro desde `/login` con contraseña de 8 caracteres sigue funcionando (regresión).
- [ ] El dashboard muestra rate limit de sign-ups y sign-ins en `10` (confirmado por el usuario).
- [ ] La app sigue funcionando sin errores de consola nuevos: landing, `/juegos`, jugar una partida y login (el `X-Frame-Options: DENY` no rompe nada propio: la app no usa iframes).
- [ ] `npm run lint` y `npm run build` pasan sin errores.

---

## Decisiones tomadas y descartadas

- **Sí: ajustes de Auth a mano en el dashboard**, documentados con ruta y valor. El MCP de Supabase no expone la configuración de Auth.
  - **Descartado: Management API con Personal Access Token:** reproducible, pero obliga a manejar un token con permisos amplios sobre la cuenta.
- **Sí: leaked password protection no aplicable (plan Free).** Se documenta y se acepta el aviso en vez de pagar Pro o armar un chequeo casero contra HaveIBeenPwned.
- **Sí: rate limit 10 / 5 min / IP.** Frena bots sin bloquear a un jugador que se equivoca un par de veces.
  - **Descartado: 5:** riesgo de bloquear a varios jugadores detrás de la misma IP (NAT, cibercafé).
  - **Descartado: dejar 30:** el checklist pide limitar.
- **Sí: 3 headers del checklist + `Permissions-Policy`.** Cero riesgo de romper la app; la app no usa cámara, micrófono ni geolocalización.
  - **Descartado: CSP + HSTS ahora:** CSP estricta exige inventariar orígenes (Supabase, OAuth, Resend) y estilos inline; HSTS necesita dominio HTTPS. Spec propio.
- **Sí: `revoke execute` sobre `rls_auto_enable()`** por migración. Mínimo e idempotente; el event trigger no depende de `EXECUTE` de los roles de la API.
  - **Descartado: moverla a otro schema:** obliga a recrear el event trigger, que es de la plataforma.
  - **Descartado: aceptar el aviso:** expone una función `SECURITY DEFINER` en la API pública sin necesidad.
- **Sí: el checklist como documento vivo** (`[x]` con valor y fecha, `[-]` con justificación). Sirve de auditoría para la próxima revisión.
- **Sí: solo advisors de seguridad.** Es lo que pide el checklist; performance en otro spec.

---

## Riesgos identificados

- **Rate limit en desarrollo.** 10 intentos por 5 minutos por IP aplica también a `localhost`; probar login/registro muchas veces seguidas (ej. criterios de SPEC 21) puede bloquear temporalmente. Mitigación: esperar 5 minutos o subir el límite mientras se prueba y volver a 10.
- **Plataforma recrea la función.** Si Supabase vuelve a crear `rls_auto_enable()` (actualización de plataforma), los grants podrían volver y los avisos reaparecer. Mitigación: la migración es idempotente; volver a aplicarla.
- **Cuentas con contraseña < 8.** Supabase solo valida la longitud al crear o cambiar contraseña; cuentas antiguas con 6–7 caracteres (si las hubiera) siguen entrando. Aceptado: el cliente exige 8 desde SPEC 04.
- **`X-Frame-Options: DENY`** impide embeber la app en iframes de terceros (ej. una vista previa en otro sitio). Aceptado: no hay ese caso de uso.
- **Rama de trabajo.** El árbol actual tiene SPEC 21 sin commitear en `spec-21-auth-oauth-google-github`. Commitear o mergear SPEC 21 antes de crear la rama de este spec, para no mezclar cambios.
