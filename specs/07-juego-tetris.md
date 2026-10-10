# SPEC 07 — TETRIS: segundo juego real con leaderboard

> **Status:** Aprobado
> **Depends on:** SPEC 04, SPEC 05, SPEC 06
> **Date:** 2026-10-10
> **Objective:** Agregar el juego `tetris` al catálogo, portando el Tetris de `references/started-games/03-tetris/` a un motor TypeScript en `games/tetris/engine.ts`, montarlo en `/jugar/tetris` y darlo de alta en `public.games` para que sus partidas se guarden y aparezcan en el leaderboard.

---

## Por qué existe este spec

ASTEROIDES (SPEC 05) es hoy el único juego real del Vault. SPEC 05 dejó el contrato de motores (`games/types.ts`) y el registro (`games/registry.ts`) pensados para que Tetris y Arkanoid llegaran en specs propios, y SPEC 06 hizo que solo los juegos dados de alta en `public.games` puedan guardar puntuaciones. Este spec trae el segundo juego real.

El original es un `game.js` de 332 líneas con estado global, dos canvas (tablero 300×600 y vista previa 120×120), marcador SCORE / LINES / LEVEL en el DOM, overlay DOM compartido para PAUSA y GAME OVER con botón Reiniciar, pausa con `P` y un selector de tema claro/oscuro guardado en `localStorage`. Tiene 8 piezas: las 7 estándar más una "N tuerca" (anillo 3×3), aunque su README habla de 7. No tiene vidas, sonido ni assets.

Dos diferencias con ASTEROIDES obligan a tocar la plataforma. Tetris no tiene vidas, así que el HUD de plataforma no debe mostrar `♥`. Además, el tablero es vertical y el CRT es 4:3. Lo segundo se resuelve sin cambiar el tamaño del canvas: un solo canvas de 800×600 con el tablero centrado y un panel lateral dibujado. Lo primero requiere una extensión mínima del registro.

TETRIS es una entrada **nueva** del catálogo. El mock `caida` (CAÍDA), parecido, no se toca.

---

## Alcance

**Entra:**

- Entrada nueva en `GAMES` de `lib/data.ts`, en la **segunda posición** (detrás de `asteroides`):
  - `id: "tetris"`, `title: "TETRIS"`, `cat: "PUZZLE"`, `color: "green"`, `cover: "cover-tetris"`, `best: 0`, `plays: "0"`.
  - Copy `short` y `long` basados en el juego real (ver Modelo de datos).
- Portada CSS nueva `.cover-tetris` en `app/globals.css`, junto a las demás `cover-*`: fondo negro con rejilla tenue, pila irregular de bloques neón en la parte baja con una fila a punto de completarse y una pieza T `--green` con glow cayendo arriba. Solo CSS/SVG inline, sin imágenes externas. Distinta de `.cover-tetro` (CAÍDA).
- Extensión mínima del contrato de motores (ver Modelo de datos):
  - `games/types.ts`: tipo `EngineEntry` con `factory` y `lives?`.
  - `games/registry.ts`: `ENGINES` pasa a `Partial<Record<string, EngineEntry>>`; `asteroides` migra a `{ factory: createAsteroids }`.
  - `components/game-player.tsx`: obtiene la fábrica desde `ENGINES[game.id]?.factory` y oculta el stat de Vidas si `lives === false`. El canvas sigue siendo 800×600 para todos.
