# SPEC 18 — INVASORES: munición de chatarra contra una formación que ondula

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 05, SPEC 06, SPEC 11, SPEC 12
> **Date:** 2026-11-04
> **Objective:** Convertir la entrada demo `invasores` del catálogo en un juego real con un motor TypeScript escrito desde cero en `games/invasores/engine.ts`, montarlo en `/jugar/invasores` y darlo de alta en `public.games` para que sus partidas se guarden y aparezcan en el leaderboard.

---

## Por qué existe este spec

`invasores` es el primer título de `GAMES` (`lib/data.ts`) que todavía corre la arena simulada y no tiene trabajo en curso (`caida`, `serpentina` y `gloton` ya tienen rama y PR abiertos: specs 15, 16 y 17). Su ficha promete "olas de pixeles hostiles que descienden formación tras formación", un cañón que se mueve en horizontal y "abrir fuego con precisión antes de que toquen la superficie". Es un diseño desde cero, sin carpeta en `references/started-games/`.

El género (cañón abajo, formación enemiga arriba) es nuevo en la plataforma: ASTEROIDES es un shooter de rotación libre sin formación. Para no ser una copia del shooter de formaciones clásico, INVASORES se apoya en **dos mecánicas centrales propias**:

1. **Munición de chatarra (precisión como recurso).** El cañón tiene un cargador de 6 celdas. Cada disparo gasta una. Cada invasor destruido suelta un **pixel de chatarra** que cae; atraparlo con el cañón devuelve munición (+1, o +2 si era un acorazado). Un disparo fallado (sale por arriba sin tocar nada) se pierde y además **corta la racha**. La recarga pasiva es lenta (+1 cada 3 s). Disparar a ciegas deja el cañón seco; disparar con precisión lo mantiene cargado.
2. **Formación viva que ondula y desciende sin pausa.** La formación no avanza a saltos de borde a borde: se balancea en una onda suave dentro del campo y **baja de forma continua**. Cuantos menos invasores quedan, más rápido ondula y baja. Cada oleada tiene una **silueta distinta** (bloque, rombo, V, columnas, torres) que rota por nivel.

Además, la **racha** multiplica el puntaje: cada impacto consecutivo sin fallar sube el multiplicador hasta ×5.

No hay escudos/búnkeres, nave nodriza, sprites ni personajes de ningún juego comercial: los tres tipos de invasor son glifos de 8×6 pixeles diseñados para este juego.

Encaja en el contrato actual sin extenderlo: canvas de 800×600, con vidas y nivel. Skins (SPEC 11) y mapeo táctil (SPEC 12) se agregan en la etapa B del flujo de `/spec-impl-game`.

---

## Alcance

**Entra:**

- Entrada `invasores` en `GAMES` de `lib/data.ts`, **en su posición actual**. Se conservan `id`, `title`, `short`, `long`, `cat` (`SHOOTER`), `cover` (`cover-invaders`) y `color` (`green`); `best` y `plays` pasan a `0` / `"0"` porque el ranking pasa a ser real (mismo criterio que SPEC 10 y 14).
- Portada: se reutiliza la existente `.cover-invaders` de `app/globals.css` (no se crea `.cover-invasores`).
- `games/invasores/engine.ts`: motor nuevo que exporta `createInvasores: GameFactory`.
  - Sin estado de módulo mutable: todo vive dentro de la instancia.
  - Gameplay según **Reglas de INVASORES** (abajo).
  - El canvas **no** dibuja score, vidas, nivel, "GAME OVER" ni texto de reinicio. Sí dibuja: marco del campo, línea de superficie, formación, disparos, chatarra, destellos, cañón, cargador de munición, racha (`×N`) y el rótulo `OLEADA N` durante 1,5 s al empezar cada oleada.
  - Al terminar la partida deja de actualizar y llama `onGameOver(score)` una sola vez. Sin reinicio por tecla.
  - `onStats` al iniciar y solo cuando cambia score, vidas o nivel.
  - Colores desde tokens con `getComputedStyle(canvas)` y fallback (patrón `readPalette`), en `games/invasores/skins.ts`.
  - Teclado: `keydown`/`keyup` en `window`, registrados al crear y quitados en `destroy()`; por `e.code`, sin filtrar `isTrusted`. `preventDefault()` solo para `←` `→` `↑` `Espacio` y solo con el motor activo. `P`/`Escape` quedan para la plataforma.
  - `pause()` detiene el loop y limpia teclas; `resume()` reinicia el tiempo de referencia; `dt` con tope de 50 ms; `end()` devuelve el score sin `onGameOver`; `destroy()` idempotente.
