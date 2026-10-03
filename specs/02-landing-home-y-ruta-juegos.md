# SPEC 02 — Landing en `/` y Biblioteca movida a `/juegos`

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-10-03
> **Objective:** Mover la Biblioteca ("INSERTA UNA MONEDA PARA JUGAR") de `/` a `/juegos` y montar en `/` la landing del template `references/templates/home-about` (todas las secciones, sin la página "Acerca de").

---

## Por qué existe este spec

SPEC 01 dejó la Biblioteca como página principal. El template `references/templates/home-about/` (`home.jsx`, `nav.jsx`, `styles.css`, más el bundle `arcade-vault-standalone.html`, que es el mismo contenido empaquetado) agrega una landing de marketing y un Nav con link "Inicio". Para que ambas convivan, la Biblioteca pasa a `/juegos` y la landing toma `/`.

Como en SPEC 01, es un port 1:1 del prototipo (mismas clases CSS, mismo copy, mismos datos fijos), no un rediseño. Se usan los `.jsx` como fuente porque el HTML standalone es un bundle de 1.4 MB ilegible.

---

## Scope

**In:**

- Mover el contenido actual de `app/page.tsx` (Biblioteca) a `app/juegos/page.tsx`, sin cambios de comportamiento: sigue mostrando el sub "INSERTA UNA MONEDA PARA JUGAR", buscador, chips y grid de 8 juegos.
- Nueva landing en `app/page.tsx`, puerto de `references/templates/home-about/home.jsx`, con todas sus secciones:
  - Hero (siluetas flotantes, título, 2 CTA, "DESLIZA").
  - `// 01` ¿POR QUÉ ARCADE VAULT? (4 feature cards con iconos pixel).
  - `// 02` JUEGOS DISPONIBLES AHORA (6 `MiniCard` de `GAMES.slice(0, 6)` + botón "VER TODOS LOS JUEGOS →").
  - Stats (12+ JUEGOS / MILES DE PARTIDAS / GLOBAL RANKING).
  - `// 03` ACTIVIDAD EN VIVO (ticker de últimas puntuaciones + top jugadores del día, datos hardcodeados).
  - `// 04` PRECIOS (plan único + FAQ).
  - CTA final "¿LISTO PARA JUGAR?".
  - Animación de aparición por scroll (`useReveal`, clase `.reveal`/`.in`).
- Portar a `app/globals.css` el CSS faltante de `home-about/styles.css`: bloque `HOME PAGE` (líneas 930–1070), `ACTIVITY` y `PRICING` (líneas 1621–1725). No se porta `ABOUT PAGE`, `GAMEPAD` ni `Theme variants`.
- Actualizar `components/nav.tsx` según `home-about/nav.jsx`: links "Inicio" (`/`), "Biblioteca" (`/juegos`), "Salón de la Fama" (`/salon`), tanto en la barra como en el panel móvil. Sin "Acerca de". El logo sigue yendo a `/`.
- Ajustar `isActive` de `Nav`: "Inicio" activo solo en `/`; "Biblioteca" activo en `/juegos`, `/juego/*` y `/jugar/*`.
- Redirigir a `/juegos` en vez de `/` los destinos "volver" y post-login:
  - `app/login/page.tsx` (login, registro e invitado, 2 `router.push`).
  - `components/game-detail.tsx` ("VOLVER AL VAULT").
  - `components/game-player.tsx` ("VOLVER AL VAULT" del modal de fin de partida).
  - `app/salon/page.tsx` ("VOLVER A LA BIBLIOTECA").
- CTA de la landing: "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" e "INSERTAR MONEDA →" van a `/juegos`; "CREAR CUENTA" y "EMPEZAR GRATIS →" van a `/login`; cada `MiniCard` va a `/juego/[id]`; "VER SALÓN →" va a `/salon`.
- Verificación visual con el MCP de Playwright (ver criterios de aceptación).

**Out of scope (para specs futuros):**

- Página "Acerca de" (`about.jsx`, ruta `/about`, CSS `ABOUT PAGE`, link en Nav). Decisión explícita: se omite.
- Datos reales o dinámicos en "Actividad en vivo" y "Top jugadores" (quedan hardcodeados como en el template).
- Backend, pagos reales o planes de precios múltiples.
- Cambios al CSS/markup de la Biblioteca más allá de la nueva ruta.
- Variantes de tema (`Theme variants`) y `GAMEPAD` del `styles.css` del template.
- Tests automatizados (no hay test runner).

---

## Modelo de datos

Este spec no introduce estructuras de datos globales nuevas. Reutiliza `GAMES` de `lib/data.ts` (SPEC 01).

Los datos del ticker y del top de jugadores se declaran como constantes locales (arrays literales) dentro del componente de la landing, idénticos a `home.jsx`:

```ts
type TickerRow = { p: string; g: string; s: number; t: string; c: "cyan" | "magenta" | "yellow" | "green" };
type TopRow = { r: number; p: string; s: number };
```

---

## Plan de implementación

