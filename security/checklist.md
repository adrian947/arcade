## Checklist de seguridad básico

Documento vivo (SPEC 22). `[x]` = aplicado y verificado (valor + fecha) · `[-]` = no aplicable (con justificación) · `[ ]` = pendiente.

- [x] RLS habilitado en `profiles`, `scores` y `games` — verificado 2026-11-15 (SQL `pg_class.relrowsecurity = true`; policies: `profiles` 2, `scores` 2, `games` 1)
- [x] Minimum password length = 8 — dashboard Supabase (Authentication → Sign In / Providers → Email), aplicado 2026-11-15. Verificado: `POST /auth/v1/signup` con 7 caracteres → `422 weak_password` ("Password should be at least 8 characters.") y sin fila en `auth.users`.
- [-] Leaked password protection (aviso `auth_leaked_password_protection`) — no aplicable: requiere plan Pro (proyecto en Free). Aviso aceptado 2026-11-15.
- [x] Rate limit sign-ups/sign-ins = 10 / 5 min / IP (anti-bot) — dashboard Supabase (Authentication → Rate Limits), aplicado 2026-11-15 (confirmado por el usuario).
- [x] Headers de seguridad en Next.js — `next.config.ts` (nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy `camera=(), microphone=(), geolocation=()`) — verificado 2026-11-15 con `curl -sI` en `/`, `/juegos`, `/jugar/tetris` y `POST /api/contact` (build de producción)

## Supabase: avisos de seguridad (advisors)

- [x] `rls_auto_enable()` ejecutable por anon/authenticated (avisos `0028` / `0029`) — `EXECUTE` revocado en migración `20261115130000_revoke_rls_auto_enable.sql`, aplicada 2026-11-15. `has_function_privilege` = `false` para anon y authenticated; el event trigger `ensure_rls` sigue habilitando RLS en tablas nuevas.
- [-] `auth_leaked_password_protection` — ver arriba

## Pendiente (otros specs)

- `Content-Security-Policy` y `Strict-Transport-Security`
- Advisors de performance / health
