# SPEC 17 — GLOTÓN: laberinto procedural con espectros que ven

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 05, SPEC 06, SPEC 11, SPEC 12
> **Date:** 2026-11-03
> **Objective:** Convertir la entrada demo `gloton` del catálogo en un juego real con un motor TypeScript escrito desde cero en `games/gloton/engine.ts`, montarlo en `/jugar/gloton` y darlo de alta en `public.games` para que sus partidas se guarden y aparezcan en el leaderboard.

---

## Por qué existe este spec

`gloton` es el primer título de `GAMES` (`lib/data.ts`) sin motor ni trabajo en curso (`caida` y `serpentina` ya tienen rama y PR abiertos). Su ficha promete "un círculo glotón que patrulla un laberinto coleccionando puntos luminosos; cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles". Es un diseño desde cero, sin carpeta en `references/started-games/`.

Ningún motor de `games/` es un laberinto de persecución, pero el género tiene un referente comercial muy reconocible. Para que GLOTÓN sea **original** se descartan su laberinto fijo, sus túneles laterales, los nombres/personalidades de sus fantasmas, sus frutas y su tabla de puntos, y se construye sobre **tres mecánicas propias**:

1. **Espectros con visión (sigilo).** Los espectros **no conocen** la posición del glotón. Patrullan al azar y solo lo persiguen cuando lo **ven en línea recta** por un pasillo sin muros (alcance distinto por espectro: 12, 9, 7 y 5 casillas) o lo **huelen** a ≤ 1,5 casillas. Si lo pierden de vista van al **último punto donde lo vieron** y, al llegar sin verlo, vuelven a patrullar. Un "!" sobre el espectro avisa que te detectó. El jugador puede esconderse detrás de una esquina.
2. **Laberinto procedural por nivel.** Cada nivel genera un laberinto distinto (backtracker + "braid" sin callejones sin salida + lazos extra que crecen con el nivel) con semilla fija: todos los jugadores ven el mismo laberinto en el mismo nivel. Nido central abierto de 5×3.
3. **Píldora errante y bonus de sigilo.** La píldora no está en esquinas fijas: **aparece cada cierto tiempo** en una casilla aleatoria lejos del glotón y desaparece si no se come a tiempo. Terminar un nivel **sin que ningún espectro te haya visto** da un bonus de sigilo.

Encaja en el contrato actual sin extenderlo: canvas de 800×600, con vidas y nivel. Los skins (SPEC 11) y el mapeo táctil (SPEC 12) se hacen en el mismo PR (etapa B de `/spec-impl-game`).

---

## Alcance

**Entra:**

- Entrada `gloton` en `GAMES` de `lib/data.ts`, **en su posición actual**. Se conservan `id`, `title`, `short`, `long`, `cat` (`ARCADE`), `cover` (`cover-glot`) y `color` (`yellow`); `best` y `plays` pasan a `0` / `"0"` porque el ranking pasa a ser real.
- Portada: se reutiliza `.cover-glot` de `app/globals.css` (no se crea `.cover-gloton`).
- `games/gloton/engine.ts`: motor nuevo que exporta `createGloton: GameFactory`.
  - Sin estado de módulo mutable: todo vive dentro de la instancia.
  - Gameplay según **Reglas de GLOTÓN** (abajo).
  - El canvas **no** dibuja score, vidas, nivel, "GAME OVER" ni texto de reinicio. Sí dibuja: barra de la píldora (arriba), laberinto, marco del nido, puntos, píldora, espectros (con "!" al detectar), glotón, puntos flotantes al comer un espectro y el rótulo `LISTO` / `NIVEL n` / `SIGILO +X` durante la pausa de inicio.
  - Al terminar la partida deja de actualizar y llama `onGameOver(score)` una sola vez. Sin reinicio por tecla.
  - `onStats` al iniciar y solo cuando cambia score, vidas o nivel.
  - Colores desde tokens con `getComputedStyle(canvas)` y fallback (patrón `readPalette`), en `games/gloton/skins.ts`.
  - Teclado: `keydown` en `window`, registrado al crear y quitado en `destroy()`; por `e.code`, sin filtrar `isTrusted` ni `repeat`. `preventDefault()` solo para las flechas y solo con el motor activo. `P`/`Escape` quedan para la plataforma.
  - `pause()` detiene el loop; `resume()` reinicia el tiempo de referencia; `dt` con tope de 50 ms; `end()` devuelve el score sin `onGameOver`; `destroy()` idempotente; `setSkin()` redibuja aunque esté en pausa.
- `games/gloton/skins.ts`: `clasico` (default), `neon`, `retro`.
- `games/registry.ts`: alta de `gloton` con `skins` y `touch`.
- Migración `supabase/migrations/20261103120000_game_gloton.sql`.
- Documentación: `references/implemented-games.md` y lista de specs de `CLAUDE.md`.

**Fuera de alcance:**

- Sonido y música.
- Canvas HiDPI.
- Anti-trampas o validación server-side del score.
- `best` y `plays` calculados desde la base.
- Tests automatizados (no hay test runner).

