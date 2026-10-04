# SPEC 05 — ASTEROIDES: primer juego real de la plataforma

> **Status:** APROBADO
> **Depends on:** SPEC 01, SPEC 02, SPEC 04
> **Date:** 2026-10-04
> **Objective:** Agregar el juego nuevo `asteroides` al catálogo, portando el Asteroids de `references/started-games/02-asteroids/` a un motor TypeScript en `games/asteroids/` y montándolo en `/jugar/asteroides` para que la partida real alimente el HUD, el modal de fin y el guardado de puntuación existentes.

---

## Por qué existe este spec

Hoy ningún juego del Vault es jugable: `components/game-player.tsx` suma puntos aleatorios con `setInterval` sobre una arena CSS decorativa (`.game-arena`). SPEC 04 dejó el guardado de scores real en Supabase, pero el score que se guarda es inventado.

Este es el primer juego real. El original es un único `game.js` (510 líneas) de canvas puro con estado global, HUD y "GAME OVER" dibujados en el canvas y reinicio con Espacio. Para encajar en la plataforma se convierte en un motor encapsulado que se monta y desmonta desde React y comunica su estado por callbacks. El contrato del motor (`games/types.ts`) y el registro por id (`games/registry.ts`) quedan listos para que Tetris y Arkanoid (`references/started-games/03-tetris`, `04-arkanoid`) lleguen en specs propios.

ASTEROIDES es una entrada **nueva** del catálogo. La entrada mock `rocas` (ROCAS) no se toca y sigue con la simulación.

---

## Alcance

**Entra:**

- Entrada nueva en `GAMES` de `lib/data.ts`, insertada en la **primera posición** (ver Modelo de datos):
  - `id: "asteroides"`, `title: "ASTEROIDES"`, `cat: "SHOOTER"`, `color: "cyan"`, `cover: "cover-asteroides"`, `best: 0`, `plays: "0"`.
  - Copy `short` y `long` basados en el juego real (sin OVNIs ni nada que el juego no tenga).
- Portada CSS nueva `.cover-asteroides` en `app/globals.css`, junto a las demás `cover-*`: fondo espacial oscuro, nave triangular `--cyan` con glow y asteroides poligonales con trazo `--yellow` (sin imágenes externas). Distinta visualmente de `.cover-rocas`.
- Carpeta nueva `games/` en la raíz (alias `@/games/...`):
  - `games/types.ts`: contrato común de motores (ver Modelo de datos).
  - `games/asteroids/engine.ts`: port a TypeScript de `game.js`.
  - `games/registry.ts`: mapa `id de juego → fábrica de motor`; contiene solo `asteroides`.
- Port fiel del gameplay: mismas constantes (rotación, empuje, drag, velocidades, radios), puntos 20/50/100 por tamaño 3/2/1, 3 vidas, invencibilidad con parpadeo al reaparecer, niveles (`3 + nivel` asteroides grandes), partículas, power-up de triple disparo (15 % de drop, garantizado a las 5 bajas, 5 s de duración, 12 s de vida) y su indicador `3x` dentro del canvas.
- Cambios respecto al original:
  - Sin estado global: todo el estado vive dentro de la instancia creada por `createAsteroids(canvas, callbacks)`.
  - Se elimina el HUD del canvas (score, nivel, iconos de vidas). Solo queda en el canvas el indicador `3x  N.Ns` del power-up.
  - Se elimina el overlay "GAME OVER … ESPACIO PARA REINICIAR" y el reinicio con Espacio. Al perder la última vida el motor deja de actualizar y llama `onGameOver(score)`.
  - Colores desde los tokens de `app/globals.css` leídos con `getComputedStyle(document.documentElement)` al crear el motor, con fallback al hex del token: nave `--cyan`, asteroides `--yellow`, balas `--ink`, partículas `--magenta`, llama del propulsor `--magenta`, power-up `--green`. Fondo `#000`. Textos del canvas con `--pixel`.
  - Listeners de teclado (`keydown`/`keyup` en `window`) registrados al crear y removidos en `destroy()`. `preventDefault()` solo para `ArrowLeft`, `ArrowRight`, `ArrowUp` y `Space`, y solo mientras el motor está activo (no pausado ni terminado), para que la página no haga scroll.
  - `pause()` detiene el loop; `resume()` lo reanuda reiniciando el tiempo de referencia para que el primer `dt` sea 0 (sin salto). Se mantiene el tope de `dt` en 50 ms.
  - Teclas mantenidas se limpian al pausar (evita nave girando sola al reanudar).
