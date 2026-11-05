# SPEC 19 — ROCAS: propulsión por retroceso y fragmentos que se re-fusionan

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 05, SPEC 06, SPEC 11, SPEC 12
> **Date:** 2026-11-05
> **Objective:** Convertir la entrada demo `rocas` del catálogo en un juego real con un motor TypeScript escrito desde cero en `games/rocas/engine.ts`, montarlo en `/jugar/rocas` y darlo de alta en `public.games` para que sus partidas se guarden y aparezcan en el leaderboard.

---

## Por qué existe este spec

`rocas` es el primer título del catálogo (`lib/data.ts`) que todavía corre la arena simulada y no tiene trabajo en curso (CAÍDA, SERPENTINA, GLOTÓN e INVASORES ya tienen rama y PR abiertos). Su ficha promete "una nave triangular que flota en vacío absoluto", que "dispara y rota para dividir rocas en fragmentos cada vez más pequeños" y "OVNIs en el horizonte". Es un diseño desde cero, sin carpeta en `references/started-games/`.

El género (nave que rota y parte rocas) ya está cubierto por ASTEROIDES (SPEC 05): ahí la nave se impulsa con un propulsor (`↑`), el campo no tiene bordes (lo que sale por un lado entra por el otro), los fragmentos son independientes y hay un power-up de disparo triple. ROCAS se diferencia con **dos mecánicas centrales** que cambian cómo se juega:

1. **Propulsión por retroceso.** La nave **no tiene propulsor**. La única forma de moverse es disparar: cada disparo empuja la nave en sentido contrario al cañón. Para huir hay que disparar hacia el lado opuesto; para quedarse quieto hay que frenar (`↓`, deceleración lenta). Apuntar y moverse son la misma decisión.
2. **Fragmentos que se re-fusionan.** Al partir una roca, sus dos fragmentos quedan **enlazados** (hermanos). Pasados 4 s, si ambos siguen vivos, una atracción los acerca (se ve un cable de energía entre ellos) y, si se tocan, **se vuelven a fundir** en la roca del tamaño anterior, sin puntos. Destruir a los dos hermanos con menos de 1,5 s de diferencia da un bonus **PAR**. La presión no es solo esquivar: es limpiar fragmentos antes de que el campo se rearme.

Además el campo es una **arena cerrada**: nave, rocas y OVNIs rebotan en las paredes (no hay envoltura de bordes). Los OVNIs cruzan por la franja superior ("el horizonte") disparando hacia la nave. No se usan nombres, sprites ni layouts de ningún juego comercial.

Encaja en el contrato actual sin extenderlo: canvas de 800×600, con vidas y nivel. Los skins (SPEC 11) y el mapeo táctil (SPEC 12) se agregan en la etapa B de `/spec-impl-game`.

---

## Alcance

**Entra:**

- Entrada `rocas` en `GAMES` de `lib/data.ts`, **en su posición actual**. Se conservan `id`, `title`, `short`, `long`, `cat` (`SHOOTER`), `cover` (`cover-rocas`) y `color`; `best` y `plays` pasan a `0` / `"0"` porque ahora el ranking es real (mismo criterio que SPEC 10 y 14).
- Portada: se reutiliza la existente `.cover-rocas` de `app/globals.css` (no se crea otra).
- `games/rocas/engine.ts`: motor nuevo que exporta `createRocas: GameFactory`.
  - Sin estado de módulo mutable: todo vive dentro de la instancia.
  - Gameplay según **Reglas de ROCAS** (abajo).
  - El canvas **no** dibuja score, vidas, nivel, "GAME OVER" ni texto de reinicio. Sí dibuja: fondo estrellado, paredes de la arena, rocas, cables de fusión, nave (parpadeando mientras es invulnerable), balas, OVNI y sus balas, restos de explosiones, destellos de fusión y el rótulo flotante `PAR +N` al conseguir el bonus.
  - Al terminar la partida deja de actualizar y llama `onGameOver(score)` una sola vez. No hay reinicio por tecla.
  - `onStats` al iniciar y solo cuando cambia score, vidas o nivel.
  - Colores desde tokens con `getComputedStyle(canvas)` y fallback (patrón `readPalette`), en `games/rocas/skins.ts`.
  - Teclado: `keydown`/`keyup` en `window`, registrados al crear y quitados en `destroy()`; por `e.code`, sin filtrar `isTrusted` ni `repeat`. `preventDefault()` solo para flechas y `Espacio`, y solo con el motor activo. `P`/`Escape` quedan para la plataforma.
  - `pause()` detiene el loop y limpia las teclas mantenidas; `resume()` reinicia el tiempo de referencia; `dt` con tope de 50 ms; `end()` devuelve el score sin `onGameOver`; `destroy()` idempotente.
