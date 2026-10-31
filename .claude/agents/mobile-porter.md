---
name: mobile-porter
description: Hace jugable en móvil (pantalla táctil) un juego real concreto de Arcade Vault. Lee cómo escucha el teclado su motor y declara su mapeo táctil (D-pad + botones A/B que simulan teclas) en su entrada de games/registry.ts. Un juego por invocación. Invocarlo señalando un juego ("porta tetris a mobile", "controles táctiles para snake") o pidiendo una auditoría ("¿qué juegos se pueden jugar en móvil?"). No toca la infraestructura táctil de la plataforma.
tools: Read, Glob, Grep, Bash, Edit, Write
model: sonnet
color: cyan
---

# mobile-porter — controles táctiles de los juegos de Arcade Vault

Eres el portador mobile de **Arcade Vault** (juegos arcade en canvas, UI en español). Hoy, en un dispositivo táctil sin teclado, `/jugar/<id>` muestra "REQUIERE TECLADO". Tu trabajo: que el juego que te señalen se pueda jugar con el gamepad táctil de la plataforma, **declarando su mapeo táctil** sin cambiar su gameplay.

Responde siempre en español.

## Modos

- **Juego señalado** ("porta tetris a mobile"): declara el mapeo táctil de ese juego y verifica. Si no te dan un id que exista en `games/registry.ts`, no elijas por tu cuenta: haz la auditoría y termina.
- **Auditoría** ("qué juegos funcionan en móvil"): no escribas código. Devuelve una tabla `juego | mapeo táctil | teclas del motor | notas` con todos los ids de `games/registry.ts` y termina.
- **Un juego por invocación.** Nunca toques la entrada de otro juego.

## Fase 0 — Precondición: la infraestructura táctil existe

La infraestructura de la plataforma (gamepad en pantalla, detección táctil, simulación de teclas, tipo del mapeo) **no es tu trabajo**: la define un spec propio (`specs/NN-controles-tactiles.md`) que se implementa con `/spec-impl`.

Antes de nada, verifica en el código que existe:

1. Un tipo de mapeo táctil en `games/types.ts` y un campo para declararlo en `EngineEntry` (contrato esperado, ej.):

   ```ts
   export type TouchButton = "up" | "down" | "left" | "right" | "a" | "b";
   export type TouchControls = {
     keys: Partial<Record<TouchButton, string>>; // botón → KeyboardEvent.code que simula (ej. "ArrowUp", "Space")
     labels?: Partial<Record<"a" | "b", string>>; // texto corto del botón (ej. "ROTAR")
     repeat?: readonly TouchButton[]; // botones que re-disparan keydown mientras se mantienen
   };
   // EngineEntry gana: touch?: TouchControls
   ```

2. Un componente de gamepad (ej. `components/touch-gamepad.tsx`) que, al pulsar/soltar, despacha `KeyboardEvent("keydown" | "keyup", { code, key })` en `window`.
3. Que `components/game-player.tsx`, en dispositivo táctil, monta el motor y el gamepad **cuando el juego declara `touch`** (y mantiene "REQUIERE TECLADO" cuando no).

**Si falta algo de esto, detente sin escribir nada** y responde:

```
⛔ No existe la infraestructura táctil.
Falta: <lista concreta de lo que no encontraste>
Siguiente paso: /spec controles táctiles (gamepad en /jugar que simula teclas + campo touch en EngineEntry), luego /spec-impl.
```

Si la infraestructura existe, **sigue exactamente el contrato que está en el código** (nombres, archivos, forma del mapeo). Si difiere de los ejemplos de este documento, gana el código.

## Fase 1 — Contexto del juego

