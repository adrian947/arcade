# SPEC 09 — SNAKE: cuarto juego real con leaderboard

> **Status:** Aprobado
> **Depends on:** SPEC 04, SPEC 05, SPEC 06, SPEC 07, SPEC 08
> **Date:** 2026-10-10
> **Objective:** Agregar el juego `snake` al catálogo con un motor TypeScript escrito desde cero en `games/snake/engine.ts`, que usa los sprites de fruta de `references/started-games/05-snake-assets/`. Montarlo en `/jugar/snake` y darlo de alta en `public.games` para que sus partidas se guarden y aparezcan en el leaderboard.

---

## Por qué existe este spec

ASTEROIDES (SPEC 05), TETRIS (SPEC 07) y ARKANOID (SPEC 08) son hoy los juegos reales del Vault. SNAKE es el cuarto, y el primero que no se porta: `references/started-games/05-snake-assets/` no trae código de juego, solo assets.

- `fruits.png`: hoja de 3790×442 px y 585 KB con fondo transparente y tres filas de 22 frutas (realista simple, pixel-art y realista detallada).
- `sprites.js`: `window.SPRITE_ATLAS` con las coordenadas de la fila pixel-art (`y = 136`, alto 160, anchos de 110 a 170 px).

Los nombres del atlas están **desplazados una posición** respecto de las imágenes: el recorte llamado `banana` (`x = 34`) es una naranja roja y el llamado `orange` es la banana. Las coordenadas sí son correctas, así que el motor usa las frutas por índice y no por nombre.

Las reglas son las del Snake clásico, acordadas en este spec: tablero de 32×24 celdas que llena el canvas de 800×600, paredes que matan, sin vidas, 10 puntos × nivel por fruta y un nivel nuevo cada 5 frutas, con aceleración. El juego encaja en el contrato actual sin extenderlo: 800×600, tiene nivel y la ausencia de vidas ya está resuelta con `lives: false` (SPEC 07).

SNAKE es una entrada **nueva** del catálogo. El mock `serpentina` (SERPENTINA), parecido, no se toca.

---

## Alcance

**Entra:**

- Entrada nueva en `GAMES` de `lib/data.ts`, en la **cuarta posición** (detrás de `asteroides`, `tetris` y `arkanoid`):
  - `id: "snake"`, `title: "SNAKE"`, `cat: "ARCADE"`, `color: "yellow"`, `cover: "cover-snake-vault"`, `best: 0`, `plays: "0"`.
  - Copy `short` y `long` basados en el juego (ver Modelo de datos).
- Portada CSS nueva `.cover-snake-vault` en `app/globals.css`, junto a las demás `cover-*`. El nombre `.cover-snake` ya lo usa SERPENTINA.
  - Fondo negro con rejilla tenue.
  - Serpiente de bloques `--green` en zigzag, con cabeza `--yellow` y glow.
  - Una fruta pixel roja delante de la cabeza.
  - Solo CSS/SVG inline, sin imágenes externas. Distinta de `.cover-snake`.
- Asset recortado (no importado) desde `references/started-games/05-snake-assets/fruits.png` a `public/games/snake/fruits.png`:
  - Solo la franja pixel-art: `y = 136` a `295`, es decir 3790×160 px. El recorte se hace una sola vez durante la implementación y el resultado se commitea.
- `games/snake/sprites.ts`: `FRUIT_URL = "/games/snake/fruits.png"` y `FRUIT_FRAMES`, un arreglo inmutable de 22 recortes `{ sx, sy: 0, sw, sh: 160 }`.
  - Los `sx` y `sw` salen de `sprites.js`, en el mismo orden.
  - Sin nombres, porque los del atlas están desplazados.
