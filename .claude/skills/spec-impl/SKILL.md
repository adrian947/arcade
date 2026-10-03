---
name: spec-impl
description: Implementa un spec aprobado. Valida que el estado signifique "Aprobado" (en cualquier idioma), crea una rama git con el nombre del spec, cambia a ella e implementa TODOS los pasos del plan de corrido, sin pausas intermedias.
disable-model-invocation: true
argument-hint: <NN-nombre-del-spec>
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl — Implementador de specs aprobados

## Contexto de la sesión

Estado actual del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles en esta carpeta:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

Configuración de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (por defecto, sin archivo de configuración)"`

---

## Instrucciones

Sigue estas cuatro fases en orden estricto. **No avances a la siguiente fase si la anterior no se completó correctamente.**

---

### Fase 1 — Identificar el spec

El argumento recibido es: `$ARGUMENTS`

Si `$ARGUMENTS` está vacío:

- Lista los archivos disponibles en `specs/` (ya los tienes arriba).
- Pide al usuario el nombre exacto del spec.
- Detente y espera respuesta. No continúes.

Si `$ARGUMENTS` tiene un valor:

- Busca el archivo en `specs/`. El usuario pudo escribir el nombre completo (`01-autenticacion`), solo el número (`01`) o solo el slug (`autenticacion`). Intenta encontrar el archivo correcto en cualquiera de esos casos.
- Si no encuentras el archivo, muestra los specs disponibles y pide al usuario que corrija el nombre.
- Si lo encuentras, continúa a la Fase 2.

---

### Fase 2 — Validar el estado del spec

Lee el archivo del spec que ubicaste en la Fase 1 con la herramienta Read o `cat`.

En el contenido, busca la línea que contiene el estado del spec. La etiqueta del encabezado suele ser `**Status:**` (inglés) o `**Estado:**` (español), pero puede estar en cualquier idioma. Reconócela por posición (línea de estado cerca del inicio del spec) y por la máquina de estados que la rodea, no por la etiqueta exacta.

**Regla absoluta:** solo puedes continuar si el estado **significa "Aprobado"**, sin importar el idioma.

Trata como estado **Aprobado** cualquiera de los siguientes (y sus equivalentes en otros idiomas) y continúa:

- Inglés: `Approved`
- Español: `Aprobado`
- Portugués: `Aprovado`
- Francés: `Approuvé`
- Alemán: `Genehmigt`
- Italiano: `Approvato`
- …o cualquier palabra de otro idioma que claramente signifique "aprobado"

Cualquier otra cosa (Draft / Borrador, In review / En revisión, Implemented / Implementado, Obsolete / Obsoleto, o cualquier valor no reconocido) significa **detenerte** y mostrar el mensaje de error de abajo.

| Categoría de estado                       | Ejemplos (cualquier idioma)                       | Acción                                                                     |
| ----------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| Aprobado                                  | `Approved`, `Aprobado`, `Aprovado`, `Approuvé`, … | Continuar a la Fase 3.                                                     |
| Borrador                                  | `Draft`, `Borrador`, …                            | Detenerte. Mostrar el mensaje de error de abajo.                           |
| En revisión                               | `In review`, `En revisión`, …                     | Detenerte. Mostrar el mensaje de error de abajo.                           |
| Implementado                              | `Implemented`, `Implementado`, …                  | Detenerte. Mostrar el mensaje de error de abajo.                           |
| Obsoleto                                  | `Obsolete`, `Obsoleto`, …                         | Detenerte. Mostrar el mensaje de error de abajo.                           |
| Línea de estado no encontrada / valor no reconocido | —                                       | Detenerte. El archivo no sigue el formato esperado. Díselo al usuario.     |

Si no estás seguro de que un valor signifique "aprobado", **no lo asumas**. Detente y pide al usuario que lo aclare o que actualice el spec a la redacción canónica.

**Mensaje de error estándar cuando el estado no significa Aprobado:**

