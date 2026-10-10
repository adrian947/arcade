# SPEC 08 — ARKANOID: tercer juego real con leaderboard

> **Status:** Aprobado
> **Depends on:** SPEC 04, SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-10-10
> **Objective:** Agregar el juego `arkanoid` al catálogo, portando el Arkanoid de `references/started-games/04-arkanoid/` a un motor TypeScript en `games/arkanoid/engine.ts`, montarlo en `/jugar/arkanoid` y darlo de alta en `public.games` para que sus partidas se guarden y aparezcan en el leaderboard.

---

## Por qué existe este spec

ASTEROIDES (SPEC 05) y TETRIS (SPEC 07) son hoy los juegos reales del Vault. SPEC 05 dejó el contrato de motores y el registro pensados para que Arkanoid llegara en un spec propio, SPEC 06 exige la fila en `public.games` para guardar puntuaciones y SPEC 07 extendió el registro con `EngineEntry` (`factory`, `lives?`). Este spec trae el tercer juego real.

El original son tres scripts globales: `game.js` (268 líneas: estado, loop, físicas, render, HUD y overlays), `levels.js` (50 líneas: 5 niveles con patrón de bloques y multiplicador de velocidad) y `assets/spritesheet.js` (helpers `loadSpritesheet`/`drawSprite`/`drawFrame` sobre `spritesheet-breakout.png`). Usa un canvas de 800×600, paleta controlada con ratón o `←`/`→`, 3 vidas, 10 puntos por bloque, 5 niveles con velocidad creciente, animación de explosión de 4 frames y dos efectos de sonido. Dibuja en el canvas score, nivel y vidas (como pelotas), overlays "GAME OVER" y "¡Completaste el juego!", y tiene su propia pausa con `P`/`Escape` cuyo overlay permite saltar a cualquier nivel con botones 1–5. Los listeners de teclado y ratón no tienen cleanup y el loop de `requestAnimationFrame` nunca se detiene.

Encaja en el contrato actual sin extenderlo: 800×600, tiene vidas y niveles, y no necesita callbacks extra. Hay que quitarle el HUD, los overlays, la pausa propia y el selector de niveles, encapsular el estado en una instancia y servir sus assets desde `public/`.

ARKANOID es una entrada **nueva** del catálogo. El mock `bloque-buster` (BLOQUE BUSTER), parecido, no se toca.

---

## Alcance

**Entra:**

- Entrada nueva en `GAMES` de `lib/data.ts`, en la **tercera posición** (detrás de `asteroides` y `tetris`):
  - `id: "arkanoid"`, `title: "ARKANOID"`, `cat: "ARCADE"`, `color: "magenta"`, `cover: "cover-arkanoid"`, `best: 0`, `plays: "0"`.
  - Copy `short` y `long` basados en el juego real (ver Modelo de datos).
- Portada CSS nueva `.cover-arkanoid` en `app/globals.css`, junto a las demás `cover-*`: fondo negro, muro de ladrillos neón con el patrón del nivel 5 (marco + cruz central), pelota blanca con estela en diagonal y paleta `--magenta` con glow en la parte baja. Solo CSS/SVG inline, sin imágenes externas. Distinta de `.cover-bricks` (BLOQUE BUSTER).
- Assets copiados (no importados) desde `references/started-games/04-arkanoid/assets/` a `public/games/arkanoid/`:
  - `spritesheet-breakout.png` (559×337, 30 KB).
  - `sounds/ball-bounce.mp3` (10 KB) y `sounds/break-sound.mp3` (9 KB).
