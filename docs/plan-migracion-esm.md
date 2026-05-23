# Plan de migración a ESM + TypeScript 6

## Contexto

Modernización del ecosistema Node.js/TypeScript propio:

- **Stack actual:** Node 22 en producción, TypeScript 5.x, librerías publicadas como UMD para servir tanto a Node (vía `require`) como al browser (vía `require-bro`, loader CJS-style propio).
- **Universo:** 23 librerías propias, frontends de varios sistemas basados en `backend-plus`, todos consumiendo el mismo ecosistema.
- **Objetivo:** pasar todo a ESM puro, aprovechando que TS 6 ya empuja en esa dirección (deja `moduleResolution: node` deprecado, default `module: esnext`, etc.).

## Principios rectores

1. **Migración incremental que entregue valor en cada paso.** No "todo o nada". Cada librería migrada se publica, se valida en producción real, y recién después se toca la siguiente.
2. **Versionado mayor marca la frontera.** Las librerías 2.x/3.x ESM-only conviven con sus líneas anteriores UMD. Los sistemas cliente migran a su ritmo.
3. **Tests como red de seguridad.** Empezar por lo que tiene cobertura alta; donde la cobertura sea baja, agregarla *antes* de migrar.
4. **Preservar la filosofía del frontend:** sin bundler, módulos servidos como archivos, control explícito del grafo. Se reemplaza `require-bro` por ESM nativo del browser + import maps, no por webpack/vite/etc.

## Decisiones tomadas

### Sobre las versiones

- Las librerías propias migran como **versión mayor ESM-only** (la línea anterior UMD queda en mantenimiento para fixes).
- `backend-plus` arranca como `3.0.0-rc.1` y se mantiene en rama paralela hasta estabilizar.
- `require-bro` no migra: su versión actual se mantiene para sistemas legacy; en `backend-plus@3` directamente no se lista como dependencia.

### Sobre el formato de exports

- Las librerías que hoy exportan **un objeto plano con funciones** (la mayoría) pasan a **named exports**:
  ```typescript
  export function changing(...) { ... }
  export function date(...) { ... }
  ```
- Esto hace que `require('lib')` desde Node 22 (vía `require(esm)`) devuelva el namespace `{ changing, date, ... }`, **mismo shape que antes**. Cero cambios en el consumer CJS legacy.
- Donde no aplique (por ejemplo, librerías que exportan una función "callable" directa), se ajusta el shape como parte del breaking change de versión mayor.

### Sobre TypeScript 6

- Migrar a TS 6 **en el mismo movimiento** que ESM por librería. Cambian juntos.
- `tsconfig.json` base para las librerías 2.x/3.x:
  ```jsonc
  {
    "compilerOptions": {
      "module": "nodenext",
      "moduleResolution": "nodenext",
      "target": "es2024",
      "strict": true,
      "types": ["node"],
      "rootDir": "./src",
      "outDir": "./dist",
      "esModuleInterop": true,
      "verbatimModuleSyntax": true
    }
  }
  ```
- Atender los nuevos defaults de TS 6: `types: []` por default obliga a declarar explícitamente `@types/node`, `@types/mocha`, etc.

## Compatibilidad entre mundos

### Backend (Node 22)

Node 22 estabilizó `require(esm)`. Eso significa:

- Un sistema basado en `backend-plus@1.x` (CJS) **puede consumir** una librería 3.x (ESM puro) en su código de backend, vía `require('lib')`, **sincrónicamente y sin cambios**.
- Limitación: el módulo ESM **no puede tener top-level await** (ni transitivamente). Para librerías utilitarias puras esto no es restricción.
- **Las librerías 3.x se pueden ir publicando independientemente, sin esperar a `backend-plus@3`.**

### Frontend (browser)

No hay equivalente a `require(esm)` en el browser. `require-bro` no puede consumir ESM. Por lo tanto:

- Un sistema legacy frontend que use librerías 3.x en el browser necesita un **shim de coexistencia**.
- Mecanismo del shim: el módulo ESM se carga vía `<script type="module">` o `await import()`, y al terminar de cargar se asigna manualmente al registro de `require-bro`:
  ```javascript
  import * as BestGlobals from 'best-globals';
  window.requireBro.definedModules['best-globals'] = BestGlobals;
  ```
- El resto del código legacy sigue haciendo `require('best-globals')` y lo encuentra ahí.

### Bootstrap asincrónico del frontend legacy

Cargar ESM antes que los scripts UMD legacy requiere un paso asincrónico en el bootstrap. **Estrategia elegida (Opción 1):** durante el piloto, agregar un `<script type="module">` al inicio del HTML que importe los ESM, registre los shims y dispare un evento que arranque el resto:

```html
<script type="module">
  import * as BestGlobals from '/node_modules/best-globals/dist/index.js';
  window.requireBro.definedModules['best-globals'] = BestGlobals;
  window.dispatchEvent(new Event('esm-modules-ready'));
</script>

<script src="require-bro.js"></script>
<script src="app-bundle.js"></script>
<script>
  window.addEventListener('esm-modules-ready', () => startApp());
</script>
```

**Evolución futura (Opción 2):** cuando ya haya 3-4 librerías migradas y el patrón se repita, centralizar la lógica en `require-bro@1.x`: agregarle una API `registerEsmModules({...}).then(start)` que haga los `await import()` y registre todo antes de devolver la promise. Esto se justifica cuando el patrón aparezca varias veces; no antes (sobreingeniería).

**Descartadas:**
- Build dual UMD + ESM: rompe la premisa de "3.x es ESM-only" y duplica mantenimiento.
- `<link rel="modulepreload">` + tuning de carga: overkill para esta etapa.

## Orden de migración

### Fase 0 — Piloto

Una sola librería, para descubrir el flujo completo (cambios en `package.json`, `tsconfig`, `exports`, publicación, consumo desde un sistema legacy vía shim).

**Candidata sugerida: `best-globals`.** Cobertura alta, exporta un objeto plano de funciones (shape ideal para named exports), es usada por muchos sistemas (validación real).

Entregables del piloto:
- `best-globals@3.0.0-rc.1` publicada y andando.
- Patrón documentado de cómo se hace una migración.
- Shim funcionando en al menos un sistema cliente.

### Fase 1 — Utilitarias puras (hojas del grafo)

Cobertura 95%+, sin frontend, sin dependencias entre ellas (a confirmar caso por caso):

- `cast-error`
- `castellano`
- `like-ar`
- `lazy-some`
- `regexplicit`
- `discrepances`
- `self-explain`
- `json4all`
- `sql-tools`

Una librería por release. Se pueden encarar en paralelo si hay ganas, pero cada una con su propio PR/commit/versión.

### Fase 2 — Backend con peso (sin frontend todavía)

Dependen de algunas de la Fase 1, así que requieren Fase 1 publicada primero:

- `pg-promise-strict`
- `pg-triggers`
- `mini-tools`
- `serve-content`
- `type-store`
- `login-plus` (cuidado especial: tiene la integración Azure AD ya configurada)

### Fase 3 — Frontend (cambio conceptual más fuerte)

- `ajax-best-promise`
- `js-to-html`
- `dialog-promise`
- `backend-skins`
- `typed-controls` ⚠️

**Punto crítico: `typed-controls` no tiene cobertura controlada.** Es el cuello de botella de toda la operación. Antes de migrarla, **dedicar tiempo a llevarla a cobertura razonable (70%+)**. Sin red de seguridad, los bugs en browser son muy difíciles de aislar.

### Fase 4 — `backend-plus@3.0.0-rc`

Integra todas las anteriores. Ya no depende de `require-bro`. El generador de frontend emite ESM + import map en lugar de UMD + `require()`.

### Fase 5 — Sistemas cliente

`siper` y los demás sistemas migran a `backend-plus@3` cuando puedan. Los que no migran se quedan en `backend-plus@1.x`, que sigue manteniéndose para fixes críticos.

## Checklist por librería

Para cada librería al migrarla:

- [ ] Confirmar cobertura de tests aceptable; si no, agregarla antes
- [ ] Listar dependencias internas (otras libs propias) y confirmar que ya están en su versión ESM
- [ ] Cambiar `package.json`:
  - [ ] `"type": "module"`
  - [ ] Campo `exports` con el shape correcto
  - [ ] Bump a versión mayor (`X.0.0-rc.1` inicial, luego `X.0.0`)
  - [ ] Revisar `main` / `types` / `files`
- [ ] Migrar `tsconfig.json` a TS 6 + ESM (template arriba)
- [ ] Convertir exports a named exports si hoy es objeto plano
- [ ] Resolver imports relativos con extensión `.js` explícita
- [ ] Reemplazar `__dirname` / `__filename` por equivalentes con `import.meta.url` donde aplique
- [ ] Reemplazar `require()` dinámico por `await import()` donde aplique
- [ ] Correr tests completos
- [ ] Publicar como `X.0.0-rc.1`
- [ ] Validar en al menos un sistema cliente real (backend: directo; frontend: vía shim)
- [ ] Promover a `X.0.0` cuando esté estable

## Decisiones pendientes

- **Ventana de soporte de las líneas 1.x:** ¿se define un horizonte temporal (ej. 1 año de fixes críticos) o se mantienen indefinidamente mientras haya consumidores activos?
- **Grafo exacto de dependencias entre librerías propias:** revisar `package.json` de cada una para confirmar el orden topológico de la Fase 1 y Fase 2.
- **Sistema piloto para frontend ESM** (cuando llegue Fase 3/4): conviene que no sea `siper` directamente, sino algo más chico para validar el cambio de loader antes de tocar el sistema principal.