- `components/game-player.tsx`:
  - Si `games/registry.ts` tiene motor para `game.id`, renderiza `<canvas width={800} height={600}>` dentro de `.crt-screen` ocupando el 100 % (escala por CSS; `.crt-screen` ya es 4:3) en lugar de `.game-arena`, y monta el motor en un `useEffect` con `destroy()` en el cleanup.
  - HUD de plataforma alimentado por `onStats`: puntuación, vidas (`♥` por vida) y nivel reales del motor. No corre el `setInterval` simulado.
  - PAUSA/REANUDAR llama `pause()`/`resume()`. Teclas `P` y `Escape` alternan la pausa (solo con motor real y sin modal abierto). Auto-pausa en `visibilitychange` (pestaña oculta) y `blur` de la ventana; no se reanuda sola.
  - FIN detiene el motor con `end()` y abre el modal FIN DEL JUEGO con el score actual, guardable igual que una partida terminada.
  - `onGameOver(score)` abre el mismo modal. El guardado usa `saveScore` de SPEC 04 sin cambios.
  - JUGAR DE NUEVO destruye el motor y crea uno nuevo (score 0, 3 vidas, nivel 1).
  - En dispositivos sin teclado físico (`matchMedia("(hover: none) and (pointer: coarse)")`) se muestra sobre el canvas un aviso `.crt-content` "REQUIERE TECLADO" y el motor no se crea.
  - Juegos sin motor en el registro (incluida ROCAS) siguen exactamente como hoy (arena simulada y `setInterval`).
- Verificación con Playwright MCP y `npm run build` / `npm run lint`; capturas en `.playwright-screenshot/`.

**Fuera de alcance (para specs futuros):**

- Cambios a la entrada `rocas` (copy, portada, eliminarla o fusionarla con ASTEROIDES).
- Controles táctiles y soporte móvil jugable.
- Bloque de controles/instrucciones en la UI y tags de detalle por juego (`TECLADO / TÁCTIL` queda igual para todos).
- Cambios de gameplay: OVNIs, vida extra, sonido, música, dificultad configurable.
- Canvas HiDPI (`devicePixelRatio`); se renderiza a 800×600 lógicos y se escala por CSS.
- Tetris (`03-tetris`) y Arkanoid (`04-arkanoid`): cada uno con su spec, reutilizando `games/types.ts` y `games/registry.ts`.
- Anti-trampas o validación server-side del score (ya diferido en SPEC 04).
- `best` y `plays` calculados desde la base (siguen siendo valores estáticos en `lib/data.ts`).
- Tests automatizados (no hay test runner).

---

## Modelo de datos

No se agregan tablas, migraciones ni variables de entorno. Las partidas se guardan en `scores` con `game_id = 'asteroides'` (formato válido para el `check` `^[a-z0-9-]{1,40}$` de SPEC 04).

Entrada nueva en `GAMES` (`lib/data.ts`), primera del arreglo:

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "Rota, propulsa y pulveriza rocas en el vacío.",
  long: "Pilotas una nave triangular en un campo de asteroides donde los bordes no existen: lo que sale por un lado entra por el otro. Cada roca grande se parte en medianas y cada mediana en pequeñas. Recoge el power-up 3x para disparar en abanico y sobrevive nivel tras nivel con solo tres vidas.",
  cat: "SHOOTER",
  cover: "cover-asteroides",
  color: "cyan",
  best: 0,
  plays: "0",
}
```

Contrato de motor en `games/types.ts`:

```ts
export type GameStats = { score: number; lives: number; level: number };

