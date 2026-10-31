# Juegos implementados — Arcade Vault

Juegos con motor real y leaderboard, según la tabla `public.games` de Supabase (consultada el 2026-10-11). Todo juego que figure aquí tiene motor en `games/<carpeta>/`, entrada en `games/registry.ts`, ficha en `lib/data.ts` y fila en `public.games` (sin esa fila no se pueden guardar puntuaciones).

Los demás títulos del catálogo de `lib/data.ts` todavía usan la arena simulada (demo).

| # | id | Título | Categoría | Alta en `games` | Spec | Motor | Vidas en HUD | Skins | Táctil | Partidas | Jugadores | Récord |
| - | -- | ------ | --------- | --------------- | ---- | ----- | ------------ | ----- | ------ | -------- | --------- | ------ |
| 1 | `asteroides` | ASTEROIDES | SHOOTER | 2026-10-04 | [05](../specs/05-asteroides-juego-real.md) | `games/asteroids/engine.ts` | Sí | clasico | No | 2 | 1 | 1180 |
| 2 | `tetris` | TETRIS | PUZZLE | 2026-10-10 | [07](../specs/07-juego-tetris.md) | `games/tetris/engine.ts` | No | clasico | No | 1 | 1 | 238 |
| 3 | `arkanoid` | ARKANOID | ARCADE | 2026-10-10 | [08](../specs/08-juego-arkanoid.md) | `games/arkanoid/engine.ts` | Sí | clasico | No | 1 | 1 | 10 |
| 4 | `snake` | SNAKE | ARCADE | 2026-10-10 | [09](../specs/09-juego-snake.md) | `games/snake/engine.ts` | No | clasico | Sí | 2 | 1 | 70 |
| 5 | `ranaria` | RANARIA | ARCADE | 2026-10-11 | [10](../specs/10-ranaria-ranaria.md) | `games/ranaria/engine.ts` | Sí | clasico, neon, retro | No | 0 | 0 | — |
| 6 | `frogger` | FROGGER | ARCADE | 2026-10-31 | [13](../specs/13-juego-frogger.md) | `games/frogger/engine.ts` | Sí | clasico, neon, retro | Sí | 0 | 0 | — |
| 7 | `bloque-buster` | BLOQUE BUSTER | ARCADE | pendiente (migración sin aplicar) | [14](../specs/14-juego-bloque-buster.md) | `games/bloque-buster/engine.ts` | Sí | clasico, neon, retro | Sí | 0 | 0 | — |

> Las estadísticas (partidas, jugadores, récord) son una foto del 2026-10-11 y cambian con cada partida guardada.

Los skins se eligen en `/jugar/<id>` cuando el juego declara 2 o más (SPEC 11); los agrega el agente `skin-designer`.

En dispositivos táctiles, los juegos que declaran `touch` en `games/registry.ts` se juegan con el gamepad de pantalla (SPEC 12); el resto muestra "REQUIERE TECLADO". Los mapeos los agrega el agente `mobile-porter`.

En todos los juegos, `P` / `Esc` pausan (la plataforma se encarga) y la pestaña oculta pausa automáticamente.

---

## 1. ASTEROIDES

- **Ruta:** `/jugar/asteroides`
- **Origen:** portado de `references/started-games/02-asteroids/`
- **Descripción:** pilotas una nave triangular en un campo de asteroides sin bordes: lo que sale por un lado entra por el otro. Cada roca grande se parte en medianas y cada mediana en pequeñas. El power-up **3x** activa el disparo en abanico. Tres vidas.
- **Controles:** `←` `→` rotar · `↑` propulsar · `Espacio` disparar
- **Puntuación:** asteroide grande 20 · mediano 50 · pequeño 100

## 2. TETRIS

- **Ruta:** `/jugar/tetris`
- **Origen:** portado de `references/started-games/03-tetris/`
- **Descripción:** pozo de 10×20 con ocho piezas, incluida la "tuerca" (pieza con hueco al centro). Rotación con rebote en las paredes, pieza fantasma y caída libre. Cada 10 líneas sube el nivel y la caída se acelera. Sin vidas.
- **Controles:** `←` `→` mover · `↓` caída suave · `↑` / `X` rotar · `Espacio` caída libre
- **Puntuación:** líneas 100 / 300 / 500 / 800 (1–4 líneas) × nivel · +1 por celda en caída suave · +2 por celda en caída libre

## 3. ARKANOID

- **Ruta:** `/jugar/arkanoid`
- **Origen:** portado de `references/started-games/04-arkanoid/` (spritesheet y sonidos en `public/games/arkanoid/`)
- **Descripción:** rompe el muro con la pelota sin dejarla caer. Hay cinco muros (`games/arkanoid/levels.ts`): parrilla, pirámide, ajedrez, huecos y marco con cruz. Cada muro superado acelera la pelota un 10 %. Tres vidas.
- **Controles:** ratón o `←` `→` para mover la paleta
- **Puntuación:** 10 por ladrillo