```
❌ No puedo implementar este spec.

Estado actual: [ESTADO ENCONTRADO]
Solo trabajo con specs cuyo estado significa "Aprobado" (ej. `Approved`, `Aprobado`,
o el equivalente en otro idioma).

Para continuar tienes dos opciones:
  1. Si el spec está listo para implementarse, ábrelo y cambia el estado
     a "Aprobado" (o el término equivalente que use tu equipo) manualmente.
     Ese cambio lo hace el humano, no el agente.
  2. Si el spec todavía necesita trabajo, usa /spec [nombre] para retomarlo.
```

No ofrezcas alternativas, no sugieras "puedo empezar igual si quieres". El bloqueo es intencional.

---

### Fase 3 — Crear la rama git y cambiar a ella

Una vez confirmado que el estado significa `Aprobado`:

0. **Revisa primero el árbol de trabajo.** Mira la salida de `git status --short` del contexto de la sesión. **Ignora el archivo del spec que vas a implementar** (`specs/NN-slug.md`, sea nuevo `??` o modificado `M`): se creó o aprobó en la rama actual y viaja a la nueva rama, donde será parte de su primer commit. Nunca preguntes por ese archivo. Si, descartado ese archivo, **el resto no está vacío**, detente, muestra los cambios pendientes (sin incluir el spec) y pregunta:

   ```
   ⚠️ Hay cambios sin commitear en el árbol de trabajo.
   Cambiar de rama los arrastraría. ¿Qué quieres hacer?
     1. Commitéalos o guárdalos con stash tú mismo y vuelve a ejecutar este comando  (recomendado)
     2. Continuar igual: los cambios viajan a la nueva rama
   ```

   Espera la respuesta. **No hagas stash ni commit por el usuario** salvo que lo pida explícitamente. Si el árbol de trabajo está limpio (o solo contiene el archivo del spec), pasa directo al paso 1 sin mencionarlo.

1. Deriva el nombre de la rama del nombre completo del archivo del spec, sin la extensión. Formato: `spec-NN-slug`. Ejemplos:

   - `01-autenticacion.md` → rama `spec-01-autenticacion`
   - `02-notificaciones.md` → rama `spec-02-notificaciones`

2. Lee el flag `AutoCreateBranch` de la **Configuración de creación de rama** del contexto de la sesión.

   - Si el archivo de configuración no existe, falta el valor o no se reconoce → trátalo como `true` (el valor por defecto).
   - Solo un `false` explícito (con cualquier capitalización) desactiva la creación automática de la rama.

   **Si `AutoCreateBranch` es `true` (por defecto):** procede sin preguntar.

   - Si la rama **no existe**: créala con `git checkout -b spec-NN-slug`.
   - Si **ya existe**: significa que se retoma trabajo previo. Cambia a ella, lee `git log --oneline` de la rama y dile al usuario qué pasos del plan parecen ya hechos y desde cuál propones retomar. Espera confirmación del punto de retoma antes de implementar nada.
   - En ambos casos: cambia a la rama con `git checkout spec-NN-slug` y confirma que el cambio fue exitoso antes de continuar.

   **Si `AutoCreateBranch` es `false`:** pregunta antes de tocar git. Muestra:

   ```
   AutoCreateBranch está en false.
   ¿Crear y cambiar a la rama spec-NN-slug? [y/N]
   ```

   - Si el usuario responde **sí**: crea/cambia a la rama exactamente como en el caso `true`.
   - Si el usuario responde **no** o lo deja vacío: **no crees ninguna rama.** Dile que implementarás en la rama actual (la que aparece en el contexto de la sesión) y pide confirmación explícita para continuar ahí. No improvises: espera la respuesta.

3. Confirma visualmente al usuario que el spec está listo y qué rama está activa:

   ```
   ✅ Listo para implementar.

   Spec:   specs/NN-slug.md
   Rama:   spec-NN-slug  (activa)   (← o la rama actual, si no se creó una nueva)
   Estado: Aprobado   (← repite el valor real encontrado en el spec)
   ```

