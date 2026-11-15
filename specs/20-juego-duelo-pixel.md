# SPEC 20 — DUELO PIXEL: duelo de paletas con efecto y remate

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 05, SPEC 06, SPEC 11, SPEC 12
> **Date:** 2026-11-06
> **Objective:** Convertir la entrada demo `duelo-pixel` del catálogo en un juego real con un motor TypeScript escrito desde cero en `games/duelo-pixel/engine.ts`, montarlo en `/jugar/duelo-pixel` y darlo de alta en `public.games` para que sus partidas se guarden y aparezcan en el leaderboard.

---

## Por qué existe este spec

`duelo-pixel` es el último título de `GAMES` (`lib/data.ts`) sin motor ni trabajo en curso (CAÍDA, SERPENTINA, GLOTÓN, INVASORES y ROCAS tienen PRs abiertos, specs 15–19). Su ficha promete "dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores". Diseño desde cero, sin carpeta en `references/started-games/`.

Paleta + bola ya existe en ARKANOID (SPEC 08) y BLOQUE BUSTER (SPEC 14), pero allí la paleta es horizontal y el rival es un muro de bloques. DUELO PIXEL es un **duelo**: el rival es otra paleta que devuelve la bola, y no hay nada que romper. Para que no sea un simple "tenis de mesa" de dos rectángulos, añade **dos mecánicas centrales** propias:

1. **Efecto (curva).** La velocidad vertical de la paleta en el instante del golpe da efecto a la bola: durante el vuelo recibe una aceleración vertical que curva su trayectoria y se disipa poco a poco. Golpear quieto = tiro recto; golpear en movimiento = tiro curvo. La CPU predice la trayectoria **sin** contar el efecto, así que curvar la bola es la forma principal de ganarle puntos.
2. **Remate.** Pulsar la tecla de remate abre una ventana de 170 ms (enfriamiento 600 ms). Si la bola toca la paleta dentro de la ventana sale un 35 % más rápida y brilla; si ese remate gana el punto, vale **doble**. Exige timing, no solo posición.

Además, el modo solitario es una **escalera de rivales**: duelos a 5 puntos contra una CPU cada vez más rápida y precisa; perder un duelo cuesta una vida y obliga a repetir el mismo rival.

No usa nombres, sprites, sonidos ni layouts de juegos comerciales.

---

## Alcance

**Entra:**

- Entrada `duelo-pixel` en `GAMES` de `lib/data.ts`, **en su posición actual** (última). Se conservan `id`, `title`, `short`, `long`, `cat` (`VERSUS`), `cover` (`cover-duelo`) y `color`; `best` y `plays` pasan a `0` / `"0"` porque el ranking es real.
- Portada: se reutiliza la existente `.cover-duelo` de `app/globals.css` (paletas cian/magenta y red central: coincide con el skin `clasico`).
- `games/duelo-pixel/engine.ts`: motor nuevo que exporta `createDueloPixel: GameFactory`.
  - Sin estado de módulo mutable: todo vive dentro de la instancia.
  - Gameplay según **Reglas** (abajo).
  - El canvas **no** dibuja score, vidas, nivel, "GAME OVER" ni texto de reinicio. Sí dibuja: bandas del campo, red, marcador del duelo (puntos de cada lado con rótulos TÚ/CPU o J1/J2), paletas, bola con estela y rótulos de estado (menú de modo, `RIVAL N`, `REVANCHA`, `GANA J1/J2`).
  - `onGameOver(score)` una sola vez al terminar. Sin reinicio por tecla.
  - `onStats` al iniciar y solo cuando cambia score, vidas o nivel.
  - Colores desde tokens con `getComputedStyle(canvas)` y fallback (patrón `readPalette`), en `games/duelo-pixel/skins.ts`.
  - Teclado: `keydown`/`keyup` en `window`, por `e.code`, sin filtrar `isTrusted`; quitados en `destroy()`. `preventDefault()` solo para flechas y `Espacio`, con el motor activo. `P`/`Escape` quedan para la plataforma.
  - `pause()` detiene el loop y limpia teclas; `resume()` reinicia el tiempo de referencia; `dt` con tope de 50 ms; `end()` devuelve el score sin `onGameOver`; `destroy()` idempotente.
