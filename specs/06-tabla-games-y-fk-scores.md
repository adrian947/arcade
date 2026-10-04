# SPEC 06 — Tabla `games` con FK desde `scores` y centrado del botón guardar

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 05
> **Date:** 2026-10-04
> **Objective:** Crear en Supabase la tabla `games` con el registro de ASTEROIDES y hacer que `scores.game_id` la referencie por FK, de modo que solo los juegos registrados puedan acumular puntuaciones.

---

## Por qué existe este spec

Spec retroactivo: documenta cambios hechos después de SPEC 05, ya aplicados en la base remota y en la rama `spec-05-asteroides-juego-real`.

Hasta SPEC 04, `scores.game_id` era texto libre validado solo por formato (`^[a-z0-9-]{1,40}$`). Cualquier cliente autenticado podía guardar puntuaciones de un `game_id` inexistente o de los juegos mock (con puntajes simulados). Con ASTEROIDES como primer juego real (SPEC 05), el catálogo de juegos "que cuentan" pasa a vivir en la base, y la FK impide registrar partidas de juegos no dados de alta.

Además se corrige un defecto visual heredado de SPEC 04: el botón GUARDAR PUNTUACIÓN quedaba alineado a la izquierda en el modal de fin de partida.

---

## Alcance

**Entra:**

- Migración `supabase/migrations/20261004010000_games.sql`, aplicada con el MCP de Supabase (`apply_migration`, nombre `games`):
  - Tabla `public.games` con columnas mínimas (`id`, `title`, `created_at`).
  - RLS activo con lectura pública; sin políticas de escritura.
  - Registro único `('asteroides', 'ASTEROIDES')`.
  - FK `scores_game_id_fkey`: `scores.game_id → games.id` con `ON DELETE RESTRICT`.
- Tipos regenerados en `lib/supabase/database.types.ts` (tabla `games` y relación `scores_game_id_fkey` en `scores` y en la vista `leaderboard`).
- `app/globals.css`: `.modal .input-row` agrega `justify-content: center`.

**Fuera de alcance (para specs futuros):**

- Registrar los 8 juegos mock (BLOQUE BUSTER, CAÍDA, SERPENTINA, GLOTÓN, INVASORES, ROCAS, RANARIA, DUELO PIXEL): cada uno se agrega a `games` cuando se porte a motor real.
- Mover el catálogo visual (`short`, `long`, `cat`, `cover`, `color`, `best`, `plays`) de `lib/data.ts` a la base y leerlo desde la app.
- Ocultar o deshabilitar GUARDAR PUNTUACIÓN en juegos sin registro en `games` (hoy muestra el error genérico).
- Corregir el aviso de `get_advisors` sobre `public.rls_auto_enable()` (`SECURITY DEFINER` ejecutable por `anon` y `authenticated`), preexistente y ajeno a esta migración.

---

## Modelo de datos

```sql
-- Catálogo de juegos con ranking real. scores.game_id pasa a referenciarlo.
create table public.games (
  id         text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  title      text not null check (char_length(title) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "games: lectura pública" on public.games
  for select to anon, authenticated using (true);

insert into public.games (id, title) values ('asteroides', 'ASTEROIDES');

alter table public.scores
  add constraint scores_game_id_fkey
  foreign key (game_id) references public.games (id) on delete restrict;
-- El índice existente scores_game_score_idx (game_id, score desc) ya cubre esta FK.
```

Notas:

- `games.id` usa el mismo `check` que `scores.game_id` y coincide con el `id` de `GAMES` en `lib/data.ts` (`asteroides`, no `asteroids`).
- Sin políticas de `insert`/`update`/`delete`: los juegos se dan de alta solo por migración.
- `ON DELETE RESTRICT`: no se puede borrar un juego que tenga partidas.
- No se crea índice nuevo: `scores_game_score_idx (game_id, score desc)` de SPEC 04 cubre las búsquedas por la FK.

Tipo generado (extracto):

```ts
games: {
  Row: { created_at: string; id: string; title: string }
  Insert: { created_at?: string; id: string; title: string }
  Update: { created_at?: string; id?: string; title?: string }
  Relationships: []
}
```

---

## Plan de implementación

