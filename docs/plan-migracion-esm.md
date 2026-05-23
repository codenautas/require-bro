# Plan de migración a ESM + TypeScript 6

## Contexto

Modernización del ecosistema Node.js/TypeScript propio:

- **Stack actual:** Node 22 en producción, TypeScript 5.x, librerías publicadas como UMD para servir tanto a Node (vía `require`) como al browser (vía `require-bro`, loader propio que implementa `define()` y `require()` AMD/UMD-style).
- **Universo:** 23 librerías propias, frontends de varios sistemas basados en `backend-plus`, todos consumiendo el mismo ecosistema.
- **Objetivo:** pasar todo a ESM puro, aprovechando que TS 6 ya empuja en esa dirección (deja `moduleResolution: node` deprecado, default `module: esnext`, etc.).

## Principios rectores

1. **Migración incremental que entregue valor en cada paso.** No "todo o nada". Cada librería migrada se publica, se valida en producción real, y recién después se toca la siguiente.
2. **Versionado mayor marca la frontera. Todas las librerías saltan a 3.x ESM-only**, sin importar desde qué versión vienen (algunas desde 0.x, otras desde 1.x, otras desde 2.x). Esto da un número único y claro de "la línea moderna ESM" en todo el ecosistema. Las líneas anteriores se mantienen en mantenimiento. Los sistemas cliente migran a su ritmo.
3. **Tests como red de seguridad.** Empezar por lo que tiene cobertura alta; donde la cobertura sea baja, agregarla *antes* de migrar.
4. **Preservar la filosofía del frontend:** sin bundler, módulos servidos como archivos, control explícito del grafo. Se reemplaza `require-bro` por ESM nativo del browser + import maps, pero solo cuando llegue el momento — durante la transición `require-bro` se vuelve la pieza estratégica que orquesta la coexistencia.
5. **Forward compatibility en el código de aplicación.** Cuando se introduce una nueva API, debe poder usarse desde el código UMD/CJS actual y seguir funcionando idéntica en ESM puro, sin retrabajo.

## Decisiones tomadas

### Sobre las versiones

- Las librerías propias migran a **versión 3.x ESM-only**, sin importar desde qué versión vienen. Esto unifica la nomenclatura: "todo lo 3.x es ESM moderno". Las líneas anteriores (0.x, 1.x, 2.x según corresponda) quedan en mantenimiento.
- `backend-plus` arranca como `3.0.0-rc.1` y se mantiene en rama paralela hasta estabilizar.
- **`require-bro` también migra a 3.x**: se publica `require-bro@3` como pieza de transición. Eventualmente se jubila cuando `backend-plus@2.x` (la línea anterior) deje de mantenerse.

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

- Un sistema basado en `backend-plus@2.x` (CJS) **puede consumir** una librería 3.x (ESM puro) en su código de backend, vía `require('lib')`, **sincrónicamente y sin cambios**.
- Limitación: el módulo ESM **no puede tener top-level await** (ni transitivamente). Para librerías utilitarias puras esto no es restricción.
- **Las librerías 3.x se pueden ir publicando independientemente, sin esperar a `backend-plus@3`.**

### Frontend (browser)

No hay equivalente a `require(esm)` en el browser. La estrategia tiene dos etapas:

**Etapa 1 (piloto, una sola librería):** shim manual de tres líneas en el HTML del sistema cliente:

```html
<script type="module">
  import * as BestGlobals from '/node_modules/best-globals/dist/index.js';
  window.requireBro.definedModules['best-globals'] = BestGlobals;
</script>
```

Funciona porque `require-bro` ya tiene un registro `definedModules` que se puede poblar manualmente. El código legacy hace `require('best-globals')` y lo encuentra ahí. Sirve para validar el flujo ESM-en-browser-vía-`require-bro` sin tocar `require-bro`.

**Etapa 2 (`require-bro@3`, cuando haya 2-3 librerías migradas):** `require-bro` se actualiza para orquestar la carga mixta UMD+ESM en una fase de bootstrap previa al resto del frontend. Ver sección siguiente.

## `require-bro@3`: diseño

### Modelo

`require-bro@3` mantiene la API actual (`define()`, `require()`, `definedModules`) y agrega una **fase de bootstrap asincrónica** que precarga ESM antes de que se ejecute cualquier código UMD legacy.

```html
<script src='require-bro.js'></script>
<script type="module">
  await window.requireBro.bootstrap({
    modules: [
      '/lib/best-globals/dist/index.js',   // ESM
      '/lib/cast-error/dist/index.js',     // ESM
      '/lib/backend-skins.js',              // UMD
      '/lib/backend-plus-client.js',       // UMD
      '/app/siper-main.js',                 // UMD del sistema
    ]
  });
</script>
```