- `games/tetris/engine.ts`: port a TypeScript que exporta `createTetris: GameFactory`.
  - Sin estado de módulo mutable: todo vive dentro de la instancia.
  - Port fiel del gameplay: tablero `COLS = 10`, `ROWS = 20`, `BLOCK = 30`; 8 piezas (I, O, T, S, Z, J, L, N tuerca) con sus matrices originales y elección aleatoria uniforme; rotación horaria con wall kicks `[0, -1, 1, -2, 2]`; pieza fantasma con alpha 0.2; `LINE_SCORES = [0, 100, 300, 500, 800]` × nivel; soft drop +1 por fila; hard drop +2 por celda; `level = floor(lines / 10) + 1`; `dropInterval = max(100, 1000 − (level − 1) × 90)` ms.
  - Disposición del canvas 800×600: tablero de 300×600 en `x = 250` y panel lateral a la derecha con el rótulo `SIGUIENTE`, la vista previa de la siguiente pieza (4×4 celdas de 30 px) y el rótulo `LÍNEAS` con el contador.
  - Se elimina: marcador DOM (SCORE / LINES / LEVEL), overlay DOM de PAUSA y GAME OVER, botón Reiniciar, lista de controles, título, selector de tema y su `localStorage`. Queda en el canvas: tablero, rejilla, fantasma, pieza actual, `SIGUIENTE` y `LÍNEAS`. Score y nivel se ven solo en el HUD de plataforma.
  - Cuando una pieza nueva colisiona al aparecer, el motor deja de actualizar y llama `onGameOver(score)` una sola vez. Sin reinicio por tecla.
  - `onStats({ score, lives: 0, level })` al iniciar y solo cuando cambian score o nivel (nunca por frame). `lives` es fijo y no se muestra.
  - Colores desde tokens de `app/globals.css` con `getComputedStyle(canvas)` y fallback al hex del token (patrón `readPalette` de `games/asteroids/engine.ts`): I `--cyan`, O `--yellow`, T `--magenta`, S `--green`, Z `--bronze`, J `--ink`, L `--gold`, N `--silver`; rejilla `--line-2`; rótulos del panel `--ink-dim` y valores `--ink`, con fuente `--pixel`. Fondo `#000`. Se mantiene el brillo superior de cada bloque (`rgba(255,255,255,0.12)`).
  - Teclado: `keydown` en `window`, registrado al crear y removido en `destroy()`. Controles: `←`/`→` mover, `↑` o `X` rotar, `↓` soft drop, `Espacio` hard drop. La repetición automática del sistema en `keydown` se mantiene como en el original. `preventDefault()` solo para `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown` y `Space`, y solo con el motor activo (no pausado ni terminado). Se elimina la pausa con `P` del motor: `P` y `Escape` los maneja la plataforma.
  - `pause()` detiene el loop e ignora la entrada; `resume()` reinicia el tiempo de referencia (primer `dt` = 0). `dt` con tope de 50 ms antes de sumarse al acumulador de caída. `end()` detiene y devuelve el score sin disparar `onGameOver`. `destroy()` idempotente.
- `games/registry.ts`: alta de `tetris` con `{ factory: createTetris, lives: false }`.
- Migración `supabase/migrations/20261010000000_game_tetris.sql` con la fila de `public.games`, aplicada con el MCP de Supabase (`apply_migration`, nombre `game_tetris`) **previa confirmación del usuario**.
- Leaderboard sin código nuevo: `/salon` y `/juego/tetris` ya leen la vista `leaderboard` filtrada por `game_id` (SPEC 04), y la FK de SPEC 06 acepta `tetris` tras la migración.
- Verificación con Playwright MCP, MCP de Supabase y `npm run build` / `npm run lint`; capturas en `.playwright-screenshot/`.

**Fuera de alcance (para specs futuros):**

- Controles táctiles y soporte móvil jugable (sigue el aviso "REQUIERE TECLADO").
- Canvas HiDPI (`devicePixelRatio`).
- Tamaño de canvas configurable por juego en el registro (`width`/`height`): no hace falta mientras todos usen 800×600.
- Mostrar `LÍNEAS` en el HUD de plataforma o callbacks extra en `GameStats`.
- Sonido y música (el original no tiene).
- Cambios de gameplay: hold, 7-bag, rotación antihoraria, SRS, lock delay, DAS/ARR configurable.
- Selector de tema claro/oscuro.
- Cambios a la entrada `caida` (copy, portada, eliminarla o fusionarla con TETRIS).
- Anti-trampas o validación server-side del score.
- `best` y `plays` calculados desde la base.
- Tests automatizados (no hay test runner).

---

## Modelo de datos

Entrada nueva en `GAMES` (`lib/data.ts`), segunda del arreglo:

```ts
{
  id: "tetris",
  title: "TETRIS",
  short: "Encaja, rota y limpia líneas antes de tocar el techo.",
  long: "Un pozo de 10×20 y ocho piezas, incluida la tuerca, una rareza con hueco al centro. Rota con rebote en las paredes, guíate por la pieza fantasma y suelta en caída libre para sumar extra. Cada 10 líneas sube el nivel y la caída se acelera.",
  cat: "PUZZLE",
  cover: "cover-tetris",
  color: "green",
  best: 0,
  plays: "0",
}
```

