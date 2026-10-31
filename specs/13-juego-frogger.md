# SPEC 13 — FROGGER: cruce de carretera y río con bocas destino

> **Status:** Aprobado
> **Depends on:** SPEC 04, SPEC 05, SPEC 06, SPEC 07, SPEC 11, SPEC 12
> **Date:** 2026-10-31
> **Objective:** Agregar el juego `frogger` al catálogo con un motor TypeScript escrito desde cero en `games/frogger/engine.ts`, montarlo en `/jugar/frogger` y darlo de alta en `public.games` para que sus partidas se guarden y aparezcan en el leaderboard.

---

## Por qué existe este spec

Reescribe al contrato de la plataforma el spec de game jam `specs/game-jam/01-frogger-core.md`, que estaba pensado para otra arquitectura. Ese spec pedía un componente React propio, una página `app/games/frogger/play`, HUD dibujado en el canvas y un guardado anónimo con `player_name` y `user_id: null`. Nada de eso existe ni funciona aquí: los motores siguen el contrato `GameFactory` (SPEC 05), se montan en `/jugar/[id]`, la plataforma dibuja el HUD y la pausa, y `scores` exige sesión por RLS (SPEC 04). De aquel spec se conserva **la mecánica**: grid de 16 × 14 celdas de 40 px, 5 carriles de carretera, 6 de río, tortugas que se sumergen, 5 bocas destino de 2 columnas, 15 s por rana, salto con animación de 120 ms y su puntuación.

Es un diseño desde cero, sin carpeta en `references/started-games/`. Se parece a RANARIA (SPEC 10), que también es de cruce por carriles, y se distingue en lo siguiente:

- tablero más alto, 14 filas: 5 carriles de carretera y 6 de río;
- camiones de 3 celdas;
- tortugas que se sumergen y dejan de servir de apoyo;
- bocas de 2 columnas, en las que caer fuera o en una ocupada mata;
- 15 s por rana en vez de 30;
- puntuación por avance, bocas, ronda y tiempo.

Encaja en el contrato actual sin extenderlo. Usa el canvas de 800 × 600 con el tablero de 640 × 560 centrado y tiene vidas y nivel, así que el registro queda `frogger: { factory: createFrogger }`. Skins (SPEC 11) y controles táctiles (SPEC 12) no entran aquí. Los agregan los agentes `skin-designer` y `mobile-porter` en la etapa B de `/spec-impl-game`.

---

## Alcance

**Entra:**

- Entrada nueva en `GAMES` de `lib/data.ts`, en la **sexta posición** (índice 5, detrás de `ranaria`), para que aparezca en la landing (`GAMES.slice(0, 6)`):
  - `id: "frogger"`, `title: "FROGGER"`, `cat: "ARCADE"`, `color: "green"`, `cover: "cover-frogger"`, `best: 0`, `plays: "0"`.
  - Copy `short` y `long`: ver Modelo de datos.
- Portada CSS nueva `.cover-frogger` en `app/globals.css`, junto a las demás `cover-*`, solo con CSS (gradientes y pseudo-elementos), sin imágenes. Lleva cinco arcos `--gold` arriba (las bocas), una franja ondulada `--cyan` en medio (el río) y rectángulos `--magenta` / `--yellow` abajo (los coches). Debe distinguirse de `.cover-rana`.
- `games/frogger/engine.ts`: motor nuevo que exporta `createFrogger: GameFactory`.
  - Sin estado de módulo mutable: todo vive dentro de la instancia.
  - Gameplay según **Reglas de FROGGER** (abajo).
  - El canvas **no** dibuja score, vidas, nivel, "GAME OVER" ni texto de reinicio. Sí dibuja la barra de tiempo, las bocas (libres u ocupadas) y el rótulo `PULSA UNA FLECHA` en la fase de espera.
  - Al terminar la partida, el motor deja de actualizar y llama `onGameOver(score)` una sola vez. No hay reinicio por tecla.
  - Llama `onStats` al iniciar y solo cuando cambia el score, las vidas o el nivel (nunca por frame).
  - Colores desde tokens con `getComputedStyle(canvas)` y fallback al hex del token (patrón `readPalette` de `games/asteroids/engine.ts`). El mapeo está en Modelo de datos. Fondo `#000`. Textos con `--pixel`.
  - Teclado: `keydown` en `window`, registrado al crear y quitado en `destroy()`. Teclas: flechas y `WASD`. Se ignoran los `keydown` con `e.repeat` (un salto por pulsación). `preventDefault()` solo para las flechas y solo con el motor activo. `P` y `Escape` quedan para la pausa de plataforma. No se filtra `e.isTrusted` (SPEC 12).
  - `pause()` detiene el loop. `resume()` reinicia el tiempo de referencia (el primer `dt` vale 0). El `dt` tiene un tope de 50 ms. `end()` detiene el motor y devuelve el score sin disparar `onGameOver`. `destroy()` es idempotente.
