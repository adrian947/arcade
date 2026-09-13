# SPEC 01 — MVP visual de Arcade Vault (5 pantallas del prototipo)

> **Status:** Implemented
> **Depends on:** Ninguno
> **Date:** 2026-09-13
> **Objective:** Portar a Next.js App Router (rutas reales) las 5 pantallas del prototipo estático en `references/templates` (Biblioteca, Detalle, Reproductor, Auth, Salón de la Fama), reutilizando el CSS y las fuentes ya configurados en `app/globals.css` y `app/layout.tsx`, sin implementar lógica de juego real.

---

## Por qué existe este spec

`references/templates` es un prototipo HTML+CDN (React vía `<script>`, sin build, routing por hash en `app.jsx`, un único componente `App` con todo el estado). El proyecto real es Next.js 16 + React 19 + TypeScript con App Router. Un commit previo ("primera configuracion") ya adelantó parte del trabajo de base: `app/layout.tsx` ya monta las fuentes (`Press_Start_2P`, `JetBrains_Mono`, `Courier_Prime`) y los divs `av-bg`/`av-noise`/`av-root`, y `app/globals.css` ya contiene el CSS completo del prototipo (950 líneas, clases `.av-*`, `.btn`, `.card`, `.crt`, etc.) importado junto a Tailwind v4. Lo que falta es todo lo demás: componentes, rutas, datos y el layout no monta todavía `Nav` ni el `<main>`/footer.

Esto es un port 1:1, no un rediseño: mismas clases CSS, mismo copy en español, mismos datos mock, pero con routing real de Next.js en vez de hash, y sesión de usuario vía contexto de React en vez de estado prop-drilled desde un único `App`.

---

## Scope

**In:**

- 5 pantallas visuales, cada una con su propia ruta App Router:
  - `/` — Biblioteca (`biblioteca.jsx` → grid de juegos, buscador, chips de categoría).
  - `/juego/[id]` — Detalle (`detalle.jsx` → info del juego + leaderboard mock).
  - `/jugar/[id]` — Reproductor (`reproductor.jsx` → HUD, arena CRT animada, modal de fin de partida). Se mantiene el mock animado tal cual (score que sube solo por `setInterval`, enemigos animados por CSS) porque sigue sin ser un juego real, solo una demo visual viva.
  - `/login` — Auth (`auth.jsx` → login, registro, invitado, botones sociales decorativos).
  - `/salon` — Salón de la Fama (`salon.jsx` → podio + tabla de puntuaciones por juego).
- `Nav` (`nav.jsx`) montado en `app/layout.tsx`, con menú hamburguesa responsive (<840px) igual que el prototipo.
- Footer igual al de `app.jsx` (línea `© 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0`), montado en el layout.
- Datos mock (`GAMES`, `CATS`, `PLAYERS`, `seededScores`) portados a TypeScript en `lib/data.ts`.
- Sesión de usuario simulada: login/logout persistido en `localStorage` bajo la clave `av_user`, igual que el prototipo.
- Guardado de puntuación al terminar una partida, persistido en `localStorage` bajo la clave `av_scores`, igual que el prototipo.
- Tipado TypeScript (`.tsx`) en todos los archivos nuevos.

**Out of scope (para specs futuros):**

- Cualquier lógica de juego real (física, colisiones, input de teclado/táctil jugable). El Reproductor sigue siendo un mock visual, no un juego.
- Backend real, API, base de datos, autenticación real (OAuth de Google/GitHub son botones decorativos sin acción, igual que en el prototipo).
- Leer `av_scores` para mostrar puntuaciones reales en el Salón de la Fama o el Detalle (hoy ambos usan datos generados por `seededScores`, y así se mantiene).
- Sonido, multiplayer, i18n, modo claro, páginas de perfil/ajustes.
- Tests automatizados (el proyecto no tiene test runner configurado).

---

## Modelo de datos

Tipos nuevos en `lib/data.ts` (mismo contenido que `data.jsx`, tipado):

```ts
type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string; // nombre de clase CSS .cover-*, ya definida en globals.css
  color: "cyan" | "magenta" | "green" | "yellow";
  best: number;
  plays: string;
};

type ScoreRow = { rank: number; name: string; score: number; date: string };
```