- `games/rocas/skins.ts`: skins `clasico` (default), `neon` y `retro`.
- `games/registry.ts`: alta de `rocas` con `skins` y `touch`.
- Migración `supabase/migrations/20261105120000_game_rocas.sql` con la fila de `public.games` (aplicarla antes de mergear).
- `references/implemented-games.md` y la lista de specs de `CLAUDE.md`.

**Fuera de alcance:**

- Control con ratón. Sonido y música. Canvas HiDPI.
- Power-ups (ASTEROIDES ya tiene el disparo triple; aquí no hay).
- Colisiones roca-roca salvo la fusión entre hermanos.
- Anti-trampas, `best`/`plays` desde la base, tests automatizados.

---

## Reglas de ROCAS

**Arena.** Canvas 800×600. Paredes a 6 px del borde. Todo lo que choca con una pared rebota (la nave con restitución 0,7). Fondo de ~90 estrellas fijas generadas por instancia.

**Nave.** Triángulo de radio 12 (colisión 10) que empieza en el centro apuntando arriba.

- `←` `→` / `A` `D` (mantener): rota a 3,6 rad/s.
- `Espacio` (mantener): dispara cada 170 ms. Bala a 540 px/s, vive 1 s, desaparece al tocar una pared; máximo 8 balas en pantalla.
- **Retroceso:** cada disparo suma 42 px/s a la velocidad de la nave en sentido contrario al cañón (velocidad máxima 300 px/s).
- `↓` / `S` (mantener): freno, deceleración de 220 px/s².
- Rozamiento casi nulo (la velocidad decae un 8 % por segundo): la nave flota.

**Rocas.** Tres tamaños: grande (radio 44), mediana (26), pequeña (14). Velocidad base 45 / 70 / 100 px/s × `min(1,8; 1 + 0,08 × (nivel − 1))`. Contorno irregular de 10 vértices, giran sobre sí mismas.

- Una bala que toca una roca la destruye. Grande y mediana se parten en **dos fragmentos hermanos** del tamaño siguiente, que salen en direcciones perpendiculares al disparo. La pequeña se pulveriza.
- **Fusión:** desde los 2,5 s de vida de un par de hermanos se ve un cable punteado entre ellos (aviso); a partir de los 4 s se atraen a 70 px/s² (cable continuo) y si se acercan a menos de `0,7 × (r1 + r2)` se funden en una roca del tamaño anterior, en el punto medio, con la velocidad promedio y sin hermano. La fusión no suma ni resta puntos.
- Destruir un fragmento rompe el enlace con su hermano. Si el hermano se destruye antes de 1,5 s → bonus **PAR**.

**OVNI.** Desde el nivel 2. Aparece cada `max(8; 14 − 0,8 × (nivel − 2)) + aleatorio(0..6)` s por un costado, en la franja superior (y entre 40 y 80), cruza a 120 px/s y sale por el otro lado. Dispara cada 1,5 s una bala dirigida a la nave (±0,15 rad de error) a 260 px/s que vive 2,5 s y atraviesa las rocas. Tocar el OVNI o sus balas mata a la nave. Solo hay un OVNI a la vez.

**Vidas.** 3. La nave muere al tocar una roca, el OVNI o una bala del OVNI. Tras 0,9 s de explosión reaparece en el centro, quieta, apuntando arriba, invulnerable (parpadeando) 2,5 s. Con 0 vidas termina la partida.

**Niveles.** La oleada del nivel `n` tiene `min(9; 2 + n)` rocas grandes que aparecen junto a las paredes, a más de 200 px de la nave. Al no quedar rocas, tras 1,2 s sube el nivel y entra la oleada siguiente (el OVNI, si está, sigue su cruce).

**Puntuación.**

| Evento | Puntos |
| --- | --- |
| Roca grande | 10 |
| Roca mediana | 30 |
| Roca pequeña | 60 |
| PAR de medianas (ambas en ≤ 1,5 s) | +100 |
| PAR de pequeñas (ambas en ≤ 1,5 s) | +200 |
| OVNI | 300 |

**Controles.**

| Tecla | Acción |
| --- | --- |
| `←` `→` / `A` `D` (mantener) | rotar |
| `Espacio` (mantener) | disparar (y moverse por retroceso) |
| `↓` / `S` (mantener) | frenar |
| `P` / `Esc` | pausa (plataforma) |

---

## Modelo de datos

`lib/data.ts` (solo cambian `best` y `plays`):

