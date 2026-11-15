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
| 7 | `bloque-buster` | BLOQUE BUSTER | ARCADE | 2026-10-31 | [14](../specs/14-juego-bloque-buster.md) | `games/bloque-buster/engine.ts` | Sí | clasico, neon, retro | Sí | 0 | 0 | — |
| 8 | `serpentina` | SERPENTINA | ARCADE | 2026-11-15 | [16](../specs/16-juego-serpentina.md) | `games/serpentina/engine.ts` | No | clasico, neon, retro | Sí | 0 | 0 | — |
| 9 | `caida` | CAÍDA | PUZZLE | 2026-11-15 | [15](../specs/15-juego-caida.md) | `games/caida/engine.ts` | No | clasico, neon, retro | Sí | 0 | 0 | — |
| 10 | `gloton` | GLOTÓN | ARCADE | 2026-11-15 | [17](../specs/17-juego-gloton.md) | `games/gloton/engine.ts` | Sí | clasico, neon, retro | Sí | 0 | 0 | — |
| 11 | `invasores` | INVASORES | SHOOTER | 2026-11-15 | [18](../specs/18-juego-invasores.md) | `games/invasores/engine.ts` | Sí | clasico, neon, retro | Sí | 0 | 0 | — |
| 12 | `rocas` | ROCAS | SHOOTER | 2026-11-15 | [19](../specs/19-juego-rocas.md) | `games/rocas/engine.ts` | Sí | clasico, neon, retro | Sí | 0 | 0 | — |
| 13 | `duelo-pixel` | DUELO PIXEL | VERSUS | 2026-11-15 | [20](../specs/20-juego-duelo-pixel.md) | `games/duelo-pixel/engine.ts` | Sí | clasico, neon, retro | Sí | 0 | 0 | — |

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

## 8. SERPENTINA

- **Ruta:** `/jugar/serpentina`
- **Origen:** diseñado desde cero; convierte la entrada demo `serpentina` del catálogo (misma portada `.cover-snake`)
- **Descripción:** serpiente de luz con **giro libre** (no va por casillas, a diferencia de SNAKE): avanza sola y `←` `→` rotan su rumbo (3,4 rad/s). Arena de 768×568 con pared letal. Siempre hay 3 núcleos magenta; cada uno alarga la serpiente 24 px (empieza con 200 px) y la acelera (+3 px/s, de 130 a 280 px/s). Mecánica central, el **cerco**: si la cabeza pasa a menos de 30 px de su propio cuerpo (al menos 160 px atrás) sin tocarlo, el lazo se cierra y captura todo lo que encierra. Una línea punteada avisa cuando hay un cerco listo. Las **esporas** (amarillas, con púas) derivan rebotando en las paredes, matan al tocar la cabeza y solo se destruyen encerrándolas; hay `min(nivel, 6)` en juego y reaparecen a los 4 s. Cada 6 núcleos sube el nivel. Tocar la pared, una espora o el propio cuerpo termina la partida. Sin vidas.
- **Controles:** `←` `→` / `A` `D` girar (mantener)
- **Puntuación:** núcleo comido 10 × nivel · cerco: (20 por núcleo + 100 por espora) × nivel × multiplicador = objetos encerrados (tope ×5)
- **Skins:** clasico, neon, retro (`games/serpentina/skins.ts`; en retro las esporas se distinguen por sus púas en cruz y el hueco central)
- **Táctil:** ◀ ▶ girar (mantener)

## 9. CAÍDA