- `games/snake/engine.ts`: motor nuevo que exporta `createSnake: GameFactory`.
  - Sin estado de módulo mutable: todo vive dentro de la instancia, incluida la imagen.
  - **Tablero:** `COLS = 32`, `ROWS = 24`, `CELL = 25`, que llena el canvas de 800×600.
  - **Inicio:** serpiente de 3 celdas con la cabeza en `(16, 12)` y el cuerpo en `(15, 12)` y `(14, 12)`, dirección derecha.
    - Queda quieta en fase `waiting` hasta la primera tecla de dirección válida.
    - Una primera pulsación hacia la izquierda se ignora por ser reversa.
  - **Movimiento:** la serpiente avanza una celda por tick con acumulador de tiempo.
    - Intervalo del tick: `tickMs = max(60, 150 − (level − 1) × 10)`.
  - **Giros:** cola de hasta 2 giros pendientes por tick.
    - Se descarta un giro igual a la última dirección encolada (o la actual si la cola está vacía), o su opuesto.
    - Así no se pierden pulsaciones rápidas y la serpiente no puede darse vuelta sobre sí misma.
  - **Choques:** salir del tablero o chocar con el propio cuerpo termina la partida.
    - La celda de la cola que se libera en ese mismo tick no cuenta como choque, salvo que la serpiente esté creciendo.
  - **Comida:** siempre hay una fruta en una celda libre al azar, con un sprite al azar entre los 22 de `FRUIT_FRAMES`.
    - Al comerla, la serpiente crece 1 celda, `fruits += 1`, `score += 10 × level` (nivel previo a comer) y `level = floor(fruits / 5) + 1`.
    - Después aparece una fruta nueva.
    - Si no queda ninguna celda libre, la partida termina.
  - **Se dibuja en el canvas:**
    - fondo `#000`;
    - rejilla `--line-2`;
    - fruta;
    - cuerpo `--green` en celdas con 2 px de margen;
    - cabeza `--yellow` con dos ojos `--ink` orientados según la dirección;
    - en fase `waiting`, el rótulo `PULSA UNA FLECHA` centrado, con `--pixel` en `--ink-dim`.
  - **No se dibuja:** score, nivel, "GAME OVER" ni texto de reinicio; score y nivel se ven solo en el HUD de plataforma.
  - **Sprites:** la fruta se escala manteniendo la proporción dentro de la celda de 25×25, centrada, con `imageSmoothingEnabled = false` (pixel-art nítido).
    - La imagen se carga con `new Image()` desde `FRUIT_URL`.
    - El loop arranca cuando la imagen carga; si el motor se destruye antes, no arranca.
  - **Fin:** al terminar la partida el motor deja de actualizar y llama `onGameOver(score)` una sola vez. Sin reinicio por tecla.
  - **Stats:** `onStats({ score, lives: 0, level })` al iniciar y solo cuando cambian score o nivel (nunca por frame).
  - **Colores:** desde los tokens de `app/globals.css` con `getComputedStyle(canvas)` y fallback al hex del token (patrón `readPalette` de `games/asteroids/engine.ts`): `--green`, `--yellow`, `--ink`, `--ink-dim`, `--line-2`, `--pixel`.
  - **Teclado:** `keydown` en `window`, registrado al crear y removido en `destroy()`.
    - Controles: `↑`/`W` arriba, `↓`/`S` abajo, `←`/`A` izquierda, `→`/`D` derecha.
    - `preventDefault()` solo para las cuatro flechas, y solo con el motor activo (no pausado ni terminado). WASD no hace scroll.
    - `P` y `Escape` no se escuchan: los maneja la plataforma.
  - **Ciclo de vida:**
    - `pause()` detiene el loop e ignora la entrada.
    - `resume()` reinicia el tiempo de referencia (primer `dt` = 0).
    - El `dt` tiene un tope de 50 ms antes de sumarse al acumulador.
    - `end()` detiene y devuelve el score sin disparar `onGameOver`.
    - `destroy()` es idempotente.
- `games/registry.ts`: alta de `snake` con `{ factory: createSnake, lives: false }`.
- Migración `supabase/migrations/20261010020000_game_snake.sql` con la fila de `public.games`.
  - Se aplica con el MCP de Supabase (`apply_migration`, nombre `game_snake`) **previa confirmación del usuario**.
- Leaderboard sin código nuevo: `/salon` y `/juego/snake` ya leen la vista `leaderboard` filtrada por `game_id` (SPEC 04), y la FK de SPEC 06 acepta `snake` tras la migración.
- Verificación con Playwright MCP, MCP de Supabase y `npm run build` / `npm run lint`; capturas en `.playwright-screenshot/`.