- `games/registry.ts`: alta de `frogger: { factory: createFrogger }`.
- Migración `supabase/migrations/20261031120000_game_frogger.sql` con la fila de `public.games`. Se aplica con el MCP de Supabase (`apply_migration`, nombre `game_frogger`) **previa confirmación del usuario**.
- Leaderboard sin código nuevo: `/salon` y `/juego/frogger` ya leen la vista `leaderboard`. El guardado usa `saveScore` con sesión (SPEC 04).
- `references/implemented-games.md`: fila y sección de FROGGER.
- Verificación con Playwright MCP, el MCP de Supabase y `npm run build` / `npm run lint`. Capturas en `.playwright-screenshot/`.

**Fuera de alcance (para specs futuros):**

- Skins `neon` / `retro` y mapeo táctil (los agregan `skin-designer` y `mobile-porter` tras este spec).
- Mosca bonus en las bocas, cocodrilos y nutrias.
- Animación de muerte elaborada (partículas o explosión): se usa un destello simple.
- Sonido y música.
- Canvas HiDPI (`devicePixelRatio`).
- Guardado anónimo o con nombre libre: se guarda solo con sesión, como en todos los juegos.
- Cambios a RANARIA.
- Anti-trampas, `best` / `plays` desde la base, tests automatizados.

---

## Modelo de datos

Entrada nueva en `GAMES` (`lib/data.ts`), insertada detrás de `ranaria`:

```ts
{
  id: "frogger",
  title: "FROGGER",
  short: "Cruza la carretera y el río sin convertirte en papilla.",
  long: "Guía a tu rana a través de cinco carriles de coches y camiones y un río de troncos y tortugas que se hunden. Llena las cinco bocas del otro lado antes de que se acaben los 15 segundos de cada rana; cada ronda acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.",
  cat: "ARCADE",
  cover: "cover-frogger",
  color: "green",
  best: 0,
  plays: "0",
}
```

Migración `supabase/migrations/20261031120000_game_frogger.sql`:

```sql
-- Alta de FROGGER en el catálogo de juegos con ranking real (SPEC 06).
insert into public.games (id, title) values ('frogger', 'FROGGER');
```

El esquema no cambia, así que no hace falta regenerar `lib/supabase/database.types.ts`.

Registro (`games/registry.ts`):

```ts
frogger: { factory: createFrogger },
```

### Tablero

Canvas 800 × 600. Tablero de 16 × 14 celdas de 40 px (640 × 560) con origen en `(80, 0)`. La franja inferior `y 560–600` lleva la barra de tiempo.

| Fila | Zona |
| --- | --- |
| 0 | Bocas destino: 5 bocas de 2 columnas en las columnas 1–2, 4–5, 7–8, 10–11 y 13–14; el resto es seto (muerte) |
| 1–6 | Río (6 carriles) |
| 7 | Mediana segura |
| 8–12 | Carretera (5 carriles) |
| 13 | Salida segura; la rana aparece en la columna 7 |

### Carriles (nivel 1)

Las velocidades están en px/s y se multiplican por `1.15^(nivel − 1)`, con tope ×2,5. Cada carril tiene `n` entidades separadas `sep` celdas entre inicios. El patrón se repite con periodo `n × sep` celdas: lo que sale por un borde reaparece por el otro.

| Fila | Sentido | Velocidad | Entidad (ancho) | n | sep |
| --- | --- | --- | --- | --- | --- |
| 12 | ← | 90 | coche (1) | 3 | 6 |
| 11 | → | 120 | coche (1) | 3 | 6 |
| 10 | ← | 150 | camión (2) | 2 | 9 |
| 9 | → | 200 | coche (1) | 2 | 9 |
| 8 | ← | 120 | camión (3) | 2 | 10 |
| 6 | → | 70 | tronco (3) | 3 | 7 |
| 5 | ← | 90 | tortugas (3) | 3 | 7 |
| 4 | → | 110 | tronco (4) | 2 | 10 |
| 3 | ← | 80 | tortugas (2) | 4 | 5 |
| 2 | → | 130 | tronco (2) | 3 | 6 |
| 1 | ← | 100 | tronco (3) | 3 | 7 |

