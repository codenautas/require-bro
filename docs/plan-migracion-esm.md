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
- **`require-bro` también migra a 3.x**: se publica `require-bro@3` como pieza de transición (salto desde 0.x). Eventualmente se jubila cuando `backend-plus@2.x` (la línea anterior) deje de mantenerse.

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

`require-bro@3` mantiene la API actual (`define()`, `require()`, `definedModules`) y agrega dos cambios:

1. **`define()` ya no ejecuta la factory inmediatamente.** Mientras todavía haya ESM cargándose, las factories quedan diferidas en una cola interna. Cuando los ESM terminan de cargarse, las factories se ejecutan en orden de registro (el mismo orden en que aparecen los `<script>` UMD en el HTML).
2. **Nueva función `bootstrap(esmModules)`** que carga ESM en paralelo y, al terminar, dispara la ejecución de las factories diferidas.

Los archivos UMD siguen cargándose **estáticamente vía `<script>`** en el HTML, como hoy. No hay carga dinámica de UMD. La única carga dinámica es la de ESM, que se hace con `import()` desde `bootstrap()`.

### Uso desde el HTML

```html
<script src='/lib/require-bro.js'></script>

<!-- UMD legacy, cargados estáticamente como hoy -->
<script src='/lib/backend-skins.js'></script>
<script src='/lib/backend-plus-client.js'></script>
<script src='/app/siper-main.js'></script>

<!-- ESM cargados dinámicamente vía bootstrap -->
<script type="module">
  await window.requireBro.bootstrap([
    {name: 'best-globals', url: '/lib/best-globals/dist/index.js'},
    {name: 'cast-error',   url: '/lib/cast-error/dist/index.js'},
  ]);
  // En este punto, ESM están registrados y todas las factories UMD diferidas se ejecutaron en orden.
</script>
```

### Flujo de ejecución

1. Browser parsea el HTML y ejecuta los `<script>` UMD en orden. Cada uno llama a `define(...)`. Como `bootstrap()` todavía no se ejecutó, `esmLoaded` es `false`, y las factories quedan diferidas en `pendingFactories`.
2. Browser llega al `<script type="module">` y ejecuta `bootstrap(esmModules)`.
3. `bootstrap()` hace `Promise.all` de `import()` para cada ESM. Cada ESM cargado se registra en `definedModules[name]`.
4. Cuando todos los ESM están cargados, `bootstrap()` setea `esmLoaded = true` y ejecuta las factories de `pendingFactories` **en orden de registro**.
5. `bootstrap()` resuelve. En este punto, todo el grafo está armado: UMD y ESM registrados, factories ejecutadas.
6. El evento `load` natural del browser se dispara cuando todo el HTML y sus recursos terminaron. `when-all-ready` ejecuta los handlers de aplicación.

### Especificación de `bootstrap()`

**Firma:**

```typescript
interface EsmModuleSpec {
  name: string;   // nombre con el que se registra en definedModules
  url: string;    // URL desde donde se hace import()
}

window.requireBro.bootstrap(esmModules: EsmModuleSpec[]): Promise<void>
```

**Por qué `name` es obligatorio en la spec del ESM:** para un UMD el `name` lo provee la propia llamada a `define(name, ...)` o se infiere del `currentScript.src`. Para un ESM nada de eso aplica — el archivo no se autoidentifica. El llamador (típicamente `backend-plus`) sabe el nombre con el que ese módulo debe registrarse en `definedModules`, y lo declara explícitamente.

**Semántica:**

- Los ESM se cargan en paralelo con `Promise.all(map(import))`.
- Cada ESM cargado se asigna a `definedModules[name] = mod`. El `mod` es el namespace completo del módulo ESM (`{ exportA, exportB, ... }`), que para librerías que exportaban "objeto plano de funciones" tiene el mismo shape que tenía la versión UMD.
- Cuando todos los ESM están cargados, se setea `esmLoaded = true` y se vacía `pendingFactories` ejecutando cada una en orden.
- `bootstrap()` resuelve cuando se ejecutó la última factory diferida.

