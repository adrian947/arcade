# SPEC 15 — CAÍDA: la prensa que baja y la cascada que encadena

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 05, SPEC 06, SPEC 11, SPEC 12
> **Date:** 2026-11-01
> **Objective:** Convertir la entrada demo `caida` del catálogo en un juego real con un motor TypeScript escrito desde cero en `games/caida/engine.ts`, montarlo en `/jugar/caida` y darlo de alta en `public.games` para que sus partidas se guarden y aparezcan en el leaderboard.

---

## Por qué existe este spec

`caida` es el primer título de `GAMES` (`lib/data.ts`) que todavía corre la arena simulada. Su ficha promete "piezas geométricas [que] descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir", con una velocidad que "aumenta sin piedad cada 10 líneas", y un subtítulo clave: "Encaja las piezas antes de que **el techo te aplaste**". Es un diseño desde cero, sin carpeta en `references/started-games/`.

El género (piezas que caen + líneas) ya está cubierto por TETRIS (SPEC 07): pozo fijo de 10×20, el peligro crece **desde abajo** (la pila sube) y al limpiar una línea todo lo de arriba baja exactamente una fila. CAÍDA se diferencia con **dos mecánicas centrales** que cambian la forma de jugar:

1. **La prensa (techo que baja).** El techo del pozo es una prensa que baja una fila cada pocos segundos y achica el pozo **desde arriba**. Cada línea limpiada la sube una fila. Si baja sobre bloques apilados, los aplasta y termina la partida. El jugador no solo administra la pila: corre contra un reloj visible (barra PRENSA).
2. **Cascada (gravedad por grupos).** Al limpiar líneas, cada grupo de bloques conectados (4 vecinos, de cualquier color) que queda sin apoyo **cae como un bloque rígido hasta asentarse**, aunque sean varias filas. Si eso completa nuevas líneas, se limpian en **cadena** con multiplicador (CADENA ×2, ×3…). Construir "repisas" sobre huecos y soltarlas a propósito es la jugada avanzada.

Además el set de piezas es propio: **8 piezas geométricas de 2 a 5 celdas** (dúo, barra, ángulo, cuadro, te, escalón, gancho, cruz), no los siete tetrominós clásicos. Sin nombres, sprites ni layouts de juegos comerciales.

Encaja en el contrato actual sin extenderlo: canvas de 800×600, sin vidas (`lives: false`, como TETRIS y SNAKE), con nivel.

---

## Alcance

**Entra:**

- Entrada `caida` en `GAMES` de `lib/data.ts`, **en su posición actual**. Se conservan `id`, `title`, `short`, `long`, `cat`, `cover` (`cover-tetro`) y `color`; `best` y `plays` pasan a `0` / `"0"` porque el ranking pasa a ser real (mismo criterio que SPEC 10 y 14).
- Portada: se reutiliza la existente `.cover-tetro` de `app/globals.css` (no se crea `.cover-caida`).
- `games/caida/engine.ts`: motor nuevo que exporta `createCaida: GameFactory`.
  - Sin estado de módulo mutable: todo vive dentro de la instancia.
  - Gameplay según **Reglas de CAÍDA** (abajo).
  - El canvas **no** dibuja score, nivel, "GAME OVER" ni texto de reinicio. Sí dibuja: pozo con grilla, prensa (placa, franjas de peligro y dientes), pila, pieza activa y fantasma, panel PRENSA (barra, segundos, filas ocupadas `n/18`), panel SIGUIENTE, contador LÍNEAS y rótulo CADENA ×N.
  - Al terminar la partida deja de actualizar y llama `onGameOver(score)` una sola vez. No hay reinicio por tecla.
  - `onStats` al iniciar y solo cuando cambia score o nivel (`lives` siempre 0, oculto en el HUD).
  - Colores desde tokens con `getComputedStyle(canvas)` y fallback (patrón `readPalette`), en `games/caida/skins.ts`.
  - Teclado: `keydown`/`keyup` en `window`, registrados al crear y quitados en `destroy()`; por `e.code`, sin filtrar `isTrusted`. `preventDefault()` solo para flechas y `Espacio`, y solo con el motor activo. `P`/`Escape` quedan para la plataforma.
  - `pause()` detiene el loop y limpia las teclas mantenidas; `resume()` reinicia el tiempo de referencia; `dt` con tope de 50 ms; `end()` devuelve el score sin `onGameOver`; `destroy()` idempotente.
