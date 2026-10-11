# SPEC 11 — Sistema de skins: selector CLÁSICO / NEÓN / RETRO en `/jugar`

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 07, SPEC 10
> **Date:** 2026-10-11
> **Objective:** Permitir elegir en `/jugar/<id>` el skin visual del juego (CLÁSICO, NEÓN o RETRO), aplicarlo en vivo al motor sin reiniciar la partida y recordarlo por juego en `localStorage`, con RANARIA como primer juego con los tres skins.

---

## Por qué existe este spec

Cada motor lee sus colores de los tokens de `app/globals.css` una sola vez, al crearse (`readPalette`), y no hay forma de cambiarlos. Queremos que todo juego real tenga al menos tres skins: `clasico` (el aspecto actual, por defecto), `neon` y `retro`. El trabajo por juego lo hará el agente `skin-designer` (`.claude/agents/skin-designer.md`), pero ese agente necesita una base común: un id de skin, una forma de pasarlo al motor, un selector y la persistencia. Este spec construye esa base y la valida de punta a punta con RANARIA, que queda como patrón para los demás juegos.

El contrato se extiende de forma **opcional**: los motores que no declaran skins no cambian una línea y siguen viéndose igual.

---

## Alcance

**Entra:**

- **Contrato** (`games/types.ts`):
  - `SkinId = "clasico" | "neon" | "retro"` y `DEFAULT_SKIN: SkinId = "clasico"`.
  - `GameOptions = { skin: SkinId }`; `GameFactory` pasa a `(canvas, callbacks, options?: GameOptions) => GameEngine`.
  - `GameEngine` gana `setSkin?: (skin: SkinId) => void`.
  - `EngineEntry` gana `skins?: readonly SkinId[]` (skins que el juego implementa; si falta, solo `clasico`).
  - Etiquetas visibles en `games/skins.ts`: `SKIN_LABELS: Record<SkinId, string> = { clasico: "CLÁSICO", neon: "NEÓN", retro: "RETRO" }` y orden `SKIN_ORDER: readonly SkinId[] = ["clasico", "neon", "retro"]`.
- **Persistencia** (`lib/use-skin.ts`, cliente):
  - Hook `useSkin(gameId: string, available: readonly SkinId[]): [SkinId, (s: SkinId) => void]`.
  - Clave `localStorage` `av:skin:<gameId>`, valor = id del skin.
  - Lectura: si la clave falta, el valor no es un `SkinId` o el juego no lo declara en `available` → `clasico`.
  - Toda lectura/escritura en `try/catch`: con storage bloqueado o en modo privado se usa `clasico` y el cambio vale solo para la sesión de la página, sin errores en consola.
  - Hidratación sin desajuste: en el servidor y el primer render cliente vale `clasico`; el valor guardado se aplica en el cliente (patrón `useSyncExternalStore` o efecto, como `useTouchOnly`).
- **Selector** (`components/game-player.tsx`):
  - Grupo segmentado de botones `CLÁSICO | NEÓN | RETRO` (solo los skins declarados, en `SKIN_ORDER`) dentro de `.player-hud`, junto a `PAUSA / FIN / SALIR`. Estilo con las clases de botón existentes; el activo se distingue (clase `active` / `aria-pressed="true"`).
  - **Solo se muestra si el juego declara 2 o más skins** y tiene motor real. Juegos sin skins y la arena simulada no muestran nada nuevo.
  - Funciona en juego y en pausa. Con el modal de fin abierto el selector sigue visible: el cambio se guarda y se aplica a la próxima partida.
  - Al pulsar un botón: guarda el skin, llama `engine.setSkin(skin)` si existe y quita el foco del botón (`blur()`) para que `Espacio`/`Enter` no lo vuelvan a activar mientras se juega. No pausa ni reinicia.
  - Cada partida nueva (montaje o JUGAR DE NUEVO) crea el motor con `factory(canvas, callbacks, { skin })` usando el skin actual.
  - Sin atajo de teclado.
- **Skins solo afectan al canvas:** marco CRT, HUD, portada `.cover-*` y página no cambian.
- **Piloto RANARIA:**
  - `games/ranaria/skins.ts`: `type Palette` (todos los colores que dibuja el motor) + flags de estilo `{ glow: number; outline: boolean }`, y `getPalette(skin, canvas): Palette`. `clasico` = el `readPalette` actual sin cambios.
  - `games/ranaria/engine.ts`: lee el skin de `options?.skin ?? DEFAULT_SKIN`, dibuja solo desde la paleta activa e implementa `setSkin(skin)`, que cambia la paleta y redibuja un frame aunque el juego esté en pausa o en espera. Sin cambios de gameplay.
  - `games/registry.ts`: `ranaria: { factory: createRanaria, skins: ["clasico", "neon", "retro"] }`.
  - Definición de los skins de RANARIA en Modelo de datos.