- **Ruta:** `/jugar/caida`
- **Origen:** diseñado desde cero; convierte la entrada demo `caida` del catálogo (misma portada `.cover-tetro`)
- **Descripción:** pozo de 10×18 con 8 piezas geométricas de 2 a 5 celdas (dúo, barra, ángulo, cuadro, te, escalón, gancho, cruz) en bolsa de 8. Se diferencia de TETRIS en dos cosas. (1) **Prensa:** el techo baja una fila cada `max(6, 16 − nivel)` s (barra PRENSA en el canvas) y cada línea limpiada la sube una; si baja sobre bloques, aplasta y termina la partida (si la pieza está pegada al techo, la bajada espera a que se fije). (2) **Cascada:** tras limpiar, cada grupo conectado sin apoyo cae entero hasta asentarse; si completa más líneas se encadenan (CADENA ×N). Cada 10 líneas sube el nivel (caída `max(70, 800 × 0,86^(nivel−1))` ms por fila). Pieza fantasma y vista previa de la siguiente. Sin vidas.
- **Controles:** `←` `→` / `A` `D` mover · `↓` / `S` caída suave · `↑` / `X` / `W` rotar horario · `Z` rotar antihorario · `Espacio` caída libre
- **Puntuación:** cada paso de cascada con `n` líneas = `100 × n² × cadena × nivel` · +1 por fila en caída suave · +2 por fila en caída libre
- **Skins:** clasico, neon, retro (`games/caida/skins.ts`; en retro las 8 piezas se distinguen por tono + patrón; en neón las que comparten color van rayadas)
- **Táctil:** ◀ ▶ mover (con repetición) · ▼ caída suave · ▲ rotar · A SOLTAR · B GIRAR (antihorario)

## 10. GLOTÓN

- **Ruta:** `/jugar/gloton`
- **Origen:** diseñado desde cero; convierte la entrada demo `gloton` del catálogo (misma portada `.cover-glot`)
- **Descripción:** laberinto procedural de 25×17 casillas (distinto en cada nivel, semilla fija, sin callejones sin salida ni túneles) lleno de puntos. Cuatro espectros salen escalonados de un nido central y **no saben dónde estás**: patrullan y solo persiguen si te ven en línea recta (alcance 12 / 9 / 7 / 5 casillas) o te huelen a ≤ 1,5 casillas; si te pierden van al último punto donde te vieron ("!" al detectarte). Cada 10–14 s aparece una píldora en un lugar aleatorio lejos del glotón (dura 8 s); comerla asusta a los espectros unos segundos (6,5 s − 0,4 s por nivel, mínimo 3 s). Comer todos los puntos sube de nivel con un laberinto nuevo y espectros más rápidos. Tres vidas.
- **Controles:** flechas o `WASD`, por pulsación (la dirección queda en cola hasta el próximo cruce; media vuelta inmediata)
- **Puntuación:** punto 10 · píldora 50 · espectro asustado 150 × n (n-ésimo con la misma píldora) · nivel completo +500 × nivel · sigilo (nivel sin ser visto) +300 × nivel
- **Skins:** clasico, neon, retro (`games/gloton/skins.ts`; en retro el espectro asustado se dibuja hueco)
- **Táctil:** ▲ ▼ ◀ ▶ mover (simulan las flechas) · sin A/B · sin repeat

## 11. INVASORES

- **Ruta:** `/jugar/invasores`
- **Origen:** diseñado desde cero; convierte la entrada demo `invasores` del catálogo (misma portada `.cover-invaders`)
- **Descripción:** cañón abajo contra una formación de 10×5 (acorazados de 2 impactos, medusas y drones; glifos propios de 8×6). Distinto del shooter de formaciones clásico en dos cosas. (1) **Munición de chatarra:** cargador de 6 celdas; cada disparo gasta una y cada invasor destruido suelta un pixel de chatarra que, atrapado con el cañón, devuelve +1 (+2 si era acorazado); recarga pasiva +1 cada 3 s. Un disparo fallado corta la **racha** (×1…×5, multiplica los puntos). (2) **Formación viva:** ondula dentro del campo y baja de forma continua, más rápido cuantos menos quedan; silueta distinta por oleada (bloque, rombo, V, columnas, torres). Un rayo enemigo o que la formación toque la superficie (aterrizaje: retrocede 3 filas) restan una vida. Tres vidas.
- **Controles:** `←` `→` / `A` `D` mover el cañón · `Espacio` / `↑` / `W` disparar (uno por pulsación)
- **Puntuación:** acorazado 40 · medusa 20 · dron 10, × racha · chatarra atrapada 5 × racha · oleada limpia +250 × nivel
- **Skins:** clasico, neon, retro (`games/invasores/skins.ts`; en retro los tipos se distinguen por silueta)
- **Táctil:** ◀ ▶ mover · A FUEGO