- `games/registry.ts`: alta de `invasores` con `skins` y `touch`.
- Migración `supabase/migrations/20261104120000_game_invasores.sql` con la fila de `public.games`.
- `references/implemented-games.md` y la lista de specs de `CLAUDE.md`.

**Fuera de alcance:**

- Escudos, nave nodriza, picadas de invasores, power-ups.
- Sonido y música. Canvas HiDPI. Control con ratón.
- Anti-trampas, `best`/`plays` desde la base, tests automatizados.

---

## Reglas de INVASORES

**Campo.** Canvas 800×600. Campo entre x = 40 y x = 760 (720 px). Línea de **superficie** en y = 528. Cañón de 44×18 px con su base en y = 566 (zona entre la superficie y el cañón: franja del jugador).

**Formación.** Grilla de 10 columnas × 5 filas, celdas de 52×36 px, invasores de 32×24 px (glifo de 8×6 pixeles × 4). Entra con su borde superior en y = 56.

- Tipos por fila: fila 0 **acorazado** (2 impactos, 40 pts), filas 1–2 **medusa** (1 impacto, 20 pts), filas 3–4 **dron** (1 impacto, 10 pts).
- Silueta según `(nivel − 1) mod 5`: bloque completo, rombo, V, columnas alternas (pares), dos torres + puente.
- **Onda:** desplazamiento horizontal = centro del rango libre + amplitud × `sin(fase)`; el rango se calcula con las columnas vivas, así la formación usa todo el ancho al estrecharse. El desplazamiento real persigue al objetivo a ≤ 240 px/s (sin saltos). Velocidad angular `0,9 + 1,6 × (1 − vivos/total)` rad/s.
- **Descenso continuo:** `(7 + 1,5 × (nivel − 1)) × (1 + 1,2 × (1 − vivos/total))` px/s.
- Animación de 2 cuadros por glifo cada 450 ms (solo visual).

**Fuego enemigo.** Cada `max(380, 1150 − 85 × (nivel − 1))` ms dispara el invasor más bajo de una columna viva al azar. Rayo de 4×12 px a `200 + 15 × (nivel − 1)` px/s.

**Cañón y munición.**

- Se mueve a 400 px/s mientras se mantiene `←`/`→` (o `A`/`D`).
- `Espacio` / `↑` / `W` dispara (uno por pulsación, enfriamiento 200 ms) si queda munición. Proyectil de 4×14 px a 640 px/s.
- Cargador de 6 celdas; empieza lleno. Recarga pasiva +1 cada 3 s mientras no esté lleno.
- Cada invasor destruido suelta un pixel de chatarra (8×8 px) que cae a 150 px/s. Si toca el cañón: +1 munición (+2 si era acorazado, sin pasar de 6) y +5 × racha puntos. Si cae bajo el cañón se pierde.
- Sin munición, `Espacio` no dispara (el cargador parpadea).

**Racha.** Empieza en ×1. Cada impacto (que daña o destruye) la sube en 1 hasta ×5. Un proyectil que sale por arriba sin tocar nada la devuelve a ×1. Perder una vida también.

**Puntuación.** Destruir un invasor: puntos del tipo × racha (la racha se aplica tras el incremento del impacto). Atrapar chatarra: 5 × racha. Oleada limpia: +250 × nivel.

**Vidas.** 3. Se pierde una si:

- un rayo toca el cañón (luego 1,5 s de invulnerabilidad con parpadeo y se borran los rayos);
- la formación **aterriza**: algún invasor toca la superficie. Esos invasores se eliminan (sin puntos), la formación retrocede 108 px (3 filas) hacia arriba y se borran los rayos.

