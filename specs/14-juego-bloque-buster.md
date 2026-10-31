# SPEC 14 — BLOQUE BUSTER: núcleo cromático contra un muro que desciende

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 05, SPEC 06, SPEC 11, SPEC 12
> **Date:** 2026-10-31
> **Objective:** Convertir la entrada demo `bloque-buster` del catálogo en un juego real con un motor TypeScript escrito desde cero en `games/bloque-buster/engine.ts`, montarlo en `/jugar/bloque-buster` y darlo de alta en `public.games` para que sus partidas se guarden y aparezcan en el leaderboard.

---

## Por qué existe este spec

`bloque-buster` es el primer título del catálogo (`lib/data.ts`) que todavía corre la arena simulada. Su ficha promete "una nave-paleta que rebota un núcleo de plasma para pulverizar muros de bloques cromáticos" y que "cada nivel reorganiza la grilla en patrones imposibles". Es un diseño desde cero, sin carpeta en `references/started-games/`.

El género (paleta + bola + muro) ya está cubierto por ARKANOID (SPEC 08): ahí cada golpe rompe el ladrillo tocado, los cinco muros son fijos y el único peligro es dejar caer la pelota. BLOQUE BUSTER se diferencia con **dos mecánicas centrales** que cambian por completo cómo se juega:

1. **Núcleo cromático (carga de color + cascada).** La bola lleva un color. Solo rompe bloques de **su mismo color**, y al hacerlo pulveriza **todo el grupo conectado** (4 vecinos) de ese color de una vez. Tocar un bloque de otro color **no lo rompe**: la bola rebota y **adopta** ese color. El jugador apunta en dos tiempos: primero "cargar" el color que le conviene y luego lanzarse contra el grupo más grande de ese color.
2. **Muro descendente.** El muro tiene 16 filas pero solo 7 son visibles al empezar; cada pocos segundos baja una fila y entra una nueva por arriba. Si el muro cruza la **línea de peligro**, se pierde una vida. La presión no viene solo de la bola: viene del tiempo.

Además los muros son **procedurales y deterministas** (PRNG con semilla por nivel): cuatro patrones base que rotan, colores barajados, ruido y huecos crecientes. No hay layouts fijos ni ladrillos especiales de ningún juego comercial.

Encaja en el contrato actual sin extenderlo: canvas de 800×600, con vidas y nivel. Los skins (SPEC 11) y el mapeo táctil (SPEC 12) se agregan en la etapa B de `/spec-impl-game`.

---

## Alcance

**Entra:**

- Entrada `bloque-buster` en `GAMES` de `lib/data.ts`, **en su posición actual** (índice 6). Se conservan `id`, `title`, `short`, `long`, `cat`, `cover` (`cover-bricks`) y `color`; `best` y `plays` pasan a `0` / `"0"` porque ahora el ranking es real (mismo criterio que RANARIA, SPEC 10).
- Portada: se reutiliza la existente `.cover-bricks` de `app/globals.css` (no se crea `.cover-bloque-buster`).
- `games/bloque-buster/engine.ts`: motor nuevo que exporta `createBloqueBuster: GameFactory`.
  - Sin estado de módulo mutable: todo vive dentro de la instancia.
  - Gameplay según **Reglas de BLOQUE BUSTER** (abajo).
  - El canvas **no** dibuja score, vidas, nivel, "GAME OVER" ni texto de reinicio. Sí dibuja: marco del campo, barra de tiempo hasta el próximo descenso, línea de peligro, muro, destellos, nave con indicador de carga, bola y el rótulo `ESPACIO PARA LANZAR` mientras la bola espera en la nave.
  - Al terminar la partida deja de actualizar y llama `onGameOver(score)` una sola vez. No hay reinicio por tecla.
  - `onStats` al iniciar y solo cuando cambia score, vidas o nivel.
  - Colores desde tokens con `getComputedStyle(canvas)` y fallback (patrón `readPalette`), en `games/bloque-buster/skins.ts`.
  - Teclado: `keydown`/`keyup` en `window`, registrados al crear y quitados en `destroy()`; por `e.code`, sin filtrar `isTrusted`. `preventDefault()` solo para `←` `→` `↑` `Espacio` y solo con el motor activo. `P`/`Escape` quedan para la plataforma.
  - `pause()` detiene el loop y limpia las teclas mantenidas; `resume()` reinicia el tiempo de referencia; `dt` con tope de 50 ms; `end()` devuelve el score sin `onGameOver`; `destroy()` idempotente.