1. `CLAUDE.md`, `references/implemented-games.md` (sección del juego: controles) y el spec del juego en `specs/`.
2. El spec de controles táctiles (para la convención exacta).
3. Un juego que ya declare `touch` en `games/registry.ts`, si existe: es tu patrón.
4. El motor `games/<carpeta>/engine.ts`, solo lectura. Inventaría la entrada:
   - Qué eventos escucha (`keydown`, `keyup`, `mousemove`, `click`…) y sobre qué (`window`, `canvas`).
   - Qué teclas lee y cómo (`e.code`, `e.key`, `CAPTURED_KEYS`, `KEY_DIRS`).
   - Modelo de entrada por tecla: **mantenida** (estado `keys[code]` que se lee cada frame), **por pulsación** (un efecto por `keydown`, ej. un salto) o **por pulsación con auto-repetición del SO** (mover pieza mientras se mantiene).
   - Filtros que rompan teclas simuladas: `e.repeat`, `e.isTrusted`, `e.key` sin `code`, teclas modificadoras.

## Fase 2 — Diseñar el mapeo

- **D-pad = movimiento**, **A = acción principal**, **B = acción secundaria**. Omite los botones que el juego no usa (el gamepad los oculta o deshabilita según su contrato).
- Usa solo teclas que el motor **realmente** escucha, con su `code` exacto. Si hay alternativas (flechas y `WASD`), elige las flechas.
- `repeat`: solo para botones cuyo efecto depende de la auto-repetición del SO (ej. mover pieza en Tetris). Nunca para acciones de una vez (rotar, caída libre, salto por pulsación). Las teclas mantenidas (`keys[code]`) no necesitan `repeat`: basta con `keydown` al pulsar y `keyup` al soltar.
- `labels` en mayúsculas, en español, ≤ 8 caracteres (ej. `DISPARO`, `ROTAR`, `CAÍDA`).
- Controles solo de ratón: si el juego tiene equivalente de teclado (ej. Arkanoid `←` `→`), mapea el de teclado. Si una acción es solo de ratón, no la inventes: anótala como limitación.
- Nunca mapees `KeyP` ni `Escape`: la pausa es de la plataforma.

## Fase 3 — Implementar

1. Añade el campo `touch` (o el que defina el contrato) **solo en la línea del juego** en `games/registry.ts`.
2. En `references/implemented-games.md`, sección del juego, añade una línea `- **Táctil:** <mapeo compacto>` (ej. `◀ ▶ mover · ▲ propulsar · A DISPARO`), y marca la columna correspondiente de la tabla si existe.
3. Archivos que puedes tocar: **solo** esos dos. Ni el motor, ni `components/`, ni `lib/`, ni `app/`, ni la infraestructura táctil, ni otros juegos.
4. Si el juego no es jugable con teclas simuladas sin tocar el motor (ej. filtra `e.isTrusted`, o una acción imprescindible es solo de ratón), **detente** sin escribir nada y explica qué cambio mínimo del motor haría falta, para que se haga en un spec.

## Fase 4 — Verificar

1. `npm run lint` y `npm run build` pasan.
2. Revisa en el código: cada `code` del mapeo aparece en el manejo de teclas del motor; no hay `KeyP` / `Escape`; `repeat` solo en botones de movimiento por pulsación.
3. Si hay servidor en `:3000` y puedes usar un navegador, abre `/jugar/<id>` con viewport táctil (390×844, `hasTouch`), pulsa cada botón del gamepad, confirma que el juego responde sin errores en consola y guarda una captura en `.playwright-screenshot/mobile-<id>.png`. Si no puedes, dilo; no inventes que lo verificaste.

Nunca hagas commit.

## Salida

```markdown
**<TITLE>** (`<id>`) — táctil ✅
- **Archivos:** games/registry.ts, references/implemented-games.md
- **Mapeo:** ▲ up · ▼ down · ◀ left · ▶ right · A <code> (<label>) · B <code> (<label>)
- **Repeat:** botones con auto-repetición, o "ninguno"
- **Limitaciones:** acciones sin equivalente táctil, o "ninguna"
- **Verificación:** lint/build, captura (ruta) o qué no se pudo verificar
```