- `games/arkanoid/engine.ts`: port a TypeScript que exporta `createArkanoid: GameFactory`.
  - Sin estado de módulo mutable: todo vive dentro de la instancia (incluida la imagen del spritesheet y los `HTMLAudioElement`). Las constantes, `LEVELS`, `SPRITES` y `EXPLOSION_FRAMES` se portan como constantes de módulo inmutables (pueden ir en `games/arkanoid/levels.ts` y `games/arkanoid/sprites.ts`).
  - Port fiel del gameplay:
    - Canvas 800×600. Paleta `{ y: 560, w: 81, h: 14 }` centrada al iniciar, velocidad con teclado 400 px/s, limitada a los bordes. Pelota 16×16 con velocidad base `vx = 200`, `vy = −300` px/s × multiplicador del nivel.
    - Bloques de 64×24 en una rejilla de 10 columnas × 6 filas con origen `x = 80`, `y = 80`, sin separación, dibujados escalando los sprites de 32×16.
    - Rebote en paredes izquierda, derecha y techo (fuerza el signo de la velocidad); rebote en la paleta si `vy > 0` y la pelota cruza su borde superior con tolerancia de 8 px (invierte `vy`, sin ángulo). Colisión AABB con bloques: un bloque por frame, invierte `vy`, suma 10 puntos y lanza una explosión.
    - Explosión: 4 frames de `EXPLOSION_FRAMES[color]` en 150 ms en la posición del bloque; el bloque deja de colisionar al instante. Se conserva que `gray` usa los frames de `red`.
    - 5 niveles de `levels.js` (parrilla 10×6, pirámide, ajedrez, filas con huecos, marco + cruz) con multiplicadores `1.00`, `1.10`, `1.21`, `1.33`, `1.46`. Al romper todos los bloques se carga el siguiente nivel con la pelota sobre la paleta; el score se acumula.
    - Al caer la pelota bajo el canvas se pierde una vida; si quedan, la pelota reaparece sobre la paleta con la velocidad del nivel actual. La pelota sale sola (sin saque), como en el original.
    - Fin de partida: 0 vidas, o completar el nivel 5.
  - Se elimina del canvas: score, "Nivel: N", vidas como pelotas, overlay "GAME OVER", overlay "¡Completaste el juego!" y overlay de pausa con el selector de niveles. Queda en el canvas: bloques, explosiones, paleta y pelota.
  - Al terminar la partida (por vidas o por completar el nivel 5) el motor deja de actualizar y llama `onGameOver(score)` una sola vez. Sin reinicio por tecla.
  - `onStats({ score, lives, level })` al iniciar y solo cuando cambia score, vidas o nivel (nunca por frame).
  - Gráficos desde el spritesheet cargado con `new Image()` desde `/games/arkanoid/spritesheet-breakout.png`; el loop arranca cuando la imagen carga (si el motor se destruye antes, no arranca). Fondo `#000`. No se dibuja texto, así que no hace falta `readPalette`.
  - Sonido: `HTMLAudioElement` por instancia para `/games/arkanoid/sounds/ball-bounce.mp3` (rebote en paredes y paleta) y `/games/arkanoid/sounds/break-sound.mp3` (rotura de bloque), reproducidos con `cloneNode().play()` para permitir solapamiento. La promesa rechazada de `play()` (autoplay bloqueado) se ignora sin error en consola. Sin control de volumen ni mute.
  - Teclado: `keydown`/`keyup` en `window`, registrados al crear y removidos en `destroy()`. Controles: `←`/`→` mueven la paleta. `preventDefault()` solo para `ArrowLeft` y `ArrowRight`, y solo con el motor activo (no pausado ni terminado). Se elimina la pausa con `P`/`Escape` del motor: los maneja la plataforma.
  - Ratón: `mousemove` en el canvas, registrado al crear y removido en `destroy()`. Centra la paleta en la `x` del cursor convertida a coordenadas lógicas con `getBoundingClientRect()` (el canvas se escala por CSS dentro de `.crt-screen`), limitada a los bordes. Ignorado con el motor pausado o terminado. Se elimina el listener `click` del selector de niveles.
  - `pause()` detiene el loop y limpia teclas mantenidas; `resume()` reinicia el tiempo de referencia (primer `dt` = 0); tope de `dt` en 50 ms (el original no tenía tope). `end()` detiene y devuelve el score sin disparar `onGameOver`. `destroy()` idempotente.
- `games/registry.ts`: alta de `arkanoid` con `{ factory: createArkanoid }` (vidas y nivel visibles).
- Migración `supabase/migrations/20261010010000_game_arkanoid.sql` con la fila de `public.games`, aplicada con el MCP de Supabase (`apply_migration`, nombre `game_arkanoid`) **previa confirmación del usuario**.
- Leaderboard sin código nuevo: `/salon` y `/juego/arkanoid` ya leen la vista `leaderboard` filtrada por `game_id` (SPEC 04) y la FK de SPEC 06 acepta `arkanoid` tras la migración.
- Verificación con Playwright MCP, MCP de Supabase y `npm run build` / `npm run lint`; capturas en `.playwright-screenshot/`.

