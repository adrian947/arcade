# SPEC 04 — Supabase: autenticación real y ranking persistente

> **Status:** Aprobado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-10-04
> **Objective:** Reemplazar el login falso y los scores en `localStorage` por Supabase (Auth con correo + contraseña, tablas `profiles` y `scores` con RLS) y hacer que el Salón de la Fama y el detalle de cada juego muestren el ranking real.

---

## Por qué existe este spec

Hoy todo el estado del jugador vive en el navegador:

- `lib/user.tsx` guarda `{ name }` en `localStorage` (`av_user`) sin verificar nada; cualquiera "inicia sesión" con cualquier nombre.
- `lib/scores.ts` guarda partidas en `localStorage` (`av_scores`) y nadie más las ve.
- `/salon` y `components/game-detail.tsx` muestran filas inventadas con `seededScores` de `lib/data.ts`.

Para que el producto sea una plataforma donde "los jugadores compiten por puntuaciones", los usuarios y las marcas tienen que existir en un backend compartido. El proyecto de Supabase (`koebecasajyjtrdwnsha`, ya enlazado en `.mcp.json`) está vacío: sin tablas ni migraciones.

Se conserva la UI actual (clases, copy, estructura del podio y la tabla). Cambian el origen de los datos y el formulario de login, que pasa a usar correo.

---

## Alcance

**Entra:**

- Dependencia nueva: `@supabase/supabase-js`. Cliente único del navegador en `lib/supabase/client.ts`, tipado con los tipos generados.
- Variables de entorno públicas `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, documentadas en `.env.example`.
- Migración SQL versionada en `supabase/migrations/` (ver Modelo de datos) y aplicada al proyecto con el MCP de Supabase (`apply_migration`).
- Tipos generados del esquema en `lib/supabase/database.types.ts` (MCP `generate_typescript_types`).
- Reescritura de `lib/user.tsx`: `UserProvider` escucha `supabase.auth.onAuthStateChange`, carga el `username` desde `profiles` y expone `user` (`{ id, name }` o `null`), `loading`, `signIn`, `signUp` y `logout`. `useUser()` mantiene `user` y `logout` para no tocar `components/nav.tsx` más de lo necesario.
- `app/login/page.tsx`:
  - Pestaña "INICIAR SESIÓN": campos **correo** y contraseña (el campo "Usuario" desaparece de esta pestaña).
  - Pestaña "CREAR CUENTA": usuario, correo y contraseña. El usuario se normaliza a mayúsculas.
  - Mensajes de error visibles y específicos (credenciales inválidas, usuario no disponible, correo ya registrado, contraseña corta, error de red).
  - Estado "enviando" con botón deshabilitado.
  - "JUGAR COMO INVITADO" solo navega a `/juegos` (sin sesión).
  - Destino tras éxito: `/juegos` (igual que SPEC 02).
- `lib/scores.ts` reescrito como capa de acceso a datos: guardar partida, leer el top de un juego, leer la mejor marca y el rango del usuario actual.
- `components/game-player.tsx`: se elimina el input "TUS INICIALES". Con sesión, "GUARDAR PUNTUACIÓN" inserta la partida con el usuario autenticado. Sin sesión, el modal muestra "INICIA SESIÓN PARA GUARDAR" con link a `/login`. Si el guardado falla, se muestra el error y se permite reintentar.
- `app/salon/page.tsx` y `components/game-detail.tsx`: leen el ranking real de la vista `leaderboard`, con estados de carga, vacío ("SÉ EL PRIMERO EN EL VAULT") y error. El podio tolera 0, 1 o 2 filas (huecos con `---`). "TU MEJOR MARCA" en el salón usa la fila y el rango reales del usuario.
- Se elimina `seededScores` de `lib/data.ts` y sus usos (el tipo `ScoreRow` se reutiliza o se adapta si hace falta).
- Verificación con Playwright MCP, con el MCP de Supabase (SQL y advisors) y con `curl` contra la REST API para probar RLS.

**Fuera de alcance (para specs futuros):**

- Login con Google/GitHub (los botones del formulario quedan como están, sin funcionar).
- Confirmación de correo, recuperar contraseña, cambio de correo o de contraseña, borrar cuenta.
- Cambiar el `username` después del registro.
- Sesión en cookies y lectura autenticada desde el servidor (`@supabase/ssr`, `proxy.ts`). Todo el acceso a datos es desde componentes cliente; se migra cuando exista una página que necesite datos del usuario en servidor.
- Protección de rutas: invitados pueden seguir viendo y jugando todo; solo guardar requiere sesión.
- Anti-trampas: el score lo reporta el cliente. Validación server-side por juego queda para otro spec.
- Realtime, paginación del ranking, filtros por periodo (diario/semanal) y "TOP JUGADORES DEL DÍA" de la landing (sigue hardcodeado).
- Migrar o importar `av_scores` / `av_user` existentes: se ignoran.
- Entorno local de Supabase (CLI/Docker) y ramas de base de datos: se trabaja contra el proyecto remoto.
- Tests automatizados (no hay test runner).

---

## Modelo de datos

Migración: `supabase/migrations/20261004000000_profiles_scores.sql`.

```sql
-- Perfil público del jugador (1:1 con auth.users)
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (username ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);

