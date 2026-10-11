# SPEC JAM — RANARIA: cruce de carretera y río con leaderboard

> **Status:** Aprobado
> **Depends on:** SPEC 04, SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-11
> **Game jam:** tema "rana que cruza carretera y río" · ángulo "arcade de cruce por carriles (Frogger-like), un salto por pulsación"
> **Objective:** Convertir la entrada demo `ranaria` del catálogo en un juego real: un motor TypeScript escrito desde cero en `games/ranaria/engine.ts`, montado en `/jugar/ranaria`, y la fila en `public.games` para que sus partidas se guarden y aparezcan en el leaderboard.

---

## Por qué existe este spec

RANARIA ya está en el catálogo (`lib/data.ts`) como título demo: tiene id `ranaria`, portada `.cover-rana` y copy, pero `/jugar/ranaria` abre la arena simulada, que suma puntos al azar. ASTEROIDES, TETRIS, ARKANOID y SNAKE (SPEC 05, 07, 08 y 09) ya son reales. RANARIA es el primero que **convierte un demo existente** en vez de añadir una entrada nueva: se mantienen el id, el título y la portada, y la entrada pasa a tener motor y ranking.

El tema es la rana que cruza la carretera y el río, y está en la mecánica, no solo en los dibujos. El tablero tiene 12 filas. Abajo, una acera de salida y cuatro carriles de coches que hay que **esquivar**. En medio, una mediana segura. Arriba, cinco carriles de río en los que pasa lo contrario: el agua mata, y solo se sobrevive **montado** en troncos y tortugas, que arrastran a la rana con ellos. En la orilla superior hay cinco nenúfares. Cada rana tiene 30 segundos para llegar a uno libre. Con los cinco ocupados se completa el nivel y todo se acelera. Es un salto por pulsación, a una celda exacta: sin movimiento continuo y sin repetición al mantener la tecla.

Es un diseño desde cero: no hay carpeta en `references/started-games/`, así que las reglas y constantes se fijan aquí. El juego encaja en el contrato actual sin extenderlo. Usa un canvas de 800×600 (16×12 celdas de 50 px), tiene vidas (3) y nivel, así que el registro queda `{ factory: createRanaria }` con la forma `EngineEntry` de SPEC 07 y el HUD muestra Vidas y Nivel.

---

## Alcance

**Entra:**

- **Modificar la entrada existente** `ranaria` en `GAMES` de `lib/data.ts`. No se crea una entrada nueva.
  - Se mantienen `id: "ranaria"`, `title: "RANARIA"`, `cat: "ARCADE"`, `color: "green"`, `cover: "cover-rana"`, `short` y `long`. El copy actual ("Salta entre carriles de coches… troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.") ya describe el juego real: los nidos se dibujan como nenúfares y hay temporizador.
  - Cambian `best: 18900 → 0` y `plays: "6.4K" → "0"`, como en las otras entradas reales (ver Decisiones).
  - Se mueve de la undécima a la **quinta posición** (índice 4, detrás de `snake`) para que aparezca en la landing (`GAMES.slice(0, 6)`).