`GAMES` (8 juegos), `CATS` (5 categorías) y `seededScores(seed, count)` se portan con los mismos valores exactos del prototipo.

Sesión y puntuaciones, en un módulo nuevo `lib/user.ts`:

```ts
type User = { name: string };
type ScoreEntry = { game: string; score: number; name: string; at: number };
```

- `av_user` en `localStorage`: `User | null`, igual que hoy.
- `av_scores` en `localStorage`: `ScoreEntry[]`, se agrega una entrada al guardar puntuación; no se lee en ninguna pantalla (igual que el prototipo, donde tampoco se consume).

---

## Plan de implementación

1. Crear `lib/data.ts` con los tipos `Game`/`ScoreRow` y los datos `GAMES`, `CATS`, `PLAYERS`, `seededScores` portados de `references/templates/data.jsx`.
2. Crear `lib/user.tsx` con un `UserProvider` (client component, contexto de React) y un hook `useUser()` que exponen `{ user, login(user), logout() }`, respaldados por `localStorage["av_user"]`. Reemplaza el estado `user` que en el prototipo vivía en `App`, porque ahora las pantallas son rutas separadas en vez de un único componente.
3. Crear `lib/scores.ts` con `saveScore(entry: Omit<ScoreEntry, "at">)`, que agrega la entrada a `localStorage["av_scores"]`.
4. Editar `app/layout.tsx`: envolver `children` con `<UserProvider>`, montar `<Nav />` antes de un `<main className="av-main">{children}</main>` y el `<footer>` con el copyright, replicando la estructura de `app.jsx`.
5. Crear `components/nav.tsx`, puerto de `nav.jsx` como client component: usa `usePathname()` de `next/navigation` para resaltar el link activo (en vez del objeto `route` del prototipo), `useUser()` para mostrar "Iniciar Sesión" o "{nombre} ▾", y `<Link>`/`useRouter()` para navegar. Mismo panel móvil y mismo botón hamburguesa.
6. Reemplazar `app/page.tsx` (boilerplate de `create-next-app`) por el puerto de `biblioteca.jsx`: buscador, chips de `CATS`, grid de `GameCard` que navega a `/juego/[id]` con `<Link>`.
7. Crear `app/juego/[id]/page.tsx`, puerto de `detalle.jsx`: lee `params.id`, busca el juego en `GAMES`, llama `notFound()` si no existe, muestra info + leaderboard con `seededScores`. Botón "JUGAR AHORA" navega a `/jugar/[id]`.
8. Crear `app/jugar/[id]/page.tsx`, puerto de `reproductor.jsx` tal cual (HUD, arena CRT animada, pausa/fin, modal de fin de partida). Usa `useUser()` para el nombre por defecto y `saveScore()` de `lib/scores.ts` al confirmar. Botón "SALIR" navega a `/juego/[id]`.
9. Crear `app/login/page.tsx`, puerto de `auth.jsx`: tabs iniciar sesión/crear cuenta, botón invitado, botones sociales decorativos (sin acción). Llama `login()`/`useUser()` y redirige a `/` tras autenticar.
10. Crear `app/salon/page.tsx`, puerto de `salon.jsx` tal cual: tabs por juego, podio, tabla, fila "tu mejor marca" solo si `useUser().user` existe. Botón "VOLVER A LA BIBLIOTECA" navega a `/`.

Cada paso deja la app corriendo (`npm run dev`) sin romper lo ya portado.

---

## Criterios de aceptación