- `games/registry.ts`: alta de `"bloque-buster"`.
- Migración `supabase/migrations/20261031130000_game_bloque-buster.sql` con la fila de `public.games`.
- `references/implemented-games.md` y la lista de specs de `CLAUDE.md`.

**Fuera de alcance:**

- Control con ratón (ARKANOID lo tiene; aquí solo teclado / gamepad táctil).
- Power-ups, bloques indestructibles, gravedad de bloques sueltos.
- Sonido y música. Canvas HiDPI.
- Anti-trampas, `best`/`plays` desde la base, tests automatizados.

---

## Reglas de BLOQUE BUSTER

**Campo.** Canvas 800×600. Campo de juego entre x = 40 y x = 760 (720 px), techo en y = 24. Muro de 12 columnas × 16 filas, bloques de 60×22 px. Línea de peligro en y = 470. Nave (paleta) de 112×14 px en y = 556.

**Muro.** Se genera por nivel con un PRNG determinista (mulberry32, semilla `nivel × 9973 + 17`):

- Patrón base según `(nivel − 1) mod 4`: franjas diagonales, ajedrez 2×2 en bandas, anillos concéntricos, zigzag.
- Los 4 colores se barajan por nivel.
- Huecos: 5 % + 1 %/nivel (tope 15 %). Ruido (color aleatorio): 8 % + 2 %/nivel (tope 25 %).
- Al empezar el nivel solo se ven las 7 filas inferiores; las otras 9 están ocultas encima del techo, no colisionan y entran al descender.

**Bola (núcleo).** Radio 7 px. Velocidad `380 × min(1,6; 1 + 0,06 × (nivel − 1))` px/s. Cada saque arranca con la carga del color más frecuente entre los bloques visibles.

- Toca un bloque **de su color** → se destruye **el grupo conectado** (4 vecinos, solo bloques visibles) de ese color; rebota.
- Toca un bloque **de otro color** → el bloque no se rompe; la bola rebota y **adopta** ese color (destello blanco).
- Paredes laterales y techo: rebote. Nave: el ángulo de salida depende del punto de impacto (±60° respecto a la vertical).
- Si la bola cae por debajo del canvas → −1 vida y nuevo saque.

**Saque.** La bola espera sobre la nave (que se puede mover). `Espacio` / `↑` / `W` la lanza a 20° hacia el último lado al que se movió la nave. Mientras espera, el muro no baja.

**Descenso.** Cada `max(4; 10 − 0,75 × (nivel − 1))` s el muro baja una fila. Si no quedan bloques visibles pero sí ocultos, baja de inmediato. Si tras bajar la fila más baja cruza la línea de peligro: **brecha** → se retiran las 3 filas inferiores ocupadas (sin puntos), la línea parpadea, −1 vida y nuevo saque. Si el muro baja sobre la bola, esta queda justo debajo y sale hacia abajo.

**Niveles.** Cuando no queda ningún bloque (visible ni oculto): +500 × nivel, sube el nivel, muro nuevo, nuevo saque.

**Vidas.** 3. Con 0 vidas termina la partida.

**Puntuación.** Romper un grupo de `n` bloques suma `10 × n × min(n, 10)` (grupo de 1 = 10, de 3 = 90, de 10+ = 100 por bloque). Nivel completo: +500 × nivel.