- **Portada:** se reutiliza `.cover-rana` de `app/globals.css` sin cambios: franjas horizontales cian (carriles) y un círculo `--green` con glow (la rana). No se crea portada nueva.
- `games/ranaria/engine.ts`: motor nuevo que exporta `createRanaria: GameFactory`.
  - Sin estado de módulo mutable: todo vive dentro de la instancia. Las tablas de carriles y nidos son constantes inmutables (`as const` / `Object.freeze`).
  - **Tablero:** `COLS = 16`, `ROWS = 12`, `CELL = 50`, que llena el canvas de 800×600. Las filas se numeran de 0 (arriba) a 11 (abajo):
    - fila 0: orilla con 5 nenúfares;
    - filas 1–5: río;
    - fila 6: mediana segura;
    - filas 7–10: carretera;
    - fila 11: acera de salida, segura.
  - **Rana:** posición `row` (entera) y `cx` (centro horizontal en px, continuo, porque el río la arrastra). Se dibuja en un cuadrado de 36×36 centrado en su celda. La caja de colisión horizontal es `cx ± 16`.
    - Sale en `row = 11`, `cx = 400`.
  - **Salto:** cada `keydown` de dirección (sin `e.repeat`) mueve la rana exactamente una celda: `row ± 1` o `cx ± 50`. El salto es instantáneo.
    - Hacia abajo no pasa de la fila 11.
    - En horizontal, el salto deja `cx` acotado a `[25, 775]`.
    - Las teclas mantenidas no repiten el salto.
  - **Arranque:** fase `waiting` al crear el motor. El tráfico y el río ya se mueven, pero el temporizador no corre y se muestra el rótulo `PULSA UNA FLECHA`. La primera tecla de dirección válida aplica su salto, pasa a `playing` y arranca el temporizador. Esto pasa solo al inicio de la partida.
  - **Carriles:** cada carril tiene `row`, `kind`, `len` (px), `count`, `speed` base (px/s), `dir` (`1` = derecha, `−1` = izquierda) y `offset` inicial (px).
    - Los objetos de un carril van equiespaciados en un bucle de ancho `LOOP = 800 + len`.
    - La posición del objeto `i` es `x_i = mod(offset + i × LOOP / count + dir × speed × mult × t, LOOP) − len`, con borde izquierdo en `x_i`. Equivale a avanzar cada objeto `dir × speed × mult × dt` por frame y envolverlo.
    - Tabla de carriles en Modelo de datos.
  - **Velocidad por nivel:** `mult = min(2.2, 1 + 0.15 × (level − 1))`. Nivel 1 = 1.0, nivel 2 = 1.15, … y desde el nivel 9 se mantiene en 2.2. Al subir de nivel se recalcula `mult` sin reposicionar objetos.
  - **Carretera (filas 7–10):** la rana muere si su caja `[cx − 16, cx + 16]` se solapa con algún vehículo de su fila (AABB horizontal).
  - **Río (filas 1–5):**
    - La rana está a salvo si `cx` cae dentro de `[x, x + len]` de algún tronco o grupo de tortugas de su fila. Mientras tanto, `cx += dir × speed × mult × dt` del objeto que la lleva.
    - Si no está sobre ningún objeto, muere ahogada.
    - Si el arrastre deja `cx < 0` o `cx > 800`, muere.
    - La comprobación se hace cada frame y justo después de cada salto.
  - **Nenúfares (fila 0):** centros en `x = 80, 240, 400, 560, 720`, radio de captura `±35`.
    - Al saltar a la fila 0 con `|cx − centro| ≤ 35` sobre un nenúfar **libre**, se ocupa y suma puntos (ver Puntuación). La rana vuelve a la salida (`row 11`, `cx 400`) con el temporizador a 30 s.
    - Si llega a un nenúfar ya ocupado o a la orilla fuera de cualquier nenúfar, muere.
  - **Temporizador:** 30 s por rana. Se reinicia al ocupar un nenúfar y al reaparecer tras morir. Si llega a 0, la rana muere.
  - **Puntuación:**
    - **+10** por cada fila nueva alcanzada en filas 10 a 1. Se lleva `bestRow` por rana: empieza en 11 y suma solo cuando `row < bestRow`, así que retroceder y volver no puntúa. Se reinicia al ocupar un nenúfar o al morir.
    - **+50** por nenúfar ocupado.
    - **+10 × floor(segundos restantes)** al ocupar un nenúfar.
    - **+1000** al completar el nivel (quinto nenúfar ocupado).
  - **Vidas:** 3. Al morir, `lives −= 1` y `onStats` se llama en ese momento. Siguen 600 ms de fase `dying`: la rana se dibuja como una X `--magenta` en su sitio, el mundo sigue moviéndose y la entrada se ignora.
    - Si quedan vidas, la rana reaparece en la salida con el temporizador a 30 s.
    - Si `lives === 0`, termina la partida.
  - **Niveles:** al ocupar el quinto nenúfar se suma el bonus de nivel, `level += 1`, se vacían los cinco nenúfares, se recalcula `mult` y la rana vuelve a la salida. No hay límite de niveles. No hay vidas extra.
  - **Se dibuja en el canvas:**
    - Fondo `#000`.
    - Fila 0: orilla en `--green` con alfa 0,25 y cinco nenúfares (círculo de radio 22, contorno `--green`, relleno `#000`). Un nenúfar ocupado muestra una rana `--green`.
    - Filas 1–5: agua `--cyan` con alfa 0,15.
    - Filas 6 y 11: acera `--magenta` con alfa 0,12.
    - Filas 7–10: asfalto `#000` con líneas discontinuas `--line-2` entre carriles.
    - Coches con faros `--ink`: fila 10 `--magenta`, fila 9 `--yellow`, fila 7 `--cyan`. Camiones de la fila 8 en `--silver`.
    - Troncos `--bronze` con vetas `--gold`. Tortugas como círculos `--gold` (2 o 3 por grupo).
    - Rana `--green` con ojos `--ink` orientados según el último salto. En `dying`, una X `--magenta`.
    - **Barra de tiempo:** 6 px de alto en `y = 592`, dentro de la acera de salida. Ancho `800 × t / 30`. Es `--green` con más de 10 s, `--yellow` entre 10 y 5 s y `--magenta` con 5 s o menos.
    - En `waiting`, el rótulo `PULSA UNA FLECHA` centrado en la mediana, con `--pixel` en `--ink-dim`.
  - **No se dibuja:** score, vidas, nivel, "GAME OVER", "NIVEL XX" ni texto de reinicio. Score, vidas y nivel se ven solo en el HUD de plataforma.
  - **Fin:** con `lives === 0`, tras los 600 ms de `dying`, el motor deja de actualizar y llama `onGameOver(score)` una sola vez. No hay reinicio por tecla.
  - **Stats:** `onStats({ score, lives, level })` al iniciar y solo cuando cambian score, vidas o nivel (nunca por frame).
  - **Colores:** desde los tokens de `app/globals.css` con `getComputedStyle(canvas)` y fallback al hex del token (patrón `readPalette` / `withAlpha` de `games/asteroids/engine.ts`). Tokens: `--green`, `--cyan`, `--magenta`, `--yellow`, `--silver`, `--bronze`, `--gold`, `--ink`, `--ink-dim`, `--line-2`, `--pixel`.
  - **Teclado:** `keydown` en `window`, registrado al crear y removido en `destroy()`.
    - Controles: `↑`/`W` arriba, `↓`/`S` abajo, `←`/`A` izquierda, `→`/`D` derecha. Un salto por pulsación; los eventos con `e.repeat` se ignoran.
    - `preventDefault()` solo en las cuatro flechas y solo con el motor activo (no pausado ni terminado). WASD no hace scroll.
    - `P` y `Escape` no se escuchan: los maneja la plataforma.
  - **Ciclo de vida:**
    - `pause()` detiene el loop e ignora la entrada. El temporizador y la animación de `dying` quedan congelados.
    - `resume()` reinicia el tiempo de referencia (primer `dt` = 0).
    - El `dt` tiene un tope de 50 ms.
    - `end()` detiene y devuelve el score sin disparar `onGameOver`.
    - `destroy()` es idempotente.