export type GameCallbacks = {
  onStats: (stats: GameStats) => void;      // al iniciar y cada vez que cambia algún valor
  onGameOver: (finalScore: number) => void; // una sola vez por instancia
};

export type GameEngine = {
  pause: () => void;
  resume: () => void;
  end: () => number;   // detiene definitivamente (botón FIN) y devuelve el score actual; no dispara onGameOver
  destroy: () => void; // cancela requestAnimationFrame y quita listeners; idempotente
};

export type GameFactory = (canvas: HTMLCanvasElement, callbacks: GameCallbacks) => GameEngine;
```

Registro en `games/registry.ts`:

```ts
export const ENGINES: Record<string, GameFactory> = {
  asteroides: createAsteroids,
};
```

Estado interno del motor (privado a `games/asteroids/engine.ts`): `ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `score`, `lives`, `level`, `phase: 'playing' | 'dead' | 'over' | 'ended'`, `deadTimer`, `powerUpSpawned`, `killsSinceSpawn`, `paused`, `lastTime`, `rafId`, `keys`, `justPressed`. Clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle` portadas con tipos y con el contexto 2D y los colores recibidos por parámetro en lugar de globals.

---

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app` en lo relativo a client components y `useEffect` (según `AGENTS.md`). Agregar la entrada `asteroides` al inicio de `GAMES` y la portada `.cover-asteroides` en `app/globals.css`. Manual: la tarjeta aparece en `/`, `/juegos`, `/salon` y `/juego/asteroides`; `/jugar/asteroides` abre con la simulación actual.
2. Crear `games/types.ts`, `games/asteroids/engine.ts` (port completo: clases, loop, colisiones, niveles, power-up, colores desde tokens, teclado con `preventDefault` acotado, `pause`/`resume`/`end`/`destroy`) y `games/registry.ts` con `asteroides`. Aún no se usa. Manual: `npm run build` y `npm run lint` pasan.
3. Adaptar `components/game-player.tsx`: canvas y montaje del motor cuando hay entrada en el registro, HUD desde `onStats`, modal desde `onGameOver`, FIN con `end()`, JUGAR DE NUEVO recreando el motor; resto de juegos sin cambios. Manual: `/jugar/asteroides` se juega con teclado y al perder 3 vidas abre el modal; `/jugar/rocas` sigue con la simulación.
4. Pausa: botón, teclas `P`/`Escape`, auto-pausa por `visibilitychange` y `blur`; limpieza de teclas al pausar. Manual: pausar, cambiar de pestaña y volver sigue pausado; reanudar no produce salto.
5. Aviso "REQUIERE TECLADO" en dispositivos táctiles sin teclado. Manual: emulación móvil en Playwright muestra el aviso.
6. Verificar criterios de aceptación con Playwright MCP (desktop y 390px, consola, guardado en Supabase) y guardar capturas en `.playwright-screenshot/`.

