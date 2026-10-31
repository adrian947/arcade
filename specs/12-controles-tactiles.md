# SPEC 12 — Controles táctiles: gamepad en pantalla para `/jugar` en móvil

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 09, SPEC 11
> **Date:** 2026-10-31
> **Objective:** Permitir jugar en dispositivos táctiles los juegos que declaren un mapeo táctil, con un gamepad debajo del CRT que simula las teclas que ya escucha el motor, con SNAKE como primer juego portado.

---

## Por qué existe este spec

Hoy, en un dispositivo táctil sin teclado (`(hover: none) and (pointer: coarse)`), `/jugar/<id>` no crea el motor y muestra "REQUIERE TECLADO" (SPEC 05). Todos los motores reales escuchan `keydown` / `keyup` en `window` y leen `e.code`. Por eso no hace falta tocar ningún motor: basta un gamepad en pantalla que despache esos mismos eventos de teclado.

El trabajo por juego (decidir qué botón simula qué tecla) lo hará el agente `mobile-porter` (`.claude/agents/mobile-porter.md`), un juego por vez. Ese agente necesita una base común: el tipo del mapeo, el campo en el registro, el componente gamepad y el cambio en `GamePlayer`. Este spec construye esa base y la valida de punta a punta con SNAKE.

El contrato se extiende de forma **opcional**: los juegos que no declaran `touch` siguen exactamente como hoy.

---

## Alcance

**Entra:**

- **Contrato** (`games/types.ts`):
  - `TouchButton = "up" | "down" | "left" | "right" | "a" | "b"`.
  - `TouchControls = { keys, labels?, repeat? }` (ver Modelo de datos).
  - `EngineEntry` gana `touch?: TouchControls`. Ausente = el juego no es jugable en táctil.
- **Gamepad** (`components/touch-gamepad.tsx`, cliente):
  - Props: `controls: TouchControls` y `disabled: boolean`.
  - Layout: D-pad en cruz a la izquierda, A y B a la derecha. Solo se renderizan los botones declarados en `controls.keys`; en el D-pad las celdas no declaradas quedan vacías y la cruz conserva su forma.
  - Al pulsar un botón despacha `new KeyboardEvent("keydown", { code, key, bubbles: true, cancelable: true })` en `window`; al soltar, `keyup` con el mismo `code`.
  - `key` se deriva del `code` con un helper local `keyFor(code)` (`ArrowUp` → `"ArrowUp"`, `Space` → `" "`, `KeyX` → `"x"`…).
  - Entrada con Pointer Events: `pointerdown` (con `setPointerCapture` y `preventDefault`) pulsa; `pointerup`, `pointercancel` y `lostpointercapture` sueltan. Multi-touch: se puede mantener una dirección y pulsar A a la vez.
  - Auto-repetición: los botones listados en `controls.repeat` re-disparan `keydown` mientras se mantienen, primero a los 200 ms y luego cada 70 ms, con `repeat: true` en el evento. Los demás disparan un solo `keydown`.
  - `disabled` (pausa o fin de partida): no despacha nada y suelta en el acto los botones mantenidos (despacha su `keyup`). Al desmontar también suelta todo y cancela los timers.
  - Sin foco: los botones no reciben foco (`tabIndex={-1}` y `preventDefault` en `pointerdown`), así no disparan la auto-pausa por `blur` ni se reactivan con teclas.
  - Accesibilidad mínima: cada botón con `aria-label` en español (`ARRIBA`, `ABAJO`, `IZQUIERDA`, `DERECHA`, o la etiqueta de A/B).
- **Estilos** (`app/globals.css`):
  - Clases `.touch-pad`, `.touch-dpad`, `.touch-actions`, `.touch-btn` (+ `.touch-btn.a`, `.touch-btn.b`, `.touch-btn.pressed`).
  - Botones ≥ 56 × 56 px, contorno neón con tokens (`--cyan` para el D-pad, `--magenta` para A, `--yellow` para B), etiquetas en `--font-pixel`, estado `pressed` con glow.
  - `touch-action: none`, `user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout: none` en `.touch-pad`. Menú contextual bloqueado en el componente.
- **Integración** (`components/game-player.tsx`):
  - `const touch = entry?.touch;`
  - En táctil con `touch` declarado: se crea el motor (igual que en escritorio) y se renderiza `<TouchGamepad controls={touch} disabled={paused || over} />` **debajo del `.crt`**, fuera de él.
  - En táctil sin `touch`: sigue "REQUIERE TECLADO" y el motor no se crea, como hoy.
  - La comprobación directa con `matchMedia` del efecto de montaje se ajusta para no bloquear el motor cuando hay `touch`.
  - El HUD de plataforma (stats, selector de skins, `PAUSA / FIN / SALIR`) se mantiene. En pantallas ≤ 720 px se compacta envolviendo en filas, sin scroll horizontal. El gamepad no tiene botón de pausa propio.
- **Piloto SNAKE** (`games/registry.ts`):
  - `snake: { factory: createSnake, lives: false, touch: { keys: { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" } } }`.
  - Sin A/B (SNAKE no los usa) y sin `repeat` (un giro por pulsación).
