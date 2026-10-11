# Juegos implementados — Arcade Vault

Juegos con motor real y leaderboard, según la tabla `public.games` de Supabase (consultada el 2026-10-11). Todo juego que figure aquí tiene motor en `games/<carpeta>/`, entrada en `games/registry.ts`, ficha en `lib/data.ts` y fila en `public.games` (sin esa fila no se pueden guardar puntuaciones).

Los demás títulos del catálogo de `lib/data.ts` todavía usan la arena simulada (demo).

| # | id | Título | Categoría | Alta en `games` | Spec | Motor | Vidas en HUD | Partidas | Jugadores | Récord |
| - | -- | ------ | --------- | --------------- | ---- | ----- | ------------ | -------- | --------- | ------ |
| 1 | `asteroides` | ASTEROIDES | SHOOTER | 2026-10-04 | [05](../specs/05-asteroides-juego-real.md) | `games/asteroids/engine.ts` | Sí | 2 | 1 | 1180 |
| 2 | `tetris` | TETRIS | PUZZLE | 2026-10-10 | [07](../specs/07-juego-tetris.md) | `games/tetris/engine.ts` | No | 1 | 1 | 238 |
| 3 | `arkanoid` | ARKANOID | ARCADE | 2026-10-10 | [08](../specs/08-juego-arkanoid.md) | `games/arkanoid/engine.ts` | Sí | 1 | 1 | 10 |
| 4 | `snake` | SNAKE | ARCADE | 2026-10-10 | [09](../specs/09-juego-snake.md) | `games/snake/engine.ts` | No | 2 | 1 | 70 |

> Las estadísticas (partidas, jugadores, récord) son una foto del 2026-10-11 y cambian con cada partida guardada.

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
- **Puntuación:** 10 × nivel por fruta

---

## Agregar un juego nuevo

Usa `/nuevo-juego <juego o carpeta de references/started-games>` para generar el spec y después `/spec-impl <NN-nombre>` para implementarlo. Al terminar, agrega el juego a este archivo.