- `games/registry.ts`: alta de `ranaria: { factory: createRanaria }`, sin `lives: false`.
- Migración `supabase/migrations/20261011170212_game_ranaria.sql` con la fila de `public.games`. Se aplica con el MCP de Supabase (`apply_migration`, nombre `game_ranaria`) **previa confirmación del usuario**.
- Leaderboard sin código nuevo: `/salon` y `/juego/ranaria` ya leen la vista `leaderboard` filtrada por `game_id` (SPEC 04), y la FK de SPEC 06 acepta `ranaria` tras la migración.
- `references/implemented-games.md`: añadir RANARIA a la tabla y su sección (id, ruta, origen "diseñado desde cero en la game jam", controles, puntuación).
- Verificación con Playwright MCP, MCP de Supabase y `npm run build` / `npm run lint`. Capturas en `.playwright-screenshot/`.

**Fuera de alcance (para specs futuros):**

- Controles táctiles y soporte móvil jugable (sigue el aviso "REQUIERE TECLADO").
- Canvas HiDPI (`devicePixelRatio`).
- Sonido y música.
- Tortugas que se sumergen, cocodrilos, serpientes en la mediana, mosca o rana bonus en los nenúfares.
- Vidas extra por puntuación y temporizador que se acorta por nivel.
- Animación de salto interpolada (el salto es instantáneo).
- Rótulo "NIVEL XX" o cualquier HUD dentro del canvas.
- Nueva portada para RANARIA (se mantiene `.cover-rana`).
- Anti-trampas o validación server-side del score.
- `best` y `plays` calculados desde la base.
- Tests automatizados (no hay test runner).