-- Una fila por partida guardada
create table public.scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_id    text not null check (game_id ~ '^[a-z0-9-]{1,40}$'),
  score      integer not null check (score between 0 and 10000000),
  created_at timestamptz not null default now()
);
create index scores_game_score_idx on public.scores (game_id, score desc);
create index scores_user_idx on public.scores (user_id);

-- Mejor marca por jugador y juego (el ranking que se muestra)
create view public.leaderboard with (security_invoker = true) as
select distinct on (s.game_id, s.user_id)
       s.game_id, s.user_id, p.username, s.score, s.created_at
from public.scores s
join public.profiles p on p.id = s.user_id
order by s.game_id, s.user_id, s.score desc, s.created_at asc;

-- Crea el perfil al registrarse, tomando el username de los metadatos
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, upper(new.raw_user_meta_data ->> 'username'));
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.scores   enable row level security;

create policy "profiles: lectura pública" on public.profiles
  for select to anon, authenticated using (true);

create policy "scores: lectura pública" on public.scores
  for select to anon, authenticated using (true);

create policy "scores: insertar los propios" on public.scores
  for insert to authenticated with check (user_id = (select auth.uid()));
```

Notas:

- No hay políticas de `update` ni `delete` en ninguna tabla: nadie puede editar o borrar marcas desde el cliente.
- `profiles` no tiene política de `insert`: solo el trigger crea perfiles.
- El ranking por juego se consulta como `leaderboard` filtrado por `game_id`, ordenado por `score desc`, límite 12 (salón) o 10 (detalle).
- Rango del usuario en un juego = (cantidad de filas de `leaderboard` con `score` mayor a la suya) + 1.
- Un empate se resuelve a favor de quien llegó primero (`created_at asc` dentro de cada jugador; entre jugadores el orden del `order by` del cliente es estable por `score desc, created_at asc`).

Tipo de sesión en el cliente:

```ts
type User = { id: string; name: string }; // name = profiles.username
```

Variables de entorno (públicas por diseño; la seguridad la da RLS):

| Variable | Contenido |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto (MCP `get_project_url`). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_...`, MCP `get_publishable_keys`). |

**Dónde colocarlas:** `.env.local` en la raíz (mismo criterio que SPEC 03). El agente no lee ni edita `.env` ni `.env.local`: puede mostrar los valores obtenidos del MCP para que el usuario los copie. La secret/service-role key **no se usa** en este spec.

**Configuración manual en el dashboard de Supabase** (la hace el usuario): Authentication → Providers → Email → desactivar "Confirm email".

---

## Plan de implementación

1. Instalar `@supabase/supabase-js` y agregar las dos variables (sin valores) a `.env.example`. Manual: `npm run build` pasa.
2. Crear `supabase/migrations/20261004000000_profiles_scores.sql` con el SQL de arriba y aplicarla con el MCP (`apply_migration`). Manual: `list_tables` muestra `profiles` y `scores` con RLS activo; `get_advisors` (security) no reporta errores.
3. Generar los tipos con el MCP y guardarlos en `lib/supabase/database.types.ts`. Crear `lib/supabase/client.ts` (cliente tipado). Manual: `npm run build` pasa.
4. El usuario crea `.env.local` con los valores y desactiva "Confirm email" en el dashboard. Reiniciar `npm run dev`.
5. Reescribir `lib/user.tsx` con sesión de Supabase (`loading`, `signIn`, `signUp`, `logout`) y adaptar `app/login/page.tsx`. Manual: registrar, ver el usuario en el Nav, recargar y seguir logueado, cerrar sesión, iniciar sesión de nuevo, entrar como invitado.
6. Reescribir `lib/scores.ts` y adaptar `components/game-player.tsx` (sin iniciales, guardado autenticado, mensaje para invitados, error con reintento). Manual: jugar, perder y guardar; la fila aparece en la tabla `scores`.
7. Conectar `app/salon/page.tsx` y `components/game-detail.tsx` a `leaderboard` (carga, vacío, error, podio con huecos, "TU MEJOR MARCA" real) y eliminar `seededScores` de `lib/data.ts`. Manual: la marca guardada aparece en ambas pantallas.
8. Verificar (criterios de aceptación) con Playwright MCP, SQL del MCP y `curl`, y guardar capturas en `.playwright-screenshot/`.