Cada paso deja la app corriendo y commiteable.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `GAMES[0]` es `asteroides` con los valores del Modelo de datos; la entrada `rocas` no cambió (diff de `lib/data.ts` solo agrega la entrada nueva).
- [ ] La tarjeta ASTEROIDES aparece en `/` (sección de juegos), en `/juegos` (incluido el filtro SHOOTER y la búsqueda "aster"), como pestaña en `/salon` y en `/juego/asteroides`, con la portada `.cover-asteroides`, distinta de la de ROCAS.
- [ ] Existen `games/types.ts`, `games/registry.ts` y `games/asteroids/engine.ts`; `engine.ts` no declara variables de módulo mutables (todo el estado está dentro de la instancia).
- [ ] En `/jugar/asteroides` hay un `<canvas>` de 800×600 dentro de `.crt-screen` y no existe `.game-arena`.
- [ ] Con teclado: `←`/`→` rotan la nave, `↑` propulsa, `Espacio` dispara; los bordes envuelven nave, balas y asteroides.
- [ ] Destruir un asteroide grande, mediano y pequeño suma 20, 50 y 100 respectivamente en el HUD de plataforma; grandes y medianos se parten en dos.
- [ ] El HUD de plataforma muestra vidas y nivel reales del motor: empieza en 3 vidas y nivel 01; perder una vida descuenta un `♥`; limpiar el campo sube el nivel.
- [ ] El canvas no dibuja score, nivel ni iconos de vidas; el indicador `3x` aparece solo con el power-up activo.
- [ ] Al perder la tercera vida se abre el modal FIN DEL JUEGO con el score final del motor; el canvas no muestra "GAME OVER" ni "ESPACIO PARA REINICIAR" y Espacio no reinicia.
- [ ] Con sesión, GUARDAR PUNTUACIÓN inserta en `scores` una fila con `game_id = 'asteroides'` y el score mostrado en el modal (verificado con SQL del MCP de Supabase), y la marca aparece en `/juego/asteroides` y en la pestaña ASTEROIDES de `/salon`.
- [ ] FIN durante la partida detiene el juego y abre el modal con el score actual.
- [ ] JUGAR DE NUEVO reinicia a score 0, 3 vidas, nivel 01 y la partida es jugable.
- [ ] PAUSA congela el canvas (posiciones idénticas en dos capturas separadas por 1 s) y REANUDAR continúa sin salto; `P` y `Escape` alternan la pausa.
- [ ] Ocultar la pestaña o quitar el foco de la ventana pausa el juego y al volver sigue en pausa.
- [ ] Con el juego activo, `Espacio` y las flechas no hacen scroll de la página; con el modal abierto o en pausa, `Espacio` no es interceptado por el motor.
- [ ] Salir de `/jugar/asteroides` (botón SALIR o navegación) destruye el motor: no quedan listeners de teclado ni `requestAnimationFrame` activos (las teclas en otras páginas no generan errores en consola).
- [ ] Nave, asteroides, partículas y power-up usan los colores de los tokens indicados (verificado en captura).
- [ ] En emulación móvil táctil (Playwright, 390px) `/jugar/asteroides` muestra "REQUIERE TECLADO", sin scroll horizontal y sin errores en consola.
- [ ] `/jugar/rocas` y `/jugar/caida` (juegos sin motor) siguen funcionando con la simulación actual.
- [ ] La consola del navegador no muestra errores en `/jugar/asteroides` durante una partida completa.
- [ ] Nada en `app/`, `components/`, `lib/` ni `games/` importa archivos de `references/`.

---

## Decisiones