---

## Modelo de datos

Entrada **existente** `ranaria` en `GAMES` (`lib/data.ts`), movida a la quinta posición (índice 4). Solo cambian `best` y `plays`:

```ts
{
  id: "ranaria",
  title: "RANARIA",
  short: "Cruza la autopista de pixeles.",
  long: "Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.",
  cat: "ARCADE",
  cover: "cover-rana",
  color: "green",
  best: 0,      // antes 18900 (valor demo)
  plays: "0",   // antes "6.4K" (valor demo)
}
```

Migración `supabase/migrations/20261011170212_game_ranaria.sql`:

```sql
-- Alta de RANARIA en el catálogo de juegos con ranking real (SPEC 06).
insert into public.games (id, title) values ('ranaria', 'RANARIA');
```

No cambia el esquema: no hace falta regenerar `lib/supabase/database.types.ts`.

El contrato (`games/types.ts`) no cambia. Registro en `games/registry.ts`:

```ts
export const ENGINES: Partial<Record<string, EngineEntry>> = {
  asteroides: { factory: createAsteroids },
  tetris: { factory: createTetris, lives: false },
  arkanoid: { factory: createArkanoid },
  snake: { factory: createSnake, lives: false },
  ranaria: { factory: createRanaria },
};
```

Carriles (`LANES`, constante inmutable del motor). Valores a nivel 1; la velocidad efectiva es `speed × mult`:

| Fila | Zona | `kind` | `len` (px) | `count` | `speed` (px/s) | `dir` | `offset` (px) | Hueco entre objetos (px) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | carretera | `car` | 50 | 3 | 60 | ← (−1) | 0 | 233 |
| 9 | carretera | `car` | 50 | 3 | 90 | → (1) | 120 | 233 |
| 8 | carretera | `truck` | 100 | 2 | 50 | ← (−1) | 200 | 350 |
| 7 | carretera | `car` | 50 | 2 | 140 | → (1) | 300 | 375 |
| 5 | río | `log` | 150 | 3 | 50 | → (1) | 0 | 167 |
| 4 | río | `turtles` (3) | 120 | 3 | 70 | ← (−1) | 150 | 187 |
| 3 | río | `log` | 200 | 2 | 80 | → (1) | 250 | 300 |
| 2 | río | `turtles` (2) | 80 | 4 | 60 | ← (−1) | 50 | 140 |
| 1 | río | `log` | 120 | 3 | 100 | → (1) | 100 | 187 |

Hueco = `LOOP / count − len`, con `LOOP = 800 + len`.

Velocidad por nivel: nivel 1 = ×1.0, 2 = ×1.15, 3 = ×1.3, … 9 = ×2.2, y a partir del 9 se mantiene en ×2.2.

Nenúfares: centros `x = [80, 240, 400, 560, 720]`, radio de captura 35 px, radio dibujado 22 px.

Puntuación de referencia (nivel 1, sin morir): cada rana que cruza suma 100 por las filas 10 a 1, 50 por el nenúfar y hasta 290 de bonus de tiempo. Completar los cinco suma unos 1000 a 2000 puntos más los 1000 del bonus de nivel. Las cifras son las mismas en todos los niveles; solo sube la velocidad. Por eso el score depende de los nenúfares ocupados y de la rapidez, y es comparable entre partidas.

Estado interno del motor (privado a `games/ranaria/engine.ts`):

