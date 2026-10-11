---
name: game-jam
description: Game jam por tema. Recibe un tema (ej. "juego sobre café"), elige dos ángulos de diseño distintos y lanza dos agentes game-jam en paralelo; cada uno diseña un juego y escribe su spec completo en specs/game-jam/. No escribe código.
disable-model-invocation: true
argument-hint: '<tema del juego, ej. "juego sobre café">'
allowed-tools: Agent, Read, Glob, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(mkdir:*)
---

# /game-jam — dos juegos, un tema, en paralelo

## Contexto de la sesión

Fecha de hoy:
!`date +%F`

Specs de jam existentes:
!`ls specs/game-jam/ 2>/dev/null || echo "(vacía)"`

Juegos reales implementados:
!`grep -o '^ *[a-z-]*: *{ *factory' games/registry.ts 2>/dev/null`

---

Tema recibido: `$ARGUMENTS`

Si está vacío, pide el tema en una frase y detente.

## Paso 1 — Elegir dos ángulos

Elige **dos ángulos de diseño claramente distintos** para el tema: género o mecánica base distinta (ej. para "café": *puzzle de caída con granos* vs *arcade de reflejos sirviendo pedidos*). Criterios:

- Ambos encajan en el contrato de motor (un canvas, teclado, score donde más es mejor, un jugador).
- Ninguno es un reskin de ASTEROIDES, TETRIS, ARKANOID o SNAKE.
- Si en `specs/game-jam/` ya hay specs para el mismo tema, evita sus mecánicas.

Deriva `tema-slug` en kebab-case corto (ej. `cafe`). No preguntes los ángulos al usuario: decídelos y muéstralos en una línea.

## Paso 2 — Lanzar dos agentes en paralelo

Asegura la carpeta con `mkdir -p specs/game-jam`. En **un solo mensaje**, lanza **dos** llamadas a `Agent` con `subagent_type: "game-jam"` (en segundo plano). Cada prompt incluye:

- Tema: `$ARGUMENTS`
- Ángulo propio y ángulo del otro agente.
- Ruta de salida: `specs/game-jam/<tema-slug>-<id>.md` (el agente elige el `id`; dile que use ese patrón).
- Recordatorio: un solo archivo, nada de código, no preguntar.

Espera las dos notificaciones. No escribas specs tú mismo ni repitas el trabajo de los agentes.

## Paso 3 — Cierre

Cuando ambos terminen:

1. Comprueba con `ls specs/game-jam/` que existen los dos archivos. Si los dos eligieron el mismo `id`, avísalo.
2. Presenta una comparación breve: tabla con juego, `id`, cat, mecánica en una línea, controles, esfuerzo, ruta del spec. Añade los supuestos a revisar de cada uno.
3. Recomienda uno en 1–2 líneas.
4. Recuerda cómo seguir:
   - Ambos specs están en `Borrador` y fuera de la numeración de `specs/`.
   - Para implementar uno: moverlo a `specs/NN-juego-<id>.md` (NN = siguiente número), cambiar el encabezado a `SPEC NN`, quitar la línea `Game jam`, revisarlo, ponerlo en `Aprobado` y ejecutar `/spec-impl NN-juego-<id>`.

**Detente aquí.** No implementes ni promuevas specs sin que el usuario lo pida.