**Indicadores en canvas.** Barra de descenso arriba (dorada; magenta en los últimos 2 s). Línea de peligro discontinua (se ilumina con el muro a ≤ 2 filas o durante la brecha). La carga actual se ve en el color de la bola y en un mini bloque en el centro de la nave.

**Controles.**

| Tecla | Acción |
| --- | --- |
| `←` `→` / `A` `D` (mantener) | mover la nave |
| `Espacio` / `↑` / `W` | lanzar la bola |
| `P` / `Esc` | pausa (plataforma) |

---

## Modelo de datos

`lib/data.ts` (solo cambian `best` y `plays`):

```ts
{
  id: "bloque-buster",
  title: "BLOQUE BUSTER",
  short: "Rebota la pelota y destruye muros de neón.",
  long: "Pilota una nave-paleta y rebota un núcleo de plasma …",
  cat: "ARCADE",
  cover: "cover-bricks",
  color: "cyan",
  best: 0,
  plays: "0",
}
```

Migración `supabase/migrations/20261031130000_game_bloque-buster.sql`:

```sql
-- Alta de BLOQUE BUSTER en el catálogo de juegos con ranking real (SPEC 06).
insert into public.games (id, title) values ('bloque-buster', 'BLOQUE BUSTER');
```

No cambia el esquema: no hace falta regenerar `lib/supabase/database.types.ts`.

Registro:

```ts
"bloque-buster": {
  factory: createBloqueBuster,
  skins: ["clasico", "neon", "retro"],
  touch: { keys: { left: "ArrowLeft", right: "ArrowRight", a: "Space" }, labels: { a: "LANZAR" } },
},
```

Mapeo de colores (skin `clasico`): bloques `--cyan` / `--magenta` / `--yellow` / `--green` con franja inferior oscura; nave `--silver` con borde `--ink-dim`; marco `--ink-faint`; barra de descenso `--gold` (aviso `--magenta`); línea de peligro `--magenta` con alfa; rótulo `--ink-dim` en `--pixel`. Fondo `#000`.

Estado interno del motor: `grid` (`Int8Array` 16×12, −1 = vacío), `shift`, `descentMs`, `paddleX`, `lastDir`, bola (`ballX`, `ballY`, `vx`, `vy`, `charge`), `score`, `lives`, `level`, `phase` (`serve` | `playing` | `over` | `ended`), `paused`, `destroyed`, `lastTime`, `rafId`, `keys`, `sparks`, `breachMs`.