- Rana: `row`, `cx`, `facing` (`'up' | 'down' | 'left' | 'right'`), `bestRow`, `timeLeft` (s).
- `nests` (`boolean[5]`), `t` (tiempo de mundo acumulado para los carriles), `mult`.
- `score`, `lives`, `level`.
- `phase: 'waiting' | 'playing' | 'dying' | 'over' | 'ended'`, `dyingMs`, `paused`, `destroyed`, `lastTime`, `rafId`.
- `colors` (resultado de `readPalette`).

Funciones como cierres de la instancia: `hop`, `laneObjects(lane)`, `update(dt)`, `checkRoad`, `checkRiver`, `tryNest`, `die`, `respawn`, `completeLevel`, `emitStats`, `draw`, `drawLanes`, `drawFrog`, `drawNests`, `drawTimeBar`.

---

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app` en lo relativo a client components (según `AGENTS.md`).
   - Mover la entrada `ranaria` a la quinta posición de `GAMES` y poner `best: 0`, `plays: "0"`. No tocar `.cover-rana`.
   - Manual: la tarjeta RANARIA aparece en `/` y sigue en `/juegos`, `/salon` y `/juego/ranaria`; `/jugar/ranaria` aún abre con la simulación.
2. Crear `games/ranaria/engine.ts`:
   - tablero, carriles y nenúfares;
   - salto por pulsación, arrastre en el río y colisiones;
   - temporizador, puntuación, vidas y niveles;
   - colores desde tokens;
   - teclado con `preventDefault` acotado;
   - `pause`/`resume`/`end`/`destroy`.

   Registrarlo en `games/registry.ts`. Manual: `/jugar/ranaria` se juega con flechas y WASD, el HUD muestra Puntuación, Vidas y Nivel del motor, y perder las 3 vidas abre el modal.
3. Escribir `supabase/migrations/20261011170212_game_ranaria.sql`.
   - **Pedir confirmación al usuario** y aplicarla con el MCP (`apply_migration`, nombre `game_ranaria`).
   - Verificar con `list_migrations`, `execute_sql` (`select * from public.games order by id`) y `get_advisors` (security).
4. Actualizar `references/implemented-games.md` con RANARIA.
5. Verificar los criterios de aceptación con Playwright MCP (desktop y 390px, consola, guardado) y SQL del MCP. Guardar capturas en `.playwright-screenshot/`.

Cada paso deja la app corriendo y commiteable.

---

## Criterios de aceptación

**Integración:**

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `GAMES[4]` es `ranaria`. Sus valores coinciden con el Modelo de datos: `best: 0`, `plays: "0"`, y `short`, `long`, `cat`, `color` y `cover` sin cambios. El diff de `lib/data.ts` solo mueve esa entrada y cambia `best` y `plays`; no hay entradas nuevas ni otras modificadas.
- [ ] `app/globals.css` no cambia: `.cover-rana` sigue igual.
- [ ] La tarjeta RANARIA aparece con la portada `.cover-rana` en:
  - `/` (entra en `GAMES.slice(0, 6)`);
  - `/juegos` (filtro ARCADE y búsqueda "rana");
  - `/salon`, como pestaña;
  - `/juego/ranaria`, con "Mejor global" en 0 y "Partidas" en 0.
- [ ] Existe `games/ranaria/engine.ts` y no declara variables de módulo mutables.
- [ ] `games/types.ts` no cambia. `games/registry.ts` incluye `ranaria: { factory: createRanaria }`, sin `lives: false`.
- [ ] En `/jugar/ranaria` hay un `<canvas>` de 800×600 dentro de `.crt-screen` y no existe `.game-arena`.
- [ ] El HUD de plataforma de `/jugar/ranaria` muestra Jugador, Puntuación, Vidas (`♥ ♥ ♥` al inicio) y Nivel reales del motor.
- [ ] El canvas no dibuja score, vidas ni nivel. No muestra "GAME OVER", "NIVEL XX" ni texto de reinicio, y ninguna tecla reinicia la partida.
- [ ] Al perder la tercera vida se abre el modal FIN DEL JUEGO con el score final del motor.
- [ ] FIN durante la partida detiene el juego y abre el modal con el score actual.
- [ ] JUGAR DE NUEVO reinicia a score 0, 3 vidas, nivel 01, nenúfares vacíos y rana en la salida con el rótulo `PULSA UNA FLECHA`, y la partida es jugable.
- [ ] PAUSA congela el canvas (dos capturas separadas por 1 s idénticas: ni coches, ni troncos, ni barra de tiempo avanzan) y REANUDAR continúa sin salto. `P` y `Escape` alternan la pausa una vez por pulsación.
- [ ] Ocultar la pestaña o quitar el foco pausa el juego, y al volver sigue en pausa.
- [ ] Con el juego activo, las flechas no hacen scroll. Con el modal abierto o en pausa no se interceptan y no mueven la rana.
- [ ] Salir de `/jugar/ranaria` destruye el motor: sin listeners de teclado ni `requestAnimationFrame` activos (las teclas en otras páginas no generan errores).
- [ ] En una captura se verifican los colores: rana `--green`, agua cian translúcida, troncos `--bronze`, tortugas `--gold`, coches `--magenta`/`--yellow`/`--cyan`, camiones `--silver`, aceras magenta translúcidas y fondo `#000`.
- [ ] En emulación móvil táctil (390px), `/jugar/ranaria` muestra "REQUIERE TECLADO", sin scroll horizontal ni errores en consola.
- [ ] `public.games` contiene la fila `ranaria` / `RANARIA` además de `asteroides`, `tetris`, `arkanoid` y `snake`. `list_migrations` muestra `game_ranaria` aplicada y `get_advisors` (security) no reporta hallazgos nuevos.
- [ ] Con sesión, GUARDAR PUNTUACIÓN inserta en `scores` una fila con `game_id = 'ranaria'` y el score del modal (SQL del MCP), y la marca aparece en `/juego/ranaria` y en la pestaña RANARIA de `/salon`.
- [ ] `/jugar/asteroides`, `/jugar/tetris`, `/jugar/arkanoid` y `/jugar/snake` siguen funcionando igual, y `/jugar/rocas` sigue con la simulación.
- [ ] La consola no muestra errores en `/jugar/ranaria` durante una partida completa.
- [ ] Nada en `app/`, `components/`, `lib/` ni `games/` importa archivos de `references/`.
- [ ] `references/implemented-games.md` lista RANARIA con sus controles y su puntuación.

