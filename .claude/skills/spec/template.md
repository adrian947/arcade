# Plantilla para un spec útil

Este archivo es la referencia que consulta la skill `/spec` al generar specs. Cada sección incluye su propósito y un ejemplo mínimo. **No es texto para copiar literalmente**: es la forma que la skill debe respetar.

---

## Encabezado

Todo spec empieza con metadatos en un blockquote (sin tablas, sin bloques, simple como se muestra abajo):

```markdown
# SPEC NN — Título corto y descriptivo

> **Status:** Draft
> **Depends on:** SPEC 01, SPEC 02
> **Date:** YYYY-MM-DD
> **Objective:** Una sola frase. Si necesitas dos frases, la feature es demasiado grande.
```

**Estados válidos:** `Draft`, `In review`, `Approved`, `Implemented`, `Obsolete`.

> Las etiquetas de arriba son los valores por defecto en inglés. Las skills también aceptan equivalentes en cualquier idioma (ej. en español `Borrador` / `En revisión` / `Aprobado` / `Implementado` / `Obsoleto`). Elige un conjunto por repositorio y mantén la consistencia con los specs existentes.

**Regla del objetivo:** una frase que un humano lee en 5 segundos y entiende qué se va a construir. Si no cabe en una frase, divide la feature.

---

## Sección 1 — Por qué existe este spec (opcional)

Para specs que toman decisiones no obvias o rompen patrones del proyecto, una sección breve que explique el **porqué** del trabajo. No el qué: el qué viene después.

Para specs simples, omítela.

---

## Sección 2 — Alcance

Dos sub-bloques explícitos. **Ambos son obligatorios.**

```markdown
## Alcance

**Entra:**

- Cosa concreta uno.
- Cosa concreta dos.

**Fuera de alcance (para specs futuros):**

- Algo que podría hacerse pero no ahora.
- Algo que surgió en la conversación pero no entra.
```

**Por qué importa el "fuera":** captura lo que el usuario mencionó durante la fase de preguntas pero se decidió diferir. Sin ese registro, durante la implementación habrá la tentación de colarlo "ya que estamos".

---

## Sección 3 — Modelo de datos

Las estructuras concretas que aparecen o cambian. Usa código real, no pseudocódigo abstracto.

````markdown
## Modelo de datos

```js
// Estado de la lista de tareas
const state = {
  filter: "all",
  tasks: [/* { id, title, done, createdAt } */],
};
```

Convenciones:

- Fechas en formato ISO 8601.
- `id` único por tarea (UUID).
````

Si la feature no introduce datos nuevos, escríbelo explícitamente: _"Esta feature no introduce estructuras de datos nuevas. Reutiliza el modelo del SPEC 01."_

---

## Sección 4 — Plan de implementación

Pasos numerados. Cada paso debe dejar el sistema en un estado **funcional y ejecutable**. Nada de "implementar la mitad y seguir mañana".

```markdown
## Plan de implementación

1. Crear el archivo X con un esqueleto vacío.
2. Implementar la función A en X. Prueba manual: ejecutar Y, ver Z.
3. Conectar X con el módulo existente W.
4. ...
```

**Reglas:**

- Cada paso debe poder commitearse por sí solo.
- Si un paso requiere más de 30–50 líneas de código, divídelo.
- El último paso del plan **no** es "probar todo": eso son los criterios de aceptación.

---

## Sección 5 — Criterios de aceptación

Checklist booleano. Cada ítem se puede verificar con sí o no.

```markdown
## Criterios de aceptación

- [ ] La página carga sin errores en la consola.
- [ ] Marcar una tarea como hecha la mueve a la sección "Completadas".
- [ ] Recargar la página conserva las tareas.
```

**Antipatrones a evitar:**

- ❌ "Que funcione bien." → no verificable.
- ❌ "Buena UX." → subjetivo.
- ❌ "Sin bugs." → no operacional.
- ✅ "Presionar Esc cierra el diálogo y devuelve el foco al botón que lo abrió." → verificable, booleano.

---

## Sección 6 — Decisiones tomadas y descartadas

La sección que más valor tiene dentro de 3 meses. Captura **lo que consideraste**, no solo lo que elegiste.

```markdown
## Decisiones

- **Sí:** almacenamiento local del navegador para persistencia. Los datos son pocos y no necesitamos consultas.
- **No:** base de datos en servidor. Sobreingeniería para este caso.
- **Sí:** clave versionada (`save:v1`). Permite migrar el esquema después sin romper nada.
- **No:** sincronización en la nube. Va en otro spec si algún día llega.
```

Cada decisión idealmente lleva una razón breve. Las decisiones sin razón son las primeras en cuestionarse después.

---

## Sección 7 — Riesgos identificados (opcional)

Solo cuando hay riesgos no obvios. Tabla simple:

```markdown
## Riesgos

| Riesgo                                     | Mitigación                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| Almacenamiento local deshabilitado         | Fallback a un objeto en memoria. La app corre, solo que no persiste.            |
| Esquema futuro incompatible                | La clave incluye `:v1`. Migración documentada en `src/storage.js`.              |
```

Para specs pequeños o features muy acotadas, omítela.

---

## Sección final — Lo que NO entra (refuerzo)

Repite explícitamente al final lo que **no** se hará en este spec. La repetición es deliberada: la sección Alcance ya lo dice, pero al final del documento sirve de recordatorio para quien lea solo las últimas líneas.

```markdown
## Lo que **no** está en este spec

- Editor visual (otro spec si algún día llega).
- Colaboración en tiempo real.
- Versión móvil.

Cada uno de esos, si llega, va en su propio spec.
```

---

## Reglas globales del documento

- **Una frase por idea.** Si una oración tiene dos comas y un punto y coma, divídela.
- **Nombres concretos.** Si dices "el módulo de almacenamiento", escribe `src/storage.js`. Si dices "una clave", da la cadena exacta.
- **Sin TODOs.** Un TODO en un spec significa que la decisión no se tomó. Tómala o anótala como decisión pendiente con su motivo.
- **Sin código largo ejecutable.** El spec describe; el código se escribe después. Fragmentos cortos para ilustrar estructuras de datos están bien; funciones completas no.
- **Markdown estándar.** Sin extensiones raras. Debe renderizar en GitHub sin sorpresas.