**Fuera de alcance (para specs futuros):**

- Controles táctiles y soporte móvil jugable (sigue el aviso "REQUIERE TECLADO").
- Canvas HiDPI (`devicePixelRatio`).
- Selector de nivel o cualquier forma de saltar niveles.
- Cambios de gameplay: ángulo de rebote según el punto de impacto en la paleta, saque manual, power-ups, más niveles, vidas extra.
- Control de volumen, mute o música.
- Recolorear los sprites con los tokens del Vault.
- Cambios a la entrada `bloque-buster` (copy, portada, eliminarla o fusionarla con ARKANOID).
- Anti-trampas o validación server-side del score.
- `best` y `plays` calculados desde la base.
- Tests automatizados (no hay test runner).

---

## Modelo de datos

Entrada nueva en `GAMES` (`lib/data.ts`), tercera del arreglo:

```ts
{
  id: "arkanoid",
  title: "ARKANOID",
  short: "Rompe el muro ladrillo a ladrillo sin dejar caer la pelota.",
  long: "Mueve la paleta con el ratón o las flechas y devuelve la pelota contra cinco muros distintos: parrilla, pirámide, ajedrez, huecos y marco con cruz. Cada ladrillo vale 10 puntos y cada muro superado acelera la pelota un 10 %. Tienes tres vidas para limpiar los cinco.",
  cat: "ARCADE",
  cover: "cover-arkanoid",
  color: "magenta",
  best: 0,
  plays: "0",
}
```

Migración `supabase/migrations/20261010010000_game_arkanoid.sql`:

```sql
-- Alta de ARKANOID en el catálogo de juegos con ranking real (SPEC 06).
insert into public.games (id, title) values ('arkanoid', 'ARKANOID');
```

No cambia el esquema: no hace falta regenerar `lib/supabase/database.types.ts`.

El contrato (`games/types.ts`) no cambia. Registro en `games/registry.ts`:

```ts
export const ENGINES: Partial<Record<string, EngineEntry>> = {
  asteroides: { factory: createAsteroids },
  tetris: { factory: createTetris, lives: false },
  arkanoid: { factory: createArkanoid },
};
```

Niveles portados de `levels.js` (bloques por nivel):

| Nivel | Patrón | Bloques | Velocidad |
| --- | --- | --- | --- |
| 1 | Parrilla completa 10×6, color por fila (red, yellow, cyan, magenta, hotpink, green) | 60 | ×1.00 |
| 2 | Pirámide (filas de 2, 4, 6, 8, 10, 10) | 40 | ×1.10 |
| 3 | Ajedrez, `(col + row) % 2 === 0`, yellow arriba y magenta abajo | 30 | ×1.21 |
| 4 | Filas con huecos fijos (`gaps4` del original) | 39 | ×1.33 |
| 5 | Marco cyan + cruz hotpink (col 4, fila 2) | 39 | ×1.46 |

Score máximo posible: 208 bloques × 10 = 2080.

Estado interno del motor (privado a `games/arkanoid/engine.ts`): `paddle` (`{ x, y, w, h }`), `ball` (`{ x, y, w, h, vx, vy }`), `blocks` (`{ x, y, w, h, color, alive }[]`), `explosions` (`{ x, y, w, h, color, elapsed }[]`), `score`, `lives`, `currentLevel`, `sheet` (`HTMLImageElement`), `sheetLoaded`, `bounceSound`, `breakSound`, `phase: 'loading' | 'playing' | 'over' | 'ended'`, `paused`, `lastTime`, `rafId`, `keys`, `destroyed`. Funciones portadas (`initPaddle`, `initBall`, `loadLevel`, `collideAABB`, `update`, `draw`, `drawSprite`, `drawFrame`) como cierres de la instancia, con el contexto 2D y la imagen por parámetro en lugar de globals. `BlockColor` tipado como `'gray' | 'red' | 'yellow' | 'cyan' | 'magenta' | 'hotpink' | 'green'`.