- **Documentación:**
  - `CLAUDE.md`: el contrato de motores menciona `touch?` y que el gamepad simula `KeyboardEvent` en `window`; los motores no deben filtrar `e.isTrusted`.
  - `references/implemented-games.md`: columna "Táctil" en la tabla (SNAKE: sí; resto: no) y línea `- **Táctil:**` en la sección de SNAKE.
- Verificación con `npm run lint` / `npm run build` y Playwright MCP en emulación móvil; capturas en `.playwright-screenshot/`.

**Fuera de alcance (para specs futuros):**

- Mapeo táctil de ASTEROIDES, TETRIS, ARKANOID y RANARIA: lo agrega el agente `mobile-porter`, un juego por vez.
- Gestos (swipe, tap sobre el canvas) y control por arrastre (ej. paleta de ARKANOID con el dedo).
- Gamepad superpuesto al canvas, configurable o reposicionable.
- Gamepad genérico para juegos sin mapeo declarado.
- Vibración (`navigator.vibrate`), sonidos de botón.
- Orientación forzada, pantalla completa, bloqueo de rotación.
- Cambios en los motores.
- Cambiar los tags `TECLADO / TÁCTIL` de `/juego/[id]`.
- Tests automatizados (no hay test runner).

---

## Modelo de datos

`games/types.ts` (se agrega; el resto no cambia):

```ts
export type TouchButton = "up" | "down" | "left" | "right" | "a" | "b";

export type TouchControls = {
  keys: Partial<Record<TouchButton, string>>; // botón → KeyboardEvent.code que simula (ej. "ArrowUp", "Space")
  labels?: Partial<Record<"a" | "b", string>>; // texto del botón A/B, mayúsculas, ≤ 8 caracteres (ej. "ROTAR")
  repeat?: readonly TouchButton[]; // botones que re-disparan keydown mientras se mantienen
};

export type EngineEntry = {
  factory: GameFactory;
  lives?: boolean;
  skins?: readonly SkinId[];
  touch?: TouchControls; // ausente = "REQUIERE TECLADO" en táctil
};
```

Convenciones:

- Los `code` son los de `KeyboardEvent.code` que el motor ya escucha. Nunca `KeyP` ni `Escape` (pausa de plataforma).
- Etiquetas por defecto si falta `labels`: `A` y `B`.
- Constantes de auto-repetición en `components/touch-gamepad.tsx`: `REPEAT_DELAY_MS = 200`, `REPEAT_INTERVAL_MS = 70`.

Sin persistencia: el gamepad no guarda nada.

---

## Plan de implementación

1. **Contrato.** Leer `node_modules/next/dist/docs/01-app` sobre client components (según `AGENTS.md`). Agregar `TouchButton`, `TouchControls` y `EngineEntry.touch?` a `games/types.ts`. Manual: `npm run build` y `npm run lint` pasan; nada cambia.
2. **Componente gamepad.** Crear `components/touch-gamepad.tsx` (render, `keyFor`, pointer events, multi-touch, auto-repetición, `disabled`, liberación al desmontar) y sus estilos en `app/globals.css`. Aún no se usa. Manual: build y lint pasan.
3. **Integración en `GamePlayer`.** Leer `entry.touch`, crear el motor en táctil cuando existe, renderizar el gamepad bajo el `.crt` con `disabled={paused || over}`, mantener "REQUIERE TECLADO" sin `touch`, y compactar `.player-hud` en ≤ 720 px. Manual: en emulación móvil todos los juegos siguen con "REQUIERE TECLADO" (nadie declara `touch` todavía); escritorio sin cambios.
4. **Piloto SNAKE.** Declarar `touch` en la línea de `snake` en `games/registry.ts`. Manual: `/jugar/snake` en emulación móvil muestra el gamepad y la serpiente gira con el D-pad.
5. **Documentación.** Actualizar `CLAUDE.md` y `references/implemented-games.md`.
6. **Verificación** con Playwright MCP (criterios de abajo), captura `.playwright-screenshot/mobile-snake.png`.

Cada paso deja la app funcionando y commiteable.

---

## Criterios de aceptación

**Contrato y compatibilidad:**

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `games/types.ts` exporta `TouchButton` y `TouchControls`; `EngineEntry.touch` es opcional.
- [ ] Los motores no cambian (diff vacío en `games/*/engine.ts`).
- [ ] En escritorio, los cinco juegos se ven y juegan igual que antes y no muestran gamepad.
- [ ] En emulación móvil táctil (Playwright, 390 × 844, `hasTouch`, `isMobile`), `/jugar/asteroides`, `/jugar/tetris`, `/jugar/arkanoid` y `/jugar/ranaria` siguen mostrando "REQUIERE TECLADO" y no muestran gamepad.
- [ ] `/jugar/rocas` (arena simulada) no muestra gamepad.

**Gamepad en SNAKE (emulación móvil):**