---

## Reglas de GLOTÓN

**Tablero.** 25×17 casillas de 32 px (800×544) bajo una banda de 28 px para la barra de la píldora. Muros y pasillos de una casilla; nodos en coordenadas impares. Generación por nivel con PRNG `mulberry32(level × 7919 + 101)`:

1. Backtracker recursivo sobre los 12×8 nodos.
2. Braid: todo nodo con una sola salida abre una pared más hacia un nodo vecino (no hay callejones sin salida).
3. Lazos: cada pared interior entre dos nodos se abre con probabilidad `min(0,14, 0,06 + 0,01 × (nivel − 1))`.
4. Nido: sala abierta en x 10–14, y 7–9.

Sin túneles laterales. Hay un punto en cada casilla abierta salvo el nido y la salida del glotón (11, 15).

**Glotón.** Empieza en (11, 15) quieto. Velocidad `5,6 × min(1,25, 1 + 0,03 × (nivel − 1))` casillas/s. Movimiento por casillas con interpolación: la última dirección pulsada queda en cola y se toma en el primer cruce donde sea posible; si no, sigue recto; contra un muro se detiene. Dar la vuelta es inmediato, incluso a mitad de casilla.

**Espectros.** 4, salen del nido escalonados (0,6 s, 2,6 s, 4,6 s, 6,6 s). Velocidad base `4,6 × min(1,45, 1 + 0,06 × (nivel − 1))`. En cada cruce nunca dan media vuelta salvo que no haya otra salida.

- **Patrulla:** 60 % sigue recto si puede; si no, salida al azar.
- **Detección:** lo ve si está en la misma fila o columna, a ≤ alcance (12 / 9 / 7 / 5 casillas) y sin muros en medio; o a ≤ 1,5 casillas (olfato). Al detectar: "!" durante 0,7 s y pupilas en color de alerta.
- **Caza:** se mueve hacia el último punto donde lo vio (ruta más corta por BFS) a velocidad ×1,1; mientras lo ve, ese punto se actualiza. Al llegar sin verlo, vuelve a patrullar.
- **Asustado** (píldora): da media vuelta al instante, huye maximizando la distancia BFS al glotón, velocidad ×0,55, parpadea el último 1,5 s. Ignora al glotón.
- **Ojos** (comido): vuelve al centro del nido a 9 casillas/s, espera 1 s y sale de nuevo normal.

**Píldora.** La primera aparece a los 10 s del inicio de cada vida/nivel; luego 14 s después de comida o desaparecida (nunca mientras dura el susto). Casilla aleatoria abierta, fuera del nido y a ≥ 8 pasos del glotón. Dura 8 s (parpadea los últimos 2 s). Comerla: +50 y susto de `max(3, 6,5 − 0,4 × (nivel − 1))` s. La barra superior muestra el tiempo de la píldora en el tablero o el del susto.

**Choques** (distancia < 0,7 casillas): espectro asustado → se come (`150 × n`, n = espectros comidos con esa píldora) y queda en ojos. Espectro normal o en el nido → el glotón muere (animación 1,1 s), −1 vida, todos vuelven a su salida, los puntos comidos se conservan, `LISTO` 1,5 s. Sin vidas → fin de partida.

**Nivel.** Comer todos los puntos: `+500 × nivel` y, si ningún espectro te vio en todo el nivel, `+300 × nivel` de sigilo (rótulo `SIGILO +X`). Sube el nivel con un laberinto nuevo.

**Puntuación:** punto 10 · píldora 50 · espectro 150 × n · nivel 500 × nivel · sigilo 300 × nivel. Tres vidas.

**Controles:** flechas o `WASD`. Táctil: D-pad (simula flechas), sin A/B.

---

## Modelo de datos

Entrada en `GAMES` (`lib/data.ts`), solo cambian `best` y `plays`:

```ts
{
  id: "gloton",
  title: "GLOTÓN",
  short: "Devora puntos y escapa de los fantasmas.",
  long: "Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.",
  cat: "ARCADE",
  cover: "cover-glot",
  color: "yellow",
  best: 0,
  plays: "0",
}
```

Migración `supabase/migrations/20261103120000_game_gloton.sql`:

```sql
-- Alta de GLOTÓN en el catálogo de juegos con ranking real (SPEC 06).
insert into public.games (id, title) values ('gloton', 'GLOTÓN');
```

Registro:

```ts
gloton: {
  factory: createGloton,
  skins: ["clasico", "neon", "retro"],
  touch: { keys: { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" } },
},
```

Estado interno del motor: `grid`, `dots`, `dotsLeft`, `player` (casilla base + dirección + avance), `desired`, `spectres[]` (modo, espera, visión, susto, `lastSeen`, `alertMs`), `pill`, `pillSpawnMs`, `frightMs`, `chain`, `detected`, `score`, `lives`, `level`, `phase` (`ready` | `playing` | `dying` | `over` | `ended`), `paused`, `lastTime`, `rafId`, `rnd`, caché BFS por frame.