## 12. ROCAS

- **Ruta:** `/jugar/rocas`
- **Origen:** diseñado desde cero; convierte la entrada demo `rocas` del catálogo (misma portada `.cover-rocas`)
- **Descripción:** arena cerrada de 800×600 donde todo rebota en las paredes (sin bordes envolventes), distinta de ASTEROIDES en dos cosas. (1) **Propulsión por retroceso:** la nave no tiene propulsor; cada disparo la empuja 42 px/s en sentido contrario al cañón (tope 300 px/s) y `↓` frena. (2) **Fragmentos que se re-fusionan:** al partir una roca (grande → 2 medianas → 2 pequeñas) los fragmentos quedan enlazados; a los 2,5 s aparece un cable punteado, a los 4 s se atraen y, si se tocan, se funden en la roca anterior (sin puntos). Destruir ambos hermanos con ≤ 1,5 s de diferencia da bonus PAR. Desde el nivel 2 cruzan OVNIs por la franja superior disparando hacia la nave. Oleadas de `min(9, 2 + nivel)` rocas grandes. Tres vidas; invulnerable 2,5 s al reaparecer.
- **Controles:** `←` `→` / `A` `D` rotar · `Espacio` disparar (mantener = ráfaga, y moverse por retroceso) · `↓` / `S` frenar
- **Puntuación:** roca grande 10 · mediana 30 · pequeña 60 · PAR de medianas +100 · PAR de pequeñas +200 · OVNI 300
- **Skins:** clasico, neon, retro (`games/rocas/skins.ts`; en retro las balas del OVNI son cuadros huecos para distinguirlas de las propias)
- **Táctil:** ◀ ▶ rotar · ▼ frenar · A DISPARO · B FRENO

## 13. DUELO PIXEL

- **Ruta:** `/jugar/duelo-pixel`
- **Origen:** diseñado desde cero; convierte la entrada demo `duelo-pixel` del catálogo (misma portada `.cover-duelo`)
- **Descripción:** duelo de dos paletas verticales en un campo de 800×512 con bandas que rebotan la bola. Dos mecánicas propias: (1) **efecto**: la velocidad de la paleta al golpear curva la trayectoria de la bola, que la CPU no predice; (2) **remate**: ventana de 170 ms que, si la bola toca la paleta, la acelera un 35 % y duplica el punto si gana. Menú en el canvas: **1 jugador** = escalera de duelos a 5 puntos contra una CPU cada vez más rápida y precisa (PRNG por nivel); ganar un duelo sube el nivel, perderlo cuesta una vida y repite el rival. Tres vidas. **2 jugadores** = exhibición local a 7 puntos que termina con score 0 (no puntúa).
- **Controles:** menú `Espacio`/`1` solitario · `2` dos jugadores. Solitario: `↑` `↓` / `W` `S` mover · `Espacio` / `D` remate. Dos jugadores: J1 `W` `S` + `D` · J2 `↑` `↓` + `←`
- **Puntuación:** punto ganado `100 × nivel + 10 × min(golpes del peloteo, 20)` (×2 si lo gana un remate) · duelo ganado `+500 × nivel + 100 × (5 − puntos de la CPU)`
- **Skins:** clasico, neon, retro (`games/duelo-pixel/skins.ts`; en retro la paleta rival es hueca con muescas)
- **Táctil:** ▲ ▼ mover · A REMATE (también empieza el modo solitario; el modo 2 jugadores requiere teclado)

---

## Agregar un juego nuevo

Usa `/nuevo-juego <juego o carpeta de references/started-games>` para generar el spec y después `/spec-impl <NN-nombre>` para implementarlo. Al terminar, agrega el juego a este archivo.