Cada paso deja la app corriendo y commiteable. Entre el paso 5 y el 7 el ranking mock sigue visible, por lo que no hay pantallas rotas en el intermedio.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `supabase/migrations/20261004000000_profiles_scores.sql` existe y `list_migrations` del MCP la muestra aplicada.
- [ ] `profiles` y `scores` tienen RLS activo y `get_advisors` (security) no reporta errores.
- [ ] Registrar un usuario nuevo con usuario, correo y contraseña crea una fila en `auth.users` y su fila en `profiles` con `username` en mayúsculas, y deja la sesión iniciada en `/juegos`.
- [ ] El Nav muestra el `username` del usuario autenticado; tras recargar la página la sesión persiste.
- [ ] "Cerrar sesión" limpia la sesión y el Nav vuelve al estado sin usuario.
- [ ] Iniciar sesión con correo y contraseña correctos redirige a `/juegos`; con contraseña incorrecta muestra un mensaje de error y no redirige.
- [ ] Registrar un `username` ya existente (aunque difiera en mayúsculas) o un correo ya registrado muestra un mensaje de error específico y no crea cuenta ni perfil huérfano.
- [ ] Un `username` fuera de `^[A-Z0-9_]{3,10}$` o una contraseña de menos de 8 caracteres se rechaza en el cliente sin hacer petición de red.
- [ ] "JUGAR COMO INVITADO" navega a `/juegos` sin crear sesión.
- [ ] El modal de fin de partida ya no tiene input de iniciales. Con sesión, "GUARDAR PUNTUACIÓN" inserta una fila en `scores` con el `user_id` del usuario y muestra "▸ PUNTUACIÓN GUARDADA_". Sin sesión, muestra "INICIA SESIÓN PARA GUARDAR" con link a `/login`.
- [ ] Si el guardado falla (por ejemplo, sin red), el modal muestra el error y permite reintentar; nunca muestra "PUNTUACIÓN GUARDADA" en un fallo.
- [ ] Con dos partidas del mismo usuario en un juego (por ejemplo, 1000 y 5000), `/salon` y el detalle muestran una sola fila para ese usuario con 5000.
- [ ] Sin partidas guardadas en un juego, `/salon` y el detalle muestran "SÉ EL PRIMERO EN EL VAULT" y el podio con `---`, sin errores.
- [ ] "TU MEJOR MARCA" en `/salon` muestra la mejor puntuación y el rango reales del usuario autenticado en el juego seleccionado, y no aparece para invitados.
- [ ] `seededScores` ya no existe en el código y ningún componente importa datos falsos de ranking.
- [ ] RLS por `curl` con la publishable key: `POST /rest/v1/scores` sin sesión devuelve 401/403; con sesión de A y `user_id` de B devuelve 403 (violación de RLS); `PATCH` y `DELETE` sobre `scores` no afectan filas.
- [ ] `score` negativo, mayor a 10.000.000 o `game_id` con formato inválido es rechazado por la base (error de constraint).
- [ ] `GET /rest/v1/leaderboard?game_id=eq.<id>` sin sesión devuelve el ranking (lectura pública).
- [ ] Búsqueda de `service_role` y `sb_secret_` en el repo y en `.next/static` sin coincidencias; `.env.local` no aparece en `git status`.
- [ ] En viewport 390px, `/login`, `/salon` y el detalle no tienen scroll horizontal.
- [ ] La consola del navegador no muestra errores en `/login`, `/salon` y `/juego/[id]` (chequeado con Playwright MCP).
- [ ] Ningún archivo de `references/templates` se importa desde `app/`, `components/` o `lib/`.

---

## Decisiones

