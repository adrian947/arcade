---
name: nuevo-juego
description: Genera el spec para agregar un juego real a Arcade Vault (motor TypeScript + registry + catálogo + portada + fila en public.games para el leaderboard), portado desde references/started-games o diseñado desde cero. No escribe código; la implementación se hace después con /spec-impl.
disable-model-invocation: true
argument-hint: '<nombre del juego o carpeta de references/started-games (ej. 03-tetris)>'
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(wc:*), Bash(grep:*)
---

# /nuevo-juego — Spec para integrar un juego real con leaderboard

## Contexto de la sesión

Fecha de hoy (úsala en el encabezado del spec, nunca la adivines):
!`date +%F`

Specs existentes:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

Juegos de referencia disponibles:
!`ls references/started-games/ 2>/dev/null || echo "Sin carpeta references/started-games"`

Motores ya integrados:
!`ls games/ 2>/dev/null`

Contrato y registro actuales:
!`cat games/types.ts games/registry.ts 2>/dev/null`

Ids del catálogo (`lib/data.ts`):
!`grep -n 'id: "' lib/data.ts 2>/dev/null`

Migraciones:
!`ls supabase/migrations/ 2>/dev/null`

---

Esta skill produce **un único archivo**: `specs/NN-juego-<id>.md`, listo para que el usuario lo apruebe y lo implemente con `/spec-impl`. **Aquí no se escribe código, no se aplican migraciones ni se toca Supabase.**

La receta de integración viene de tres specs ya implementados, que son la fuente de verdad:

- **SPEC 04** (`specs/04-supabase-auth-y-ranking.md`): `scores`, vista `leaderboard`, `saveScore`, ranking en `/salon` y `/juego/[id]`.
- **SPEC 05** (`specs/05-asteroides-juego-real.md`): contrato de motor (`games/types.ts`), registro (`games/registry.ts`), motor portado (`games/asteroids/engine.ts`), integración en `components/game-player.tsx`, entrada en `lib/data.ts`, portada `.cover-*`.
- **SPEC 06** (`specs/06-tabla-games-y-fk-scores.md`): tabla `public.games` y FK `scores.game_id → games.id`. **Sin fila en `games` el guardado de puntuación falla.**

La plantilla con la receta fija está en `game-spec-template.md` (misma carpeta). Úsala siempre.

Responde en el idioma del prompt del usuario (por defecto español, como los specs del repo).

---

## Fase 1 — Contexto del proyecto

1. Lee `CLAUDE.md` y `AGENTS.md`.
2. Lee SPEC 04, 05 y 06 completos, y cualquier spec posterior que toque `games/` (revisa el listado de arriba). Toma de ahí el idioma, las palabras de estado (`Borrador`, `Aprobado`, `Implementado`) y el formato de secciones.
3. Lee `games/types.ts`, `games/registry.ts`, `components/game-player.tsx`, `lib/data.ts` (tipo `Game`, valores válidos de `cat` y `color`, ids existentes) y, como patrón de motor, `games/asteroids/engine.ts` (`readPalette`, `withAlpha`, `startLoop`/`stopLoop`, objeto retornado con `pause`/`resume`/`end`/`destroy`).
4. Revisa en `app/globals.css` las clases `.cover-*` existentes (en especial `.cover-asteroides`) y `.game-canvas`.

Si `$ARGUMENTS` llega vacío, pregunta: "¿Qué juego quieres agregar? Puede ser una carpeta de `references/started-games/` o un juego nuevo descrito en una frase."

## Fase 2 — Analizar el origen del juego

### A. Desde `references/started-games/`

Si `$ARGUMENTS` coincide con una carpeta (nombre completo `03-tetris`, solo número `03` o solo slug `tetris`):

1. Lee todos los archivos de código y documentación de la carpeta: `game.js`, `index.html`, `style.css`, `README.md`, `CLAUDE.md`, módulos extra (`levels.js`, `assets/*.js`) y sus `specs/` internos si existen. Usa `wc -l` para dimensionar.
2. Extrae y anota (lo usarás en el spec):
   - Tamaño del canvas principal y canvas secundarios (ej. "siguiente pieza").
   - Constantes de gameplay (velocidades, radios, tamaños de grilla, tiempos).
   - Controles (teclas exactas) y si alguna choca con `P` o `Escape`, que la plataforma reserva para pausa.
   - Reglas de puntaje, vidas, niveles y condición de fin.
   - Qué dibuja en el canvas que la plataforma ya muestra (score, vidas, nivel, "GAME OVER", "PRESIONA X PARA REINICIAR") y debe eliminarse.
   - HUD/UI fuera del canvas (DOM en `index.html`) que hay que absorber o descartar.
   - Estado global, `requestAnimationFrame`, listeners sin cleanup.
   - Assets: imágenes, spritesheets, sonidos (rutas y tamaño).
   - Colores hardcodeados a mapear a tokens.
3. Detecta si se parece a un mock del catálogo (ej. Tetris ≈ `caida`, Arkanoid ≈ `bloque-buster`, Asteroids ≈ `rocas`).

### B. Juego desde cero

Si no hay carpeta, pide en un bloque: mecánica en una frase, controles, reglas de puntaje, vidas (o ninguna), niveles/dificultad, condición de fin. Si la descripción no cabe en una frase o el juego es grande, propone dividirlo (spec base jugable + specs de extras).

## Fase 3 — Preguntas de clarificación

Haz las preguntas en bloques de 3–4 con `AskUserQuestion`, recomendación primero y marcada `(Recomendado)`. No preguntes lo que ya responde el análisis o los specs previos. Temas obligatorios:

1. **Identidad:** `id` (`^[a-z0-9-]{1,40}$`, en español como el catálogo: `asteroides`, no `asteroids`) y `title` en mayúsculas (≤ 40 caracteres).
2. **Relación con mock:** si hay un mock parecido, ¿entrada nueva (precedente de SPEC 05) o reemplazar el mock? Recomienda entrada nueva salvo que el usuario quiera limpiar el catálogo.
3. **Catálogo:** `cat` (valores del tipo `Game`), `color`, posición en `GAMES` (primera posición = aparece en landing y es pestaña por defecto de `/salon`), copy `short`/`long` (propón un borrador basado en el juego real, sin inventar features).
4. **Portada:** idea de `.cover-<id>` solo con CSS/SVG inline, distinta de las existentes.
5. **Colores:** mapeo de cada elemento del juego a tokens (`--cyan`, `--magenta`, `--yellow`, `--green`, `--ink`, `--pixel`), fondo `#000`.
6. **Canvas HUD:** qué queda dibujado en el canvas (indicadores propios del juego como "siguiente pieza" o un power-up) y qué se elimina porque lo muestra el HUD de plataforma.
7. **Assets y sonido:** si hay assets, ¿se copian a `public/games/<id>/` o se dibujan por código? Sonido: ¿entra o se difiere? (SPEC 05 lo difirió.)
8. **Gameplay:** port fiel (recomendado) o cambios concretos.
9. **Conflicto de teclas:** si el juego usa `P` o `Escape`, ¿se reasigna la tecla del juego o se cambia la pausa?

Deja de preguntar cuando puedas responder sin asumir: qué archivos aparecen o cambian, cuál es el primer y el último paso, y cómo se verifica que el juego quedó integrado.

## Fase 4 — Chequeo del contrato de motor

Compara el juego con el contrato y el `GamePlayer` actuales (léelos, no confíes en la memoria):

- Hoy `GamePlayer` renderiza `<canvas width={800} height={600}>` fijo, el HUD asume vidas (`♥`) y nivel, y `ENGINES` mapea `id → GameFactory`.
- Si el juego **cabe** (800×600, tiene vidas y nivel, no necesita callbacks extra): sin cambios al contrato.
- Si **no cabe** (otro tamaño o proporción, sin vidas, sin niveles, necesita otra información en el HUD) y ningún spec previo extendió ya el contrato: el spec debe incluir un paso **"Extender contrato de motores"** con este diseño:
  - `games/registry.ts` pasa a `ENGINES: Partial<Record<string, EngineEntry>>` con `type EngineEntry = { factory: GameFactory; width: number; height: number; lives?: boolean; level?: boolean }` (definido en `games/types.ts`).
  - `GamePlayer` toma `width`/`height` del registro para el `<canvas>` y mantiene la proporción dentro de `.crt-screen` (centrado, `object-fit`/letterbox por CSS si no es 4:3); oculta el stat de Vidas si `lives === false` y el de Nivel si `level === false`.
  - `asteroides` migra a `{ factory: createAsteroids, width: 800, height: 600 }` sin cambio de comportamiento (criterio de aceptación explícito).
  - Ajusta los nombres si el código real ya difiere; documenta el cambio en Decisiones y Riesgos.
- Si un spec previo ya extendió el contrato, úsalo tal cual y agrégalo a `Depends on`.
- Cualquier otra extensión (callbacks nuevos, canvas secundario) va también en el spec, con su justificación. Si es grande, propone un spec previo separado solo para el contrato.

## Fase 5 — Escribir el spec

1. Lee `game-spec-template.md` y rellénalo. Sustituye todos los `<placeholders>`; borra los bloques marcados `(CONDICIONAL)` que no apliquen y quita las marcas de los que sí apliquen. No dejes instrucciones de plantilla (`<!-- … -->`) en el archivo final.
2. Numeración: el número más alto de `specs/` + 1, con dos dígitos. Nombre: `specs/NN-juego-<id>.md`.
3. Encabezado: `**Status:** Borrador`, `**Depends on:** SPEC 04, SPEC 05, SPEC 06` (+ los que correspondan; verifica que existan), `**Date:**` con la fecha del contexto.
4. Criterios específicos del juego: cada control, regla de puntaje, vida, nivel, power-up y asset que extrajiste se convierte en un criterio booleano verificable con Playwright o SQL. Nada aspiracional.
5. Escribe el archivo directamente, sin pedir permiso. Solo pregunta si el archivo ya existe.

## Fase 6 — Cierre

Confirma al usuario:

- Ruta del spec creado.
- Si incluye extensión de contrato.
- Recordatorio: está en `Borrador`; cámbialo a `Aprobado` tras releerlo.
- Recordatorio: la migración de `public.games` se aplicará con el MCP de Supabase durante `/spec-impl`, pidiendo confirmación antes.
- Siguiente paso: `/spec-impl NN-juego-<id>`.

**Detente aquí.** No propongas implementar.

## Reglas duras

- Nunca escribas código, migraciones ni CSS: solo el `.md` del spec.
- Nunca apliques migraciones ni llames al MCP de Supabase desde esta skill.
- El spec nunca debe proponer importar archivos de `references/` desde `app/`, `components/`, `lib/` o `games/`: se porta a TypeScript; los assets se copian a `public/`.
- Nunca leas `.env`, `.env.local` ni secretos.
- No inventes features que el juego de referencia no tiene; los extras van a "Fuera de alcance".
- El spec siempre incluye la fila en `public.games`: sin ella no hay leaderboard.