- [ ] `/jugar/snake` crea el motor, no muestra "REQUIERE TECLADO" y muestra el gamepad debajo del CRT, fuera de él.
- [ ] Se ven los 4 botones del D-pad y no se ven A ni B.
- [ ] Tocar `▲` / `▼` / `◀` / `▶` gira la serpiente igual que las flechas del teclado; la primera dirección válida arranca la partida (reglas de SPEC 09).
- [ ] Mantener un botón no genera giros extra (SNAKE no declara `repeat`).
- [ ] Con el juego en pausa (botón PAUSA del HUD), tocar el D-pad no mueve nada; al reanudar responde de nuevo.
- [ ] Con el modal de fin abierto, el D-pad no despacha eventos.
- [ ] Tocar un botón del gamepad no dispara la auto-pausa por `blur` ni deja el botón con foco.
- [ ] La página no hace scroll, zoom ni abre el menú contextual al tocar o mantener botones del gamepad.
- [ ] A 390 px no hay scroll horizontal; el HUD (stats, PAUSA / FIN / SALIR) se ve completo envolviendo en filas.
- [ ] JUGAR DE NUEVO crea la partida nueva y el gamepad sigue funcionando.
- [ ] Sin errores en consola durante una partida completa en móvil (captura `.playwright-screenshot/mobile-snake.png`).

**Comportamiento del componente (verificable con un `touch` de prueba en Playwright o revisando el código):**

- [ ] Un botón en `repeat` re-dispara `keydown` con `repeat: true` a los 200 ms y luego cada 70 ms mientras se mantiene.
- [ ] Pasar a `disabled` con un botón mantenido despacha su `keyup`.
- [ ] Desmontar el gamepad con un botón mantenido despacha su `keyup` y no deja timers activos.
- [ ] Dos botones pueden mantenerse a la vez (multi-touch) y cada uno suelta su propia tecla.

**Documentación:**

- [ ] `CLAUDE.md` describe `touch?` en el contrato de motores y la regla de no filtrar `e.isTrusted`.
- [ ] `references/implemented-games.md` tiene la columna "Táctil" y la línea táctil de SNAKE.

---

## Decisiones

- **Sí:** el gamepad simula `KeyboardEvent` en `window`. Los cinco motores ya escuchan ahí con `e.code`; portar un juego es solo declarar un mapeo, sin tocar su motor.
- **No:** API táctil nueva en el contrato de motores (`engine.press(button)`). Obligaría a cambiar todos los motores.
- **Sí:** mapeo declarado por juego (`EngineEntry.touch`), opcional. Lo agrega `mobile-porter`, un juego por vez, como `skin-designer` con `skins`.
- **Sí:** juegos sin `touch` siguen con "REQUIERE TECLADO". Mejor un aviso honesto que un gamepad genérico que no encaja.
- **No:** gamepad genérico de flechas + Espacio para todos.
- **Sí:** gamepad debajo del CRT. No tapa el juego.
- **No:** botones superpuestos al canvas.
- **Sí:** el HUD se mantiene y se compacta; PAUSA / FIN / SALIR siguen en el HUD. El gamepad no duplica la pausa.
- **No:** ocultar el HUD en móvil.
- **Sí:** auto-repetición propia del gamepad (`repeat`, 200 / 70 ms) solo para botones que dependen de la repetición del sistema (ej. mover pieza en TETRIS). Las teclas mantenidas (`keys[code]`) ya funcionan con `keydown` + `keyup`.
- **Sí:** Pointer Events con `setPointerCapture`. Cubre multi-touch y soltar fuera del botón con un solo modelo de eventos.
- **Sí:** SNAKE como piloto. Solo usa el D-pad y un `keydown` por giro: valida la base sin depender de A/B ni de `repeat`.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Un motor futuro filtra `e.isTrusted` y descarta las teclas simuladas | Regla en `CLAUDE.md`; `mobile-porter` lo revisa y se detiene si lo encuentra. |
| Botón queda "pegado" (sin `keyup`) si el dedo sale o la página pierde el puntero | `setPointerCapture` + `pointercancel` / `lostpointercapture`; liberación al pasar a `disabled` y al desmontar. |
| Tocar el gamepad quita el foco y dispara la auto-pausa por `blur` | Botones sin foco (`tabIndex={-1}`, `preventDefault` en `pointerdown`); criterio explícito. |
| Scroll o zoom del navegador al tocar | `touch-action: none` y bloqueo de menú contextual en `.touch-pad`. |
| Hidratación: `touchOnly` vale `false` en el servidor y el primer render | El gamepad depende de `touchOnly` (ya resuelto con `useSyncExternalStore`); en el primer render cliente no se muestra y aparece tras hidratar, sin desajuste. |

---

## Lo que **no** está en este spec

- Mapeos táctiles de ASTEROIDES, TETRIS, ARKANOID y RANARIA (los agrega `mobile-porter`).
- Gestos, swipe o control por arrastre.
- Gamepad superpuesto, configurable o genérico.
- Vibración, sonidos, pantalla completa u orientación.
- Cambios en los motores.

Cada uno de esos, si llega, va en su propio spec.
