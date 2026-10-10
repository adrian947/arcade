# SPEC <NN> — <TITLE>: <subtítulo corto>

> **Status:** Borrador
> **Depends on:** SPEC 04, SPEC 05, SPEC 06<, SPEC XX si aplica>
> **Date:** <YYYY-MM-DD del contexto>
> **Objective:** Agregar el juego `<id>` al catálogo<, portando <descripción> de `references/started-games/<carpeta>/`> a un motor TypeScript en `games/<slug>/engine.ts`, montarlo en `/jugar/<id>` y darlo de alta en `public.games` para que sus partidas se guarden y aparezcan en el leaderboard.

---

## Por qué existe este spec

<!-- 2–3 párrafos: qué es el juego, de dónde viene (referencia o desde cero), cómo está hecho el original (archivos, líneas, estado global, HUD en canvas, reinicio por tecla) y por qué hay que adaptarlo al contrato de SPEC 05. Mencionar si existe un mock parecido y qué se decidió. -->

---

## Alcance

**Entra:**

- Entrada nueva en `GAMES` de `lib/data.ts`<, en la posición X>:
  - `id: "<id>"`, `title: "<TITLE>"`, `cat: "<CAT>"`, `color: "<color>"`, `cover: "cover-<id>"`, `best: 0`, `plays: "0"`.
  - Copy `short` y `long` basados en el juego real (ver Modelo de datos).
- Portada CSS nueva `.cover-<id>` en `app/globals.css`, junto a las demás `cover-*`: <descripción visual>, solo CSS/SVG inline, sin imágenes externas. Distinta de las portadas existentes.
- (CONDICIONAL: contrato) Extensión del contrato de motores (ver Modelo de datos):
  - `games/types.ts`: tipo `EngineEntry` con `factory`, `width`, `height`, `lives?`, `level?`.
  - `games/registry.ts`: `ENGINES` pasa a `Partial<Record<string, EngineEntry>>`; `asteroides` migra a `{ factory: createAsteroids, width: 800, height: 600 }`.
  - `components/game-player.tsx`: el `<canvas>` usa `width`/`height` del registro y conserva su proporción dentro de `.crt-screen`; oculta Vidas si `lives === false` y Nivel si `level === false`.
- `games/<slug>/engine.ts`: port a TypeScript que exporta `create<Factory>: GameFactory`.
  - Sin estado de módulo mutable: todo vive dentro de la instancia.
  - Port fiel del gameplay: <constantes, reglas de puntaje, vidas, niveles, extras>.
  - Se elimina del canvas: <score, vidas, nivel, "GAME OVER", "PRESIONA X PARA REINICIAR", …>. Queda en el canvas: <indicadores propios del juego o "nada">.
  - Al terminar la partida el motor deja de actualizar y llama `onGameOver(score)` una sola vez. Sin reinicio por tecla.
  - `onStats` al iniciar y solo cuando cambia score, vidas o nivel (nunca por frame).
  - Colores desde tokens de `app/globals.css` con `getComputedStyle(canvas)` y fallback al hex del token (patrón `readPalette` de `games/asteroids/engine.ts`): <elemento → token>. Fondo `#000`. Textos con `--pixel`.
  - Teclado: `keydown`/`keyup` en `window`, registrados al crear y removidos en `destroy()`. `preventDefault()` solo para <teclas del juego> y solo con el motor activo (no pausado ni terminado). `P` y `Escape` quedan para la pausa de plataforma.
  - `pause()` detiene el loop y limpia teclas mantenidas; `resume()` reinicia el tiempo de referencia (primer `dt` = 0); tope de `dt` en 50 ms. `end()` detiene y devuelve el score sin disparar `onGameOver`. `destroy()` idempotente.
- (CONDICIONAL: assets) Assets copiados a `public/games/<id>/` (<lista>), cargados por URL desde el motor.
- `games/registry.ts`: alta de `<id>`.
- Migración `supabase/migrations/<YYYYMMDDHHMMSS>_game_<id>.sql` con la fila de `public.games`, aplicada con el MCP de Supabase (`apply_migration`, nombre `game_<id>`) **previa confirmación del usuario**.
- Leaderboard sin código nuevo: `/salon` y `/juego/<id>` ya leen la vista `leaderboard` filtrada por `game_id` (SPEC 04) y la FK de SPEC 06 acepta el `id` tras la migración.
- Verificación con Playwright MCP, MCP de Supabase y `npm run build` / `npm run lint`; capturas en `.playwright-screenshot/`.

**Fuera de alcance (para specs futuros):**

- Controles táctiles y soporte móvil jugable (sigue el aviso "REQUIERE TECLADO").
- Canvas HiDPI (`devicePixelRatio`).
- <Sonido / música, si se difiere>.
- <Cambios de gameplay no presentes en el original>.
- <Cambios al mock relacionado, si existe>.
- Anti-trampas o validación server-side del score.
- `best` y `plays` calculados desde la base.
- Tests automatizados (no hay test runner).