1. Crear `app/juegos/page.tsx` con el contenido actual de `app/page.tsx` (mover, no copiar). `app/page.tsx` queda temporalmente con un `export default function Home() { return null; }`. Manual: `/juegos` muestra la Biblioteca.
2. Actualizar los links a la Biblioteca: `router.push("/")`/`href="/"` pasan a `/juegos` en `app/login/page.tsx`, `components/game-detail.tsx`, `components/game-player.tsx` y `app/salon/page.tsx`. Manual: login redirige a `/juegos`, "VOLVER" lleva a `/juegos`.
3. Actualizar `components/nav.tsx`: agregar "Inicio" (`/`), apuntar "Biblioteca" a `/juegos`, ajustar `isActive` (barra y panel móvil).
4. Portar a `app/globals.css` los bloques `HOME PAGE`, `ACTIVITY` y `PRICING` de `home-about/styles.css`. Manual: build sin errores, páginas existentes sin cambios visuales.
5. Crear `components/home/floating-silhouettes.tsx` (8 SVG) y `components/home/feature-icon.tsx` (4 iconos).
6. Crear `components/home/use-reveal.ts` (hook `useReveal` con `IntersectionObserver`, limpieza al desmontar).
7. Crear `app/page.tsx` completo como client component: hero + secciones `// 01` y `// 02` (con `MiniCard` como función local), usando `<Link>` en vez de `navigate()`. Manual: `/` muestra hero, features y juegos.
8. Agregar a `app/page.tsx` las secciones restantes: stats, `// 03` actividad, `// 04` precios y CTA final. Manual: `/` muestra la landing completa.
9. Verificar con Playwright MCP (criterios de aceptación) y guardar capturas en `.playwright-screenshot/`.

Cada paso deja la app corriendo y commiteable.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `/` muestra la landing con las 6 secciones: hero, 01 ¿POR QUÉ?, 02 JUEGOS, stats, 03 ACTIVIDAD, 04 PRECIOS y CTA final "¿LISTO PARA JUGAR?".
- [ ] `/juegos` muestra la Biblioteca con el texto "INSERTA UNA MONEDA PARA JUGAR", buscador, chips y los 8 juegos.
- [ ] El hero de `/` tiene el eyebrow "▸ INSERTA UNA MONEDA" y los CTA "EXPLORAR JUEGOS" y "CREAR CUENTA".
- [ ] La sección 02 de `/` muestra exactamente 6 `MiniCard`; click en una navega a `/juego/[id]` correcto.
- [ ] "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" e "INSERTAR MONEDA →" navegan a `/juegos`.
- [ ] "CREAR CUENTA" y "EMPEZAR GRATIS →" navegan a `/login`; "VER SALÓN →" navega a `/salon`.
- [ ] El Nav muestra "Inicio", "Biblioteca" y "Salón de la Fama", y no muestra "Acerca de" (barra ni panel móvil).
- [ ] "Inicio" aparece activo en `/`, "Biblioteca" en `/juegos`, `/juego/[id]` y `/jugar/[id]`, y "Inicio" no está activo en esas rutas.
- [ ] Tras iniciar sesión (login, registro o invitado), la URL es `/juegos`.
- [ ] "VOLVER AL VAULT" (detalle y modal de fin de partida) y "VOLVER A LA BIBLIOTECA" (salón) navegan a `/juegos`.
- [ ] Las secciones con clase `.reveal` reciben la clase `in` al entrar en el viewport al hacer scroll.
- [ ] En viewport 390px de ancho, `/` no tiene scroll horizontal, y el grid de features pasa a 1 columna.
- [ ] La consola del navegador no muestra errores en `/` ni en `/juegos` (chequeado con Playwright MCP).
- [ ] No existe ruta `/about` ni texto "Acerca de" en el código nuevo.
- [ ] Ningún archivo de `references/templates` se importa desde `app/`, `components/` o `lib/`.

---

## Decisiones

- **Sí:** usar `home.jsx`, `nav.jsx` y `styles.css` de `home-about/` como fuente del port. El `arcade-vault-standalone.html` es el mismo contenido en bundle comprimido; leerlo no aporta nada y es inmanejable (1.4 MB).
- **Sí:** Biblioteca en `/juegos`, landing en `/`. Pedido explícito del usuario.
- **Sí:** post-login y botones "volver" van a `/juegos`. La landing es marketing; quien ya inició sesión o vuelve de una partida quiere la Biblioteca.
- **No:** dejar esos destinos en `/`. Llevaría al usuario logueado a una página de ventas.
- **Sí:** Nav con "Inicio", "Biblioteca", "Salón de la Fama". Es el template menos "Acerca de".
- **No:** página o link "Acerca de". Fuera por pedido del usuario ("todo menos about").
- **Sí:** port 1:1 de todas las secciones, incluida PRECIOS, con datos hardcodeados. Pedido de "todo", y los datos reales no existen todavía.
- **Sí:** portar solo el CSS necesario (HOME, ACTIVITY, PRICING) a `globals.css`, no copiar el `styles.css` entero. Evita arrastrar CSS de About, gamepad y temas que no se usan.
- **Sí:** componentes de la landing en `components/home/` y `app/page.tsx` como client component (usa `useReveal`).
- **Sí:** verificar con Playwright MCP, capturas en `.playwright-screenshot/`.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Colisión de nombres de clases CSS entre los bloques nuevos y `globals.css` existente (ej. `.btn.xl`, `.kicker`) | Al portar, buscar cada selector en `globals.css` antes de pegar; no duplicar reglas existentes. |
| `useReveal` corre antes del montaje y deja secciones invisibles (`.reveal` sin `in`) | El hook se ejecuta en `useEffect` tras el montaje y se verifica con scroll en Playwright. |
| Hidratación: `toLocaleString("es-ES")` con distinto locale en servidor/cliente | Usar el mismo formato que la Biblioteca existente (ya usa `toLocaleString("es-ES")`); revisar la consola en Playwright. |
| Next.js 16 con APIs distintas a las recordadas | Leer `node_modules/next/dist/docs/01-app` antes de escribir, según `AGENTS.md`. |

---

## Lo que **no** está en este spec

- Página "Acerca de" y su link en el Nav.
- Datos dinámicos o reales para actividad en vivo, ranking y precios.
- Variantes de tema y gamepad del template.
- Cambios de comportamiento en la Biblioteca, Detalle, Reproductor, Login o Salón (solo cambian los destinos de navegación).
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.