```ts
{
  id: "rocas",
  title: "ROCAS",
  short: "Pulveriza asteroides en gravedad cero.",
  long: "Tu nave triangular flota en vacío absoluto. …",
  cat: "SHOOTER",
  cover: "cover-rocas",
  color: "yellow",
  best: 0,
  plays: "0",
}
```

Migración `supabase/migrations/20261105120000_game_rocas.sql`:

```sql
-- Alta de ROCAS en el catálogo de juegos con ranking real (SPEC 06).
insert into public.games (id, title) values ('rocas', 'ROCAS');
```

No cambia el esquema: no hace falta regenerar `lib/supabase/database.types.ts`.

Registro:

```ts
rocas: {
  factory: createRocas,
  skins: ["clasico", "neon", "retro"],
  touch: {
    keys: { left: "ArrowLeft", right: "ArrowRight", down: "ArrowDown", a: "Space", b: "KeyS" },
    labels: { a: "DISPARO", b: "FRENO" },
  },
},
```

Mapeo de colores (skin `clasico`): nave `--ink`; balas `--yellow`; rocas contorno `--silver` con relleno oscuro; cables de fusión `--cyan`; OVNI y sus balas `--magenta`; restos `--silver`; rótulo PAR `--gold` en `--pixel`; paredes y estrellas `--ink-faint`. Fondo `#000`.

Estado interno del motor: `ship` (`x`, `y`, `vx`, `vy`, `angle`), `invulnMs`, `fireMs`, `bullets`, `rocks` (`id`, `x`, `y`, `vx`, `vy`, `size`, `angle`, `spin`, `shape`, `siblingId`, `age`, `pairDeadAt`), `ufo`, `ufoBullets`, `debris`, `flashes`, `popups`, `clock`, `waveMs`, `ufoMs`, `dyingMs`, `score`, `lives`, `level`, `phase` (`playing` | `dying` | `over` | `ended`), `paused`, `destroyed`, `lastTime`, `rafId`, `keys`.