---

## Modelo de datos

Entrada nueva en `GAMES` (`lib/data.ts`):

```ts
{
  id: "<id>",
  title: "<TITLE>",
  short: "<copy corto>",
  long: "<copy largo>",
  cat: "<CAT>",
  cover: "cover-<id>",
  color: "<color>",
  best: 0,
  plays: "0",
}
```

Migración `supabase/migrations/<YYYYMMDDHHMMSS>_game_<id>.sql`:

```sql
-- Alta de <TITLE> en el catálogo de juegos con ranking real (SPEC 06).
insert into public.games (id, title) values ('<id>', '<TITLE>');
```

No cambia el esquema: no hace falta regenerar `lib/supabase/database.types.ts`.

<!-- (CONDICIONAL: contrato) -->
Contrato extendido en `games/types.ts` (se agrega; `GameStats`, `GameCallbacks`, `GameEngine` y `GameFactory` no cambian):

```ts
export type EngineEntry = {
  factory: GameFactory;
  width: number;   // tamaño lógico del canvas
  height: number;
  lives?: boolean; // false oculta el stat de Vidas en el HUD de plataforma
  level?: boolean; // false oculta el stat de Nivel
};
```

Registro en `games/registry.ts`:

```ts
export const ENGINES: Partial<Record<string, EngineEntry>> = {
  asteroides: { factory: createAsteroids, width: 800, height: 600 },
  <id>: { factory: create<Factory>, width: <W>, height: <H><, lives: false><, level: false> },
};
```
<!-- (FIN CONDICIONAL) -->

<!-- Sin contrato extendido, el registro queda: -->
<!-- `<id>: create<Factory>,` dentro de `ENGINES`. -->

Estado interno del motor (privado a `games/<slug>/engine.ts`): <lista de campos>, `phase`, `paused`, `lastTime`, `rafId`, `keys`. <Clases portadas con tipos, recibiendo contexto 2D y colores por parámetro.>