Tortugas que se sumergen: el grupo 1 de la fila 5 y los grupos 2 y 4 de la fila 3. Su ciclo es 3 s visibles y 1,5 s bajo el agua, con 400 ms de aviso (dibujo semitransparente) antes de hundirse. Cada grupo tiene su propio temporizador, desfasado.

### Colores (tokens, skin `clasico`)

| Elemento | Token |
| --- | --- |
| Fondo / asfalto | `#000` |
| Líneas de carril | `--line-2` discontinuas |
| Río | `--cyan` α 0,15 |
| Mediana y salida | `--magenta` α 0,12 |
| Fila de bocas (seto) | `--green` α 0,25 |
| Borde de boca | `--gold` |
| Coches | `--magenta` / `--yellow` / `--cyan` (por carril), faros `--ink` |
| Camiones | `--silver`, cabina `--ink-dim` |
| Troncos | `--bronze`, vetas `--gold` |
| Tortugas | `--gold`; en aviso, α 0,4 |
| Rana (y rana en boca ocupada) | `--green`, ojos `--ink` |
| Destello de muerte | `--magenta` |
| Barra de tiempo | `--green` > 50 %, `--yellow` > 25 %, `--magenta` ≤ 25 % |
| Rótulo `PULSA UNA FLECHA` | `--ink-dim` |

Todos los colores viven en un objeto de paleta (`readPalette`), para que `skin-designer` pueda agregar `neon` y `retro` sin tocar la lógica.

Estado interno del motor (privado): `lanes`, `frog { x, row, fromX, fromRow, animT }`, `goals: boolean[5]`, `bestRow`, `timeLeft`, `score`, `lives`, `level`, `phase: "waiting" | "playing" | "dying" | "over"`, `pendingDir`, `paused`, `lastTime`, `rafId`.

---

## Reglas de FROGGER

- **Inicio:** fase `waiting` con el tablero dibujado y el rótulo `PULSA UNA FLECHA`. La primera flecha (o `WASD`) arranca la partida y ejecuta ese salto. Lives 3, nivel 1, score 0.
- **Salto:** cada pulsación mueve la rana una celda (40 px) en su dirección con una animación de 120 ms. Durante la animación se guarda una sola dirección pendiente (`pendingDir`), que se ejecuta al terminar. Abajo no pasa de la fila 13. Los saltos horizontales se limitan al tablero (`x` entre 0 y 600, relativo al tablero).
- **Río:** al terminar un salto en las filas 1–6, la rana necesita apoyo: su centro tiene que estar dentro de un tronco o de un grupo de tortugas visible. Sin apoyo, muere. Con apoyo, el carril la arrastra a su velocidad. Si el arrastre saca su centro del tablero, muere.
- **Tortugas:** si el grupo que la sostiene se hunde, muere.
- **Carretera:** si el centro de la rana está dentro de un coche o camión de su fila, muere, también mientras espera quieta.
- **Bocas:** al llegar a la fila 0, la columna del centro de la rana decide qué pasa. En una boca libre, la boca queda ocupada y se suma la puntuación. En una boca ocupada o en el seto, muere.
- **Tiempo:** cada rana tiene `max(8, 15 − (nivel − 1))` segundos. El temporizador se reinicia al aparecer una rana nueva (tras ocupar una boca, morir o pasar de ronda). Si llega a 0, muere.
- **Muerte:** fase `dying` de 500 ms con un destello `--magenta` sobre la rana, sin input. Después: `lives − 1` y `onStats`. Si quedan 0 vidas, fase `over` y `onGameOver(score)`. Si no, la rana reaparece en la salida.
- **Ronda:** con las 5 bocas ocupadas se suma el bonus de ronda, las bocas se vacían, `level + 1` (`onStats`), los carriles se reconstruyen con la nueva velocidad y la rana reaparece.
- **Puntuación:**
  - +10 por cada fila nueva más alta alcanzada por la rana actual (se reinicia con cada rana);
  - +50 al ocupar una boca, más un bonus de `segundos restantes enteros × 10`;
  - +200 al completar la ronda.