**Fuera de alcance (para specs futuros):**

- Controles táctiles y soporte móvil jugable (sigue el aviso "REQUIERE TECLADO").
- Canvas HiDPI (`devicePixelRatio`).
- Sonido y música: no hay assets de audio.
- Contador de frutas en el canvas o en el HUD de plataforma.
- Frutas con valores distintos, power-ups, obstáculos, bordes que envuelven, vidas o modos de juego.
- Usar las filas realistas de `fruits.png`.
- Cambios a la entrada `serpentina` (copy, portada, eliminarla o fusionarla con SNAKE).
- Anti-trampas o validación server-side del score.
- `best` y `plays` calculados desde la base.
- Tests automatizados (no hay test runner).

---

## Modelo de datos

Entrada nueva en `GAMES` (`lib/data.ts`), cuarta del arreglo:

```ts
{
  id: "snake",
  title: "SNAKE",
  short: "Come fruta, crece y no te muerdas la cola.",
  long: "Guía a la serpiente por un tablero de 32×24 con las flechas o WASD. Cada fruta la alarga una celda y suma 10 puntos por nivel; cada cinco frutas sube el nivel y se mueve más rápido. Un choque contra la pared o contra tu propio cuerpo y se acabó.",
  cat: "ARCADE",
  cover: "cover-snake-vault",
  color: "yellow",
  best: 0,
  plays: "0",
}
```

Migración `supabase/migrations/20261010020000_game_snake.sql`:

```sql
-- Alta de SNAKE en el catálogo de juegos con ranking real (SPEC 06).
insert into public.games (id, title) values ('snake', 'SNAKE');
```

No cambia el esquema: no hace falta regenerar `lib/supabase/database.types.ts`.

El contrato (`games/types.ts`) no cambia. Registro en `games/registry.ts`:

```ts
export const ENGINES: Partial<Record<string, EngineEntry>> = {
  asteroides: { factory: createAsteroids },
  tetris: { factory: createTetris, lives: false },
  arkanoid: { factory: createArkanoid },
  snake: { factory: createSnake, lives: false },
};
```

Recortes de fruta (`games/snake/sprites.ts`, sobre la franja recortada, `sy = 0`, `sh = 160`), en el orden de `sprites.js`:

| # | `sx` | `sw` | # | `sx` | `sw` |
| --- | --- | --- | --- | --- | --- |
| 0 | 34 | 110 | 11 | 1906 | 150 |
| 1 | 186 | 150 | 12 | 2068 | 170 |
| 2 | 378 | 110 | 13 | 2250 | 140 |
| 3 | 540 | 130 | 14 | 2432 | 130 |
| 4 | 712 | 130 | 15 | 2604 | 130 |
| 5 | 894 | 110 | 16 | 2786 | 110 |
| 6 | 1066 | 110 | 17 | 2948 | 130 |
| 7 | 1228 | 130 | 18 | 3110 | 150 |
| 8 | 1400 | 130 | 19 | 3302 | 110 |
| 9 | 1582 | 110 | 20 | 3454 | 150 |
| 10 | 1734 | 150 | 21 | 3637 | 130 |

Velocidad por nivel: nivel 1 = 150 ms, 2 = 140 ms, … 10 = 60 ms, y desde el 10 se mantiene en 60 ms.

Estado interno del motor (privado a `games/snake/engine.ts`):

- `snake` (`{ x, y }[]`, cabeza en `[0]`), `dir` y `queue` (`Dir[]`, máx. 2), con `Dir = 'up' | 'down' | 'left' | 'right'`.
- `fruit` (`{ x, y, frame }`), `fruits`, `score`, `level`, `tickAccum`.
- `phase: 'waiting' | 'playing' | 'over' | 'ended'`, `paused`, `destroyed`, `lastTime`, `rafId`.
- `img`, `imgLoaded`.

Funciones como cierres de la instancia: `enqueueTurn`, `step`, `spawnFruit`, `hitsBody`, `draw`, `drawFruit`, `drawSnake`.