Con 0 vidas termina la partida.

**Niveles.** Al destruir todos los invasores: +250 × nivel, sube el nivel, nueva silueta, cargador lleno, se borran rayos/chatarra y se muestra `OLEADA N`.

**Controles.**

| Tecla | Acción |
| --- | --- |
| `←` `→` / `A` `D` (mantener) | mover el cañón |
| `Espacio` / `↑` / `W` | disparar |
| `P` / `Esc` | pausa (plataforma) |

**Táctil (SPEC 12):** ◀ ▶ mover · A `FUEGO` (`Space`, sin repeat: un disparo por toque).

---

## Modelo de datos

`lib/data.ts` (solo cambian `best` y `plays`):

```ts
{
  id: "invasores",
  title: "INVASORES",
  short: "Defiende el planeta de filas alienígenas.",
  long: "Olas de pixeles hostiles descienden formación tras formación. …",
  cat: "SHOOTER",
  cover: "cover-invaders",
  color: "green",
  best: 0,
  plays: "0",
}
```

Migración `supabase/migrations/20261104120000_game_invasores.sql`:

```sql
-- Alta de INVASORES en el catálogo de juegos con ranking real (SPEC 06).
insert into public.games (id, title) values ('invasores', 'INVASORES');
```

No cambia el esquema: no hace falta regenerar `lib/supabase/database.types.ts`.

Registro:

```ts
invasores: {
  factory: createInvasores,
  skins: ["clasico", "neon", "retro"],
  touch: { keys: { left: "ArrowLeft", right: "ArrowRight", a: "Space" }, labels: { a: "FUEGO" } },
},
```

Mapeo de colores (skin `clasico`): drones `--green`, medusas `--magenta`, acorazados `--cyan` (dañados: `--ink-dim`); cañón `--silver` con base `--ink-dim`; proyectil `--yellow`; rayos enemigos `--magenta`; chatarra `--gold`; superficie `--green` con alfa (alerta `--magenta`); cargador `--gold` / `--ink-faint`; racha y rótulos `--ink-dim` en `--pixel`. Fondo `#000`.

Estado interno del motor: `alive` (`Int8Array` 5×10 con impactos restantes, 0 = vacío), `kinds`, `formY`, `offsetX`, `wave`, `shots`, `bolts`, `scraps`, `sparks`, `cannonX`, `ammo`, `regenMs`, `cooldownMs`, `fireMs`, `streak`, `invulnMs`, `bannerMs`, `score`, `lives`, `level`, `phase` (`playing` | `over` | `ended`), `paused`, `destroyed`, `lastTime`, `rafId`, `keys`.

---

## Plan de implementación

1. `lib/data.ts`: `best`/`plays` a 0 en `invasores`.
2. `games/invasores/engine.ts` + `skins.ts` (clasico) y alta en `games/registry.ts`.
3. Migración `supabase/migrations/20261104120000_game_invasores.sql` (aplicarla antes de mergear).
4. Etapa B: skins `neon` y `retro` (skin-designer) y luego `touch` (mobile-porter).
5. `npm run lint` y `npm run build`; prueba en navegador headless (desktop, skins, 390 px táctil).

---

## Criterios de aceptación

**Integración:**

- [x] `npm run build` y `npm run lint` pasan sin errores.
- [x] `GAMES` contiene `invasores` con `best: 0` y `plays: "0"`; el resto de la entrada y las demás entradas no cambiaron.
- [x] Existe `games/invasores/engine.ts` y no declara variables de módulo mutables.
- [x] En `/jugar/invasores` hay un `<canvas>` de 800×600 y el HUD de plataforma muestra score, vidas y nivel del motor.
- [x] El canvas no dibuja score, vidas, nivel, "GAME OVER" ni texto de reinicio; ninguna tecla reinicia.
- [x] Al llegar a 0 vidas se llama `onGameOver` una sola vez; `end()` devuelve el score sin dispararlo; `destroy()` es idempotente y quita los listeners.
- [ ] `public.games` contiene la fila `invasores` (pendiente: aplicar la migración antes de mergear).
- [ ] Con sesión, GUARDAR PUNTUACIÓN inserta en `scores` con `game_id = 'invasores'` (depende de la migración).
- [x] En emulación táctil (390 px) se muestra el gamepad con ◀ ▶ y A `FUEGO`, sin "REQUIERE TECLADO".
- [x] El selector muestra CLÁSICO / NEÓN / RETRO y cada skin redibuja en vivo.