---

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app` en lo relativo a client components, `useEffect` y la carpeta `public` (según `AGENTS.md`). Agregar la entrada `arkanoid` en la tercera posición de `GAMES` y la portada `.cover-arkanoid`. Manual: la tarjeta aparece en `/`, `/juegos`, `/salon` y `/juego/arkanoid`; `/jugar/arkanoid` abre con la simulación.
2. Copiar el spritesheet y los dos sonidos a `public/games/arkanoid/`. Crear `games/arkanoid/engine.ts` (con `levels.ts`/`sprites.ts` si se separan): port completo de paleta, pelota, colisiones, niveles, explosiones y sonido; teclado y ratón con cleanup; `pause`/`resume`/`end`/`destroy`. Registrarlo en `games/registry.ts`. Manual: `/jugar/arkanoid` se juega con ratón y flechas, el HUD de plataforma refleja score, vidas y nivel, y perder las 3 vidas abre el modal.
3. Escribir `supabase/migrations/20261010010000_game_arkanoid.sql`. **Pedir confirmación al usuario** y aplicarla con el MCP (`apply_migration`, nombre `game_arkanoid`). Verificar con `list_migrations`, `execute_sql` (`select * from public.games order by id`) y `get_advisors` (security).
4. Verificar los criterios de aceptación con Playwright MCP (desktop y 390px, consola, guardado) y SQL del MCP; guardar capturas en `.playwright-screenshot/`.

Cada paso deja la app corriendo y commiteable.

---

## Criterios de aceptación

**Integración:**

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `GAMES[2]` es `arkanoid` con los valores del Modelo de datos; las demás entradas no cambiaron (el diff de `lib/data.ts` solo agrega la entrada nueva).
- [ ] La tarjeta ARKANOID aparece en `/` (sección de juegos), en `/juegos` (filtro ARCADE y búsqueda "arka"), como pestaña en `/salon` y en `/juego/arkanoid`, con la portada `.cover-arkanoid`, distinta de la de BLOQUE BUSTER.
- [ ] Existen `public/games/arkanoid/spritesheet-breakout.png`, `public/games/arkanoid/sounds/ball-bounce.mp3` y `public/games/arkanoid/sounds/break-sound.mp3`, y responden 200 en el servidor de desarrollo.
- [ ] Existe `games/arkanoid/engine.ts` y no declara variables de módulo mutables (`let` de módulo, objetos o arreglos de módulo que se modifican).
- [ ] `games/types.ts` no cambia; `games/registry.ts` incluye `arkanoid: { factory: createArkanoid }`.
- [ ] En `/jugar/arkanoid` hay un `<canvas>` de 800×600 dentro de `.crt-screen` y no existe `.game-arena`.
- [ ] El HUD de plataforma muestra Jugador, Puntuación, Vidas (`♥ ♥ ♥` al iniciar) y Nivel (`01`) reales del motor.
- [ ] El canvas no dibuja score, nivel ni vidas; no muestra "GAME OVER", "¡Completaste el juego!", "PAUSA" ni botones de nivel, y ninguna tecla reinicia la partida.
- [ ] Al perder la tercera vida se abre el modal FIN DEL JUEGO con el score final del motor.
- [ ] FIN durante la partida detiene el juego y abre el modal con el score actual.
- [ ] JUGAR DE NUEVO reinicia a score 0, 3 vidas, nivel 01 y el muro completo del nivel 1, y la partida es jugable.
- [ ] PAUSA congela el canvas (dos capturas separadas por 1 s idénticas) y REANUDAR continúa sin salto; `P` y `Escape` alternan la pausa una sola vez por pulsación.
- [ ] Ocultar la pestaña o quitar el foco pausa el juego y al volver sigue en pausa.
- [ ] Con el juego activo, `←`/`→` no hacen scroll; con el modal abierto o en pausa no son interceptadas y no mueven la paleta.
- [ ] Salir de `/jugar/arkanoid` destruye el motor: sin listeners de teclado ni de ratón ni `requestAnimationFrame` activos (las teclas en otras páginas no generan errores).
- [ ] Bloques, explosiones, paleta y pelota se dibujan con los sprites del spritesheet sobre fondo `#000` (verificado en captura).
- [ ] En emulación móvil táctil (390px) `/jugar/arkanoid` muestra "REQUIERE TECLADO", sin scroll horizontal ni errores en consola.
- [ ] `public.games` contiene la fila `arkanoid` / `ARKANOID` además de `asteroides` y `tetris`; `list_migrations` muestra `game_arkanoid` aplicada; `get_advisors` (security) no reporta hallazgos nuevos.
- [ ] Con sesión, GUARDAR PUNTUACIÓN inserta en `scores` una fila con `game_id = 'arkanoid'` y el score del modal (SQL del MCP), y la marca aparece en `/juego/arkanoid` y en la pestaña ARKANOID de `/salon`.
- [ ] `/jugar/asteroides` y `/jugar/tetris` siguen funcionando igual; `/jugar/bloque-buster` sigue con la simulación.
- [ ] La consola no muestra errores en `/jugar/arkanoid` durante una partida completa (incluido el caso de autoplay de audio bloqueado).
- [ ] Nada en `app/`, `components/`, `lib/` ni `games/` importa archivos de `references/`.