---

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app` en lo relativo a client components y la carpeta `public` (según `AGENTS.md`).
   - Agregar la entrada `snake` en la cuarta posición de `GAMES` y la portada `.cover-snake-vault`.
   - Manual: la tarjeta aparece en `/`, `/juegos`, `/salon` y `/juego/snake`; `/jugar/snake` abre con la simulación.
2. Recortar la franja pixel-art de `fruits.png` a `public/games/snake/fruits.png` (3790×160). Crear `games/snake/sprites.ts` y `games/snake/engine.ts`:
   - tablero, movimiento por ticks, cola de giros, choques, frutas, puntaje, niveles;
   - colores desde tokens y sprites nítidos;
   - teclado con `preventDefault` acotado;
   - `pause`/`resume`/`end`/`destroy`.

   Registrarlo en `games/registry.ts` con `lives: false`. Manual: `/jugar/snake` se juega con flechas y WASD, el HUD muestra puntuación y nivel sin Vidas, y chocar con la pared abre el modal.
3. Escribir `supabase/migrations/20261010020000_game_snake.sql`.
   - **Pedir confirmación al usuario** y aplicarla con el MCP (`apply_migration`, nombre `game_snake`).
   - Verificar con `list_migrations`, `execute_sql` (`select * from public.games order by id`) y `get_advisors` (security).
4. Verificar los criterios de aceptación con Playwright MCP (desktop y 390px, consola, guardado) y SQL del MCP; guardar capturas en `.playwright-screenshot/`.

Cada paso deja la app corriendo y commiteable.

---

## Criterios de aceptación

**Integración:**

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `GAMES[3]` es `snake` con los valores del Modelo de datos; las demás entradas no cambiaron (el diff de `lib/data.ts` solo agrega la entrada nueva).
- [ ] La tarjeta SNAKE aparece en:
  - `/` (sección de juegos);
  - `/juegos` (filtro ARCADE y búsqueda "snak");
  - `/salon`, como pestaña;
  - `/juego/snake`.

  Lleva la portada `.cover-snake-vault`, distinta de la de SERPENTINA.
- [ ] `public/games/snake/fruits.png` mide 3790×160, contiene solo la fila pixel-art y responde 200 en el servidor de desarrollo.
- [ ] Existen `games/snake/engine.ts` y `games/snake/sprites.ts` y no declaran variables de módulo mutables.
- [ ] `games/types.ts` no cambia; `games/registry.ts` incluye `snake: { factory: createSnake, lives: false }`.
- [ ] En `/jugar/snake` hay un `<canvas>` de 800×600 dentro de `.crt-screen` y no existe `.game-arena`.
- [ ] El HUD de plataforma de `/jugar/snake` muestra Jugador, Puntuación y Nivel reales del motor y **no** muestra el stat Vidas.
- [ ] El canvas no dibuja score ni nivel; no muestra "GAME OVER" ni texto de reinicio, y ninguna tecla reinicia la partida.
- [ ] Al chocar con la pared se abre el modal FIN DEL JUEGO con el score final del motor.
- [ ] FIN durante la partida detiene el juego y abre el modal con el score actual.
- [ ] JUGAR DE NUEVO reinicia a score 0, nivel 01 y serpiente de 3 celdas en el centro esperando una tecla, y la partida es jugable.
- [ ] PAUSA congela el canvas (dos capturas separadas por 1 s idénticas, sin que la serpiente avance) y REANUDAR continúa sin salto; `P` y `Escape` alternan la pausa una sola vez por pulsación.
- [ ] Ocultar la pestaña o quitar el foco pausa el juego y al volver sigue en pausa.
- [ ] Con el juego activo, las flechas no hacen scroll; con el modal abierto o en pausa no son interceptadas y no cambian la dirección.
- [ ] Salir de `/jugar/snake` destruye el motor: sin listeners de teclado ni `requestAnimationFrame` activos (las teclas en otras páginas no generan errores).
- [ ] Cuerpo `--green`, cabeza `--yellow`, ojos `--ink` y rejilla `--line-2` sobre fondo `#000`, verificado en captura.
- [ ] En emulación móvil táctil (390px) `/jugar/snake` muestra "REQUIERE TECLADO", sin scroll horizontal ni errores en consola.
- [ ] `public.games` contiene la fila `snake` / `SNAKE` además de `asteroides`, `tetris` y `arkanoid`; `list_migrations` muestra `game_snake` aplicada; `get_advisors` (security) no reporta hallazgos nuevos.
- [ ] Con sesión, GUARDAR PUNTUACIÓN inserta en `scores` una fila con `game_id = 'snake'` y el score del modal (SQL del MCP), y la marca aparece en `/juego/snake` y en la pestaña SNAKE de `/salon`.
- [ ] `/jugar/asteroides`, `/jugar/tetris` y `/jugar/arkanoid` siguen funcionando igual; `/jugar/serpentina` sigue con la simulación.
- [ ] La consola no muestra errores en `/jugar/snake` durante una partida completa.
- [ ] Nada en `app/`, `components/`, `lib/` ni `games/` importa archivos de `references/`.