- `games/registry.ts`: alta de `caida` con `lives: false`, `skins` y `touch`.
- Migración `supabase/migrations/20261101120000_game_caida.sql` con la fila de `public.games`.
- `references/implemented-games.md` y la lista de specs de `CLAUDE.md`.

**Fuera de alcance:**

- Reserva de pieza (hold), vista previa de más de una pieza, rotación SRS completa.
- Sonido y música. Canvas HiDPI.
- Anti-trampas, `best`/`plays` desde la base, tests automatizados.

---

## Reglas de CAÍDA

**Pozo.** Canvas 800×600. Pozo de 10 columnas × 18 filas, celdas de 30 px (300×540), centrado en x = 250, arriba en y = 40. Encima, la placa de la prensa (14 px) siempre visible.

**Piezas.** 8 piezas, bolsa barajada de 8 (cada pieza sale una vez por bolsa):

| # | Pieza | Celdas | Forma |
| - | ----- | ------ | ----- |
| 1 | dúo | 2 | `██` |
| 2 | barra | 3 | `███` |
| 3 | ángulo | 3 | `█ / ██` |
| 4 | cuadro | 4 | `██ / ██` |
| 5 | te | 4 | `███ / ·█·` |
| 6 | escalón | 4 | `██· / ·██` |
| 7 | gancho | 4 | `█·· / ███` |
| 8 | cruz | 5 | `·█· / ███ / ·█·` |

Aparecen centradas justo debajo de la prensa. Rotación de 90° con rebotes (0, −1, +1, −2, +2 columnas, o una fila abajo). Fijación tras 450 ms apoyada (moverla o rotarla apoyada reinicia la espera, hasta 12 veces). Pieza fantasma en contorno.

**Caída.** Intervalo por fila `max(70, 800 × 0,86^(nivel − 1))` ms. Caída suave: 35 ms por fila. Caída libre instantánea.

**Prensa.** Baja una fila cada `max(6, 16 − nivel)` s (barra PRENSA; aviso en los últimos 2 s). Si al vencer el plazo la pieza activa está pegada al techo, la bajada queda **pendiente** y ocurre al fijarse la pieza. Cada línea limpiada **sube** la prensa una fila (mínimo 0). Si al bajar ocupa una fila con bloques → **aplastado**: fin de partida.

**Líneas y cascada.** Una fila completa se ilumina 260 ms y se borra. Luego cada grupo conectado de bloques (4 vecinos, cualquier color) sin apoyo cae como bloque rígido hasta asentarse. Si eso completa nuevas filas, se repite con la cadena + 1.

**Niveles.** Nivel = 1 + ⌊líneas / 10⌋.

**Fin de partida.** Prensa que aplasta bloques, o pieza nueva sin lugar bajo la prensa.

**Puntuación.**

- Cada paso de la cascada con `n` líneas: `100 × n² × cadena × nivel` (paso 1 = cadena 1).
- Caída suave: +1 por fila. Caída libre: +2 por fila.

**Controles.**

| Tecla | Acción |
| --- | --- |
| `←` `→` / `A` `D` | mover (acepta auto-repetición) |
| `↓` / `S` (mantener) | caída suave |
| `↑` / `X` / `W` | rotar horario |
| `Z` | rotar antihorario |
| `Espacio` | caída libre |
| `P` / `Esc` | pausa (plataforma) |