---

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app` (client components / efectos). `lib/data.ts`: `best`/`plays` a 0.
2. `games/rocas/engine.ts` + `skins.ts` (clasico) y alta en `games/registry.ts`.
3. Migración `supabase/migrations/20261105120000_game_rocas.sql` (aplicarla antes de mergear).
4. Etapa B: skins `neon` y `retro` (trabajo de `skin-designer`) y luego mapeo `touch` (trabajo de `mobile-porter`).
5. `npm run lint` y `npm run build`; prueba en navegador headless (partida, pausa, skins).

---

## Criterios de aceptación

**Integración:**

- [x] `npm run build` y `npm run lint` pasan sin errores.
- [x] `GAMES` contiene `rocas` con los valores del Modelo de datos; las demás entradas no cambiaron.
- [x] La tarjeta ROCAS aparece en `/juegos` (filtro SHOOTER), como pestaña en `/salon` y en `/juego/rocas`, con la portada `.cover-rocas`.
- [x] Existe `games/rocas/engine.ts` y no declara variables de módulo mutables.
- [x] En `/jugar/rocas` hay un `<canvas>` de 800×600 dentro de `.crt-screen` y no existe `.game-arena`.
- [x] El HUD de plataforma muestra score, vidas y nivel reales del motor.
- [x] El canvas no dibuja score, vidas ni nivel; no muestra "GAME OVER" ni texto de reinicio, y ninguna tecla reinicia la partida.
- [x] Al terminar la partida se llama `onGameOver` una sola vez y se abre el modal FIN DEL JUEGO.
- [x] `end()` detiene el juego y devuelve el score actual sin `onGameOver`.
- [x] PAUSA congela el canvas y REANUDAR continúa sin salto; `P` y `Escape` no los maneja el motor.
- [x] Con el juego activo, flechas y `Espacio` no hacen scroll; en pausa o con el modal abierto no son interceptadas.
- [x] `destroy()` cancela el `requestAnimationFrame` y quita los listeners; es idempotente.
- [x] Los elementos del juego usan los tokens indicados (skin `clasico`).
- [ ] `public.games` contiene la fila `rocas` / `ROCAS` (**pendiente: aplicar la migración antes de mergear**; sin acceso a la DB en esta corrida).
- [ ] Con sesión, GUARDAR PUNTUACIÓN inserta en `scores` una fila con `game_id = 'rocas'` (depende de la migración).
- [x] `/jugar/asteroides` y un juego demo (ej. `/jugar/duelo-pixel`) siguen funcionando igual.
- [x] Nada en `app/`, `components/`, `lib/` ni `games/` importa archivos de `references/`.

**Gameplay:**

- [x] `←`/`→` (y `A`/`D`) rotan la nave mientras se mantienen.
- [x] No existe tecla de propulsión: disparar empuja la nave en sentido contrario al cañón.
- [x] `↓`/`S` frena la nave hasta detenerla.
- [x] Nave, rocas y OVNI rebotan en las paredes; nada sale por un borde y entra por el opuesto.
- [x] Una roca grande se parte en dos medianas hermanas; una mediana en dos pequeñas; la pequeña desaparece.
- [x] A los 2,5 s se ve el cable punteado entre hermanos; a los 4 s se atraen y, al tocarse, se funden en la roca del tamaño anterior sin cambiar el score.
- [x] Destruir dos hermanos con ≤ 1,5 s de diferencia suma el bonus PAR y muestra `PAR +N` en el canvas.
- [x] Desde el nivel 2 aparece un OVNI por la franja superior que dispara hacia la nave; derribarlo suma 300.
- [x] Al morir la nave reaparece en el centro e invulnerable 2,5 s; con 0 vidas termina la partida.
- [x] Al limpiar la oleada sube el nivel y entra una oleada con una roca grande más (tope 9).
- [x] Los skins `clasico`, `neon` y `retro` cambian solo la presentación y se aplican en vivo, incluso en pausa.
- [x] En dispositivos táctiles se juega con ◀ ▶ rotar, ▼ / B frenar y A disparar (mantener dispara en ráfaga).

---

## Decisiones

Esta corrida es automática (agente nocturno, sin humano): las decisiones abiertas se resolvieron así.

- **Sí:** juego `rocas` / ROCAS elegido porque es el primer id de `GAMES` sin motor y sin rama/PR en curso (caida, serpentina, gloton e invasores ya tienen PR #19–#22).
- **Sí:** se conservan `id`, `title`, `short`, `long`, `cat`, `cover` y `color` del catálogo; `best`/`plays` a 0 / "0" porque el ranking pasa a ser real.
- **Sí:** diseño propio, distinto de ASTEROIDES (SPEC 05) en sus mecánicas centrales: sin propulsor (movimiento solo por retroceso del disparo + freno), arena cerrada con rebotes en lugar de bordes envolventes, y fragmentos hermanos que se re-fusionan con bonus PAR. Sin power-ups. La puntuación también es distinta.
- **Sí:** el OVNI aparece desde el nivel 2 y solo en la franja superior, para cumplir "OVNIs en el horizonte" sin saturar la primera oleada.
- **Sí:** las balas del OVNI atraviesan las rocas (si chocaran, las rocas actuarían de escudo perfecto y el OVNI no sería una amenaza).
- **No:** dibujar "OLEADA N" en el canvas: el nivel ya lo muestra el HUD de plataforma.
- **Sí:** reutilizar `.cover-rocas` existente en lugar de crear otra portada.
- **Sí:** skins y mapeo táctil escritos por el agente principal siguiendo `.claude/agents/skin-designer.md` y `.claude/agents/mobile-porter.md` (mismas reglas y archivos permitidos).
- **Sí:** mapeo táctil `▼` → `ArrowDown` y `B` → `KeyS` (FRENO): el mismo freno en dos lugares, para frenar con el pulgar derecho mientras el izquierdo rota. Códigos distintos para que soltar un botón no anule el otro (el gamepad despacha `keyup` por botón). Sin `repeat`: rotar, frenar y disparar son teclas mantenidas.
- **Sí:** migración escrita pero **no aplicada** (sin acceso a Supabase en esta corrida). Hay que aplicarla antes de mergear.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| React 19 Strict Mode monta efectos dos veces: dos motores y listeners duplicados | `destroy()` idempotente en el cleanup. |
| Teclas "pegadas" al perder foco | Limpiar teclas al pausar; auto-pausa de plataforma por `blur`. |
| `onStats` a 60 fps provoca re-renders | Llamar `onStats` solo cuando cambia algún valor. |
| No aplicar la migración de `games`: el guardado falla por FK | Aviso destacado en el PR; criterio pendiente explícito. |
| La fusión hace el juego interminable | El bonus PAR y el aviso del cable incentivan limpiar pares rápido; la fusión solo devuelve el tamaño anterior, nunca crea rocas nuevas. |
| Moverse solo por retroceso resulta frustrante | Retroceso moderado (42 px/s por disparo, tope 300), freno siempre disponible e invulnerabilidad al reaparecer. |
| Teclas del juego chocan con `P`/`Escape` de pausa | No aplica: el motor no usa esas teclas. |

---

## Lo que **no** está en este spec

- Sonido, HiDPI, control con ratón.
- Power-ups.
- Anti-trampas y validación de scores.
- `best` y `plays` desde la base.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.