Migración `supabase/migrations/20261010000000_game_tetris.sql`:

```sql
-- Alta de TETRIS en el catálogo de juegos con ranking real (SPEC 06).
insert into public.games (id, title) values ('tetris', 'TETRIS');
```

No cambia el esquema: no hace falta regenerar `lib/supabase/database.types.ts`.

Contrato extendido en `games/types.ts` (se agrega; `GameStats`, `GameCallbacks`, `GameEngine` y `GameFactory` no cambian):

```ts
export type EngineEntry = {
  factory: GameFactory;
  lives?: boolean; // false oculta el stat de Vidas en el HUD de plataforma
};
```

Registro en `games/registry.ts`:

```ts
export const ENGINES: Partial<Record<string, EngineEntry>> = {
  asteroides: { factory: createAsteroids },
  tetris: { factory: createTetris, lives: false },
};
```

Estado interno del motor (privado a `games/tetris/engine.ts`): `board` (`number[][]`, `ROWS × COLS`, `0` vacío y `1–8` índice de pieza), `current` y `next` (`{ type, shape, x, y }`), `score`, `lines`, `level`, `dropInterval`, `dropAccum`, `phase: 'playing' | 'over' | 'ended'`, `paused`, `lastTime`, `rafId`, `destroyed`. Funciones portadas (`collide`, `rotateCW`, `tryRotate`, `merge`, `clearLines`, `ghostY`, `hardDrop`, `softDrop`, `lockPiece`, `spawn`, `draw`, `drawNext`) como cierres de la instancia, con el contexto 2D y la paleta recibidos por parámetro en lugar de globals.