- **Documentación:**
  - `CLAUDE.md`: el contrato de motores menciona `options.skin`, `setSkin?` y `skins?`.
  - `references/implemented-games.md`: columna o línea "Skins" (RANARIA: clasico, neon, retro; resto: clasico).
- Verificación con `npm run lint` / `npm run build` y Playwright MCP; capturas en `.playwright-screenshot/`.

**Fuera de alcance (para specs futuros):**

- Skins de ASTEROIDES, TETRIS, ARKANOID y SNAKE: los agrega el agente `skin-designer`, un juego por vez.
- Skins que cambien el marco CRT, el HUD, la portada o la página.
- Guardar el skin en Supabase / perfil, o un skin global para todos los juegos.
- Atajo de teclado para cambiar de skin.
- Selector en `/juego/[id]` o en la landing.
- Skins de pago, desbloqueables o ligados a puntuación.
- Tests automatizados (no hay test runner).

---

## Modelo de datos

`games/types.ts` (se agrega; `GameStats` y `GameCallbacks` no cambian):

```ts
export type SkinId = "clasico" | "neon" | "retro";
export const DEFAULT_SKIN: SkinId = "clasico";

export type GameOptions = { skin: SkinId };

export type GameEngine = {
  pause: () => void;
  resume: () => void;
  end: () => number;
  destroy: () => void;
  setSkin?: (skin: SkinId) => void; // aplica el skin en vivo y redibuja; opcional
};

export type GameFactory = (canvas: HTMLCanvasElement, callbacks: GameCallbacks, options?: GameOptions) => GameEngine;

export type EngineEntry = {
  factory: GameFactory;
  lives?: boolean;
  skins?: readonly SkinId[]; // skins implementados; ausente = solo "clasico"
};
```

`games/skins.ts`:

```ts
import type { SkinId } from "@/games/types";

export const SKIN_ORDER: readonly SkinId[] = ["clasico", "neon", "retro"];
export const SKIN_LABELS: Record<SkinId, string> = { clasico: "CLÁSICO", neon: "NEÓN", retro: "RETRO" };
export const isSkinId = (v: unknown): v is SkinId => typeof v === "string" && (SKIN_ORDER as readonly string[]).includes(v);
```

`localStorage`:

| Clave | Valor | Ejemplo |
| --- | --- | --- |
| `av:skin:<gameId>` | `SkinId` | `av:skin:ranaria` → `retro` |

Sin versionado: un valor desconocido cae a `clasico`.

### Skins de RANARIA

Ningún skin cambia posiciones, tamaños, colisiones, tiempos ni puntuación.

| Elemento | `clasico` (actual) | `neon` | `retro` |
| --- | --- | --- | --- |
| Fondo / asfalto | `#000` | `#000` | `#0f380f` |
| Orilla (fila 0) | `--green` α 0,25 | contorno inferior `--green` con glow | `#306230` |
| Nenúfar | relleno `#000`, contorno `--green` | contorno `--green`, glow 12 | relleno `#0f380f`, contorno `#8bac0f` |
| Agua (filas 1–5) | `--cyan` α 0,15 | líneas horizontales `--cyan` α 0,35 cada 12 px, sin relleno | `#306230` |
| Aceras (filas 6 y 11) | `--magenta` α 0,12 | contornos `--magenta` con glow 8 | `#306230` con borde superior/inferior `#8bac0f` 2 px |
| Líneas de carril | `--line-2` discontinuas | `--cyan` α 0,3 discontinuas | `#306230` discontinuas |
| Coches | `--magenta` / `--yellow` / `--cyan`, faros `--ink` | solo contorno (2 px) del mismo color, glow 12, faros `--ink` | `#8bac0f`, faros `#9bbc0f` |
| Camiones | `--silver` | contorno `--silver`, glow 12 | `#8bac0f` con ventana `#0f380f` |
| Troncos | `--bronze`, vetas `--gold` | contorno `--bronze`, vetas `--gold`, glow 10 | `#8bac0f`, vetas `#306230` |
| Tortugas | `--gold` | contorno `--gold`, glow 10 | `#8bac0f` con punto central `#306230` |
| Rana | `--green`, ojos `--ink` | relleno `--green`, glow 16, ojos `--ink` | `#9bbc0f`, ojos `#0f380f`, borde `#0f380f` 2 px |
| Rana muerta (X) | `--magenta` | `--magenta`, glow 16 | `#9bbc0f` |
| Barra de tiempo | `--green` / `--yellow` / `--magenta` | mismos colores, glow 8 | `#9bbc0f` / `#8bac0f` / parpadeo `#9bbc0f` ↔ `#306230` a 4 Hz con ≤ 5 s |
| Rótulo `PULSA UNA FLECHA` | `--ink-dim` | `--cyan` con glow 8 | `#9bbc0f` |