1. Escribir `supabase/migrations/20261004010000_games.sql` con el SQL de arriba.
2. Aplicarla con el MCP (`apply_migration`) y verificar con `execute_sql` el registro y las FKs de `scores`; correr `get_advisors` (security).
3. Regenerar tipos con `generate_typescript_types` e incorporar `games` y `scores_game_id_fkey` a `lib/supabase/database.types.ts`. `tsc --noEmit` y `npm run lint` pasan.
4. Agregar `justify-content: center` a `.modal .input-row` en `app/globals.css` y verificar el centrado con Playwright MCP.

---

## Criterios de aceptación

- [x] `public.games` existe con RLS activo y contiene exactamente la fila `asteroides` / `ASTEROIDES`.
- [x] `scores` tiene `scores_game_id_fkey: FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE RESTRICT` además de `scores_user_id_fkey`.
- [x] `get_advisors` (security) no reporta hallazgos sobre `games` ni `scores`.
- [x] `supabase/migrations/20261004010000_games.sql` está en el repo y coincide con lo aplicado.
- [x] `lib/supabase/database.types.ts` incluye `games` y la relación `scores_game_id_fkey`; `tsc --noEmit` y `npm run lint` pasan.
- [x] En el modal FIN DEL JUEGO, el botón GUARDAR PUNTUACIÓN queda centrado (márgenes izquierdo y derecho iguales, medido con Playwright: 115 px / 115 px).
- [ ] Con sesión, guardar una partida de ASTEROIDES inserta la fila en `scores` y aparece en `/juego/asteroides` (pendiente: no hay usuarios registrados todavía).
- [ ] Con sesión, guardar una partida de un juego mock (ej. `rocas`) muestra "NO SE PUDO GUARDAR LA PUNTUACIÓN. REINTENTA" y no inserta fila (pendiente, mismo motivo).
- [ ] `GET /rest/v1/games` sin sesión devuelve la fila `asteroides`; `POST /rest/v1/games` con o sin sesión es rechazado por RLS (pendiente).

---

## Decisiones

- **Sí:** solo `asteroides` en `games`. Únicamente los juegos reales cuentan para el ranking; los mock tenían puntajes simulados.
- **No:** registrar los 9 juegos del catálogo. Habría mantenido el guardado de puntajes falsos.
- **Sí:** columnas mínimas (`id`, `title`, `created_at`). El catálogo visual sigue en `lib/data.ts`; moverlo es otro spec.
- **No:** catálogo completo en la base. Obligaría a cambiar cómo la app lee el catálogo, fuera de este alcance.
- **Sí:** `id` = `asteroides`, igual que la app, para que `saveScore` no cambie.
- **Sí:** `ON DELETE RESTRICT` en la FK. Borrar un juego nunca borra partidas en cascada.
- **Sí:** lectura pública y sin escritura por RLS. El alta de juegos es una decisión de despliegue (migración), no de usuario.
- **No:** índice adicional sobre `scores.game_id`; el compuesto existente basta.
- **Sí:** centrar `.input-row` en vez de quitar el wrapper. Cambio de una línea; conserva el espaciado vertical del modal.
- **Sí:** spec escrito después de implementar (retroactivo), a pedido del usuario, para dejar registro de los cambios.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| En los 8 juegos mock, GUARDAR PUNTUACIÓN falla con un error genérico que parece un bug | Aceptado; se documenta. Spec futuro para ocultar el botón en juegos sin registro o para portar esos juegos. |
| Portar un juego nuevo y olvidar su fila en `games`: el guardado falla | Agregar la fila en la migración de cada nuevo port; mencionarlo en la guía "Agregar un juego" del README. |
| Migración aplicada directo en el proyecto remoto | La tabla nace vacía salvo el registro semilla; `scores` estaba vacía, así que la FK no pudo fallar por datos existentes. |
| Criterios con sesión sin verificar | Quedan marcados como pendientes hasta registrar un usuario de prueba. |

---

## Lo que **no** está en este spec

- Registro de los juegos mock en `games`.
- Catálogo visual en la base.
- Ocultar GUARDAR PUNTUACIÓN en juegos sin registro.
- Corrección de `public.rls_auto_enable()`.

Cada uno de estos, si se necesita, va en su propio spec.
