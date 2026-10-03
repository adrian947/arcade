---
name: spec
description: Diseña y desarrolla specs siguiendo el método spec-driven. Hace preguntas de clarificación antes de proponer estructura y arma el spec sección por sección. Úsalo al empezar una feature grande, antes de escribir código.
disable-model-invocation: true
argument-hint: 'descripción corta de la feature o requerimiento'
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*)
---

# /spec — Diseñador guiado de specs

## Contexto de la sesión

Fecha de hoy (úsala en el encabezado del spec, nunca la adivines):
!`date +%F`

Specs que ya existen:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ todavía no existe"`

---

Esta skill te ayuda a producir un spec útil siguiendo el método spec-driven. **Aquí no se escribe código.** Tu trabajo es ayudar al usuario a clarificar qué quiere construir, preguntar cuando algo no esté lo bastante definido y desarrollar el spec sección por sección hasta que esté listo para guardarse en `specs/`.

## Filosofía

Un spec no es documentación decorativa. Es el contrato que guía la ejecución posterior. Si el spec es vago, el código improvisa. Por eso este flujo es **deliberadamente lento en la fase de definición** y **rápido en la fase de escritura**.

Lee `template.md` (en la misma carpeta que esta skill) para ver la estructura completa que seguirá el spec. Apóyate en él en cada paso.

## Flujo del comando

- Sigue las cuatro fases en orden. **Nunca te saltes la Fase 2**: las preguntas son el punto central. Si el usuario quiere ir más rápido, recuérdale que el costo de un mal spec se paga después en código. (La Fase 3 tiene un camino rápido cuando la Fase 2 está realmente completa; ver abajo.)
- Tus respuestas deben estar en el mismo idioma que el prompt inicial. Ej.: si el prompt inicial está en español, responde en español; si está en inglés, en inglés.

### Fase 1 — Entender el contexto

Antes de preguntar sobre la feature, asegúrate de tener contexto del proyecto:

1. Lee el archivo de memoria del proyecto, si existe. Prueba en orden y detente en el primero que encuentres: `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `README.md`. Así la skill se adapta al agente que la ejecute (Claude Code, Codex, Gemini CLI, etc.).
2. Mira el listado de `specs/` del contexto de la sesión para ver qué specs existen y cómo están numerados.
3. Si hay specs previos, lee al menos los dos más recientes para tomar las convenciones del proyecto, incluido el **idioma** en que están escritos y las palabras exactas que usan para estados y títulos de sección. Un spec nuevo debe calzar con los existentes.

Si el argumento `$ARGUMENTS` llega vacío, pide al usuario una descripción inicial de **una sola frase** de lo que quiere construir. Si la descripción no cabe en una frase, es la primera señal de que la feature es demasiado grande: sugiere dividirla antes de continuar.

### Fase 2 — Clarificar con preguntas

Esta es la fase más importante del comando. Tu trabajo aquí es **detectar ambigüedades y preguntar**, no asumir.

Haz las preguntas en bloques de 3 a 5 a la vez (no una pregunta suelta tras otra, es agotador). Después de cada bloque, espera la respuesta antes de seguir.

**Categorías de preguntas que siempre debes considerar:**

- **Alcance:** ¿Qué entra y qué NO? ¿Qué partes de la feature se difieren a otro spec?
- **Datos:** ¿Qué estructuras nuevas se introducen? ¿Cómo se llaman? ¿Dónde viven?
- **Integración:** ¿Depende de specs anteriores? ¿Modifica algo existente o solo agrega?
- **Persistencia:** ¿Se guarda algo entre sesiones? ¿Dónde? ¿Con qué versionado?
- **UX y estados:** ¿Cómo se ve cuando funciona? ¿Cómo se ve cuando falla? ¿Hay estados intermedios?
- **Riesgos:** ¿Qué puede romperlo? ¿Qué pasa en el caso degradado?
- **Decisiones cerradas:** ¿Hay alguna decisión que el usuario ya tomó y no quiere reabrir?

**Cómo formular las preguntas:**

- Usa preguntas concretas, no abiertas. ❌ "¿Cómo imaginas la persistencia?" → ✅ "¿La persistencia es una base de datos, almacenamiento del navegador o un archivo JSON en disco?"
- Cuando ofrezcas opciones, da 2–4, marca cuál recomiendas y por qué.
- Si tu agente expone una herramienta nativa de preguntas de opción múltiple (en Claude Code: `AskUserQuestion`), úsala para estos bloques en vez de escribir las opciones como prosa: el usuario elige en lugar de teclear. Pon tu recomendación primero y márcala. Si no existe esa herramienta, usa una lista markdown numerada.
- Si detectas una respuesta que abriría la caja de Pandora (ej. "y también queremos notificaciones en tiempo real"), señala que merece su propio spec y pregunta si lo dejamos fuera del alcance de este.

**Cuándo dejar de preguntar:**

Detente cuando puedas responder estas tres preguntas sin asumir nada:

1. ¿Qué archivos van a aparecer o cambiar?
2. ¿Cuál es el primer paso ejecutable y cuál es el último?
3. ¿Cómo verifico que la feature está terminada?

Si todavía no puedes responder alguna, sigue preguntando.

### Fase 3 — Escribir el spec

Una vez cerrada la Fase 2, decide cómo escribirlo:

**Si ya tienes toda la información necesaria**, es decir, puedes responder las tres preguntas de la Fase 2 (qué archivos cambian, cuál es el primer y el último paso ejecutable, cómo se verifica que está terminado) **sin asumir nada**, entonces **no vayas sección por sección**. Escribe el spec completo y salta directo a la Fase 4 para guardar el archivo. No pidas confirmación sección por sección y no muestres un borrador para aprobación: el usuario ya respondió todo en la Fase 2 y volver a preguntar es fricción. El usuario revisa el archivo guardado y pide cambios si hace falta.

**Solo si falta información** (el usuario cortó la Fase 2, una respuesta fue vaga o alguna sección no se puede escribir sin inventar algo), desarrolla las secciones **una por una**, mostrando cada una y esperando confirmación antes de pasar a la siguiente.

En ambos casos el contenido sigue el mismo orden:

1. **Encabezado** (estado, dependencias, fecha, objetivo en una frase). El objetivo en una frase es crítico: si no cabe en una frase, vuelve a la Fase 2.
2. **Alcance** (qué entra y qué NO). El "no entra" debe ser explícito.
3. **Modelo de datos** (estructuras concretas con nombres reales). Si la feature no introduce datos nuevos, omite esta sección y dilo explícitamente.
4. **Plan de implementación** (pasos numerados, cada uno deja el sistema funcional).
5. **Criterios de aceptación** (checklist booleano, nada aspiracional).
6. **Decisiones tomadas y descartadas** (con justificación breve).
7. **Riesgos identificados** (solo si aplica; si no hay riesgos relevantes, omítela).

**Después de cada sección (solo en el modo sección por sección):**

- Muéstrala formateada en markdown.
- Pregunta: "¿Esta sección queda así o quieres ajustarla?"
- Si el usuario pide cambios, aplícalos y muéstrala de nuevo.
- Pasa a la siguiente solo cuando el usuario confirme.

**Errores comunes a evitar:**

- Generar criterios de aceptación no verificables ("que funcione bien").
- Meter en el plan de implementación cosas que no están en el alcance.
- Asumir nombres de archivos o estructuras que el usuario no confirmó.
- Saltarse la sección de decisiones: es la que más valor tiene a largo plazo.

### Fase 4 — Guardar el spec

Cuando el contenido esté listo (porque tenías todo, o porque todas las secciones fueron confirmadas):

1. Determina el siguiente número secuencial a partir del listado de `specs/` del contexto de la sesión. Toma el número más alto existente y suma uno, con relleno de ceros a dos dígitos. Si el último es `02-autenticacion.md`, este será `03-`. Si `specs/` está vacío o no existe, empieza en `01-`.
2. Genera un slug corto en kebab-case a partir del objetivo (ej. `exportar-reportes`). Ver **Argumentos** más abajo para cuando `$ARGUMENTS` es el slug.
3. Usa la fecha del contexto de la sesión para el campo `**Date:**`. **Nunca escribas una fecha que no hayas leído de ahí.**
4. Escribe el archivo directamente en `specs/NN-slug.md` con todas las secciones. **No pidas permiso para escribirlo ni preguntes si el nombre del archivo sirve**: anuncia la ruta en la confirmación final. Solo pregunta si el archivo destino ya existe.
5. Marca el estado como `Draft` por defecto (o la palabra equivalente que usen los specs existentes del repo). **No lo marques como `Approved` automáticamente**: eso lo hace el usuario cuando lo haya releído.
6. Si el encabezado lista dependencias (`**Depends on:** SPEC 01`), verifica que cada spec referenciado exista en `specs/`. Si alguno no existe, dilo en vez de escribir una referencia colgante.
7. **Crea el archivo de configuración si no existe.** Revisa si existe `specs/.spec-config.yml`. Si **falta**, créalo con el contenido por defecto de abajo. Si **ya existe, no lo toques**: nunca sobrescribas la configuración del usuario.

   ```yaml
   # spec workflow configuration
   #
   # AutoCreateBranch — controla si /spec-impl crea la rama git automáticamente.
   #   true  (default) → /spec-impl crea y cambia a spec-NN-slug sin preguntar
   #   false           → /spec-impl pide confirmación [y/N] antes de crear la rama
   AutoCreateBranch: true
   ```

8. Confirma al usuario:
   - Ruta del archivo creado.
   - Recordatorio: el spec está en estado `Draft`. Cámbialo a `Approved` cuando lo hayas releído.
   - Si acabas de crear `specs/.spec-config.yml`, menciona que existe y que `AutoCreateBranch` vale `true` por defecto (ponlo en `false` para controlar tú la creación de la rama).
   - Siguiente paso: una vez revisado y aprobado, ejecuta `/spec-impl NN-slug` para implementarlo.
   - **Detente aquí.** No propongas implementar el spec, escribir código ni ninguna otra acción más allá de esta confirmación.

## Reglas duras

- **Nunca escribas código durante este comando.** Solo el `.md` del spec al final.
- **Nunca propongas implementar el spec después de guardarlo.** Tu trabajo termina cuando el archivo está escrito. El usuario ejecuta `/spec-impl` cuando esté listo.
- **Nunca asumas decisiones que el usuario no confirmó.** Si falta información, pregunta, en la Fase 2, que es donde van las preguntas.
- **No vuelvas a preguntar en la Fase 3 lo que ya se respondió en la Fase 2.** Si la información está completa, escribe el spec entero y guárdalo. La confirmación sección por sección es el recurso para información incompleta, no el camino por defecto.
- **Si el usuario quiere acelerar y saltarse la Fase 2**, recuérdale: "Las preguntas ahora ahorran horas después. ¿Seguro que quieres saltártelas?". Si insiste, respeta su decisión pero regístralo en la sección de decisiones del spec ("Definición rápida sin clarificación detallada").
- **Si la feature es demasiado grande** (no cabe en una frase, toca más de tres áreas del sistema, requiere decisiones en cuatro o más dominios), propón dividirla en dos o más specs antes de continuar.

## Tono al preguntar

Sé directo y específico. No te disculpes por preguntar. No uses frases como "si no te molesta..." o "¿podrías quizás...?". El usuario invocó esta skill justamente porque quiere que le hagas preguntas. Usa preguntas concretas, una por línea cuando haya varias, y numéralas para que sean fáciles de responder.

Ejemplo de un bloque bien formado:

> Antes de escribir el modelo de datos necesito aclarar tres cosas:
>
> 1. **Persistencia.** ¿Base de datos, almacenamiento del navegador o un archivo JSON en disco? Recomendación: almacenamiento local si los datos son pocos y no necesitan consultas.
> 2. **Versionado del esquema.** ¿Qué pasa cuando cambia el formato? Opciones: (a) prefijo de versión en la clave, (b) ignorar y reconstruir, (c) migrar al cargar.
> 3. **Privacidad.** ¿Los datos son sensibles? Si es así, ¿se cifran? ¿Se borran al cerrar sesión?

## Argumentos

`$ARGUMENTS` es **la descripción de la feature**, no el nombre del archivo. Trátalo como punto de partida de la Fase 1 y deriva el slug del objetivo en la Fase 4.

La única excepción: si `$ARGUMENTS` ya es un único token en kebab-case sin espacios (ej. `/spec exportar-reportes`), es ambiguo entre descripción y slug: úsalo como slug **y** como semilla de la descripción, sin pedir confirmación.

Si invocaron `/spec` sin argumentos, empieza pidiendo la descripción en una frase.