**Gameplay de RANARIA:**

- [ ] Al entrar, el tablero muestra la orilla con 5 nenúfares vacíos, 5 carriles de río con troncos y tortugas en movimiento, la mediana, 4 carriles con vehículos en movimiento, la rana en la acera de salida (centro horizontal), la barra de tiempo llena y el rótulo `PULSA UNA FLECHA`.
- [ ] En fase de espera, la barra de tiempo no disminuye durante 3 s sin teclas.
- [ ] La primera pulsación de `↑` o `W` sube la rana una fila, quita el rótulo y la barra de tiempo empieza a bajar.
- [ ] `↑`/`↓`/`←`/`→` y `W`/`S`/`A`/`D` mueven la rana exactamente una celda (50 px) por pulsación.
- [ ] Mantener pulsada una flecha 1 s produce un único salto.
- [ ] `↓` en la acera de salida no mueve la rana. `←` repetido junto al borde izquierdo deja la rana con su centro en 25 px como mínimo, sin salir del canvas; lo mismo con `→` en el borde derecho.
- [ ] Subir de la fila 11 a la 10 suma 10 al HUD. Bajar a la 11 y volver a subir a la 10 no suma de nuevo.
- [ ] Un vehículo que toca a la rana en la carretera le quita una vida (el HUD pasa de 3 a 2 corazones), la rana se ve como una X magenta unos 600 ms y reaparece en la salida con la barra de tiempo llena.
- [ ] Saltar al río fuera de un tronco o grupo de tortugas cuesta una vida.
- [ ] Sobre un tronco, la rana se desplaza con él sin pulsar teclas. Si el tronco la saca del canvas, pierde una vida.
- [ ] Entrar en un nenúfar libre suma 50 más 10 por cada segundo entero restante, el nenúfar muestra una rana y la rana activa vuelve a la salida con la barra llena.
- [ ] Saltar a la orilla fuera de un nenúfar, o a un nenúfar ya ocupado, cuesta una vida.
- [ ] Dejar que la barra de tiempo llegue a 0 (unos 30 s) cuesta una vida.
- [ ] Al ocupar el quinto nenúfar, el HUD suma además 1000, muestra nivel 02, los cinco nenúfares quedan vacíos y los carriles se mueven visiblemente más rápido (×1.15).
- [ ] Tras morir, las filas ya recorridas vuelven a puntuar en el siguiente intento (el máximo avance es por rana).
- [ ] Perder las 3 vidas termina la partida tras la animación de muerte y abre el modal una sola vez.

