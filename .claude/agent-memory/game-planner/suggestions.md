# Historial de sugerencias — game-planner

Estados: `sugerido` → `aceptado` | `descartado` (con motivo) → `implementado`.

## 2026-10-11 — Recomendar el próximo juego real (tras asteroides, tetris, arkanoid, snake)

| Juego | id propuesto | Categoría | Total | Estado |
| ----- | ------------ | --------- | ----- | ------ |
| INVASORES | invasores | SHOOTER | 31/35 | sugerido |
| GLOTÓN | gloton | ARCADE | 30/35 | sugerido |
| RANARIA | ranaria | ARCADE | 29/35 | sugerido |

- **Elegido:** INVASORES — el menor esfuerzo de todos los que aún usan la demo, con id y portada ya listos, y una mecánica (shooter fijo por oleadas) distinta de Asteroides.
- Fuera del top: DUELO PIXEL (VERSUS; puntuación pobre para el leaderboard y está pensado para 2 jugadores). Los títulos BLOQUE BUSTER, CAÍDA, SERPENTINA y ROCAS duplican juegos ya reales.

## 2026-10-11 — Lista amplia de 20 candidatos (4 agentes en paralelo por género)

| Juego | id propuesto | Categoría | Género | Total | Estado |
| ----- | ------------ | --------- | ------ | ----- | ------ |
| RANARIA | ranaria | ARCADE | laberinto/cruce | 33/35 | aceptado (spec specs/game-jam/ranaria-ranaria.md) |
| GLOTÓN | gloton | ARCADE | laberinto | 33/35 | sugerido |
| DUELO PIXEL | duelo-pixel | VERSUS | deportes (Pong vs CPU) | 33/35 | sugerido |
| TURBO NEÓN | turbo-neon | ARCADE | carreras | 31/35 | sugerido |
| TORRE | torre | ARCADE | habilidad (stacker) | 31/35 | sugerido |
| FUSIÓN | fusion | PUZZLE | puzzle (2048) | 30/35 | sugerido |
| COLUMNAS | caida / columnas | PUZZLE | puzzle (Columns) | 30/35 | sugerido |
| CAVERNA | caverna | ARCADE | habilidad (Helicopter) | 30/35 | sugerido |
| ALUNIZAJE | alunizaje | ARCADE | habilidad (Lunar Lander) | 30/35 | sugerido |
| CIEMPIÉS | ciempies | SHOOTER | shooter (Centipede) | 28/35 | sugerido |
| ESCUADRÓN | escuadron | SHOOTER | shooter vertical (1942) | 28/35 | sugerido |
| DEFENSA ORBITAL | defensa | SHOOTER | defensa (Missile Command) | 27/35 | sugerido |
| DESCARGA | descarga | SHOOTER | twin-stick (Robotron) | 27/35 | sugerido |
| PIRÁMIDE | piramide | ARCADE | plataformas (Q*bert) | 27/35 | sugerido |
| BURBUJAS | burbujas | PUZZLE | puzzle (bubble shooter) | 27/35 | sugerido |
| ECO | eco | PUZZLE | memoria (Simon) | 27/35 | sugerido |
| EXCAVADOR | excavador | ARCADE | laberinto (Dig Dug) | 26/35 | sugerido |
| GALAXIA | galaxia | SHOOTER | shooter (Galaga) | 25/35 | sugerido |
| BARRILES | barriles | ARCADE | plataformas (Donkey Kong) | 25/35 | sugerido |
| GEMAS | gemas | PUZZLE | puzzle (match-3) | 25/35 | sugerido |

- Puntajes de agentes distintos: comparables solo aproximadamente entre géneros.
- GALAXIA solo tiene sentido si se descarta INVASORES (mecánica muy cercana).
- Descartados: BUSCAMINAS (puntaje por tiempo, leaderboard ordena de mayor a menor), endless runner con salto (cubierto por plataformas).
- `cat` en lib/data.ts solo admite ARCADE | PUZZLE | SHOOTER | VERSUS; carreras/deportes van como ARCADE salvo ampliar el tipo.