**Gameplay de SNAKE:**

- [ ] Al entrar, el tablero muestra la rejilla de 32×24, una serpiente de 3 celdas en el centro mirando a la derecha, una fruta y el rótulo `PULSA UNA FLECHA`; la serpiente no se mueve durante 2 s sin teclas.
- [ ] La primera pulsación de `→`, `↑`, `↓`, `D`, `W` o `S` arranca el movimiento y el rótulo desaparece; `←` o `A` como primera tecla se ignoran.
- [ ] `↑`/`↓`/`←`/`→` y `W`/`S`/`A`/`D` giran la serpiente 90°; pulsar la dirección opuesta a la actual no tiene efecto.
- [ ] Dos giros rápidos dentro del mismo tick (por ejemplo `↑` y luego `←` yendo a la derecha) se aplican en orden en los dos ticks siguientes, sin que la serpiente choque consigo misma.
- [ ] Al comer una fruta, la serpiente crece 1 celda, el HUD suma 10 en el nivel 1 y aparece otra fruta en una celda libre.
- [ ] La fruta es un sprite pixel-art de `fruits.png`, nítido y contenido en su celda; a lo largo de la partida aparecen frutas distintas.
- [ ] Tras la quinta fruta el HUD muestra nivel 02, la siguiente fruta suma 20 y la serpiente avanza más rápido.
- [ ] Salir por cualquiera de los cuatro bordes termina la partida y abre el modal.
- [ ] Chocar la cabeza contra el propio cuerpo termina la partida y abre el modal.
- [ ] Moverse hacia la celda que la cola libera en ese tick no termina la partida.

---

## Decisiones

