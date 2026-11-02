# SPEC 16 — SERPENTINA: serpiente de luz con giro libre que cerca su presa

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 05, SPEC 06, SPEC 11, SPEC 12
> **Date:** 2026-11-02
> **Objective:** Convertir la entrada demo `serpentina` del catálogo en un juego real con un motor TypeScript escrito desde cero en `games/serpentina/engine.ts`, montarlo en `/jugar/serpentina` y darlo de alta en `public.games` para que sus partidas se guarden y aparezcan en el leaderboard.

---

## Por qué existe este spec

`serpentina` es el primer título de `GAMES` (`lib/data.ts`) que sigue en la arena simulada sin trabajo en curso (`caida` ya tiene la rama `spec-15-juego-caida` y el PR #19 abiertos). Su ficha promete "una serpiente de luz que recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma". Es un diseño desde cero, sin carpeta en `references/started-games/`.

El género (serpiente que crece comiendo) ya está cubierto por SNAKE (SPEC 09): tablero de casillas, cuatro direcciones, una fruta a la vez. SERPENTINA se diferencia con **dos mecánicas centrales**:

1. **Giro libre.** La serpiente no se mueve por casillas: avanza sola a velocidad continua y `←` / `→` **rotan su rumbo** (giro relativo, como un volante). El cuerpo es un rastro de luz continuo. Con más velocidad, el radio de giro crece y maniobrar cuesta más.
2. **El cerco.** Además de comer núcleos con la cabeza, la serpiente puede **encerrarlos**: si la cabeza pasa cerca de su propio cuerpo **sin tocarlo**, el lazo se cierra y captura todo lo que queda dentro, con multiplicador. Es riesgo puro: rozar el propio cuerpo es la jugada que más puntúa y también la que mata. Las **esporas** errantes (peligro) solo se destruyen así.

No usa nombres, sprites, personajes ni layouts de juegos comerciales. La retícula de fondo es decorativa: alude a "recorre la grilla" de la ficha sin atar el movimiento a casillas.

Encaja en el contrato actual sin extenderlo: canvas de 800×600, sin vidas (`lives: false`, una sola vida como SNAKE), con nivel. Skins (SPEC 11) y mapeo táctil (SPEC 12) se agregan en la etapa B de `/spec-impl-game`.

---

## Alcance

**Entra:**

- Entrada `serpentina` en `GAMES` de `lib/data.ts`, **en su posición actual**. Se conservan `id`, `title`, `short`, `long`, `cat` (`ARCADE`), `cover` (`cover-snake`) y `color` (`green`); `best` y `plays` pasan a `0` / `"0"` porque el ranking pasa a ser real (mismo criterio que SPEC 10 y SPEC 14).
- Portada: se reutiliza la existente `.cover-snake` de `app/globals.css` (no se crea `.cover-serpentina`).
- `games/serpentina/engine.ts`: motor nuevo que exporta `createSerpentina: GameFactory`.
  - Sin estado de módulo mutable: todo vive dentro de la instancia.
  - Gameplay según **Reglas de SERPENTINA** (abajo).
  - El canvas **no** dibuja score, vidas, nivel, "GAME OVER" ni texto de reinicio. Sí dibuja: retícula y borde de la arena, núcleos, esporas, serpiente, aviso de cerco (línea punteada + relleno tenue del lazo), destello del lazo al cerrarse y, durante los primeros 4 s, el rótulo `← → GIRAR · CERCA LOS NÚCLEOS`.
  - Al terminar la partida deja de actualizar y llama `onGameOver(score)` una sola vez. No hay reinicio por tecla.
  - `onStats` al iniciar y solo cuando cambia score o nivel (y una vez al morir, con `lives: 0`).
  - Colores desde tokens con `getComputedStyle(canvas)` y fallback (patrón `readPalette`), en `games/serpentina/skins.ts`.
  - Teclado: `keydown`/`keyup` en `window`, registrados al crear y quitados en `destroy()`; por `e.code`, sin filtrar `isTrusted`. `preventDefault()` solo para `←` `→` y solo con el motor activo. `P`/`Escape` quedan para la plataforma.
  - `pause()` detiene el loop y limpia teclas; `resume()` reinicia el tiempo de referencia; `dt` con tope de 50 ms; `end()` devuelve el score sin `onGameOver`; `destroy()` idempotente.
- `games/serpentina/skins.ts`: `clasico` (default), `neon` y `retro`.
- `games/registry.ts`: alta de `serpentina` con `lives: false`, `skins` y `touch`.
- Migración `supabase/migrations/20261102120000_game_serpentina.sql` con la fila de `public.games`.
- `references/implemented-games.md` y la lista de specs de `CLAUDE.md`.

**Fuera de alcance:**

- Ratón, aceleración manual ("turbo"), power-ups.
- Esporas que interactúan con el cuerpo (lo atraviesan sin efecto).
- Sonido y música. Canvas HiDPI.
- Anti-trampas, `best`/`plays` desde la base, tests automatizados.

---

## Reglas de SERPENTINA

**Arena.** Canvas 800×600. Arena entre x = 16 y x = 784, y = 16 e y = 584 (768×568), con retícula decorativa de 40 px. El borde es letal.

**Serpiente.** Empieza en (260, 300) mirando a la derecha, con 200 px de cuerpo recto. Avanza sola a `min(280, 130 + 3 × núcleos)` px/s. `←`/`A` y `→`/`D` (mantenidos) rotan el rumbo a 3,4 rad/s. El cuerpo es el rastro de la cabeza muestreado cada 4 px y recortado a su longitud. Cabeza de radio 7, cuerpo de radio 5. El movimiento se integra en subpasos de ≤ 2 px.

**Mordida.** Si la cabeza queda a menos de 9 px de un punto del cuerpo (ignorando los 6 puntos inmediatos al cuello), la partida termina.

**Núcleos.** Siempre hay 3 núcleos magenta (radio 7) en la arena; aparecen al azar a ≥ 120 px de la cabeza y lejos del cuerpo y de otros objetos. Comer uno con la cabeza: **+10 × nivel**, +24 px de cuerpo y +3 px/s.

**Cerco.** Si la cabeza pasa a menos de **30 px** de un punto del cuerpo situado al menos **40 puntos (160 px) atrás**, se forma un polígono con ese tramo de cuerpo y la cabeza. Si encierra al menos un objeto, el lazo se cierra: captura todos los núcleos y esporas cuyo centro queda dentro y suma **(20 × núcleos + 100 × esporas) × nivel × multiplicador**, donde el multiplicador es la cantidad de objetos encerrados (tope ×5). Cada núcleo capturado alarga y acelera igual que uno comido. Tras un cierre hay 500 ms de enfriamiento. Si el lazo no encerraría nada, no ocurre nada. Mientras la cabeza está a menos de 64 px de un tramo válido y el lazo encerraría algo, se dibuja una línea punteada cabeza→cuerpo y el relleno tenue del lazo (aviso de "cerco listo").

**Esporas.** Peligro con púas (radio 10) que deriva a `min(90, 40 + 5 × nivel)` px/s y rebota en las paredes. Tocarla con la cabeza termina la partida; atraviesan el cuerpo sin efecto. En juego hay como máximo `min(nivel, 6)`; la primera aparece a los 2,5 s y, si faltan, reaparecen cada 4 s (a ≥ 240 px de la cabeza). Solo se destruyen con un cerco.

**Nivel.** `1 + floor(núcleos / 6)` (comidos o capturados). Sube la cantidad y velocidad de las esporas.

**Fin.** Pared, mordida o espora. Una sola vida (`lives: false` en el HUD).

---

## Modelo de datos

Entrada en `GAMES` (`lib/data.ts`), solo cambian `best` y `plays`:

```ts
{
  id: "serpentina",
  title: "SERPENTINA",
  short: "Crece sin morder tu propia cola.",
  long: "Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.",
  cat: "ARCADE",
  cover: "cover-snake",
  color: "green",
  best: 0,
  plays: "0",
}
```

Registro (`games/registry.ts`):

```ts
serpentina: {
  factory: createSerpentina,
  lives: false,
  skins: ["clasico", "neon", "retro"],
  touch: { keys: { left: "ArrowLeft", right: "ArrowRight" } },
},
```

Migración `supabase/migrations/20261102120000_game_serpentina.sql`:

```sql
-- Alta de SERPENTINA en el catálogo de juegos con ranking real (SPEC 06).
insert into public.games (id, title) values ('serpentina', 'SERPENTINA');
```

No cambia el esquema: no hace falta regenerar `lib/supabase/database.types.ts`.

Estado interno del motor (privado): `hx`, `hy`, `angle`, `length`, `pts` (rastro), `nucleos`, `esporas`, `collected`, `score`, `level`, `elapsed`, `esporaTimer`, `loopCooldown`, `flash`, `hint`, `phase`, `paused`, `destroyed`, `lastTime`, `rafId`, `keys`.

---

## Plan de implementación

1. Leer `node_modules/next/dist/docs/` (el motor es canvas puro y no usa APIs de Next). `lib/data.ts`: `best`/`plays` a 0.
2. `games/serpentina/engine.ts` + `skins.ts` y alta en `games/registry.ts`.
3. Migración `supabase/migrations/20261102120000_game_serpentina.sql` (aplicarla antes de mergear).
4. Etapa B: skins (neon, retro) según `skin-designer` y luego mapeo táctil según `mobile-porter`.
5. `npm run lint` y `npm run build`; prueba lógica headless del motor y prueba en navegador (desktop con los 3 skins y 390 px táctil).

---

## Criterios de aceptación

**Integración:**

- [x] `npm run build` y `npm run lint` pasan sin errores.
- [x] `GAMES` contiene `serpentina` con `best: 0` y `plays: "0"`; el resto de la entrada y las demás entradas no cambiaron.
- [x] Existe `games/serpentina/engine.ts` y no declara variables de módulo mutables.
- [x] En `/jugar/serpentina` hay un `<canvas>` de 800×600, no existe `.game-arena` y el HUD muestra score y nivel (sin Vidas).
- [x] El canvas no dibuja score, vidas, nivel, "GAME OVER" ni texto de reinicio; ninguna tecla reinicia.
- [x] Al morir se llama `onGameOver` una sola vez; `end()` devuelve el score sin dispararlo; `pause()` cancela el rAF; `destroy()` es idempotente y quita los listeners.
- [ ] `public.games` contiene la fila `serpentina` (pendiente: aplicar la migración antes de mergear).
- [ ] Con sesión, GUARDAR PUNTUACIÓN inserta en `scores` con `game_id = 'serpentina'` (depende de la migración).
- [x] En emulación táctil (390 px) se muestra el gamepad con ◀ ▶, sin "REQUIERE TECLADO" ni scroll horizontal; ◀ despacha `ArrowLeft`.
- [x] El selector muestra CLÁSICO / NEÓN / RETRO y cada skin se ve distinto.

**Gameplay:**

- [x] `←`/`→` (y `A`/`D`) rotan el rumbo mientras se mantienen; sin teclas la serpiente sigue recta.
- [x] Comer un núcleo suma 10 × nivel, alarga y acelera la serpiente.
- [x] Pasar cerca del propio cuerpo encerrando núcleos los captura con multiplicador (prueba headless: 3 núcleos en nivel 2 → +360).
- [x] Tocar el propio cuerpo, la pared o una espora termina la partida.
- [x] Cada 6 núcleos sube el nivel.

---

## Decisiones

- **Sí:** el juego a implementar es `serpentina`: primer id de `GAMES` sin motor ni trabajo en curso (`caida` descartado por la rama `spec-15-juego-caida` / PR #19 abiertos). Por eso este spec es el 16.
- **Sí:** diseño original diferenciado de SNAKE por el giro libre y el cerco. Sin nombres, sprites, layouts ni personajes de juegos comerciales.
- **Sí:** se conserva la ficha del catálogo (id, título, `short`, `long`, `cover-snake`, color); `best`/`plays` a 0.
- **Sí:** reutilizar `.cover-snake`: la portada ya existe y representa al juego (serpiente verde + núcleo magenta).
- **Sí:** una sola vida y `lives: false`, como SNAKE: la ficha dice "un movimiento en falso y se devora a sí misma".
- **Sí:** cuerpo inicial de 200 px: con ~240 px por vuelta a giro máximo, hacen falta 2–3 núcleos para poder cerrar el primer lazo. El cerco es una recompensa por crecer.
- **Sí:** aviso visual de "cerco listo" (línea punteada + relleno): hace legible una mecánica nueva sin texto.
- **Sí:** las esporas atraviesan el cuerpo: simplifica la física y mantiene el peligro solo en la cabeza.
- **Sí:** aparición de núcleos y esporas con `Math.random` (igual que SNAKE); no hay muros fijos que deban ser iguales para todos.
- **No:** ratón ni turbo. Mantiene el motor alineado con el gamepad táctil (solo ◀ ▶, mantenidos, sin `repeat`).
- **Sí:** skins y táctil hechos en este mismo PR siguiendo `.claude/agents/skin-designer.md` y `.claude/agents/mobile-porter.md` a mano (corrida nocturna sin humano). En retro la serpiente es bloques claros con núcleo interno y las esporas, del mismo tono, se distinguen por las púas en cruz y el hueco central.
- **Supuesto:** nombre de migración `20261102120000_game_serpentina.sql`. No se pudo aplicar: la corrida no tiene acceso a la base.
- **Supuesto:** en `CLAUDE.md` se agrega "16 Serpentina" a la lista de implementados aunque el 15 (CAÍDA) aún no esté mergeado; si se mergean ambos, el orden de la lista puede requerir un ajuste trivial.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Migración sin aplicar: guardar puntaje falla por la FK de SPEC 06 | Aviso destacado en el PR; aplicar antes de mergear. |
| Tunelado de la cabeza a través del cuerpo a alta velocidad | Subpasos de ≤ 2 px con chequeo de mordida en cada uno. |
| El cerco se dispara al correr paralelo al propio cuerpo | Solo cuenta si el lazo encierra algún objeto, exige ≥ 160 px de cuerpo y tiene 500 ms de enfriamiento. |
| Costo por frame con serpientes largas | O(n) por subpaso sobre ≤ ~600 puntos; despreciable. |
| React 19 Strict Mode monta dos motores | `destroy()` idempotente; verificado que no quedan listeners. |
| Teclas pegadas al perder foco | `pause()` limpia teclas; auto-pausa de plataforma. |

---

## Lo que **no** está en este spec

- Ratón, turbo, power-ups, sonido, HiDPI.
- Anti-trampas y validación de scores; `best`/`plays` desde la base.
- Tests automatizados.