**Errores:**

- Si un `import()` falla (módulo no encontrado, error de sintaxis, etc.), `bootstrap()` rechaza. Es un error de infraestructura del frontend; no hay recuperación razonable.
- Si una factory UMD lanza al ejecutarse, mantener el comportamiento actual de `require-bro` (propagar la excepción). No acumular silenciosamente como `when-all-ready` — `require-bro` es infraestructura crítica, `when-all-ready` es coordinación de inicializaciones de aplicación.

### Implementación de referencia

```javascript
// require-bro@3 (esquemática, en pseudo-JS para guiar la implementación TS)

var definedModules = (window.requireBro = window.requireBro || {}).definedModules = {};
var pendingFactories = []; // [{name, deps, factory}]
var esmLoaded = false;

function define(/* (name?, deps?, factory) | (name?, plainObject) */) {
  var parsed = parseDefineArgs(arguments); // mantiene la lógica actual de parseo UMD/AMD
  var {name, deps, factory, plainObject} = parsed;

  if (plainObject !== undefined) {
    // Shortcut: define(name, {...}) sin factory — registración directa
    definedModules[name] = plainObject;
    return;
  }

  if (esmLoaded) {
    // ESM ya cargados: comportamiento clásico, ejecutar factory enseguida
    runFactory(name, deps, factory);
  } else {
    // ESM todavía pendientes: diferir la factory
    pendingFactories.push({name, deps, factory});
  }
}

function runFactory(name, deps, factory) {
  var resolvedDeps = deps.map(function(dep) {
    if (dep === 'require') return requireBro;
    if (dep === 'exports') {
      var exp = {};
      definedModules[name] = exp;
      return exp;
    }
    return requireBro(dep);
  });
  var result = factory.apply(null, resolvedDeps);
  if (result !== undefined) {
    definedModules[name] = result;
  }
}

window.requireBro.bootstrap = async function(esmModules) {
  await Promise.all(esmModules.map(async function(spec) {
    var mod = await import(spec.url);
    definedModules[spec.name] = mod;
  }));

  esmLoaded = true;

  // Ejecutar factories diferidas en orden de registro (FIFO)
  while (pendingFactories.length > 0) {
    var entry = pendingFactories.shift();
    runFactory(entry.name, entry.deps, entry.factory);
  }
};

// require() sigue funcionando como hoy: busca en definedModules,
// con el fallback de búsqueda por globals con conversión camelCase si no se encuentra.
function requireBro(name) {
  if (name in definedModules) {
    return definedModules[name];
  }
  // ... fallback a búsqueda por globals (preservar lógica actual)
}
```

**Notas para la implementación:**

- El parseo de argumentos de `define()` (`parseDefineArgs`) ya está implementado en `require-bro@0.3.4`. Hay que portarlo a TypeScript preservando los tres shapes soportados (`define(name, deps, factory)`, `define(deps, factory)`, `define(factory)`, `define(name?, plainObject)`).
- El fallback de búsqueda por globals con conversión camelCase también está en el código actual. Hay incertidumbre sobre si todavía se usa; en la duda, **preservarlo** en `require-bro@3` y revisarlo más adelante.
- `require-plus.js` (archivo presente en `0.3.4`) **se elimina**. No se usa desde 2016.
- El `polyfills-bro.js` actual hay que revisarlo: si sigue siendo necesario, se mantiene; si no, se elimina junto con el resto de la limpieza.

### El problema del evento `load` y `whenAllReady`

**Problema:** los handlers de aplicación hoy se registran con `window.addEventListener('load', ...)`. No son idempotentes. El bootstrap asincrónico de `require-bro@3` hace que `load` se dispare antes de que termine la carga real — y un handler registrado dinámicamente después de `load` nunca se ejecuta (el DOM no provee "ejecutar este handler aunque load ya pasó").

