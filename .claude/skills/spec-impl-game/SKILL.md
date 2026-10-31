---
name: spec-impl-game
description: Implementa un spec aprobado de juego nuevo con el mismo flujo de /spec-impl (validar estado, rama, implementar todo de corrido) y, al terminar, lanza en secuencia — no en paralelo — el agente skin-designer y luego el agente mobile-porter sobre ese juego.
disable-model-invocation: true
argument-hint: <NN-nombre-del-spec-de-juego>
allowed-tools: Agent, Read, Glob, Grep, Edit, Write, AskUserQuestion, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*), Bash(npm run lint:*), Bash(npm run build:*)
---

# /spec-impl-game — Implementar un juego + skins + mobile

## Contexto de la sesión

Estado actual del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles en esta carpeta:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

Configuración de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (por defecto, sin archivo de configuración)"`

Juegos con motor real (registro):
!`cat games/registry.ts 2>/dev/null || echo "games/registry.ts no existe"`

---

## Instrucciones

El argumento recibido es: `$ARGUMENTS`

Este comando tiene dos etapas en orden estricto. **No empieces la Etapa B si la Etapa A no terminó con todos los pasos implementados.**

---

### Etapa A — Implementación (idéntica a `/spec-impl`)

1. Lee `.claude/skills/spec-impl/SKILL.md` completo. Es la fuente única de verdad del flujo de implementación: no lo copies ni lo reinterpretes aquí.
2. Ejecuta sus **Fases 1 a 4 al pie de la letra**, usando `$ARGUMENTS` como argumento y el contexto de sesión de arriba (mismas validaciones de estado "Aprobado", misma creación de rama `spec-NN-slug` según `AutoCreateBranch`, misma implementación de corrido, mismas reglas: nunca commit, implementar lo que dice el spec, detenerse solo por ambigüedad real o bloqueo técnico).
3. Si `/spec-impl` se detendría (spec no encontrado, estado no aprobado, ambigüedad, bloqueo), **detente igual** y no pases a la Etapa B.
4. Validación extra de este comando: el spec debe ser de **un juego real** (su objetivo/alcance crea un motor en `games/<carpeta>/` y lo monta en `/jugar/<id>`). Si no lo es, detente tras la Fase 2 y sugiere usar `/spec-impl`.
5. Al terminar la Fase 4, entrega el resumen final de `/spec-impl` **sin** el cierre "✅ Todos los pasos del plan están implementados" (ese cierre va al final de la Etapa B) y continúa de inmediato.

Antes de la Etapa B, deja anotados del spec y del código ya escrito:

- `<id>` del juego (el de `lib/data.ts` y `/jugar/<id>`).
- `<carpeta>` del motor (`games/<carpeta>/`).
- Archivo del spec (`specs/NN-slug.md`).

---

### Etapa B — Agentes en secuencia (uno después del otro, nunca en paralelo)

Lanza cada agente con la herramienta `Agent` en un mensaje propio. **No lances el segundo hasta haber recibido el resultado final del primero.** Nunca dos llamadas `Agent` en el mismo mensaje.

#### B1 — `skin-designer`

- `subagent_type: "skin-designer"`
- Prompt (rellena los valores):

  ```
  Modo juego señalado. Agrega los skins que falten (clasico, neon, retro) al juego `<id>` (motor en `games/<carpeta>/`), recién implementado con el spec `specs/NN-slug.md` en la rama actual.
  No hagas commit. Devuelve tu bloque de Salida estándar.
  ```

- Espera su resultado. Si devuelve `⛔ No existe la infraestructura de skins` o reporta que lint/build fallan y no pudo arreglarlo: **detente**, muestra su salida tal cual y pregunta al usuario si lanzar igualmente `mobile-porter`. No continúes sin respuesta.
- Si terminó bien, resume su salida en 2–4 líneas y sigue con B2.

#### B2 — `mobile-porter` (solo después de B1)

- `subagent_type: "mobile-porter"`
- Prompt (rellena los valores; el juego va explícito porque el agente no puede preguntarlo):

  ```
  Modo juego señalado. Porta a mobile el juego `<id>` (motor en `games/<carpeta>/`, spec `specs/NN-slug.md`), recién implementado en la rama actual.
  Un solo juego. No hagas commit. Devuelve tu bloque de Salida estándar.
  ```

- Espera su resultado. Si devuelve `⛔ No existe la infraestructura táctil` o se detiene porque el motor necesita cambios, muestra su salida tal cual; no improvises el port tú.

#### B3 — Verificación final

Tras ambos agentes, corre `npm run lint` y `npm run build`. Si fallan por cambios de los agentes, dilo con la línea de error decisiva; corrige solo si el arreglo es mínimo y dentro de los archivos que ellos tocaron, y decláralo como "fuera del plan".

---

## Resumen final

```markdown
**<TITLE>** (`<id>`) — spec `specs/NN-slug.md` · rama `spec-NN-slug`

- **Implementación:** archivos creados/modificados, verificaciones (de la Etapa A)
- **skin-designer:** resultado resumido (skins, archivos, capturas o qué no verificó)
- **mobile-porter:** resultado resumido (archivo, keyMap) o motivo de parada
- **Lint/build final:** ✅ / ❌ + línea de error
- **Observaciones / fuera del plan:** …
```

Y el cierre:

```
✅ Juego implementado, con skins y port mobile.

Siguiente paso: verifica uno por uno los criterios de aceptación del spec,
prueba cada skin y el gamepad en viewport mobile. Si todo pasa, actualiza
el estado del spec a "Implementado" y haz el commit final antes de mergear.
```

Nunca hagas commit.