---

## Modelo de datos

`lib/data.ts` (solo cambian `best` y `plays`):

```ts
{
  id: "caida",
  title: "CAÍDA",
  short: "Encaja las piezas antes de que el techo te aplaste.",
  long: "Piezas geométricas descienden desde la oscuridad. …",
  cat: "PUZZLE",
  cover: "cover-tetro",
  color: "magenta",
  best: 0,
  plays: "0",
}
```

Migración `supabase/migrations/20261101120000_game_caida.sql`:

```sql
-- Alta de CAÍDA en el catálogo de juegos con ranking real (SPEC 06).
insert into public.games (id, title) values ('caida', 'CAÍDA');
```

No cambia el esquema: no hace falta regenerar `lib/supabase/database.types.ts`.

Registro:

```ts
caida: {
  factory: createCaida,
  lives: false,
  skins: ["clasico", "neon", "retro"],
  touch: {
    keys: { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", a: "Space", b: "KeyZ" },
    labels: { a: "SOLTAR", b: "GIRAR" },
    repeat: ["left", "right"],
  },
},
```

Mapeo de colores (skin `clasico`): piezas `--ink-dim`, `--cyan`, `--green`, `--yellow`, `--magenta`, `--bronze`, `--gold`, `--ink` con borde y franja inferior oscura; grilla y marco `--ink-faint`; prensa gris oscuro con dientes `--silver` y franjas `--gold` (aviso `--magenta`); barra PRENSA `--gold`; rótulos `--ink-dim` / valores `--ink` en `--pixel`; CADENA `--magenta`. Fondo `#000`.

Estado interno del motor: `grid` (`Int8Array` 18×10), `bag`, `piece`, `next`, `pressRows`, `pressMs`, `pressPending`, `fallMs`, `lockMs`, `lockResets`, `clearRows`, `clearMs`, `chain`, `lines`, `score`, `level`, `phase` (`falling` | `clearing` | `over` | `ended`), `paused`, `destroyed`, `lastTime`, `rafId`, `keys`.