- [x] `npm run dev` levanta sin errores de consola.
- [x] `npm run build` compila sin errores.
- [x] `npm run lint` pasa sin errores.
- [x] `/` muestra la Biblioteca: hero, buscador funcional, chips de categoría funcionales, grid con los 8 juegos de `GAMES`.
- [x] Buscar un término sin resultados muestra el estado "NO HAY RESULTADOS".
- [x] Click en una tarjeta o su botón "JUGAR" navega a `/juego/[id]` con la info y el leaderboard correctos para ese juego.
- [x] En `/juego/[id]`, "JUGAR AHORA" navega a `/jugar/[id]`.
- [x] En `/jugar/[id]`, el score sube solo, "PAUSA" detiene el incremento y cambia a "REANUDAR", "FIN" abre el modal de fin de partida.
- [x] En el modal de fin de partida, guardar la puntuación con iniciales la persiste en `localStorage["av_scores"]` y muestra el toast "PUNTUACIÓN GUARDADA".
- [x] `/login` permite iniciar sesión (nombre en mayúsculas, máx. 10 caracteres), crear cuenta, o entrar como invitado; cualquiera de las tres redirige a `/`.
- [x] Tras iniciar sesión, `Nav` muestra "{NOMBRE} ▾" en vez de "Iniciar Sesión", y esto persiste al recargar la página (lee `localStorage["av_user"]`).
- [x] Cerrar sesión desde `Nav` borra `localStorage["av_user"]` y vuelve a mostrar "Iniciar Sesión".
- [x] `/salon` muestra podio + tabla de puntuaciones por juego seleccionado; la fila "TU MEJOR MARCA" solo aparece con sesión iniciada.
- [x] Con viewport <840px, `Nav` oculta los links y muestra el botón hamburguesa; abrirlo despliega el panel lateral con los mismos links.
- [x] Ningún archivo de `references/templates` se importa desde código de `app/`, `components/` o `lib/` (solo sirvió de referencia visual).

---

## Decisiones

- **Sí:** rutas reales de Next.js App Router (`/`, `/juego/[id]`, `/jugar/[id]`, `/login`, `/salon`) en vez del hash-routing del prototipo. Es lo idiomático en App Router y evita mantener un router casero.
- **No:** hash-routing SPA como en `app.jsx`. Habría sido más fiel línea a línea al prototipo, pero va contra el patrón estándar de Next.js que el resto del scaffold ya usa.
- **Sí:** reutilizar `app/globals.css` tal cual (ya contiene el CSS completo del prototipo desde el commit "primera configuracion"). Fidelidad visual exacta, cero trabajo adicional.
- **No:** migrar el sistema visual a utilities de Tailwind v4. Más trabajo y riesgo de perder detalle visual (neón, CRT, pixel fonts) sin beneficio para un MVP solo visual.
- **Sí:** `localStorage` real para `av_user` y `av_scores`, mismas claves que el prototipo. Ya es el comportamiento que trae el template y no requiere backend.
- **Sí:** mantener el Reproductor como mock animado (score automático, enemigos CSS) en vez de congelarlo a un frame estático. Se ve vivo sin ser un juego real, y es lo que ya hace el prototipo.
- **Sí:** sesión de usuario centralizada en un `UserProvider` de contexto de React (`lib/user.tsx`), en vez de prop-drilling como en el `App` original. Necesario porque ahora Nav, Auth y Reproductor viven en rutas/archivos separados, no en un único componente con estado compartido.
- **Sí:** TypeScript tipado (`.tsx`) para todos los archivos nuevos, coherente con el scaffold `create-next-app` en modo TS.
- **Sí:** datos mock centralizados en un único `lib/data.ts`, mismo patrón que `data.jsx` en el prototipo.
- **No:** leer `av_scores` para alimentar el Salón de la Fama o el Detalle. El prototipo tampoco lo hace (usa `seededScores` determinístico); cambiarlo es una decisión de producto para otro spec.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Next.js 16 tiene APIs distintas a las recordadas por el modelo (rutas dinámicas, `params` async, etc.) | Leer `node_modules/next/dist/docs/01-app` antes de escribir cada ruta, según indica `AGENTS.md`. |
| Las clases usadas en el JSX portado no calzan exactamente con las ya definidas en `app/globals.css` | Revisar cada clase contra `globals.css` (ya escrito) al portar cada componente, no asumir nombres. |
| `localStorage` no disponible (SSR o modo privado) | Los componentes que lo usan son client components; acceso envuelto en `try/catch` igual que el prototipo. |

---

## Lo que **no** está en este spec

- Ningún juego jugable de verdad (física, colisiones, input real).
- Backend, API, autenticación real u OAuth funcional.
- Lectura de `av_scores` en Salón de la Fama o Detalle.
- Sonido, multiplayer, i18n, páginas de perfil o ajustes.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.