4. Muestra un **resumen breve** del spec (objetivo y plan de implementación, una línea por paso) como contexto y **continúa de inmediato con la Fase 4**, sin esperar respuesta.

---

### Fase 4 — Implementar todo el plan de corrido

**Implementa TODOS los pasos del plan de implementación en una sola ejecución, en orden, sin pausas ni confirmaciones intermedias.** No preguntes "¿empezamos con el Paso 1?" ni "¿sigo con el Paso N+1?". Si el usuario invocó `/spec-impl`, ya autorizó implementar el spec completo.

Reglas durante toda la implementación:

**Nunca hagas commit automáticamente.** Ni por paso ni al final. Escribes el código; el commit es decisión y comando del usuario. Solo haz commit si lo pide explícitamente.

**Una regla por encima de todas:** implementa lo que dice el spec. Si algo del spec te parece subóptimo, menciónalo como observación al final, pero implementa lo acordado. Los cambios al spec van en el spec, no en el código por sorpresa.

**Ritmo de trabajo:**

- Implementa los pasos del plan uno tras otro, respetando su orden.
- Tras cada paso, haz una verificación rápida (lint, typecheck, build o tests, según lo que el proyecto tenga configurado; descúbrelo en `package.json`, `Makefile`, el archivo de memoria del proyecto, etc.) y corrige lo que falle antes de seguir. Esto no es una pausa: es parte del paso.
- Si el spec pide verificar con alguna herramienta (por ejemplo un navegador automatizado o un script de prueba), hazlo como parte de la ejecución y corrige lo que encuentres dentro del alcance del spec.

**Cuándo SÍ detenerte (únicas excepciones a "sin pausas"):**

- **Ambigüedad real** que el spec no resuelve: describe la ambigüedad exacta, presenta dos o tres opciones concretas y espera la decisión del usuario. No improvises.
- **Bloqueo técnico** que no puedes resolver dentro del alcance del spec (dependencia faltante, error irresoluble). Explica qué intentaste y qué necesitas.

**Si el usuario pide algo fuera del alcance del spec:**

- Recuérdale que está fuera del alcance de este spec.
- Sugiere anotarlo para el siguiente spec.
- No lo implementes en esta rama.

**Si necesitas un cambio fuera del plan para cumplir un criterio de aceptación** (ej. un ajuste de CSS que el spec no previó): hazlo solo si es mínimo e imprescindible, y decláralo explícitamente en el resumen final como "fuera del plan".

**Al terminar el último paso**, entrega un resumen final con: archivos creados/modificados, resultado de las verificaciones, observaciones o cambios fuera del plan, y este cierre:

```
✅ Todos los pasos del plan están implementados.

Siguiente paso: verifica uno por uno los criterios de aceptación del spec.
Si todos pasan, actualiza el estado del spec a "Implementado" (o el equivalente
en el idioma de tu repo) y haz el commit final antes de mergear esta rama.
```

---

## Resumen del comportamiento esperado

```
/spec-impl 01-autenticacion

  Fase 1  →  Encuentra specs/01-autenticacion.md
  Fase 2  →  Lee el estado → "Approved" (o "Aprobado", etc.) → ✅ continúa
  Fase 3  →  git checkout -b spec-01-autenticacion
             Muestra resumen de objetivo y plan
  Fase 4  →  Implementa TODOS los pasos de corrido, verificando cada uno
             Termina con resumen y recordatorio de verificar criterios

/spec-impl 02-notificaciones  (estado: Draft / Borrador)

  Fase 1  →  Encuentra specs/02-notificaciones.md
  Fase 2  →  Lee el estado → "Draft" → ❌ se detiene
             Muestra el mensaje de error estándar
             No crea rama, no toca código
```

**La creación de la rama la controla el flag `AutoCreateBranch`** de `specs/.spec-config.yml`. Por defecto vale `true` (crea la rama automáticamente, como se muestra arriba). Ponlo en `false` para que la Fase 3 pregunte `[y/N]` antes de crearla.