Flags: `clasico` `{ glow: 0, outline: false }` · `neon` `{ glow: 12, outline: true }` · `retro` `{ glow: 0, outline: false }` + `imageSmoothingEnabled = false`.

Tras cada pieza con glow se restablece `shadowBlur = 0`. En `retro` no hay alfa. Los colores de `neon` salen de tokens con `readPalette`; los de `retro` son constantes del skin.

---

## Plan de implementación

1. **Contrato y utilidades.** Leer `node_modules/next/dist/docs/01-app` sobre client components y `useSyncExternalStore` (según `AGENTS.md`). Extender `games/types.ts`, crear `games/skins.ts` y `lib/use-skin.ts`. Manual: `npm run build` y `npm run lint` pasan; los cinco juegos se ven y juegan igual (nadie usa todavía el tercer parámetro).
2. **Selector en `GamePlayer`.** Leer `entry.skins`, `useSkin(game.id, skins)`, pasar `{ skin }` a la fábrica, render del grupo de botones (solo con ≥ 2 skins), `setSkin` en vivo y `blur()` tras el clic. Manual: ningún juego muestra el selector todavía; todo sigue igual.
3. **Piloto RANARIA.** Crear `games/ranaria/skins.ts`, adaptar el dibujo del motor a la paleta activa, implementar `setSkin` y declarar `skins` en el registro. Manual: `/jugar/ranaria` muestra `CLÁSICO | NEÓN | RETRO`, el cambio es inmediato y se recuerda al recargar.
4. **Documentación.** Actualizar `CLAUDE.md` y `references/implemented-games.md`.
5. **Verificación** con Playwright MCP (criterios de abajo), capturas `.playwright-screenshot/skin-ranaria-<skin>.png`.

Cada paso deja la app funcionando y commiteable.

---

## Criterios de aceptación

**Contrato y compatibilidad:**

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `games/types.ts` exporta `SkinId`, `DEFAULT_SKIN`, `GameOptions`; `GameFactory` acepta un tercer parámetro opcional; `GameEngine.setSkin` y `EngineEntry.skins` son opcionales.
- [ ] Los motores de ASTEROIDES, TETRIS, ARKANOID y SNAKE no cambian (diff vacío en sus carpetas).
- [ ] `/jugar/asteroides`, `/jugar/tetris`, `/jugar/arkanoid` y `/jugar/snake` no muestran selector y se ven igual que antes (captura).
- [ ] `/jugar/rocas` (arena simulada) no muestra selector.

**Selector y persistencia:**

- [ ] `/jugar/ranaria` muestra en el HUD los botones `CLÁSICO`, `NEÓN`, `RETRO` en ese orden; sin valor guardado, `CLÁSICO` está activo (`aria-pressed="true"`).
- [ ] Pulsar `NEÓN` durante la partida cambia el canvas en el siguiente frame, sin reiniciar: puntuación, vidas, nivel, posición de la rana y nenúfares ocupados siguen iguales.
- [ ] Pulsar `RETRO` en pausa redibuja el canvas en retro y el juego sigue en pausa; al reanudar continúa en retro.
- [ ] Tras pulsar un botón de skin, `Espacio` y `Enter` no vuelven a activarlo (el botón no conserva el foco) y las flechas mueven la rana.
- [ ] Cambiar de skin no pausa el juego ni dispara la auto-pausa por `blur`.
- [ ] `localStorage.getItem("av:skin:ranaria")` vale el último skin elegido.
- [ ] Recargar `/jugar/ranaria` arranca con el skin guardado y ese botón activo, sin error de hidratación en consola.
- [ ] JUGAR DE NUEVO crea la partida con el skin activo.
- [ ] Con `av:skin:ranaria = "dorado"` (valor inválido) la página arranca en `CLÁSICO` sin errores.
- [ ] Con `localStorage` lanzando excepción (simulado con `Object.defineProperty` en Playwright), el selector funciona durante la sesión y no hay errores en consola.
- [ ] El skin guardado de un juego no afecta a otro (`av:skin:<id>` por juego).

**Skins de RANARIA:**