**Gameplay de ARKANOID:**

- [ ] Al iniciar, el nivel 1 muestra 60 bloques (10×6) con un color por fila: rojo, amarillo, cyan, magenta, rosa, verde.
- [ ] La pelota sale sola desde encima de la paleta, sin pulsar ninguna tecla.
- [ ] `←`/`→` mueven la paleta sin salirse del canvas.
- [ ] Mover el ratón sobre el canvas centra la paleta en el cursor, también con el canvas escalado por CSS, sin salirse del canvas.
- [ ] La pelota rebota en las paredes izquierda, derecha y techo, y en la paleta.
- [ ] Al tocar un bloque, desaparece, se reproduce su animación de explosión y la puntuación del HUD sube 10.
- [ ] Suena `ball-bounce.mp3` al rebotar en paredes o paleta y `break-sound.mp3` al romper un bloque (petición de red a `/games/arkanoid/sounds/…` tras la primera interacción).
- [ ] Al caer la pelota bajo la paleta, el HUD pasa de `♥ ♥ ♥` a `♥ ♥` y la pelota reaparece sobre la paleta.
- [ ] Al romper todos los bloques del nivel 1, el HUD muestra nivel 02, aparece la pirámide de 40 bloques y la pelota es más rápida; el score se conserva.
- [ ] Los niveles 3, 4 y 5 muestran ajedrez (30 bloques), filas con huecos (39) y marco + cruz (39).
- [ ] Al romper el último bloque del nivel 5, se abre el modal FIN DEL JUEGO con el score acumulado.

---

## Decisiones

