# SPEC 03 — Página "Acerca de" y formulario de contacto con Resend

> **Status:** Aprobado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-10-03
> **Objective:** Montar la página `/about` del template `references/templates/home-about/about.jsx` (misión + formulario de contacto) y hacer que el formulario envíe un correo real al equipo mediante Resend desde un Route Handler.

---

## Por qué existe este spec

SPEC 02 omitió explícitamente la página "Acerca de" y su link en el Nav. Este spec la recupera. A diferencia del template, donde el envío es simulado (`setSent(...)` sin red), aquí el formulario llama a un endpoint real que usa [Resend](https://resend.com/). Eso introduce la primera variable de entorno secreta del proyecto y la primera ruta de API.

Port 1:1 del prototipo para el markup y el CSS (mismas clases, mismo copy). Lo único que se agrega al template es el envío real, el estado de error y el honeypot.

---

## Alcance

**Entra:**

- Nueva ruta `app/about/page.tsx`, client component, puerto de `references/templates/home-about/about.jsx`:
  - Hero `▸ ACERCA DE` con título, misión y 3 `highlight` (HEART, BROWSER, PLANT) con sus iconos pixel.
  - Divisor `about-divider` con 24 píxeles animados.
  - Sección `▸ CONTACTO` con intro, 3 `tip` y formulario (NOMBRE, CORREO ELECTRÓNICO, MENSAJE).
  - Animación de aparición por scroll reutilizando `useReveal` de `components/home/use-reveal.ts` (SPEC 02).
  - Animación `shake` cuando el envío del cliente es inválido (campos vacíos).
  - Terminal de éxito `VAULT-OS // TERMINAL` con el texto del template y botón "ENVIAR OTRO MENSAJE".
- Estados del formulario: `idle`, `sending`, `sent`, `error`.
  - `sending`: botón deshabilitado con texto "ENVIANDO…".
  - `error`: terminal en rojo (misma estructura que la de éxito, clase `terminal-error`) con el mensaje devuelto por la API y botón "REINTENTAR" que vuelve a `idle` conservando lo escrito.
- Route Handler `app/api/contact/route.ts` (`POST`):
  - Valida server-side `name`, `email`, `message` y el honeypot.
  - Envía el correo con el SDK `resend`.
  - Responde JSON `{ ok: true }` o `{ ok: false, error: string }` con código HTTP acorde (400 validación, 502 fallo de Resend, 500 configuración faltante).
- Dependencia nueva: `resend` en `package.json`.
- Variables de entorno (ver Modelo de datos) y archivo `.env.example` con los nombres, sin valores.
- Portar a `app/globals.css` el bloque `ABOUT PAGE` de `home-about/styles.css` (líneas 1071–1150) más `.btn.press`, `.terminal-success`, `.term-*` y `.caret`, más las reglas nuevas `terminal-error` y `.hp-field` (honeypot oculto).
- Actualizar `components/nav.tsx`: link "Acerca de" (`/about`) en la barra y en el panel móvil; activo solo en `/about`.
- Verificación con Playwright MCP y con `curl` contra el endpoint (ver criterios).

**Fuera de alcance (para specs futuros):**

- Rate limit por IP (en memoria no sirve en serverless multi-instancia; si hace falta, spec propio con almacén externo).
- Dominio verificado en Resend. Por ahora se usa el sandbox `onboarding@resend.dev`; cambiar a un dominio propio es solo cambiar `CONTACT_FROM_EMAIL`.
- Correo de confirmación al remitente (auto-respuesta).
- Guardar los mensajes en una base de datos o panel de administración.
- CAPTCHA (Turnstile, reCAPTCHA).
- Plantilla HTML elaborada del correo: se envía texto plano.
- Variantes de tema, `GAMEPAD` y tests automatizados (no hay test runner).

---

## Modelo de datos

Payload del `POST /api/contact`:

```ts
type ContactRequest = {
  name: string;     // 1–80 caracteres tras trim
  email: string;    // formato de correo válido, máx. 254
  message: string;  // 1–2000 caracteres tras trim
  website: string;  // honeypot: debe llegar vacío
};

type ContactResponse = { ok: true } | { ok: false; error: string };
```

Reglas del handler:

- Si `website` no está vacío, responde `{ ok: true }` sin enviar nada (el bot cree que funcionó).
- `email` del visitante va en `replyTo` del correo; nunca en `from`.
- Asunto del correo: `[Arcade Vault] Mensaje de <name>`.
- Cuerpo en texto plano: nombre, correo y mensaje.

Variables de entorno (solo servidor, sin prefijo `NEXT_PUBLIC_`):

| Variable | Contenido |
| --- | --- |
| `RESEND_API_KEY` | API key de Resend (`re_...`). Secreta. |
| `CONTACT_TO_EMAIL` | Correo que recibe los mensajes. En sandbox, debe ser el correo de la cuenta de Resend. |
| `CONTACT_FROM_EMAIL` | Remitente. Por ahora `onboarding@resend.dev`. |

**Dónde colocarlas:** en `.env.local` en la raíz del proyecto (`05-arcade/.env.local`), junto a `package.json`. Next.js lo carga solo en dev y build; `.gitignore` ya ignora `.env*` (excepto `.env.example`). En producción se definen en el panel del hosting. Tras crear o cambiar el archivo hay que reiniciar `npm run dev`. El agente no lee ni edita `.env` ni `.env.local`: las crea el usuario.

---

## Plan de implementación

1. Instalar `resend` (`npm install resend`) y crear `.env.example` con los tres nombres sin valores. Manual: `npm run build` pasa.
2. Crear `app/api/contact/route.ts` con validación, honeypot y envío por Resend; devuelve 500 con `error` claro si falta alguna variable. Manual: `curl` con payload inválido devuelve 400; con payload válido y las variables definidas devuelve `{ ok: true }` y llega el correo.
3. Portar a `app/globals.css` el CSS `ABOUT PAGE`, `.btn.press`, terminal, `terminal-error` y `.hp-field`. Manual: build sin errores, páginas existentes sin cambios visuales.
4. Crear `components/about/highlight-icon.tsx` (3 iconos pixel).
5. Crear `app/about/page.tsx` con hero, divisor y sección de contacto con el formulario aún sin red (valida y muestra éxito local como el template). Manual: `/about` se ve igual al template.
6. Conectar el formulario al endpoint: `fetch("/api/contact")`, estados `sending`/`sent`/`error`, botón "REINTENTAR". Manual: enviar desde `/about` y recibir el correo.
7. Agregar "Acerca de" a `components/nav.tsx` (barra y panel móvil) con `isActive` solo en `/about`.
8. Verificar con Playwright MCP (criterios de aceptación) y guardar capturas en `.playwright-screenshot/`.

Cada paso deja la app corriendo y commiteable.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `/about` muestra el título "ACERCA DE ARCADE VAULT", los 3 highlights, el divisor y la sección "CONTÁCTANOS" con los 3 tips.
- [ ] El Nav muestra "Acerca de" en la barra y en el panel móvil; está activo en `/about` y no activo en `/`, `/juegos` ni `/salon`.
- [ ] Enviar el formulario con algún campo vacío no hace petición de red y aplica la clase `shake` al formulario.
- [ ] Con las variables definidas, enviar el formulario válido muestra la terminal de éxito con "GRACIAS, <NOMBRE EN MAYÚSCULAS>." y el correo llega a `CONTACT_TO_EMAIL` con asunto `[Arcade Vault] Mensaje de <name>`, y con `replyTo` igual al correo del visitante.
- [ ] Durante el envío el botón muestra "ENVIANDO…" y está deshabilitado.
- [ ] "ENVIAR OTRO MENSAJE" vuelve al formulario vacío.
- [ ] Si el endpoint responde error (por ejemplo, con `RESEND_API_KEY` inválida), se muestra la terminal roja con el mensaje y "REINTENTAR" devuelve al formulario con los valores conservados.
- [ ] `curl -X POST /api/contact` con `email` inválido, `message` vacío o `message` de más de 2000 caracteres devuelve 400 y `{ ok: false, error }`.
- [ ] `curl -X POST /api/contact` con `website` no vacío devuelve `{ ok: true }` y no se envía correo.
- [ ] Sin `RESEND_API_KEY` el endpoint devuelve 500 con `{ ok: false, error }` y no filtra el valor de ninguna variable.
- [ ] `RESEND_API_KEY` no aparece en el bundle del cliente (búsqueda en `.next/static` sin coincidencias) ni en ningún archivo versionado.
- [ ] `.env.example` existe, lista las 3 variables sin valores, y `git status` no muestra `.env` ni `.env.local`.
- [ ] En viewport 390px de ancho `/about` no tiene scroll horizontal y `contact-grid` pasa a 1 columna.
- [ ] La consola del navegador no muestra errores en `/about` (chequeado con Playwright MCP).
- [ ] Ningún archivo de `references/templates` se importa desde `app/`, `components/` o `lib/`.

---

## Decisiones

- **Sí:** Route Handler `POST /api/contact`. Se prueba aislado con `curl` y el cliente maneja los estados con `fetch`.
- **No:** Server Action. Menos fácil de verificar de forma independiente del formulario.
- **Sí:** SDK oficial `resend`. Pedido explícito de usar Resend, y evita armar a mano la petición HTTP y sus errores.
- **Sí:** sandbox `onboarding@resend.dev` por ahora, con `FROM` y `TO` en variables de entorno. Cambiar a un dominio verificado no toca código.
- **Sí:** secretos en `.env.local`, nunca con prefijo `NEXT_PUBLIC_`. `.env.local` es la convención de Next.js para secretos locales y ya está ignorado por git.
- **Sí:** `.env.example` versionado, solo con nombres. Documenta qué configurar sin exponer valores.
- **Sí:** validación server-side más honeypot. Sin dependencias nuevas y frena bots simples.
- **No:** rate limit en memoria. No es fiable en serverless; se difiere.
- **No:** CAPTCHA. Fricción y dependencia externa innecesarias para este volumen.
- **Sí:** el visitante va en `replyTo`, no en `from`. Resend exige un remitente propio/verificado; así responder desde el correo funciona.
- **Sí:** texto plano en el correo. Evita inyección HTML con contenido del visitante.
- **Sí:** estado de error visible (terminal roja con reintento). Un fallo de envío no puede mostrarse como éxito.
- **Sí:** "Acerca de" vuelve al Nav. Revierte la exclusión que hizo SPEC 02 solo por alcance.
- **Sí:** el honeypot responde `ok: true`. No da señal al bot de que fue detectado.
- **Sí:** el agente no lee `.env`. Por pedido explícito; el usuario crea `.env.local` y los valores.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Sandbox de Resend solo entrega al correo de la cuenta | `CONTACT_TO_EMAIL` documentado como el correo de la cuenta; cambiar a dominio verificado queda como paso futuro. |
| API key filtrada al cliente o al repositorio | Sin prefijo `NEXT_PUBLIC_`, uso solo en el Route Handler, `.env*` ignorado por git, criterio de aceptación que busca la key en `.next/static`. |
| Abuso del endpoint (spam hacia la bandeja del equipo) | Honeypot, límites de largo y validación. Rate limit queda fuera por decisión; reevaluar si hay abuso real. |
| Inyección de cabeceras vía `name`/`email` en asunto o `replyTo` | Validar `email` con regex estricta, rechazar saltos de línea en `name` y `email`. |
| Next.js 16 con convenciones distintas a las recordadas para Route Handlers | Leer `node_modules/next/dist/docs/01-app` antes de escribir, según `AGENTS.md`. |
| Variables no cargadas tras crear `.env.local` | Reiniciar `npm run dev`; el endpoint devuelve 500 con mensaje claro si faltan. |

---

## Lo que **no** está en este spec

- Rate limit, CAPTCHA y auto-respuesta al visitante.
- Dominio propio verificado en Resend.
- Almacenar mensajes o panel de administración.
- Plantillas HTML de correo.
- Variantes de tema y gamepad del template.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.