---

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app` (client components / efectos). `lib/data.ts`: `best`/`plays` a 0.
2. `games/caida/engine.ts` + `skins.ts` y alta en `games/registry.ts`.
3. Migración `supabase/migrations/20261101120000_game_caida.sql` (aplicarla antes de mergear).
4. Etapa B: skins neon y retro (`skin-designer`) y luego `touch` (`mobile-porter`).
5. `npm run lint` y `npm run build`; prueba en navegador (desktop, skins y 390 px táctil).

---

## Criterios de aceptación

**Integración:**

- [x] `npm run build` y `npm run lint` pasan sin errores.
- [x] `GAMES` contiene `caida` con `best: 0` y `plays: "0"`; el resto de la entrada y las demás entradas no cambiaron.
- [x] Existe `games/caida/engine.ts` y no declara variables de módulo mutables.
- [x] En `/jugar/caida` hay un `<canvas>` de 800×600 y el HUD de plataforma muestra score y nivel del motor (sin Vidas).
- [x] El canvas no dibuja score, nivel, "GAME OVER" ni texto de reinicio; ninguna tecla reinicia.
- [x] Al terminar se llama `onGameOver` una sola vez y se abre el modal FIN DEL JUEGO; `end()` devuelve el score sin dispararlo; `destroy()` es idempotente y quita los listeners.
- [x] PAUSA congela el canvas (dos capturas separadas por 1 s idénticas).
- [ ] `public.games` contiene la fila `caida` (pendiente: aplicar la migración antes de mergear).
- [ ] Con sesión, GUARDAR PUNTUACIÓN inserta en `scores` con `game_id = 'caida'` (depende de la migración).
- [x] En emulación táctil (390 px) se muestra el gamepad con D-pad, A `SOLTAR` y B `GIRAR`, sin "REQUIERE TECLADO".
- [x] El selector muestra CLÁSICO / NEÓN / RETRO y cada skin redibuja en vivo.

**Gameplay:**

- [x] `←`/`→` mueven, `↑` rota horario, `Z` antihorario, `↓` mantenida acelera, `Espacio` suelta.
- [x] La prensa baja una fila al vencer su plazo (panel `1/18`) y sube una fila por línea limpiada.
- [x] Una prensa que baja sobre bloques termina la partida.
- [x] Tras limpiar una línea, un grupo sin apoyo cae varias filas y, si completa otra línea, se encadena: con el escenario de prueba (dúo que completa la fila 16 y un bloque que cae a la fila 17) el score es `32 + 100 + 200 = 332` y el pozo queda vacío.
- [x] Cada 10 líneas sube el nivel (caída y prensa más rápidas).

---

## Decisiones

- **Sí:** el juego a implementar es `caida`, el primer id de `GAMES` sin motor ni trabajo en curso (sin ramas remotas ni PRs abiertos con ese id).
- **Sí:** diseño original diferenciado de TETRIS por la prensa que baja desde el techo y la cascada por grupos con cadenas, y por un set propio de 8 piezas de 2 a 5 celdas. Sin nombres, sprites, layouts ni personajes de juegos comerciales.
- **Sí:** se conserva la ficha del catálogo (id, título, `short`, `long`, `cover-tetro`, color); `best`/`plays` a 0 porque el ranking pasa a ser real.
- **Sí:** reutilizar `.cover-tetro` en vez de crear `.cover-caida`: la portada ya existe y es la del catálogo.
- **Sí:** sin vidas (`lives: false`): la amenaza es continua (la prensa); una vida extra rompería la tensión.
- **Sí:** la gravedad de la cascada ignora colores (grupos de cualquier color): la regla es física y fácil de leer; el color solo identifica la pieza.
- **Sí:** bajada de prensa pendiente si la pieza está pegada al techo, para no aplastar una pieza en movimiento sin aviso.
- **Sí:** cadena con multiplicador lineal y líneas al cuadrado: premia tanto las limpiezas múltiples como las cascadas planificadas.
- **Sí:** skins y táctil en este mismo PR siguiendo `.claude/agents/skin-designer.md` y `.claude/agents/mobile-porter.md` (corrida nocturna sin humano). En retro las 8 piezas se distinguen por tono + patrón (sólido, rayas, puntos, hueco); en neón las piezas que comparten color van rayadas.
- **Sí:** táctil con `repeat` en ◀ ▶ (el motor mueve por pulsación con auto-repetición); ▼ no lo necesita (se lee como tecla mantenida). B = `Z` (rotar antihorario), ya que ▲ rota horario.
- **Supuesto:** nombre de migración `20261101120000_game_caida.sql`. No se pudo aplicar: la corrida no tiene acceso a la base.
- **Supuesto:** el texto "LÍNEAS" se dibuja con `--pixel` igual que en TETRIS; la `Í` cae a la fuente de respaldo (mismo comportamiento que TETRIS).

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Migración sin aplicar: guardar puntaje falla por la FK de SPEC 06 | Aviso destacado en el PR; aplicar antes de mergear. |
| Prensa demasiado agresiva o lenta | Constante única `pressFor(level)`; 16 s en nivel 1, mínimo 6 s. Ajustable sin tocar la lógica. |
| Cascada en bucle infinito | Cada iteración baja un grupo una fila (estado finito) y hay un tope de seguridad de 2000 iteraciones. |
| React 19 Strict Mode monta dos motores | `destroy()` idempotente; verificado que no quedan listeners. |
| Teclas pegadas al perder foco | `pause()` limpia teclas; auto-pausa de plataforma. |

---

## Lo que **no** está en este spec

- Hold, vista previa múltiple, sonido, HiDPI.
- Anti-trampas y validación de scores; `best`/`plays` desde la base.
- Tests automatizados.