- **Sí:** Supabase Auth con correo + contraseña e invitado sin sesión. Sin OAuth: evita crear apps en Google/GitHub y configurar redirect URLs.
- **Sí:** login con correo y `username` en la tabla `profiles`. Supabase Auth identifica por correo; mantener "login por usuario" exigiría una RPC o Route Handler extra.
- **No:** nombre visible derivado del correo. Expondría parte del correo en un ranking público.
- **Sí:** `profiles` creado por trigger `security definer` desde los metadatos del registro. El perfil nace en la misma transacción que el usuario y el cliente no puede crear perfiles arbitrarios (sin política de `insert`).
- **Sí:** `username` en mayúsculas, 3–10 caracteres `[A-Z0-9_]`. Coincide con el límite y el estilo actuales (`toUpperCase().slice(0, 10)`).
- **Sí:** el ranking muestra la mejor marca por jugador y juego (vista `leaderboard`, `security_invoker`). Un jugador no ocupa varias posiciones; se guardan todas las partidas por si luego se quiere historial.
- **No:** ranking con todas las partidas ni nombre libre/iniciales en el ranking. Permitirían duplicados del mismo jugador y suplantación visual.
- **Sí:** insertar scores desde el cliente autenticado con RLS (`user_id = auth.uid()`), lectura pública. Es lo más simple que impide escribir en nombre de otro.
- **No:** Route Handler con service role y validación por juego. Más código y una secret key en el servidor; se difiere junto con el tema anti-trampas.
- **Sí:** solo `@supabase/supabase-js`, sesión en el almacenamiento del navegador. Todo el acceso a datos es client-side; `@supabase/ssr` y `proxy.ts` se agregan cuando haya páginas que lean datos del usuario en el servidor.
- **Sí:** publishable key en `NEXT_PUBLIC_*`. Es pública por diseño; la protección es RLS, verificada con `curl` en los criterios.
- **Sí:** migración SQL versionada en `supabase/migrations/` aplicada con el MCP. Reproducible y revisable en el repo.
- **Sí:** confirmación de correo desactivada por ahora. Mantiene el flujo "registrar y jugar" sin pantalla intermedia ni ruta `/auth/callback`. Se reactiva en un spec propio.
- **Sí:** ranking vacío real con estado "SÉ EL PRIMERO EN EL VAULT"; `av_scores` y `av_user` viejos se ignoran. Sembrar datos falsos complicaría RLS y habría que borrarlos después.
- **Sí:** el agente no lee `.env` ni `.env.local`; el usuario crea `.env.local` con los valores.
- **Sí:** tipos de la base generados con el MCP y cliente tipado, para detectar columnas mal escritas en compilación.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El score lo envía el cliente: cualquiera con sesión puede insertar un valor arbitrario (hasta el tope de 10.000.000) | Asumido y documentado. El `check` limita el rango; validación server-side por juego queda para un spec posterior. |
| La publishable key es pública, así que RLS es la única barrera | Criterios que prueban con `curl` inserción anónima, suplantación de `user_id`, `update`/`delete` y `get_advisors`. |
| `username` duplicado: el trigger falla y `signUp` devuelve un error genérico ("Database error saving new user") | Consultar `profiles` antes de `signUp` para dar un mensaje claro; ante la carrera restante, mapear el error genérico a "USUARIO NO DISPONIBLE". Criterio de aceptación sin perfil huérfano. |
| Confirmación de correo desactivada permite cuentas con correos ajenos o falsos | Aceptado por ahora; se documenta y se aborda en el spec de confirmación/recuperación de contraseña. |
| Parpadeo del estado de sesión: el servidor renderiza "sin usuario" y el cliente recupera la sesión después | `loading` en `useUser()`; el Nav no muestra botones de login/logout hasta resolverlo. |
| Dos pestañas con sesiones distintas o sesión expirada | `onAuthStateChange` mantiene el contexto sincronizado; el guardado de score maneja el error de autenticación y redirige a `/login`. |
| Aplicar la migración directo al proyecto remoto sin entorno de prueba | El esquema parte de un proyecto vacío (`list_tables` y `list_migrations` sin filas); revisar el SQL antes de aplicar y correr `get_advisors` después. |
| Proyecto gratuito pausado por inactividad | Fuera de control del spec; la UI muestra el estado de error del ranking en vez de romperse. |
| Next.js 16 con convenciones distintas a las recordadas | Leer `node_modules/next/dist/docs/01-app` antes de escribir, según `AGENTS.md`. |

---

## Lo que **no** está en este spec

- Login con Google/GitHub, confirmación de correo, recuperar o cambiar contraseña, cambiar `username`, borrar cuenta.
- Sesión por cookies, lectura autenticada en servidor y protección de rutas.
- Anti-trampas y validación de scores por juego.
- Realtime, paginación, filtros por periodo y datos reales en la landing.
- Migración de `av_scores` / `av_user` locales.
- Entorno local de Supabase y ramas de base de datos.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.