- `games/registry.ts`: alta de `"duelo-pixel"` con skins y `touch`.
- Migración `supabase/migrations/20261106120000_game_duelo-pixel.sql`.
- `references/implemented-games.md` y lista de specs de `CLAUDE.md`.

**Fuera de alcance:**

- Ratón. Sonido. Canvas HiDPI.
- Dos jugadores en dispositivos táctiles (el gamepad de plataforma es de un jugador).
- Ranking del modo 2 jugadores (es exhibición, ver Decisiones).
- Anti-trampas, `best`/`plays` desde la base, tests automatizados.

---

## Reglas de DUELO PIXEL

**Campo.** Canvas 800×600. Marcador arriba (y ≈ 34). Campo entre y = 72 y y = 584 con bandas de 6 px que rebotan la bola. Red central discontinua (decorativa). Paletas de 12×84 px: izquierda en x = 36, derecha en x = 752. Velocidad del jugador 520 px/s. Bola cuadrada de 10 px.

**Menú.** Al cargar, el canvas muestra `ESPACIO · 1 JUGADOR VS CPU` y `TECLA 2 · 2 JUGADORES` (`EXHIBICIÓN · NO PUNTÚA`). `Espacio` o `1` inicia el modo solitario; `2` el modo a dos jugadores.

**Saque.** La bola espera 0,9 s en el centro (parpadea) y sale hacia quien perdió el último punto (la primera, hacia el jugador) con un ángulo de ±25° elegido por el PRNG del nivel. Las paletas se pueden mover durante la espera.

**Bola.** Velocidad base `340 × min(1,5; 1 + 0,05 × (nivel − 1))` px/s. Cada golpe de paleta en el peloteo la acelera un 4 % (tope ×1,6). Ángulo de salida según el punto de impacto: ±50° respecto a la horizontal. Subpasos de ≤ 4 px para evitar tunelado.

**Efecto.** Al golpear, `efecto = clamp(velPaleta / 520, −1, 1) × 950` px/s². En vuelo, `vy += efecto × dt` (|vy| ≤ 720) y el efecto se disipa un 70 % por segundo. Al rebotar en una banda, el efecto se invierte y se reduce a la mitad.

**Remate.** Tecla de remate → ventana de 170 ms (la paleta avanza 6 px, solo visual) y enfriamiento de 600 ms. Golpe dentro de la ventana: velocidad ×1,35 para ese cruce y bola resaltada. La pulsación con auto-repetición del SO no cuenta.

**CPU (solitario).** Cuando la bola va hacia ella, tras un tiempo de reacción `max(50, 220 − 18 × (nivel − 1))` ms se mueve hacia la `y` predicha (rebotes en bandas, **sin** efecto) más un error `±max(8, 56 − 6 × (nivel − 1))` px; velocidad `min(520, 250 + 30 × (nivel − 1))` px/s. Desde el nivel 3 remata con probabilidad `min(0,4; 0,15 + 0,05 × (nivel − 3))`. Cuando la bola se aleja vuelve al centro. Su azar viene de un PRNG con semilla por nivel (mulberry32, `nivel × 7919 + 3`): mismo rival para todos.

**Duelos (solitario).** Duelo a **5** puntos. Ganarlo: bono, sube el nivel (rival nuevo, rótulo `RIVAL N`, pausa 1,8 s). Perderlo: −1 vida, se repite el mismo rival desde 0-0 (`REVANCHA`). 3 vidas; con 0 termina la partida.

**Puntuación (solitario).** Punto ganado por el jugador: `100 × nivel + 10 × min(golpes del peloteo, 20)`, **×2** si el último golpe fue un remate del jugador. Duelo ganado: `+500 × nivel + 100 × (5 − puntos de la CPU)`. Los puntos de la CPU no restan.

**Dos jugadores (exhibición).** J1 izquierda, J2 derecha. A **7** puntos, sin niveles ni vidas (el HUD muestra 3 vidas y nivel 1 fijos). Al terminar, el canvas muestra `GANA J1` / `GANA J2` y el motor llama `onGameOver(0)`: no entra al ranking.

**Controles.**