## 4. SNAKE

- **Ruta:** `/jugar/snake`
- **Origen:** motor escrito desde cero, con los sprites de fruta de `references/started-games/05-snake-assets/` (`public/games/snake/fruits.png`)
- **Descripción:** tablero de 32×24. Cada fruta alarga la serpiente una celda y cada cinco frutas sube el nivel, con más velocidad. Chocar contra la pared o contra el propio cuerpo termina la partida. Sin vidas.
- **Controles:** flechas o `WASD`
- **Táctil:** ▲ ▼ ◀ ▶ girar (simulan las flechas) · sin A/B · sin repeat
- **Puntuación:** 10 × nivel por fruta

## 5. RANARIA

- **Ruta:** `/jugar/ranaria`
- **Origen:** diseñado desde cero en la game jam (`/game-jam`); convierte la entrada demo `ranaria` del catálogo (misma portada `.cover-rana`)
- **Descripción:** tablero de 16×12 al estilo Frogger. La rana esquiva 4 carriles de coches y camiones, cruza 5 carriles de río montada en troncos y tortugas (el agua mata) y debe ocupar los 5 nenúfares de la orilla. 30 s por rana, con barra de tiempo en el canvas. Al llenar los 5 nenúfares sube el nivel y todo va un 15 % más rápido (tope ×2.2). Tráfico fijo, sin azar. Tres vidas.
- **Controles:** flechas o `WASD`, un salto de una celda por pulsación (mantener no repite)
- **Puntuación:** +10 por fila nueva alcanzada por rana · +50 por nenúfar · +10 por segundo restante al llegar · +1000 por nivel completo

## 6. FROGGER

- **Ruta:** `/jugar/frogger`
- **Origen:** diseñado desde cero; reescritura al contrato de la plataforma del spec de game jam `specs/game-jam/01-frogger-core.md`
- **Descripción:** tablero de 16×14 celdas de 40 px centrado en el canvas de 800×600. 5 carriles de coches y camiones, mediana segura y 6 carriles de río con troncos y tortugas (algunos grupos se hunden: 3 s a flote, 1,5 s bajo el agua, con aviso). Arriba, 5 bocas de 2 columnas; caer en el seto o en una boca ocupada mata. 15 s por rana (−1 s por nivel, mínimo 8), barra de tiempo bajo el tablero. Al llenar las 5 bocas sube el nivel y todo va un 15 % más rápido (tope ×2,5). Tres vidas.
- **Controles:** flechas o `WASD`, un salto de una celda por pulsación con animación de 120 ms (mantener no repite; una dirección en cola durante el salto)
- **Puntuación:** +10 por fila nueva alcanzada por rana · +50 por boca + 10 por segundo restante · +200 por ronda completa
- **Skins:** clasico, neon, retro (`games/frogger/skins.ts`)
- **Táctil:** ◀ ▶ ▲ ▼ saltar (una celda por toque)

## 7. BLOQUE BUSTER

- **Ruta:** `/jugar/bloque-buster`
- **Origen:** diseñado desde cero; convierte la entrada demo `bloque-buster` del catálogo (misma portada `.cover-bricks`)
- **Descripción:** paleta y bola contra un muro de 12×16 bloques de 4 colores, distinto de ARKANOID en dos cosas. (1) **Núcleo cromático:** la bola lleva un color y solo rompe bloques de ese color, pulverizando de una vez todo el grupo conectado (4 vecinos); tocar un bloque de otro color no lo rompe: la bola rebota y adopta ese color. (2) **Muro descendente:** solo 7 filas visibles al empezar; cada `max(4, 10 − 0,75 × (nivel − 1))` s baja una fila (barra de tiempo arriba). Si cruza la línea de peligro hay brecha: −1 vida y se retiran las 3 filas inferiores. Muros procedurales deterministas (4 patrones que rotan por nivel). Vaciar el muro sube el nivel y acelera la bola un 6 % (tope ×1,6). Tres vidas.
- **Controles:** `←` `→` / `A` `D` mover la nave · `Espacio` / `↑` / `W` lanzar la bola
- **Puntuación:** grupo de `n` bloques = `10 × n × min(n, 10)` · nivel completo +500 × nivel
- **Skins:** clasico, neon, retro (`games/bloque-buster/skins.ts`; en retro los 4 colores se distinguen también por patrón)
- **Táctil:** ◀ ▶ mover · A LANZAR

---

## Agregar un juego nuevo

Usa `/nuevo-juego <juego o carpeta de references/started-games>` para generar el spec y después `/spec-impl <NN-nombre>` para implementarlo. Al terminar, agrega el juego a este archivo.