---

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app` en lo relativo a client components y `useEffect` (según `AGENTS.md`). Agregar la entrada `<id>` en `GAMES` y la portada `.cover-<id>`. Manual: la tarjeta aparece en `/`, `/juegos`, `/salon` y `/juego/<id>`; `/jugar/<id>` abre con la simulación.
2. (CONDICIONAL: contrato) Extender el contrato: `EngineEntry` en `games/types.ts`, `ENGINES` con metadatos, `asteroides` migrado y `GamePlayer` leyendo tamaño y flags del registro. Manual: `/jugar/asteroides` se ve y juega igual que antes; `npm run build` y `npm run lint` pasan.
3. Crear `games/<slug>/engine.ts` (port completo<, assets en `public/games/<id>/`>) y registrarlo en `games/registry.ts`. Manual: `/jugar/<id>` se juega con teclado, el HUD de plataforma refleja el motor y el fin de partida abre el modal.
4. Escribir `supabase/migrations/<YYYYMMDDHHMMSS>_game_<id>.sql`. **Pedir confirmación al usuario** y aplicarla con el MCP (`apply_migration`, nombre `game_<id>`). Verificar con `list_migrations`, `execute_sql` (`select * from public.games`) y `get_advisors` (security).
5. Verificar los criterios de aceptación con Playwright MCP (desktop y 390px, consola, guardado) y SQL del MCP; guardar capturas en `.playwright-screenshot/`.

Cada paso deja la app corriendo y commiteable.

---

## Criterios de aceptación

**Integración (fijos):**

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `GAMES` contiene `<id>` con los valores del Modelo de datos; las demás entradas no cambiaron.
- [ ] La tarjeta <TITLE> aparece en `/` (si su posición entra en `GAMES.slice(0, 6)`), en `/juegos` (filtro <CAT> y búsqueda "<prefijo>"), como pestaña en `/salon` y en `/juego/<id>`, con la portada `.cover-<id>`.
- [ ] Existe `games/<slug>/engine.ts` y no declara variables de módulo mutables.
- [ ] En `/jugar/<id>` hay un `<canvas>` de <W>×<H> dentro de `.crt-screen` y no existe `.game-arena`.
- [ ] El HUD de plataforma muestra score<, vidas> <y nivel> reales del motor<; Vidas/Nivel no se muestran si el juego no los tiene>.
- [ ] El canvas no dibuja score<, vidas ni nivel>; no muestra "GAME OVER" ni texto de reinicio, y ninguna tecla reinicia la partida.
- [ ] Al terminar la partida se abre el modal FIN DEL JUEGO con el score final del motor.
- [ ] FIN durante la partida detiene el juego y abre el modal con el score actual.
- [ ] JUGAR DE NUEVO reinicia a score 0 <, vidas iniciales y nivel 01> y la partida es jugable.
- [ ] PAUSA congela el canvas (dos capturas separadas por 1 s idénticas) y REANUDAR continúa sin salto; `P` y `Escape` alternan la pausa.
- [ ] Ocultar la pestaña o quitar el foco pausa el juego y al volver sigue en pausa.
- [ ] Con el juego activo, las teclas del juego no hacen scroll; con el modal abierto o en pausa no son interceptadas.
- [ ] Salir de `/jugar/<id>` destruye el motor: sin listeners de teclado ni `requestAnimationFrame` activos (teclas en otras páginas no generan errores).
- [ ] Los elementos del juego usan los tokens indicados (verificado en captura).
- [ ] En emulación móvil táctil (390px) `/jugar/<id>` muestra "REQUIERE TECLADO", sin scroll horizontal ni errores en consola.
- [ ] `public.games` contiene la fila `<id>` / `<TITLE>` y `list_migrations` muestra `game_<id>` aplicada; `get_advisors` (security) no reporta hallazgos nuevos.
- [ ] Con sesión, GUARDAR PUNTUACIÓN inserta en `scores` una fila con `game_id = '<id>'` y el score del modal (SQL del MCP), y la marca aparece en `/juego/<id>` y en la pestaña <TITLE> de `/salon`.
- [ ] `/jugar/asteroides` y un juego mock (ej. `/jugar/rocas`) siguen funcionando igual.
- [ ] La consola no muestra errores en `/jugar/<id>` durante una partida completa.
- [ ] Nada en `app/`, `components/`, `lib/` ni `games/` importa archivos de `references/`.

**Gameplay (específicos de <TITLE>):**

<!-- Un criterio booleano por cada control, regla de puntaje, vida, nivel, power-up, asset o indicador en canvas extraído del análisis. Ej.: -->
- [ ] <`←`/`→` …>
- [ ] <Completar N líneas suma X puntos …>
- [ ] <El nivel sube cuando …>

---

## Decisiones

- **Sí:** juego `<id>` / <TITLE> como entrada <nueva | que reemplaza a `<mock>`>. <Justificación.>
- **Sí:** port a motor TypeScript con el contrato `GameFactory` de SPEC 05. Tipado, sin globals, montaje/desmontaje limpio desde React.
- **No:** iframe ni copiar el JS original sin tipos (mismas razones que SPEC 05).
- **Sí:** HUD de plataforma como única fuente de score<, vidas y nivel>; en el canvas solo <indicadores propios>.
- **Sí:** fin de partida por modal de plataforma, sin reinicio por tecla: toda partida pasa por el guardado de SPEC 04.
- **Sí:** alta en `public.games` por migración aplicada con el MCP tras confirmación. Sin la fila, la FK de SPEC 06 rechaza el guardado.
- **Sí:** colores desde tokens de `globals.css`.
- **Sí:** port fiel del gameplay; cambios en otro spec.
- (CONDICIONAL: contrato) **Sí:** extender el registro con `EngineEntry` (`width`, `height`, `lives`, `level`) en vez de forzar <TITLE> a 800×600 con vidas falsas. Reutilizable para próximos ports.
- (CONDICIONAL: contrato) **No:** cambiar `GameStats`/`GameCallbacks`: el motor puede seguir reportando `lives`/`level` aunque la UI los oculte.
- <Decisiones sobre assets, sonido, teclas en conflicto, mock relacionado.>

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| React 19 Strict Mode monta efectos dos veces: dos motores y listeners duplicados | `destroy()` idempotente en el cleanup; criterio que verifica que no quedan listeners ni loops. |
| Teclas "pegadas" al perder foco | Limpiar teclas al pausar; auto-pausa por `blur`. |
| `onStats` a 60 fps provoca re-renders | Llamar `onStats` solo cuando cambia algún valor. |
| Olvidar o no aplicar la migración de `games`: el guardado falla con error genérico | Paso 4 explícito y criterio con SQL del MCP. |
| Migración aplicada directo en el proyecto remoto | Solo inserta una fila; se pide confirmación antes de aplicar. |
| El score lo reporta el cliente | Asumido en SPEC 04; anti-trampas en spec posterior. |
| Teclas del juego chocan con `P`/`Escape` de pausa | <Resolución acordada o "No aplica">. |
| (CONDICIONAL: contrato) Cambiar el registro rompe ASTEROIDES | Paso 2 verifica `/jugar/asteroides` antes de agregar el motor nuevo. |
| (CONDICIONAL: contrato) Canvas no 4:3 dentro de `.crt-screen` 4:3 se deforma | Escalar manteniendo proporción y centrar (letterbox). |
| Next.js 16 con convenciones distintas a las recordadas | Leer `node_modules/next/dist/docs/01-app` antes de escribir. |

---

## Lo que **no** está en este spec

- Controles táctiles, HiDPI y soporte móvil jugable.
- <Sonido, extras de gameplay, cambios al mock>.
- Anti-trampas y validación de scores.
- `best` y `plays` desde la base.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.