| Modo | Tecla | Acción |
| --- | --- | --- |
| Menú | `Espacio` / `1` · `2` | 1 jugador · 2 jugadores |
| Solitario | `↑` `↓` / `W` `S` (mantener) | mover paleta |
| Solitario | `Espacio` / `D` | remate |
| 2 jugadores | `W` `S` · `D` | J1 mover · remate |
| 2 jugadores | `↑` `↓` · `←` | J2 mover · remate |
| Todos | `P` / `Esc` | pausa (plataforma) |

---

## Modelo de datos

`lib/data.ts` (solo cambian `best` y `plays`):

```ts
{
  id: "duelo-pixel",
  title: "DUELO PIXEL",
  short: "Dos paletas. Una pelota. Reflejos máximos.",
  long: "El duelo más puro: dos paletas verticales …",
  cat: "VERSUS",
  cover: "cover-duelo",
  color: "cyan",
  best: 0,
  plays: "0",
}
```

Migración `supabase/migrations/20261106120000_game_duelo-pixel.sql`:

```sql
-- Alta de DUELO PIXEL en el catálogo de juegos con ranking real (SPEC 06).
insert into public.games (id, title) values ('duelo-pixel', 'DUELO PIXEL');
```

No cambia el esquema: no hace falta regenerar `lib/supabase/database.types.ts`.

Registro:

```ts
"duelo-pixel": {
  factory: createDueloPixel,
  skins: ["clasico", "neon", "retro"],
  touch: { keys: { up: "ArrowUp", down: "ArrowDown", a: "Space" }, labels: { a: "REMATE" } },
},
```

Skin `clasico`: fondo `#0a0a18` (el de la portada), bandas `--ink-faint`, red `--ink` con alfa, paleta del jugador `--cyan`, rival `--magenta`, bola `--yellow` (remate `--gold`), marcador `--ink`, rótulos `--ink-dim` en `--pixel`.

Estado interno: `mode`, `phase` (`menu` | `serve` | `playing` | `over` | `ended`), `level`, `score`, `lives`, `rng`, `paddles[2]` (`y`, `vel`, `smashMs`, `coolMs`, `points`), bola (`ballX`, `ballY`, `vx`, `vy`, `spin`, `smashed`), `lastHitter`, `lastSmashBy`, `rallyHits`, `serveMs`, `serveDir`, `banner`, `trail`, estado de la CPU, `paused`, `destroyed`, `lastTime`, `rafId`, `keys`.

---

## Plan de implementación

1. `lib/data.ts`: `best`/`plays` a 0.
2. `games/duelo-pixel/engine.ts` + `skins.ts` y alta en `games/registry.ts`.
3. Migración `supabase/migrations/20261106120000_game_duelo-pixel.sql` (aplicarla antes de mergear).
4. Etapa B: skins `neon` y `retro` (guía `skin-designer`) y luego `touch` (guía `mobile-porter`).
5. `npm run lint` y `npm run build`; prueba en navegador (desktop, skins y 390 px táctil).

---

## Criterios de aceptación

**Integración:**

- [x] `npm run build` y `npm run lint` pasan sin errores.
- [x] `GAMES` contiene `duelo-pixel` con `best: 0` y `plays: "0"`; el resto de la entrada y las demás no cambiaron.
- [x] `games/duelo-pixel/engine.ts` no declara variables de módulo mutables.
- [x] `/jugar/duelo-pixel` muestra un `<canvas>` de 800×600 y el HUD de plataforma muestra score, vidas y nivel del motor.
- [x] El canvas no dibuja score, vidas, nivel, "GAME OVER" ni texto de reinicio; ninguna tecla reinicia.
- [x] `onGameOver` se llama una sola vez; `end()` devuelve el score sin dispararlo; `destroy()` es idempotente y quita los listeners.
- [ ] `public.games` contiene la fila `duelo-pixel` (pendiente: aplicar la migración antes de mergear).
- [ ] Con sesión, GUARDAR PUNTUACIÓN inserta en `scores` con `game_id = 'duelo-pixel'` (depende de la migración).
- [x] En emulación táctil (390 px) se ve el gamepad (▲ ▼ y A `REMATE`), sin "REQUIERE TECLADO" ni scroll horizontal.
- [x] El selector muestra CLÁSICO / NEÓN / RETRO y cada skin redibuja en vivo.