### Lo que hace `bootstrap()` internamente

1. Para cada módulo en la lista, detecta el formato (UMD o ESM) — esto se puede hacer leyendo las primeras líneas del archivo en el deploy y marcándolo, o con detección runtime simple.
2. Para los ESM: `await import(url)`, asigna `definedModules[name] = mod`.
3. Para los UMD: inserta `<script>` y espera su `onload`, lo cual dispara su `define()` interno que ya popula `definedModules`.
4. Cuando todo está cargado, dispara los handlers de `whenAllReady` (ver abajo).

### El problema del evento `load` y `whenAllReady`

**Problema:** los handlers de aplicación hoy se registran con `window.addEventListener('load', ...)`. No son idempotentes. El bootstrap asincrónico de `require-bro@3` hace que `load` se dispare antes de que termine la carga real — y un handler registrado dinámicamente después de `load` nunca se ejecuta (el DOM no provee "ejecutar este handler aunque load ya pasó").

**Insight de fondo:** este patrón (`addEventListener('load', initFn)` para "todo está listo") **no tiene sentido en ESM puro tampoco**. ESM resuelve el orden vía el grafo de imports y top-level code; `load` solo aplica a recursos (imágenes, iframes), no a "mi JS terminó de inicializarse". Por lo tanto, **migrar a otro mecanismo no es deuda de la transición, es alineación con el modelo destino**.

**Solución: `whenAllReady`, con paquete propio `when-all-ready`** (nombre ya registrado en npm). Durante la transición se re-exporta desde `require-bro@3`. Cuando `require-bro` se jubile, el paquete `when-all-ready` queda como ubicación canónica de la función — el código de aplicación que ya importa de ahí no necesita cambios.

```javascript
// En código de aplicación, hoy (UMD/CJS):
var {whenAllReady} = require('require-bro');
whenAllReady(myInitFunc);

// Mañana (ESM, todavía con require-bro):
import {whenAllReady} from 'require-bro';
whenAllReady(myInitFunc);

// Post-jubilación de require-bro:
import {whenAllReady} from 'when-all-ready';
whenAllReady(myInitFunc);
```

Mismo código de aplicación, solo cambia la sintaxis del import y eventualmente el specifier.

### Por qué el nombre `whenAllReady` y no `whenReady` u `onReady`

- `whenReady` es ambiguo: ¿ready qué? ¿el DOM, este módulo, una dependencia, la app?
- `whenAllReady` es preciso: cuando *todo* el bootstrap está terminado.
- Deja namespace libre para futuros `whenModuleReady(name, fn)`, `whenDomReady(fn)`, etc., sin colisión.

### Implementación de `whenAllReady`

La implementación canónica vive en el paquete `when-all-ready`. `require-bro@3` la re-exporta para conveniencia de los consumers que ya importan de `require-bro`:

```javascript
// when-all-ready (paquete propio)
var readyHandlers = [];
var isReady = false;

export function whenAllReady(fn) {
  if (isReady) {
    Promise.resolve().then(fn); // microtask, no sincrónico
  } else {
    readyHandlers.push(fn);
  }
}

export function _markAllReady() {
  isReady = true;
  var handlers = readyHandlers;
  readyHandlers = [];
  handlers.forEach(h => h());
}
```

`require-bro@3` llama a `_markAllReady()` al final de `bootstrap()`. Cuando `require-bro` se jubile, otro orquestador (o el propio código de la app en ESM puro) llamará a `_markAllReady()` cuando corresponda.

### Compatibilidad con `require-bro@2.x`

Para que el código de aplicación pueda **empezar a usar `whenAllReady` antes de que salga `require-bro@3`**, se publica un patch `require-bro@2.x+1` que re-exporta `whenAllReady` desde el paquete `when-all-ready`. La implementación de `when-all-ready` en esta etapa puede usar `load` internamente como fallback:

```javascript
// when-all-ready v1.x (etapa de transición)
export function whenAllReady(fn) {
  if (document.readyState === 'complete') {
    Promise.resolve().then(fn);
  } else {
    window.addEventListener('load', fn);
  }
}
```

```javascript
// require-bro@2.x+1 re-exporta
window.requireBro.whenAllReady = require('when-all-ready').whenAllReady;
```

Esto permite que los sistemas cliente migren sus handlers de `load` a `whenAllReady` progresivamente, **una regla por PR**: si tocás un handler de `load`, cambialo a `whenAllReady`. Cuando llegue `require-bro@3`, la implementación de `when-all-ready` se actualiza para usar el bootstrap (sin depender de `load`) y el código de aplicación no se entera.