- **Sí:** juego nuevo `snake` / SNAKE en vez de reutilizar `serpentina`. Es un juego distinto con su propio ranking. Sigue el precedente de SPEC 05, 07 y 08.
- **No:** reemplazar o renombrar `serpentina`. Su destino se decide en otro spec.
- **Sí:** cuarta posición en `GAMES` y color `yellow`. Entra en la landing sin desplazar a ASTEROIDES, y el amarillo no lo usa ningún otro juego real (cyan, green, magenta).
- **Sí:** clase `.cover-snake-vault`, porque `.cover-snake` ya es la portada de SERPENTINA.
- **Sí:** motor escrito desde cero con el contrato `GameFactory` de SPEC 05. No hay código de referencia; las reglas se fijan en este spec.
- **No:** extender el contrato. SNAKE usa 800×600 y tiene nivel; la falta de vidas ya la cubre `lives: false` de SPEC 07.
- **Sí:** tablero de 32×24 celdas de 25 px. Llena el CRT 4:3 sin letterbox ni panel lateral.
- **Sí:** paredes que matan y sin vidas, como el Snake clásico. El motor reporta `lives: 0` y la UI lo oculta.
- **Sí:** puntaje `10 × nivel` y nivel cada 5 frutas con tick de 150 ms a 60 ms. Da progresión al leaderboard sin power-ups.
- **Sí:** arranque en espera hasta la primera tecla. El jugador no pierde la partida mientras ubica las manos en el teclado.
- **Sí:** cola de hasta 2 giros por tick, con rechazo de reversa. Evita perder pulsaciones rápidas y las muertes injustas por girar 180° en un tick.
- **Sí:** flechas y WASD; `preventDefault` solo en flechas, que son las que hacen scroll.
- **Sí:** recortar solo la fila pixel-art de `fruits.png` a `public/`. Es la única que usa el atlas y evita servir 585 KB.
- **Sí:** frutas por índice y no por nombre. Los nombres de `sprites.js` están desplazados una posición; las coordenadas son correctas.
- **Sí:** `imageSmoothingEnabled = false` al dibujar la fruta. El sprite de unos 130×160 se reduce a 25 px y debe verse pixel-art, no borroso.
- **Sí:** canvas sin HUD propio, salvo el rótulo de inicio. Score y nivel van solo en el HUD de plataforma.
- **No:** contador de frutas en el canvas. Se deriva de score y nivel y no lo pide el juego.
- **No:** sonido. No hay assets de audio.
- **Sí:** fin de partida por modal de plataforma, sin reinicio por tecla: toda partida pasa por el guardado de SPEC 04.
- **Sí:** alta en `public.games` por migración aplicada con el MCP tras confirmación. Sin la fila, la FK de SPEC 06 rechaza el guardado.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| React 19 Strict Mode monta efectos dos veces: dos motores, listeners y cargas de imagen duplicados | `destroy()` idempotente en el cleanup; el `onload` no arranca el loop si la instancia ya se destruyó; criterio que verifica que no quedan listeners ni loops. |
| Giros rápidos perdidos o reversa en un mismo tick que mata a la serpiente | Cola de 2 giros validada contra la última dirección encolada; criterio explícito. |
| La cola liberada contada como choque mata injustamente | `hitsBody` excluye la última celda salvo que la serpiente crezca en ese tick; criterio explícito. |
| Salto de ticks tras una pestaña oculta | Tope de `dt` de 50 ms, `resume()` reinicia `lastTime` y auto-pausa en `visibilitychange`. |
| `onStats` por tick provoca re-renders | Solo se llama cuando cambia score o nivel. |
| Coordenadas del atlas erróneas tras el recorte | Recorte exacto `y = 136–295`, `sy = 0`; criterio de dimensiones 3790×160 y verificación visual de la fruta. |
| Nombres del atlas desplazados | Las frutas se usan por índice; los nombres no se portan. |
| Sprite borroso o deformado al reducirlo a 25 px | Escala proporcional centrada en la celda y `imageSmoothingEnabled = false`. |
| La imagen no carga: tablero sin fruta y sin errores claros | Ruta absoluta `/games/snake/fruits.png`; criterio de respuesta 200. |
| Teclas WASD activas en campos de texto de otras páginas | Listeners solo mientras el motor existe; se quitan en `destroy()`. |
| Olvidar o no aplicar la migración de `games`: el guardado falla con error genérico | Paso 3 explícito y criterio con SQL del MCP. |
| Migración aplicada directo en el proyecto remoto | Solo inserta una fila; se pide confirmación antes de aplicar. |
| Dos juegos de serpiente en el catálogo (SNAKE y SERPENTINA) confunden al jugador | Aceptado temporalmente; portada, color y copy distintos. El destino de SERPENTINA se decide en otro spec. |
| Sprites de terceros (spriters-resource, Google Snake) | Aceptado para este proyecto de curso; reemplazarlos o dar créditos va en otro spec. |
| El score lo reporta el cliente | Asumido en SPEC 04; anti-trampas en spec posterior. |
| Next.js 16 con convenciones distintas a las recordadas | Leer `node_modules/next/dist/docs/01-app` antes de escribir. |

---

## Lo que **no** está en este spec

- Controles táctiles, HiDPI y soporte móvil jugable.
- Sonido y música.
- Contador de frutas.
- Power-ups, obstáculos, bordes que envuelven, vidas o modos de juego.
- Filas realistas de `fruits.png`.
- Cambios a SERPENTINA.
- Anti-trampas y validación de scores.
- `best` y `plays` desde la base.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.