---

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app` en lo relativo a client components y `useEffect` (según `AGENTS.md`). Agregar la entrada `tetris` en la segunda posición de `GAMES` y la portada `.cover-tetris`. Manual: la tarjeta aparece en `/`, `/juegos`, `/salon` y `/juego/tetris`; `/jugar/tetris` abre con la simulación.
2. Extender el contrato: `EngineEntry` en `games/types.ts`, `ENGINES` con entradas `{ factory, lives? }`, `asteroides` migrado y `GamePlayer` leyendo `factory` y `lives` del registro. Manual: `/jugar/asteroides` se ve y juega igual que antes (con vidas); `npm run build` y `npm run lint` pasan.
3. Crear `games/tetris/engine.ts` (port completo: piezas, colisiones, rotación con kicks, fantasma, puntaje, niveles, panel SIGUIENTE/LÍNEAS, colores desde tokens, teclado con `preventDefault` acotado, `pause`/`resume`/`end`/`destroy`) y registrarlo en `games/registry.ts`. Manual: `/jugar/tetris` se juega con teclado, el HUD de plataforma muestra puntuación y nivel sin Vidas, y llenar el pozo abre el modal.
4. Escribir `supabase/migrations/20261010000000_game_tetris.sql`. **Pedir confirmación al usuario** y aplicarla con el MCP (`apply_migration`, nombre `game_tetris`). Verificar con `list_migrations`, `execute_sql` (`select * from public.games order by id`) y `get_advisors` (security).
5. Verificar los criterios de aceptación con Playwright MCP (desktop y 390px, consola, guardado) y SQL del MCP; guardar capturas en `.playwright-screenshot/`.

Cada paso deja la app corriendo y commiteable.

---

## Criterios de aceptación

**Integración:**

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `GAMES[1]` es `tetris` con los valores del Modelo de datos; las demás entradas no cambiaron (el diff de `lib/data.ts` solo agrega la entrada nueva).
- [ ] La tarjeta TETRIS aparece en `/` (sección de juegos), en `/juegos` (filtro PUZZLE y búsqueda "tetr"), como pestaña en `/salon` y en `/juego/tetris`, con la portada `.cover-tetris`, distinta de la de CAÍDA.
- [ ] `games/types.ts` exporta `EngineEntry`; `games/registry.ts` tipa `ENGINES` como `Partial<Record<string, EngineEntry>>` con `asteroides` y `tetris`.
- [ ] `/jugar/asteroides` sigue igual que antes del cambio de registro: canvas 800×600, HUD con `♥ ♥ ♥`, partida jugable hasta el modal.
- [ ] Existe `games/tetris/engine.ts` y no declara variables de módulo mutables.
- [ ] En `/jugar/tetris` hay un `<canvas>` de 800×600 dentro de `.crt-screen` y no existe `.game-arena`.
- [ ] El HUD de plataforma de `/jugar/tetris` muestra Jugador, Puntuación y Nivel reales del motor y **no** muestra el stat Vidas.
- [ ] El canvas no dibuja score ni nivel; no muestra "GAME OVER", "PAUSA" ni botón o texto de reinicio, y ninguna tecla reinicia la partida.
- [ ] Al aparecer una pieza sobre bloques ocupados se abre el modal FIN DEL JUEGO con el score final del motor.
- [ ] FIN durante la partida detiene el juego y abre el modal con el score actual.
- [ ] JUGAR DE NUEVO reinicia a score 0, nivel 01, tablero vacío y 0 líneas, y la partida es jugable.
- [ ] PAUSA congela el canvas (dos capturas separadas por 1 s idénticas, sin que la pieza baje) y REANUDAR continúa sin salto; `P` y `Escape` alternan la pausa.
- [ ] Ocultar la pestaña o quitar el foco pausa el juego y al volver sigue en pausa.
- [ ] Con el juego activo, `Espacio` y las flechas no hacen scroll; con el modal abierto o en pausa no son interceptadas y no mueven piezas.
- [ ] Salir de `/jugar/tetris` destruye el motor: sin listeners de teclado ni `requestAnimationFrame` activos (las teclas en otras páginas no generan errores).
- [ ] Las piezas usan los tokens indicados (I `--cyan`, O `--yellow`, T `--magenta`, S `--green`, Z `--bronze`, J `--ink`, L `--gold`, N `--silver`), verificado en captura.
- [ ] En emulación móvil táctil (390px) `/jugar/tetris` muestra "REQUIERE TECLADO", sin scroll horizontal ni errores en consola.
- [ ] `public.games` contiene la fila `tetris` / `TETRIS` además de `asteroides`; `list_migrations` muestra `game_tetris` aplicada; `get_advisors` (security) no reporta hallazgos nuevos.
- [ ] Con sesión, GUARDAR PUNTUACIÓN inserta en `scores` una fila con `game_id = 'tetris'` y el score del modal (SQL del MCP), y la marca aparece en `/juego/tetris` y en la pestaña TETRIS de `/salon`.
- [ ] `/jugar/rocas` y `/jugar/caida` (juegos sin motor) siguen con la simulación actual.
- [ ] La consola no muestra errores en `/jugar/tetris` durante una partida completa.
- [ ] Nada en `app/`, `components/`, `lib/` ni `games/` importa archivos de `references/`.

**Gameplay de TETRIS:**

- [ ] El tablero ocupa 10×20 celdas de 30 px, centrado horizontalmente en el canvas, con rejilla visible.
- [ ] `←`/`→` mueven la pieza una columna sin atravesar paredes ni bloques.
- [ ] `↑` y `X` rotan en sentido horario; junto a una pared, la rotación se aplica desplazando la pieza (wall kick) cuando hay espacio.
- [ ] `↓` baja la pieza una fila y suma 1 punto en el HUD.
- [ ] `Espacio` deja caer la pieza al fondo y suma 2 puntos por celda recorrida.
- [ ] La pieza fantasma se dibuja translúcida en la posición de aterrizaje.
- [ ] Completar 1, 2, 3 o 4 líneas en nivel 1 suma 100, 300, 500 u 800 puntos; en nivel N, ese valor × N.
- [ ] El contador `LÍNEAS` del panel aumenta con cada línea completada.
- [ ] Al llegar a 10 líneas el HUD muestra nivel 02 y la caída automática es más rápida.
- [ ] El panel `SIGUIENTE` muestra la pieza que aparece a continuación.
- [ ] La pieza "N tuerca" (anillo 3×3 `--silver`) aparece durante la partida.

---

## Decisiones

- **Sí:** juego nuevo `tetris` / TETRIS en vez de reutilizar `caida`. Es un juego distinto con su propio ranking. Sigue el precedente de SPEC 05 con ROCAS.
- **No:** reemplazar o renombrar `caida`. Su destino se decide en otro spec.
- **Sí:** segunda posición en `GAMES` y color `green`. Aparece en la landing sin desplazar a ASTEROIDES como pestaña por defecto de `/salon`, y se distingue de CAÍDA (magenta) y ASTEROIDES (cyan).
- **Sí:** canvas único de 800×600 con el tablero centrado y el panel SIGUIENTE/LÍNEAS dibujado. Llena el CRT 4:3 sin letterbox, conserva la vista previa y el contador de líneas, y evita mover el tamaño del canvas al contrato.
- **No:** canvas de 300×600 con letterbox ni un segundo canvas para la vista previa. Obligaría a extender el registro con `width`/`height` y a tocar el layout del CRT.
- **Sí:** extender el registro solo con `lives?`. Es lo mínimo que exige TETRIS. `width`/`height` se agregan cuando un juego los necesite.
- **No:** cambiar `GameStats`/`GameCallbacks`. El motor reporta `lives: 0` y la UI lo oculta por el flag del registro.
- **No:** mostrar LÍNEAS en el HUD de plataforma: requeriría ampliar `GameStats`. Queda en el canvas.
- **Sí:** las 8 piezas del `game.js`, incluida la tuerca (port fiel del código, no del README).
- **Sí:** colores neón más metales (`--bronze`, `--gold`, `--silver`, `--ink`) para distinguir las 8 piezas sin hex sueltos.
- **Sí:** quitar la pausa con `P` del motor. La plataforma ya maneja `P`/`Escape`; dos manejadores alternarían la pausa dos veces.
- **Sí:** tope de `dt` en 50 ms y reinicio de `lastTime` al reanudar, como pide el contrato de SPEC 05 (el original no tenía tope).
- **Sí:** mantener la repetición de `keydown` del sistema para movimiento y soft drop, igual que el original.
- **Sí:** fin de partida por modal de plataforma, sin reinicio por tecla ni overlay propio.
- **Sí:** alta en `public.games` por migración aplicada con el MCP tras confirmación. Sin la fila, la FK de SPEC 06 rechaza el guardado.
- **No:** selector de tema claro/oscuro ni `localStorage` propio. La estética la da el Vault.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Cambiar el tipo de `ENGINES` rompe ASTEROIDES | El paso 2 verifica `/jugar/asteroides` antes de agregar el motor nuevo; criterio explícito. |
| React 19 Strict Mode monta efectos dos veces: dos motores y listeners duplicados | `destroy()` idempotente en el cleanup; criterio que verifica que no quedan listeners ni loops. |
| `P` manejada por motor y plataforma alterna la pausa dos veces | El motor no escucha `P`; solo la plataforma. |
| La repetición de teclas mueve piezas durante la pausa o con el modal abierto | El motor ignora la entrada si está pausado o terminado; criterio explícito. |
| `onStats` en cada soft drop provoca re-renders frecuentes | Solo se llama cuando cambia score o nivel; un re-render por pulsación es aceptable. |
| Salto de caída al reanudar o tras pestaña oculta | `resume()` reinicia `lastTime`; tope de `dt` de 50 ms; auto-pausa en `visibilitychange`. |
| Olvidar o no aplicar la migración de `games`: el guardado falla con error genérico | Paso 4 explícito y criterio con SQL del MCP. |
| Migración aplicada directo en el proyecto remoto | Solo inserta una fila; se pide confirmación antes de aplicar. |
| Dos juegos de bloques en el catálogo (TETRIS y CAÍDA) confunden al jugador | Aceptado temporalmente; portada, color y copy distintos. El destino de CAÍDA se decide en otro spec. |
| "TETRIS" es marca registrada | Aceptado para este proyecto de curso; renombrar es un cambio de copy e id en otro spec. |
| El score lo reporta el cliente | Asumido en SPEC 04; anti-trampas en spec posterior. |
| Next.js 16 con convenciones distintas a las recordadas | Leer `node_modules/next/dist/docs/01-app` antes de escribir. |

---

## Lo que **no** está en este spec

- Controles táctiles, HiDPI y soporte móvil jugable.
- Tamaño de canvas por juego en el registro.
- LÍNEAS en el HUD de plataforma.
- Sonido, hold, 7-bag, SRS u otros cambios de gameplay.
- Selector de tema.
- Cambios a CAÍDA.
- Anti-trampas y validación de scores.
- `best` y `plays` desde la base.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.