**Gameplay:**

- [x] `←`/`→` (y `A`/`D`) mueven el cañón mientras se mantienen; `Espacio`/`↑`/`W` disparan uno por pulsación y gastan una celda del cargador.
- [x] Sin munición no se dispara; la recarga pasiva suma 1 celda cada 3 s.
- [x] Destruir un invasor suelta chatarra; atraparla devuelve munición (+2 si era acorazado).
- [x] Los acorazados necesitan 2 impactos.
- [x] La racha sube por impacto hasta ×5 y vuelve a ×1 con un disparo fallado o al perder una vida.
- [x] La formación ondula y baja de forma continua, más rápido cuantos menos invasores quedan.
- [x] Un rayo enemigo o el aterrizaje de la formación restan una vida; con 0 vidas termina la partida.
- [x] Limpiar la oleada suma +250 × nivel, sube el nivel y cambia la silueta.

---

## Decisiones

- **Sí:** el juego a implementar es `invasores`: primer id de `GAMES` sin motor ni trabajo en curso (`caida`, `serpentina`, `gloton` tienen ramas `spec-15/16/17-*` y PRs #19–#21 abiertos). Por eso este spec es el 18.
- **Sí:** diseño original diferenciado del shooter de formaciones clásico y de ASTEROIDES por la munición de chatarra (precisión como recurso), la racha y la formación que ondula y baja de forma continua con siluetas por oleada. Sin escudos, nave nodriza, sprites ni personajes de juegos comerciales.
- **Sí:** se conserva la ficha del catálogo (id, título, `short`, `long`, `cover-invaders`, color); `best`/`plays` a 0.
- **Sí:** reutilizar `.cover-invaders` (ya existe y representa el juego) en vez de crear `.cover-invasores`.
- **Sí:** aterrizar resta una vida y hace retroceder la formación, en vez de terminar la partida de golpe: castiga sin frustrar (mismo criterio que la brecha de SPEC 14).
- **Sí:** la recarga pasiva evita quedarse sin munición para siempre; es lenta a propósito para que la chatarra importe.
- **Supuesto:** el azar del fuego enemigo usa `Math.random` (no afecta la equidad del ranking de forma relevante; las siluetas sí son fijas por nivel).
- **Supuesto:** skins y táctil se hacen en este mismo PR siguiendo `.claude/agents/skin-designer.md` y `.claude/agents/mobile-porter.md` (corrida nocturna sin humano). En retro los 3 tipos se distinguen por la silueta del glifo (acorazado en el tono más claro) y el acorazado dañado pasa al tono oscuro `#306230`.
- **Supuesto:** nombre de migración `20261104120000_game_invasores.sql`. No se pudo aplicar: la corrida no tiene acceso a la base.
- **Supuesto:** verificación en navegador con Playwright headless y servidor local sin Supabase configurado (sin guardar puntaje).

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Migración sin aplicar: guardar puntaje falla por la FK de SPEC 06 | Aviso destacado en el PR; aplicar antes de mergear. |
| Conflicto de merge en `CLAUDE.md` y `references/implemented-games.md` con los PRs 15–17 abiertos | Cambios acotados a una línea/sección; resolver al mergear en orden. |
| Neón con `shadowBlur` en 50 invasores × 48 pixeles | Cada glifo es un `Path2D` precalculado: un solo `fill` por invasor. |
| Formación que salta al morir una columna | El desplazamiento persigue al objetivo a velocidad máxima limitada. |
| React 19 Strict Mode monta dos motores | `destroy()` idempotente; no quedan listeners. |

---

## Lo que **no** está en este spec

- Escudos, nave nodriza, power-ups, sonido, HiDPI, ratón.
- Anti-trampas y validación de scores; `best`/`plays` desde la base.
- Tests automatizados.