---

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app` (client components / efectos). `lib/data.ts`: `best`/`plays` a 0.
2. `games/bloque-buster/engine.ts` + `skins.ts` (clasico) y alta en `games/registry.ts`.
3. Migración `supabase/migrations/20261031130000_game_bloque-buster.sql` (aplicarla antes de mergear).
4. Etapa B: `skin-designer` (neon, retro) y luego `mobile-porter` (`touch`).
5. `npm run lint` y `npm run build`; prueba en navegador (desktop, skins y 390 px táctil).

---

## Criterios de aceptación

**Integración:**

- [x] `npm run build` y `npm run lint` pasan sin errores.
- [x] `GAMES` contiene `bloque-buster` con `best: 0` y `plays: "0"`; el resto de la entrada y las demás entradas no cambiaron.
- [x] Existe `games/bloque-buster/engine.ts` y no declara variables de módulo mutables.
- [x] En `/jugar/bloque-buster` hay un `<canvas>` de 800×600 y el HUD de plataforma muestra score, vidas y nivel del motor.
- [x] El canvas no dibuja score, vidas, nivel, "GAME OVER" ni texto de reinicio; ninguna tecla reinicia.
- [x] Al llegar a 0 vidas se llama `onGameOver` una sola vez; `end()` devuelve el score sin dispararlo; `destroy()` es idempotente y quita los listeners.
- [ ] `public.games` contiene la fila `bloque-buster` (pendiente: aplicar la migración antes de mergear).
- [ ] Con sesión, GUARDAR PUNTUACIÓN inserta en `scores` con `game_id = 'bloque-buster'` (depende de la migración).
- [x] En emulación táctil (390 px) se muestra el gamepad con ◀ ▶ y A `LANZAR`, sin "REQUIERE TECLADO" ni scroll horizontal.
- [x] El selector muestra CLÁSICO / NEÓN / RETRO y cada skin redibuja en vivo.

**Gameplay:**

- [x] `←`/`→` (y `A`/`D`) mueven la nave mientras se mantienen; `Espacio`/`↑`/`W` lanzan la bola desde la nave.
- [x] Una bola tocando un bloque de otro color no lo rompe y adopta su color.
- [x] Una bola tocando un bloque de su color destruye el grupo conectado y suma `10 × n × min(n, 10)`.
- [x] El muro baja una fila según el intervalo del nivel y no baja mientras la bola espera en la nave.
- [x] Si el muro cruza la línea de peligro se pierde una vida y se retiran las 3 filas inferiores ocupadas.
- [x] Perder la bola resta una vida; con 0 vidas termina la partida.
- [x] Vaciar el muro suma +500 × nivel y sube el nivel con un muro distinto.

---

## Decisiones

- **Sí:** el juego a implementar es `bloque-buster`, el primer id de `GAMES` sin motor ni trabajo en curso (sin ramas remotas ni PRs abiertos con ese id).
- **Sí:** diseño original diferenciado de ARKANOID por la carga de color + cascada y el muro descendente. Sin nombres, sprites, layouts ni personajes de juegos comerciales.
- **Sí:** se conserva la ficha del catálogo (id, título, `short`, `long`, `cover-bricks`, color); `best`/`plays` a 0 porque el ranking pasa a ser real.
- **Sí:** reutilizar `.cover-bricks` en vez de crear `.cover-bloque-buster`: la portada ya existe y representa el juego.
- **Sí:** muros procedurales con semilla fija: todos los jugadores ven el mismo muro en el mismo nivel (ranking justo).
- **Sí:** la cascada solo recorre bloques visibles, para que el jugador vea lo que rompe.
- **Sí:** la brecha resta vida y retira 3 filas (no termina la partida de golpe): castiga sin frustrar.
- **No:** control con ratón. Mantiene el motor simple y alineado con el gamepad táctil.
- **Sí:** skins y táctil hechos en este mismo PR siguiendo `.claude/agents/skin-designer.md` y `.claude/agents/mobile-porter.md` (corrida nocturna sin humano). Retro distingue los 4 colores también por patrón (sólido, puntos, hueco, rayas).
- **Supuesto:** nombre de migración `20261031130000_game_bloque-buster.sql` (formato `<timestamp>_game_<id>.sql`, conserva el guion del id). No se pudo aplicar: la corrida no tiene acceso a la base.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Migración sin aplicar: guardar puntaje falla por la FK de SPEC 06 | Aviso destacado en el PR; aplicar antes de mergear. |
| Tunelado de la bola a 60 fps contra bloques de 22 px | Subpasos de movimiento ≤ 0,8 × radio. |
| Muro demasiado rápido o lento | Simulación con bot: un bot que sigue la bola sin apuntar completa el nivel 1 en ~4 min y pierde por brechas en el nivel 2. Ajustable en `descentFor`. |
| React 19 Strict Mode monta dos motores | `destroy()` idempotente; verificado que no quedan listeners. |
| Teclas pegadas al perder foco | `pause()` limpia teclas; auto-pausa de plataforma. |

---

## Lo que **no** está en este spec

- Ratón, power-ups, sonido, HiDPI.
- Anti-trampas y validación de scores; `best`/`plays` desde la base.
- Tests automatizados.