**Insight de fondo:** este patrón (`addEventListener('load', initFn)` para "todo está listo") **no tiene sentido en ESM puro tampoco**. ESM resuelve el orden vía el grafo de imports y top-level code; `load` solo aplica a recursos (imágenes, iframes), no a "mi JS terminó de inicializarse". Por lo tanto, **migrar a otro mecanismo no es deuda de la transición, es alineación con el modelo destino**.

**Solución: `whenAllReady`, en su propio paquete `when-all-ready`** (nombre ya registrado en npm). El código de aplicación lo importa directamente desde ahí, sin pasar por `require-bro`. Eso desacopla el código de aplicación de `require-bro` desde el día uno: cuando `require-bro` se jubile, no hay nada que migrar.

```javascript
// En código de aplicación, hoy (UMD/CJS):
var {whenAllReady} = require('when-all-ready');
whenAllReady(myInitFunc);

// Mañana (ESM):
import {whenAllReady} from 'when-all-ready';
whenAllReady(myInitFunc);
```

Mismo specifier en las dos etapas. Solo cambia la sintaxis del import al migrar a ESM.

### Por qué el nombre `whenAllReady` y no `whenReady` u `onReady`

- `whenReady` es ambiguo: ¿ready qué? ¿el DOM, este módulo, una dependencia, la app?
- `whenAllReady` es preciso: cuando *todo* el bootstrap está terminado.
- Deja namespace libre para futuros `whenModuleReady(name, fn)`, `whenDomReady(fn)`, etc., sin colisión.

### Implementación de `whenAllReady`

```javascript
// when-all-ready (paquete propio, autosuficiente)

export interface WhenAllReadyError {
  error: Error;
  moduleName: string;
  moduleNameWasDeduced: boolean;
}

// La cola arranca bloqueada esperando 'load' (o ya resuelta si el evento pasó)
var queue = new Promise<void>(resolve => {
  if (document.readyState === 'complete') {
    resolve();
  } else {
    window.addEventListener('load', () => resolve());
  }
});

export var errors: WhenAllReadyError[] = [];

function enqueue(fn, moduleName, moduleNameWasDeduced) {
  queue = queue.then(async () => {
    try {
      await fn();
    } catch (error) {
      errors.push({ error, moduleName, moduleNameWasDeduced });
    }
  });
}

export function whenAllReady(fn, moduleName) {
  var moduleNameWasDeduced = moduleName === undefined;
  var resolvedName = moduleName !== undefined ? moduleName : (fn.name || '');
  enqueue(fn, resolvedName, moduleNameWasDeduced);
}
```

**Semántica:**

- **Ejecución serial estricta.** Todos los handlers van a la misma cola permanente. Si un handler devuelve una promesa, los siguientes esperan a que se resuelva (o rechace) antes de arrancar. Da igual si se registraron antes o después del evento `load`: el orden de encolado es el orden de ejecución.
- **Aislamiento de errores.** Si un handler tira excepción o rechaza la promesa, los siguientes se ejecutan igual. El error no rompe la cadena.
- **Errores acumulados y expuestos.** La lista `errors` exportada contiene todos los errores ocurridos, cada uno con la referencia al `Error` original, el `moduleName` que se le asoció, y un flag `moduleNameWasDeduced` que indica si ese nombre fue pasado explícitamente por el caller o deducido de `fn.name`. El código de aplicación puede revisar esta lista al final del bootstrap y decidir qué hacer (romper todo, avisar al usuario, loguear, etc.).
- **Si un handler quiere paralelizar parte de su trabajo**, que dispare la promesa internamente sin awaitearla. El default es serial.

**API:**

```javascript
whenAllReady(fn);                      // moduleName se deduce de fn.name
whenAllReady(fn, 'mi-modulo');         // moduleName explícito
```

**Lectura de errores desde el código de aplicación:**

```javascript
import { whenAllReady, errors } from 'when-all-ready';

whenAllReady(function mainInit() {
  if (errors.length > 0) {
    // decidir qué hacer: romper, avisar, loguear, etc.
    console.error('Errores durante la carga:', errors);
    showUserNotification('Hubo errores en la carga. Algunas funciones podrían no funcionar como se espera, por favor avise a soporte.');
  }
  // resto de la inicialización principal
}, 'main');
```