**Gameplay:**

- [x] `Espacio` en el menú inicia el modo solitario; `2` el de dos jugadores.
- [x] `↑`/`↓` (y `W`/`S`) mueven la paleta mientras se mantienen.
- [x] Golpear con la paleta en movimiento curva la trayectoria de la bola.
- [x] Un remate a tiempo acelera la bola y, si gana el punto, suma el doble.
- [x] Ganar un duelo a 5 suma el bono y sube el nivel; perderlo resta una vida y repite el rival.
- [x] Con 0 vidas termina la partida.
- [x] En dos jugadores, el primero en llegar a 7 termina la partida con score 0.

---

## Decisiones

- **Sí:** el juego es `duelo-pixel`, el primer (y único) id de `GAMES` sin motor ni trabajo en curso: `caida`, `serpentina`, `gloton`, `invasores` y `rocas` tienen ramas `spec-15..19-*` y PRs abiertos.
- **Sí:** NN = 20 (máximo entre `specs/` en main = 14 y ramas remotas `spec-19-*`, +1).
- **Sí:** diseño original de duelo de paletas, diferenciado de ARKANOID y BLOQUE BUSTER (paleta horizontal contra un muro) por ser un duelo contra otra paleta, con efecto por velocidad de paleta y remate por timing. Sin nombres, sprites ni sonidos de juegos comerciales.
- **Sí:** se conserva la ficha del catálogo (id, título, `short`, `long`, `cover-duelo`, `VERSUS`, color); `best`/`plays` a 0.
- **Sí:** reutilizar `.cover-duelo`: la portada ya existe y coincide con el skin `clasico`.
- **Supuesto:** el modo a dos jugadores que promete la ficha se implementa como **exhibición** que reporta score 0. El ranking es individual y no hay forma justa de atribuir un puntaje a un jugador con sesión en una partida local compartida. Alternativa descartada: guardar los puntos de J1 (inflable con un J2 que se deja ganar).
- **Supuesto:** el modo se elige en un menú dibujado en el canvas antes del primer saque. El contrato de motor no tiene opciones de modo y no se toca la plataforma.
- **Supuesto:** en táctil solo se juega el modo solitario: A = `Espacio` sirve para empezar y para rematar. El gamepad es de un jugador; `2` no tiene botón.
- **Sí:** CPU con PRNG por nivel (misma CPU para todos: ranking justo). La CPU predice sin el efecto, a propósito: es la ventaja que el jugador aprende a usar.
- **Sí:** skins y táctil hechos en este mismo PR siguiendo `.claude/agents/skin-designer.md` y `.claude/agents/mobile-porter.md` a mano, en secuencia (corrida nocturna sin humano). En retro, la paleta rival es hueca con muescas para distinguirla de la del jugador.
- **Supuesto:** nombre de migración `20261106120000_game_duelo-pixel.sql` (formato `<timestamp>_game_<id>.sql`, con el guion del id). No se pudo aplicar: la corrida no tiene acceso a la base.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Migración sin aplicar: guardar puntaje falla por la FK de SPEC 06 | Aviso destacado en el PR; aplicar antes de mergear. |
| CPU imbatible o trivial | Parámetros por nivel en funciones (`cpuSpeedFor`, `cpuErrorFor`, `cpuReactFor`). Prueba con bot que sigue la bola y remata cerca de su paleta: gana puntos a la CPU de nivel 1 (≈1700 pts en 2 min). |
| Tunelado a velocidades altas | Subpasos ≤ 4 px. |
| Conflictos en `games/registry.ts` / `CLAUDE.md` / `implemented-games.md` con los PRs 15–19 abiertos | Cambios aditivos de una entrada; se resuelven trivialmente al mergear en orden. |
| React 19 Strict Mode monta dos motores | `destroy()` idempotente. |
| Teclas pegadas al perder foco | `pause()` limpia teclas; auto-pausa de plataforma. |

---

## Lo que **no** está en este spec

- Ratón, sonido, HiDPI.
- Ranking del modo 2 jugadores; 2 jugadores en táctil.
- Anti-trampas y validación de scores; `best`/`plays` desde la base.
- Tests automatizados.