### Después de `require-bro@3`: jubilación

Cuando `backend-plus@2.x` (la línea anterior) deje de mantenerse, `require-bro` se jubila. **El código de aplicación que importa `whenAllReady` desde `require-bro` migra a importarlo desde `when-all-ready` directamente** — mismo nombre, misma semántica, solo cambia el specifier. `when-all-ready` queda como paquete independiente, manteniéndose vivo más allá de `require-bro`.

## Orden de migración

### Fase 0 — Preparación (sin tocar librerías todavía)

- [ ] Publicar `when-all-ready@1.x` con la implementación inicial (fallback a `load`).
- [ ] Publicar `require-bro@2.x+1` con `whenAllReady` re-exportado desde `when-all-ready`.
- [ ] Documentar `whenAllReady` como nuevo estándar para "código que corre cuando todo está listo".
- [ ] Empezar a migrar handlers de `load` en sistemas cliente a `whenAllReady`. Regla incremental, una por PR. **No bloquea otras fases.**

### Fase 1 — Piloto (1 librería)

**Candidata: `best-globals`.** Cobertura 95%+, exporta objeto plano de funciones (shape ideal para named exports), usada por muchos sistemas.

Entregables:
- `best-globals@3.0.0-rc.1` publicada (ESM-only, TS 6).
- Patrón documentado de cómo se hace una migración.
- Shim manual de 3 líneas funcionando en al menos un sistema cliente.

### Fase 2 — Utilitarias puras (hojas del grafo)

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

Una librería por release. Mientras va saliendo esta fase, en el HTML de los sistemas cliente se acumulan los shims manuales de 3 líneas (uno por librería migrada).

### Fase 3 — `require-bro@3`

Cuando ya hay 2-3 librerías migradas y el patrón se repite, se justifica subir a `require-bro@3`:

- Implementa `bootstrap()` con carga mixta UMD+ESM.
- Actualiza la implementación de `when-all-ready` para usar el bootstrap (sin depender de `load`).
- Los shims manuales del HTML se reemplazan por una lista en la configuración de `bootstrap()`.

### Fase 4 — Backend con peso (sin frontend todavía)

Dependen de algunas de la Fase 2, así que requieren Fase 2 publicada primero:

- `pg-promise-strict`
- `pg-triggers`
- `mini-tools`
- `serve-content`
- `type-store`
- `login-plus` (cuidado especial: tiene la integración Azure AD ya configurada)

### Fase 5 — Frontend (cambio conceptual más fuerte)

- `ajax-best-promise`
- `js-to-html`
- `dialog-promise`
- `backend-skins`
- `typed-controls` ⚠️

**Punto crítico: `typed-controls` no tiene cobertura controlada.** Antes de migrarla, dedicar tiempo a llevarla a cobertura razonable (70%+).

### Fase 6 — `backend-plus@3.0.0-rc`

Integra todas las anteriores. Ya no depende de `require-bro` (o lo usa solo opcionalmente para sistemas en transición). El generador de frontend emite ESM + import map en lugar de UMD + `require()`.

### Fase 7 — Sistemas cliente

`siper` y los demás migran a `backend-plus@3` cuando puedan. Los que no migran se quedan en `backend-plus@2.x` con `require-bro@3`, que sigue manteniéndose para fixes críticos.

### Fase 8 — Jubilación de `require-bro`

Cuando `backend-plus@2.x` deje de tener consumers activos, `require-bro` se archiva. Los consumers que importaban `whenAllReady` desde `require-bro` pasan a importarlo desde `when-all-ready` directamente.

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
- [ ] Validar en al menos un sistema cliente real (backend: directo; frontend: vía shim manual durante Fases 1-2, vía `bootstrap()` después)
- [ ] Promover a `X.0.0` cuando esté estable

## Decisiones pendientes

- **Ventana de soporte de las líneas anteriores (0.x, 1.x, 2.x según corresponda):** ¿se define un horizonte temporal (ej. 1 año de fixes críticos) o se mantienen indefinidamente mientras haya consumidores activos?
- **Grafo exacto de dependencias entre librerías propias:** revisar `package.json` de cada una para confirmar el orden topológico de la Fase 2 y Fase 4.
- **Sistema piloto para frontend ESM** (cuando llegue Fase 5/6): conviene que no sea `siper` directamente, sino algo más chico para validar el cambio de loader antes de tocar el sistema principal.
- **Detección automática UMD vs ESM en `bootstrap()`:** en `backend-plus` se puede recorrer la lista de archivos JS en deploy y marcar el tipo. Empezar simple (dos listas explícitas en el piloto), agregar detección automática cuando se justifique.