---

## Decisiones

- **Sí:** convertir la entrada demo `ranaria` en juego real, reutilizando id, título, categoría, color, copy y portada `.cover-rana`. Lo pidió el brief de la jam y evita tener dos RANARIA en el catálogo. Es el primer demo que se convierte: SPEC 05, 07, 08 y 09 crearon entradas nuevas y dejaron intactos sus mocks parecidos.
- **Sí (Supuesto de la jam):** `best: 0` y `plays: "0"` en vez de mantener 18900 / "6.4K". Se comprobó que **no hay precedente** de demo convertido. Las cuatro entradas reales tienen `best: 0` y `plays: "0"`, y `/juego/[id]` muestra "Mejor global" junto al top 10 real: un 18900 inventado contradiría el ranking. Si el usuario prefiere conservar los valores demo, basta con no tocar esos dos campos; el resto del spec no cambia.
- **Sí (Supuesto de la jam):** mover `ranaria` a la quinta posición de `GAMES`, detrás de `snake`. Los juegos reales van primero, y así entra en la landing (`GAMES.slice(0, 6)`) sin desplazar a ASTEROIDES de la pestaña por defecto de `/salon`. Como consecuencia, `caida` (CAÍDA, demo) sale de la landing.
- **Sí (Supuesto de la jam):** copy `short`/`long` sin cambios. Coches, troncos, río, nenúfares y temporizador están en el juego real. Las tortugas, las vidas y los niveles no se mencionan, pero el copy no promete nada falso.
- **Sí (Supuesto de la jam):** portada `.cover-rana` sin cambios. Encaja con el juego (carriles cian y rana verde) y el brief pide no crear una nueva.
- **Sí (Supuesto de la jam):** color `green` (ya era el de la entrada). TETRIS también es `green`. Se acepta porque cambiarlo modificaría la identidad de una entrada existente.
- **Sí:** motor escrito desde cero con el contrato `GameFactory` de SPEC 05. No hay código de referencia; las reglas se fijan en este spec.
- **No:** extender el contrato. 800×600, con vidas y nivel: `{ factory: createRanaria }` con `EngineEntry` de SPEC 07 basta.
- **Sí:** tablero de 16×12 celdas de 50 px: llena el CRT 4:3 sin letterbox. Doce filas dan 4 de carretera y 5 de río con dos zonas seguras.
- **Sí:** salto instantáneo de una celda por `keydown`, ignorando `e.repeat`. Es el ángulo de la jam ("un salto por pulsación"), da control exacto y evita interpolar.
- **Sí:** `cx` continuo, aunque los saltos sean de 50 px, para que el arrastre del río funcione. Por eso los nenúfares tienen un radio de captura (±35) y no una celda exacta.
- **Sí:** carriles como `velocidad + dirección + equiespaciado` con bucle `800 + len`, sin IA ni aleatoriedad. Todas las partidas tienen el mismo tráfico, lo que hace el leaderboard justo y los criterios reproducibles.
- **Sí:** dificultad solo por velocidad (`×1.15` por nivel, tope ×2.2 en el nivel 9). Con puntos fijos por acción, el score crece de forma predecible con el progreso.
- **Sí:** puntuación de +10 por fila nueva por rana, +50 por nenúfar, +10 por segundo restante y +1000 por nivel. Premia avanzar, completar y hacerlo rápido. `bestRow` impide sumar puntos subiendo y bajando.
- **Sí:** 3 vidas, sin vidas extra. Partidas de 1 a 5 minutos para un jugador medio.
- **Sí:** temporizador de 30 s por rana, en una barra dentro del canvas. Es un indicador propio del juego (no un stat de plataforma), igual que la pieza siguiente de TETRIS.
- **Sí:** fase de espera inicial con tráfico en movimiento y el temporizador parado, como el rótulo de SNAKE (SPEC 09).
- **Sí:** flechas y WASD; `preventDefault` solo en flechas, que son las que hacen scroll.
- **No (Supuesto de la jam):** sonido. No hay assets de audio y la jam lo deja fuera por defecto.
- **No:** tortugas que se sumergen, cocodrilos, moscas bonus. Están en "Fuera de alcance" para mantener el esfuerzo bajo-medio.
- **Sí:** fin de partida por modal de plataforma, sin reinicio por tecla: toda partida pasa por el guardado de SPEC 04.
- **Sí:** alta en `public.games` por migración aplicada con el MCP tras confirmación. Sin la fila, la FK de SPEC 06 rechaza el guardado.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| React 19 Strict Mode monta efectos dos veces: dos motores y listeners duplicados | `destroy()` idempotente en el cleanup; criterio que verifica que no quedan listeners ni loops. |
| Auto-repetición del teclado convierte una pulsación larga en varios saltos | Se ignoran los `keydown` con `e.repeat`; criterio explícito. |
| La rana "salta sobre" un coche entre frames y no colisiona | El salto es de una celda y se comprueba la colisión justo después de cada salto y cada frame; con `dt ≤ 50 ms` y velocidades ≤ 308 px/s, un objeto avanza como máximo unos 15 px por frame. |
| Arrastre del río acumulado tras una pestaña oculta | Tope de `dt` de 50 ms, `resume()` reinicia `lastTime` y auto-pausa en `blur`/`visibilitychange`. |
| Desalineación entre la rejilla de saltos (múltiplos de 50) y los nenúfares tras el arrastre | Radio de captura de ±35 px y salto lateral libre para corregir; criterio de entrada en nenúfar. |
| Huecos del río demasiado grandes a alta velocidad: muertes inevitables | Huecos fijos de 140 a 300 px y tope de velocidad ×2.2; se ajustan en la tabla de carriles si las pruebas lo piden. |
| Farmear filas subiendo y bajando | `bestRow` por rana; criterio explícito. |
| `onStats` por frame provoca re-renders | Solo se llama cuando cambia score, vidas o nivel; la barra de tiempo es local al canvas. |
| Cambiar `best`/`plays` y la posición de una entrada existente rompe expectativas del catálogo | Supuestos marcados en Decisiones; criterio de diff acotado en `lib/data.ts`. |
| `/juego/ranaria` tenía ranking vacío y valores demo; jugadores confundidos | `best: 0` y `plays: "0"` alinean la ficha con el ranking real. |
| Olvidar o no aplicar la migración de `games`: el guardado falla con error genérico | Paso 3 explícito y criterio con SQL del MCP. |
| Migración aplicada directo en el proyecto remoto | Solo inserta una fila; se pide confirmación antes de aplicar. |
| Teclas del juego chocan con `P`/`Escape` de pausa | No aplica: el juego solo usa flechas y WASD. |
| El score lo reporta el cliente | Asumido en SPEC 04; anti-trampas en spec posterior. |
| Next.js 16 con convenciones distintas a las recordadas | Leer `node_modules/next/dist/docs/01-app` antes de escribir. |

---

## Lo que **no** está en este spec

- Controles táctiles, HiDPI y soporte móvil jugable.
- Sonido y música.
- Tortugas que se sumergen, cocodrilos, serpientes, moscas o ranas bonus.
- Vidas extra, temporizador variable por nivel y animación de salto.
- Portada nueva o cambios de copy, color o título de RANARIA.
- Anti-trampas y validación de scores.
- `best` y `plays` desde la base.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.