---

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app` sobre client components (según `AGENTS.md`). Agregar la entrada `frogger` en `GAMES` y la portada `.cover-frogger`. Manual: la tarjeta aparece en `/`, `/juegos`, `/salon` y `/juego/frogger`, y `/jugar/frogger` abre con la arena simulada.
2. Crear `games/frogger/engine.ts`: paleta y constantes, tablero y carriles, loop y salto, río y tortugas, carretera, bocas, tiempo, muerte, ronda y puntuación. Registrarlo en `games/registry.ts`. Manual: `/jugar/frogger` se juega con teclado, el HUD de plataforma refleja el motor y el fin de partida abre el modal.
3. Escribir `supabase/migrations/20261031120000_game_frogger.sql`. **Pedir confirmación al usuario** y aplicarla con el MCP (`apply_migration`, nombre `game_frogger`). Verificar con `list_migrations`, `execute_sql` (`select * from public.games`) y `get_advisors` (security).
4. Agregar FROGGER a `references/implemented-games.md` (tabla y sección: ruta, origen, descripción, controles, puntuación).
5. Verificar los criterios de aceptación con Playwright MCP (escritorio, 390 px, consola y guardado) y SQL del MCP. Guardar las capturas en `.playwright-screenshot/`.

Cada paso deja la app corriendo y commiteable.

---

## Criterios de aceptación

**Integración:**

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `GAMES` contiene `frogger` en el índice 5 con los valores del Modelo de datos; las demás entradas no cambiaron.
- [ ] La tarjeta FROGGER aparece en `/`, en `/juegos` (filtro ARCADE y búsqueda "frog"), como pestaña en `/salon` y en `/juego/frogger`, con la portada `.cover-frogger`, distinta de `.cover-rana`.
- [ ] Existe `games/frogger/engine.ts` y no declara variables de módulo mutables.
- [ ] En `/jugar/frogger` hay un `<canvas>` de 800 × 600 dentro de `.crt-screen` y no existe `.game-arena`.
- [ ] El HUD de plataforma muestra el score, las vidas (3 ♥ al empezar) y el nivel reales del motor.
- [ ] El canvas no dibuja score, vidas ni nivel; no muestra "GAME OVER" ni texto de reinicio, y ninguna tecla reinicia la partida.
- [ ] Al perder la última vida se abre el modal FIN DEL JUEGO con el score final del motor.
- [ ] FIN durante la partida detiene el juego y abre el modal con el score actual.
- [ ] JUGAR DE NUEVO reinicia a score 0, 3 vidas y nivel 01, y la partida es jugable.
- [ ] PAUSA congela el canvas (dos capturas separadas por 1 s son idénticas) y REANUDAR continúa sin salto; `P` y `Escape` alternan la pausa.
- [ ] Ocultar la pestaña o quitar el foco pausa el juego, y al volver sigue en pausa.
- [ ] Con el juego activo las flechas no hacen scroll; con el modal abierto o en pausa no son interceptadas.
- [ ] Salir de `/jugar/frogger` destruye el motor: no quedan listeners de teclado ni `requestAnimationFrame` activos.
- [ ] Los elementos usan los tokens de la tabla de colores (verificado en captura).
- [ ] `public.games` contiene la fila `frogger` / `FROGGER`, `list_migrations` muestra `game_frogger` aplicada y `get_advisors` (security) no reporta hallazgos nuevos.
- [ ] Con sesión, GUARDAR PUNTUACIÓN inserta en `scores` una fila con `game_id = 'frogger'` y el score del modal (SQL del MCP), y la marca aparece en `/juego/frogger` y en la pestaña FROGGER de `/salon`.
- [ ] `/jugar/ranaria` y un juego mock (ej. `/jugar/rocas`) siguen funcionando igual.
- [ ] La consola no muestra errores en `/jugar/frogger` durante una partida completa.
- [ ] Nada en `app/`, `components/`, `lib/` ni `games/` importa archivos de `references/`.

**Gameplay:**

- [ ] Al cargar, la rana está en la fila 13, columna 7, con el rótulo `PULSA UNA FLECHA`; la primera flecha arranca y salta.
- [ ] Cada pulsación mueve exactamente 40 px con una animación de 120 ms; mantener la tecla no repite el salto.
- [ ] La rana no sale por los bordes laterales ni por debajo de la fila 13.
- [ ] Coches y camiones recorren sus carriles en el sentido y orden de la tabla y reaparecen por el borde opuesto.
- [ ] Troncos y tortugas se mueven y arrastran a la rana montada.
- [ ] Las tortugas marcadas alternan 3 s visibles y 1,5 s hundidas, con aviso de 400 ms; las demás nunca se hunden.
- [ ] La rana muere al tocar un vehículo, al caer al agua, al hundirse su tortuga, al ser arrastrada fuera del tablero, al caer en el seto o en una boca ocupada, y al agotar el tiempo.
- [ ] Cada muerte resta una vida en el HUD y la rana reaparece en la salida tras el destello de 500 ms.
- [ ] Ocupar una boca libre la marca con una rana dibujada y suma 50 + segundos restantes × 10.
- [ ] Cada fila nueva más alta alcanzada por la rana actual suma 10.
- [ ] Con las 5 bocas ocupadas se suman 200, el nivel sube en el HUD, las bocas se vacían y el tráfico es más rápido (×1,15).
- [ ] El tiempo por rana es 15 s en el nivel 1 y 14 s en el nivel 2, con un mínimo de 8 s.
- [ ] La barra de tiempo cambia de color al 50 % y al 25 %.

---

## Decisiones

- **Sí:** reescribir al contrato `GameFactory` el spec de game jam (`specs/game-jam/01-frogger-core.md`). Se conserva su mecánica y se descartan su componente React, su página `app/games/...`, su HUD en canvas y su guardado anónimo.
- **No:** guardado con `player_name` y `user_id: null`. `scores.user_id` es `not null` y la RLS solo permite insertar filas propias (SPEC 04). Se guarda con sesión, como en todos los juegos.
- **Sí:** entrada nueva `frogger` en vez de reutilizar RANARIA. Es otro diseño (más carriles, tortugas que se hunden, bocas con seto, otra puntuación) y tiene ranking propio.
- **Sí:** `color: "green"`. El tipo `Game.color` solo admite `cyan | magenta | green | yellow`, así que `lime` no es válido.
- **Sí:** canvas de 800 × 600 con el tablero de 640 × 560 centrado y la barra de tiempo debajo. Así no hay que extender el contrato con tamaños por juego y se conserva el grid de 16 × 14 × 40 del original.
- **Sí:** HUD de plataforma como única fuente de score, vidas y nivel. En el canvas solo quedan la barra de tiempo, las bocas y el rótulo de inicio.
- **Sí:** las velocidades se definen en px/s por carril en una tabla cerrada. Las px/frame del original mezclaban unidades.
- **Sí:** el temporizador y el "avance por primera vez" son por rana, no por ronda. Con la versión por ronda, solo la primera rana de cada ronda puntuaba por avance, y el bonus de tiempo carecía de sentido.
- **Sí:** un salto por pulsación ignorando `e.repeat`, y una dirección en cola durante la animación. Es mecánica de salto discreto y encaja con el gamepad táctil sin `repeat`.
- **Sí:** fase de espera hasta la primera flecha, como RANARIA y SNAKE.
- **Sí:** flechas y `WASD`, consistente con RANARIA y SNAKE.
- **Sí:** colores desde tokens en un objeto de paleta, preparado para que `skin-designer` agregue `neon` y `retro`.
- **No:** skins y mapeo táctil en este spec. Los agregan los agentes en la etapa B de `/spec-impl-game`.
- **No:** mosca, cocodrilos, partículas ni sonido (otro spec).

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| React 19 Strict Mode monta efectos dos veces | `destroy()` idempotente; criterio de listeners y loops. |
| `onStats` a 60 fps provoca re-renders | Llamar `onStats` solo al cambiar score, vidas o nivel. |
| Carriles imposibles de cruzar | Tabla cerrada con huecos (`sep` > ancho) y verificación en partida. |
| Arrastre del río con `dt` grande saca a la rana del tablero injustamente | Tope de `dt` en 50 ms y primer `dt` = 0 al reanudar. |
| Migración no aplicada: el guardado falla | Paso 3 explícito y criterio con SQL del MCP. |
| Migración aplicada directo en el proyecto remoto | Solo inserta una fila; se pide confirmación. |
| Confusión con RANARIA (mismo género) | Portada, copy y reglas distintas; criterios que verifican que RANARIA no cambia. |
| Teclas en conflicto con la pausa | No aplica: el juego usa solo flechas y `WASD`. |
| Next.js 16 con convenciones distintas a las recordadas | Leer `node_modules/next/dist/docs/01-app` antes de escribir. |

---

## Lo que **no** está en este spec

- Skins `neon` / `retro` y mapeo táctil (agentes de `/spec-impl-game`).
- Mosca, cocodrilos, partículas, sonido y HiDPI.
- Guardado anónimo.
- Cambios a RANARIA.
- Anti-trampas, `best` / `plays` desde la base, tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.