---

## Plan de implementación

1. `lib/data.ts`: `best`/`plays` a 0 en `gloton`.
2. `games/gloton/skins.ts` y `games/gloton/engine.ts`; alta en `games/registry.ts` con `skins` y `touch`.
3. Migración `supabase/migrations/20261103120000_game_gloton.sql` (aplicarla antes de mergear).
4. `references/implemented-games.md` y `CLAUDE.md`.
5. `npm run lint`, `npm run build` y prueba con Playwright (desktop, skins, pausa, móvil táctil).

---

## Criterios de aceptación

**Integración:**

- [x] `npm run build` y `npm run lint` pasan sin errores.
- [x] `GAMES` contiene `gloton` con los valores del Modelo de datos; las demás entradas no cambiaron.
- [x] Existe `games/gloton/engine.ts` y no declara variables de módulo mutables.
- [x] En `/jugar/gloton` hay un `<canvas>` dentro de `.crt-screen` y no existe `.game-arena`.
- [x] El HUD de plataforma muestra score, vidas y nivel del motor; el canvas no los dibuja ni muestra "GAME OVER".
- [x] Al perder las 3 vidas se abre el modal FIN DEL JUEGO con el score final.
- [x] PAUSA congela el canvas (dos capturas separadas por 1 s idénticas).
- [x] Los 3 skins se aplican en vivo desde el selector.
- [x] En emulación móvil táctil (390 px) aparece el gamepad (no "REQUIERE TECLADO"), el D-pad mueve al glotón y no hay scroll horizontal.
- [x] Sin errores en consola durante una partida.
- [ ] `public.games` contiene la fila `gloton` / `GLOTÓN` (pendiente: aplicar la migración).
- [ ] Con sesión, GUARDAR PUNTUACIÓN inserta en `scores` con `game_id = 'gloton'` (depende de la migración).

**Gameplay:**

- [x] Flechas / `WASD` mueven al glotón con dirección en cola; media vuelta inmediata.
- [x] Cada punto suma 10; el laberinto cambia de nivel a nivel y es igual para la misma semilla.
- [x] Los espectros salen del nido escalonados, patrullan y solo persiguen al ver al glotón (con "!").
- [x] La píldora aparece en lugares distintos, desaparece si no se come y asusta a los espectros.
- [x] Comer espectros asustados suma 150 × n y los convierte en ojos que vuelven al nido.
- [x] Completar un nivel sin ser visto suma el bonus de sigilo.

---

## Decisiones

- **Sí:** el juego a implementar es `gloton`: primer id de `GAMES` sin entrada en `ENGINES`, descartando `caida` (PR #19) y `serpentina` (PR #20), que ya tienen trabajo en curso.
- **Sí:** diseño original: visión en línea recta + último punto visto, laberinto procedural, píldora errante y bonus de sigilo. Sin laberinto fijo, túneles, nombres ni personalidades de fantasmas, frutas ni tabla de puntos 200/400/800/1600 de ningún juego comercial. Los espectros son rombos con "cola" en dientes, no la silueta clásica de fantasma.
- **Sí:** se conserva la ficha del catálogo (id, título, copy, `cover-glot`, color); `best`/`plays` a 0.
- **Sí:** reutilizar `.cover-glot`: la portada ya existe y representa el juego.
- **Sí:** semilla fija por nivel para el laberinto (ranking justo). El azar de patrulla y la ubicación de la píldora usan un PRNG con semilla por nivel; la secuencia depende del ritmo de juego, así que no es una "ruta" memorizable.
- **Sí:** espectros en el nido también matan al tocarlos (el glotón puede entrar al nido, pero es peligroso).
- **Sí:** entrada por pulsación con dirección en cola (no hace falta mantener): encaja con el D-pad táctil sin `repeat`.
- **Sí:** skins y táctil hechos en este mismo PR siguiendo `.claude/agents/skin-designer.md` y `.claude/agents/mobile-porter.md` (corrida nocturna sin humano; se diseñaron junto al motor para no tener que extraer la paleta después). En retro los espectros comparten tono y se distinguen del glotón por la forma; el espectro asustado se dibuja hueco.
- **Supuesto:** nombre de migración `20261103120000_game_gloton.sql`. No se pudo aplicar: la corrida no tiene acceso a la base.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Parecerse demasiado a un juego comercial | Mecánicas propias (visión, laberinto procedural, píldora errante, sigilo), formas y puntuación propias. |
| Laberinto sin salida o desconectado | Backtracker garantiza conexión; braid elimina callejones. |
| Dificultad: espectros más rápidos que el glotón en niveles altos | Topes de velocidad; la visión limitada permite esconderse. |
| React 19 Strict Mode monta dos motores | `destroy()` idempotente quita listener y rAF. |
| Migración sin aplicar: guardar falla por FK | Aviso destacado en el PR. |

---

## Lo que **no** está en este spec

- Sonido, HiDPI, anti-trampas, `best`/`plays` desde la base, tests automatizados.