- **Sí:** juego nuevo `arkanoid` / ARKANOID en vez de reutilizar `bloque-buster`. Es un juego distinto con su propio ranking. Sigue el precedente de SPEC 05 (ROCAS) y SPEC 07 (CAÍDA).
- **No:** reemplazar o renombrar `bloque-buster`. Su destino se decide en otro spec.
- **Sí:** tercera posición en `GAMES` y color `magenta`. Entra en la landing sin desplazar a ASTEROIDES como pestaña por defecto de `/salon`, y se distingue de BLOQUE BUSTER y ASTEROIDES (cyan) y TETRIS (green).
- **Sí:** port a motor TypeScript con el contrato `GameFactory` de SPEC 05. Tipado, sin globals, montaje/desmontaje limpio desde React.
- **No:** iframe ni copiar el JS original sin tipos (mismas razones que SPEC 05).
- **No:** extender el contrato. ARKANOID usa 800×600, tiene vidas y niveles y no necesita callbacks extra; la entrada del registro es `{ factory }`.
- **Sí:** spritesheet original copiado a `public/games/arkanoid/`. Port fiel, explosiones animadas incluidas. Los colores salen de los sprites y no de los tokens; es la excepción a la regla de tokens del Vault y se acepta por fidelidad.
- **No:** dibujar los elementos por código con tokens. Se pierde la animación de explosión; puede ir en otro spec.
- **Sí:** sonido incluido, con assets en `public/` y `play()` tolerante a autoplay bloqueado. El original lo tiene (a diferencia de ASTEROIDES, donde SPEC 05 lo difirió).
- **Sí:** HUD de plataforma como única fuente de score, vidas y nivel; en el canvas solo el juego.
- **Sí:** eliminar el selector de niveles de la pausa. Permitiría saltar al nivel 5 y falsear el leaderboard, y su overlay compite con la pausa de plataforma.
- **Sí:** quitar la pausa con `P`/`Escape` del motor. La plataforma ya maneja esas teclas; dos manejadores alternarían la pausa dos veces.
- **Sí:** completar el nivel 5 termina la partida con `onGameOver(score)`, igual que perder las vidas. Toda partida pasa por el modal y el guardado de SPEC 04.
- **Sí:** tope de `dt` en 50 ms y reinicio de `lastTime` al reanudar (el original no tenía tope: tras una pestaña oculta la pelota atravesaría bloques o la paleta).
- **Sí:** port fiel del gameplay (rebote sin ángulo, pelota sin saque, quirk de explosión gris con frames rojos); los cambios van en otro spec.
- **Sí:** alta en `public.games` por migración aplicada con el MCP tras confirmación. Sin la fila, la FK de SPEC 06 rechaza el guardado.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| React 19 Strict Mode monta efectos dos veces: dos motores, listeners y cargas de imagen duplicados | `destroy()` idempotente en el cleanup; el `onload` de la imagen no arranca el loop si la instancia ya se destruyó; criterio que verifica que no quedan listeners ni loops. |
| Teclas "pegadas" al perder foco | Limpiar teclas al pausar; auto-pausa por `blur`. |
| `onStats` a 60 fps provoca re-renders | Llamar `onStats` solo cuando cambia score, vidas o nivel. |
| `P`/`Escape` manejadas por motor y plataforma alternan la pausa dos veces | El motor no escucha `P` ni `Escape`; solo la plataforma. |
| El ratón mueve la paleta con el juego en pausa | El motor ignora `mousemove` si está pausado o terminado; el overlay de pausa además tapa el canvas. |
| Coordenadas del ratón erróneas con el canvas escalado en `.crt-screen` | Conversión con `getBoundingClientRect()` (como el original); criterio explícito. |
| Autoplay bloqueado: `play()` rechaza la promesa y ensucia la consola | `.catch(() => {})` en cada reproducción; criterio de consola limpia. |
| Spritesheet no carga (ruta errónea): canvas negro sin error claro | Ruta absoluta `/games/arkanoid/…`; criterio de assets con respuesta 200. |
| Salto grande de `dt` (pestaña oculta) atraviesa bloques o la paleta | Tope de 50 ms y reinicio de `lastTime` en `resume()`. |
| Sprites pixel-art escalados se ven borrosos | Port fiel (el original no desactiva el suavizado); ajustar `imageSmoothingEnabled` queda para otro spec si molesta. |
| Olvidar o no aplicar la migración de `games`: el guardado falla con error genérico | Paso 3 explícito y criterio con SQL del MCP. |
| Migración aplicada directo en el proyecto remoto | Solo inserta una fila; se pide confirmación antes de aplicar. |
| Dos juegos de ladrillos en el catálogo (ARKANOID y BLOQUE BUSTER) confunden al jugador | Aceptado temporalmente; portada, color y copy distintos. El destino de BLOQUE BUSTER se decide en otro spec. |
| "ARKANOID" es marca registrada y el spritesheet es de un tercero (Petraheim, pide créditos) | Aceptado para este proyecto de curso; renombrar o dar créditos es un cambio de copy en otro spec. |
| El score lo reporta el cliente | Asumido en SPEC 04; anti-trampas en spec posterior. |
| Next.js 16 con convenciones distintas a las recordadas | Leer `node_modules/next/dist/docs/01-app` antes de escribir. |

---

## Lo que **no** está en este spec

- Controles táctiles, HiDPI y soporte móvil jugable.
- Selector o salto de niveles.
- Ángulo de paleta, saque manual, power-ups u otros cambios de gameplay.
- Volumen, mute y música.
- Sprites recoloreados con tokens.
- Cambios a BLOQUE BUSTER.
- Anti-trampas y validación de scores.
- `best` y `plays` desde la base.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.