- [ ] `CLÁSICO` se ve idéntico a antes de este spec (comparación de capturas en la misma escena de espera).
- [ ] `NEÓN`: fondo negro, coches/camiones/troncos/tortugas dibujados con contorno y glow en sus colores, agua como líneas cian, rana verde con glow (captura).
- [ ] `RETRO`: solo los 4 tonos `#0f380f`, `#306230`, `#8bac0f`, `#9bbc0f` en el canvas (muestreo de píxeles con `getImageData` en una captura de la fase de espera: ningún otro color), sin glow (captura).
- [ ] En los tres skins se distinguen a simple vista rana, vehículos, troncos/tortugas, agua y zonas seguras (revisión de capturas).
- [ ] El gameplay no cambia: mismas reglas de SPEC 10 (un salto por pulsación, puntuación, muertes por coche/agua/tiempo) verificadas en una partida corta en `NEÓN` y otra en `RETRO`.
- [ ] Sin errores en consola durante una partida con cambios de skin.
- [ ] Marco CRT, HUD y portada `.cover-rana` no cambian con el skin.

**Documentación:**

- [ ] `CLAUDE.md` describe `options.skin`, `setSkin?` y `skins?` en el contrato de motores.
- [ ] `references/implemented-games.md` indica los skins de cada juego.

---

## Decisiones

- **Sí:** cambio de skin **en vivo** con `setSkin`, sin reiniciar. Cambiar el look no debe costar una partida.
- **No:** reiniciar el motor al cambiar de skin ni elegirlo solo antes de jugar.
- **Sí:** contrato **opcional** (`options?`, `setSkin?`, `skins?`). Los cuatro motores existentes no se tocan en este spec; `skin-designer` los migra uno a uno.
- **No:** obligar a todos los motores a implementar `setSkin` ya.
- **Sí:** selector como grupo de botones en el HUD, visible solo con ≥ 2 skins. No se muestran opciones que no hacen nada.
- **Sí:** persistencia por juego en `localStorage` con clave `av:skin:<gameId>`, fallback a `clasico`. Sin sesión ni Supabase: es una preferencia visual local.
- **No:** guardado en perfil ni skin global.
- **Sí:** los skins solo afectan al canvas; el marco CRT, HUD y página quedan como están.
- **Sí:** sin atajo de teclado, para no chocar con teclas de juego.
- **Sí:** `blur()` del botón tras el clic: con el foco en un botón, `Espacio` lo reactivaría en juegos que usan esa tecla.
- **Sí:** familias globales de skin: `neon` = contornos con glow sobre negro con colores de tokens; `retro` = paleta fija de 4 verdes (`#0f380f`, `#306230`, `#8bac0f`, `#9bbc0f`) sin glow ni alfa. Coherentes con `.claude/agents/skin-designer.md`.
- **Sí:** RANARIA como piloto: es el motor más reciente, sin sprites, y deja un patrón (`games/ranaria/skins.ts`) para el agente.
- **Sí:** `clasico` reutiliza el `readPalette` actual tal cual, para garantizar que el aspecto por defecto no cambia.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Desajuste de hidratación al leer `localStorage` en el render | Servidor y primer render en `clasico`; el valor guardado se aplica en el cliente; criterio sin error de hidratación. |
| `shadowBlur` de `neon` contamina otros dibujos o baja el rendimiento | Restablecer `shadowBlur = 0` tras cada pieza; glow ≤ 16; revisar fluidez en partida. |
| `setSkin` en pausa no se ve hasta reanudar | `setSkin` redibuja un frame aunque el loop esté detenido. |
| Clic en el selector deja el foco en el botón y `Espacio` lo reactiva | `blur()` tras el clic; criterio explícito. |
| `localStorage` bloqueado (modo privado, políticas) | `try/catch` en lectura/escritura; criterio con storage que lanza. |
| `retro` hace indistinguibles elementos distintos | Tabla de mapeo con tonos y bordes por elemento; criterio de legibilidad por captura. |
| Cambiar la firma de `GameFactory` rompe motores existentes | Tercer parámetro opcional; criterio de diff vacío en los otros cuatro motores. |
| Next.js 16 con convenciones distintas a las recordadas | Leer `node_modules/next/dist/docs/01-app` antes de escribir. |

---

## Lo que **no** está en este spec

- Skins de ASTEROIDES, TETRIS, ARKANOID y SNAKE (agente `skin-designer`).
- Skins del marco CRT, HUD, portada o página.
- Persistencia en Supabase o skin global.
- Atajo de teclado y selector fuera de `/jugar`.
- Skins desbloqueables o de pago.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.