Como `mainInit` se encola al final y la cola es serial, cuando se ejecuta ya pasaron todos los handlers anteriores y `errors` refleja el estado completo.

### Compatibilidad durante la transición

`when-all-ready@1.x` se publica antes del piloto y queda disponible para que cualquier sistema cliente lo use ya mismo. Su implementación es la misma desde el día uno (la mostrada arriba) — no necesita cambiar cuando llegue `require-bro@3`, porque `whenAllReady` ya se basa en el evento `load` natural del browser, que es exactamente lo que los handlers de aplicación están esperando.

Esto permite que los sistemas cliente migren sus handlers de `load` a `whenAllReady` progresivamente, **una regla por PR**: si tocás un handler de `load`, cambialo a `whenAllReady`.

### Después de `require-bro@3`: jubilación

Cuando `backend-plus@2.x` (la línea anterior) deje de mantenerse, `require-bro` se jubila. **El código de aplicación no necesita ningún cambio**: siempre importó `whenAllReady` desde `when-all-ready` directamente. `when-all-ready` queda como paquete independiente que sobrevive a `require-bro` sin modificaciones.

## Orden de migración

### Fase 0 — Preparación (sin tocar librerías todavía)

- [ ] Publicar `when-all-ready@1.x` con la implementación inicial (fallback a `load`).
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

Cuando `backend-plus@2.x` deje de tener consumers activos, `require-bro` se archiva. El código de aplicación no necesita cambios porque siempre importó `whenAllReady` desde `when-all-ready` directamente.

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

## Para la sesión de implementación con Claude Code

### Alcance del primer paso

En esta primera sesión se tocan **tres carpetas**:

1. **`when-all-ready`** — paquete nuevo, hay que crearlo desde cero. Repositorio ya creado en `github.com/emilioplatzer/when-all-ready` (queda ahí por ahora; eventualmente se mueve a la organización principal).
2. **`require-bro`** — sí se toca en esta etapa. Salto de versión a `3.0.0-rc.1`.
3. **`best-globals`** — el piloto del salto a 3.x ESM-only.

**`best-globals` no depende de `when-all-ready`** (es utilitario puro, sin código de browser). Las tres migraciones son técnicamente independientes; podés trabajarlas en paralelo o secuencial según convenga.

### Convenciones técnicas

- **TypeScript desde el día uno**, todo en TS (tanto `src/` como `test/`). Tomar como referencia la estructura de `cast-error`, que ya está full TS.
- **Versionado inicial**:
  - `when-all-ready`: `3.0.0-rc.1` desde el inicio (es parte fundamental del esfuerzo de migración, alineado con la nomenclatura 3.x del resto del ecosistema).
  - `require-bro`: salto de `0.3.4` a `3.0.0-rc.1`.
  - `best-globals`: salto de `2.x` a `3.0.0-rc.1`.
- **Tests con Mocha**, cobertura con Coveralls (consistente con el resto del ecosistema).
- **`tsconfig.json` base** para los tres paquetes: el template definido más arriba en este documento.

### Sobre el carácter browser-only de `when-all-ready`

`when-all-ready` solo tiene sentido en browser (depende de `window` y `document`). No se necesita un mecanismo especial para prevenir su uso en Node: las librerías que dependerán de `whenAllReady` son las que ya usan `window.addEventListener`, ninguna otra. Basta con dejarlo documentado en el README.

### Workflow esperado de Claude Code

- **Claude Code no hace commits**. Trabaja por pasos cortos y los muestra antes de avanzar al siguiente. Cualquier commit/push lo hace Emilio manualmente.
- **Claude Code arma primero un plan**, lo muestra, y avanza paso a paso esperando confirmación.
- **Permisos de comandos**:
  - Permitidos: `npm install`, `npm test`, `npm run build`, y similares de lectura/ejecución local.
  - **No permitidos**: `npm publish`, `git commit`, `git push`, ni nada que modifique repositorios remotos.