- **Sí:** juego nuevo `asteroides` / ASTEROIDES en lugar de reutilizar `rocas`. Es un juego distinto con su propio ranking; el nombre en español sigue la convención del catálogo.
- **No:** reutilizar o renombrar `rocas`. ROCAS queda como mock sin cambios; qué hacer con ella (eliminar, fusionar) se decide en otro spec.
- **Sí:** insertar ASTEROIDES primero en `GAMES`. Al ser el único juego jugable aparece en la landing (`GAMES.slice(0, 6)`) y es la pestaña por defecto del `/salon`.
- **Sí:** portada CSS propia `.cover-asteroides` en cyan. Evita dos tarjetas idénticas en el catálogo.
- **Sí:** `best: 0` y `plays: "0"`. Juego nuevo, sin números inventados.
- **Sí:** port a motor TypeScript con contrato `GameFactory` y callbacks. Tipado, lint, sin globals, montaje/desmontaje limpio desde React y reutilizable para los próximos juegos.
- **No:** iframe con los archivos estáticos ni copiar `game.js` casi tal cual. El iframe obliga a `postMessage` y complica foco/teclado; el JS sin tipos rompe la convención del proyecto.
- **Sí:** carpeta `games/` en la raíz con `registry.ts`. Separa la lógica de juego de la UI (`components/`) y de datos (`lib/`).
- **Sí:** HUD de plataforma alimentado por el motor y HUD del canvas eliminado (salvo el `3x`). Una sola fuente visual de score/vidas/nivel, coherente con el resto del Vault.
- **Sí:** game over por modal de plataforma, sin reinicio con Espacio. Así toda partida pasa por el flujo de guardado de SPEC 04.
- **Sí:** FIN termina la partida y permite guardar el score actual. Mantiene el comportamiento actual del botón.
- **Sí:** pausa por botón, `P`/`Escape` y auto-pausa al perder foco, sin reanudar sola.
- **Sí:** lógica fija 800×600 escalada por CSS dentro del CRT (4:3); solo teclado, con aviso en táctiles. Controles táctiles y HiDPI se difieren.
- **Sí:** colores neón desde los tokens de `globals.css`. El juego encaja en la estética del Vault sin duplicar hex a mano.
- **Sí:** port fiel del gameplay. Cualquier ajuste (OVNIs, sonido, vida extra) va en otro spec.
- **Sí:** juegos sin motor mantienen la simulación. El Vault no pierde pantallas mientras llegan los demás ports.
- **No:** bloque de controles en pantalla ni tags por juego en este spec.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Dos juegos de asteroides en el catálogo (ASTEROIDES y ROCAS) confunden al jugador | Aceptado temporalmente; portada y copy distintos. Decidir el destino de ROCAS en otro spec. |
| Cambiar el primer elemento de `GAMES` altera la pestaña por defecto de `/salon` y las tarjetas de la landing | Intencional; criterio de aceptación revisa ambas pantallas. |
| React 19 en desarrollo monta efectos dos veces (Strict Mode): dos motores y listeners duplicados | `destroy()` idempotente en el cleanup del `useEffect`; criterio que verifica que no quedan listeners ni loops tras salir. |
| `preventDefault` sobre `Space` bloquea botones del modal o inputs | Solo se intercepta con el motor activo; el motor se detiene antes de abrir el modal. Criterio explícito. |
| Saltos de física al reanudar tras pausa o pestaña oculta | `resume()` reinicia `lastTime`; tope de `dt` en 50 ms; auto-pausa en `visibilitychange`. |
| Teclas "pegadas" al perder foco (keyup nunca llega) | Limpiar `keys` y `justPressed` al pausar; la auto-pausa por `blur` cubre el caso. |
| Callbacks `onStats` a 60 fps provocan re-renders excesivos | Llamar `onStats` solo cuando cambia score, vidas o nivel, no por frame. |
| Detección de táctil falla en híbridos (laptop con pantalla táctil) | Se usa `(hover: none) and (pointer: coarse)`, que en híbridos con mouse/trackpad no coincide. |
| Escalado CSS deja el canvas borroso en pantallas HiDPI | Aceptado; HiDPI diferido. |
| El score lo reporta el cliente y ahora es fácil de manipular desde DevTools | Ya asumido en SPEC 04; anti-trampas en spec posterior. |
| Next.js 16 con convenciones distintas a las recordadas | Leer `node_modules/next/dist/docs/01-app` antes de escribir, según `AGENTS.md`. |

---

## Lo que **no** está en este spec

- Cambios a ROCAS.
- Controles táctiles, HiDPI y soporte móvil jugable.
- Bloque de controles en la UI y tags por juego.
- OVNIs, sonido, vida extra u otros cambios de gameplay.
- Tetris, Arkanoid y cualquier otro port.
- Anti-trampas y validación de scores.
- `best` y `plays` desde la base.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.
