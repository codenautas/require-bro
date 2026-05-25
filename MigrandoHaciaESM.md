<!--multilang v0 es:MigrandoHaciaESM.md en:MigratingToESM.md -->

<!--lang:es-->
# Migrando hacia ESM
<!--lang:en--]
# Migrating to ESM
[!--lang:*-->

<!--multilang buttons-->

idioma: ![castellano](https://raw.githubusercontent.com/codenautas/multilang/master/img/lang-es.png)
también disponible en:
[![inglés](https://raw.githubusercontent.com/codenautas/multilang/master/img/lang-en.png)](MigratingToESM.md)

<!--lang:es-->
## Para quién es esto

Para proyectos que sirven scripts al browser con `<script src=...>` y dependen de globales, y que quieren empezar a consumir librerías ESM sin reescribir todo de una. Es la situación típica de apps basadas en backend-plus.

No hace falta migrar todo a ESM en un solo paso. El stack que describe este documento permite que ESM y UMD convivan en la misma página indefinidamente.

## Las cuatro piezas

| Pieza | Qué resuelve |
|---|---|
| `<script type="importmap">` | Nativo del browser. Mapea nombres bare (`'best-globals'`) a URLs. Solo lo ven los `<script type="module">` e `import()` dinámicos. |
| `require-bro` + `bootstrap()` | Pone en cola a los `define()` de UMD hasta que los `import()` de ESM terminen. Es la sincronización que el browser no provee. |
| `define(['require'], factory)` | Patrón AMD/UMD. Hace que el cuerpo de un script "espere" al bootstrap. Cualquier `require(...)` de adentro encuentra el módulo ya cargado. |
| `whenAllReady(fn)` | Corre `fn` cuando bootstrap terminó **y** el DOM está listo. Reemplazo de `window.addEventListener('load', fn)` para código que depende de librerías que vienen por bootstrap. |

importmap y `whenAllReady` son piezas que sobreviven al UMD y serán útiles aunque algún día se retire `require-bro`. `bootstrap()` y `define()` son el puente que vive mientras haya código UMD que consume ESM.
<!--lang:en--]
## Who this is for

For projects that serve scripts to the browser via `<script src=...>` and rely on globals, and want to start consuming ESM libraries without rewriting everything at once. The typical situation of backend-plus apps.

You don't need to migrate everything to ESM in one step. The stack described in this document lets ESM and UMD coexist in the same page indefinitely.

## The four pieces

| Piece | What it solves |
|---|---|
| `<script type="importmap">` | Browser native. Maps bare names (`'best-globals'`) to URLs. Only `<script type="module">` and dynamic `import()` see it. |
| `require-bro` + `bootstrap()` | Queues UMD `define()` factories until the ESM `import()` calls settle. The synchronization the browser does not provide. |
| `define(['require'], factory)` | AMD/UMD pattern. Makes the script body "wait" for bootstrap. Any `require(...)` inside finds the module already loaded. |
| `whenAllReady(fn)` | Runs `fn` after bootstrap finishes **and** the DOM is ready. Replacement for `window.addEventListener('load', fn)` for code that depends on libraries loaded via bootstrap. |

importmap and `whenAllReady` are pieces that outlive UMD and stay useful even when `require-bro` is eventually retired. `bootstrap()` and `define()` are the bridge that lives as long as there is UMD code consuming ESM.
[!--lang:*-->

<!--lang:es-->
## El problema en una línea
<!--lang:en--]
## The problem in one line
[!--lang:*-->

<!--lang:es-->
`require()` síncrono al tope de un script UMD no puede consumir un módulo ESM que se carga asincrónicamente. Cuando el script UMD evalúa su `require('best-globals')`, el módulo ESM todavía no terminó de cargar — la llamada falla.
<!--lang:en--]
Synchronous `require()` at the top of a UMD script can't consume an ESM module loaded asynchronously. When the UMD script evaluates its `require('best-globals')`, the ESM module hasn't finished loading yet — the call fails.
[!--lang:*-->

<!--lang:es-->
La solución es no hacer ese `require()` al tope: meterlo dentro de un `define()` cuya factory `require-bro` encola hasta que termine el `bootstrap()`. Recién cuando el ESM está cargado, la factory corre, el `require(...)` encuentra el módulo, y el código sigue.
<!--lang:en--]
The fix is not to do that `require()` at the top: put it inside a `define()` factory that `require-bro` queues until `bootstrap()` finishes. Only when the ESM is loaded, the factory runs, the `require(...)` finds the module, and the code proceeds.
[!--lang:*-->

<!--lang:es-->
## Receta A: migrar una librería UMD que hacía `require()` al tope

**Antes** (librería que se servía con `<script src=mi-lib.js>` y dejaba un global `MiLib`):

```js
"use strict";

const otraLib = require("otra-lib");

var MiLib = {};
MiLib.algo = function(){ return otraLib.cosa(); };
```

Si `otra-lib` pasa a ser ESM, este archivo rompe.

**Después** (envuelto con el wrapper UMD codenautas):

```js
"use strict";

(function codenautasModuleDefinition(root, name, factory) {
    if (typeof root.globalModuleName !== 'string') {
        root.globalModuleName = name;
    }
    if (typeof exports === 'object' && typeof module === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else if (typeof exports === 'object') {
        exports[root.globalModuleName] = factory();
    } else {
        root[root.globalModuleName] = factory();
    }
    root.globalModuleName = null;
})(this, 'MiLib', function() {

const otraLib = require("otra-lib");

var MiLib = {};
MiLib.algo = function(){ return otraLib.cosa(); };

return MiLib;
});
```

El cuerpo entre `function() {` y `return MiLib;` queda **igual** al original. Solo cambia el envoltorio. El `require("otra-lib")` ahora corre dentro de la factory que `require-bro` encola detrás del `bootstrap()`, así que cuando se evalúa el `otra-lib` ya está cargado.

### Si la librería exponía otros nombres como globales

Si los consumidores hacían `miFuncion(...)` directamente (no `MiLib.miFuncion(...)`), agregalos como propiedades de `MiLib` y opcionalmente también como globales, antes del `return`:

```js
MiLib.miFuncion = miFuncion;
if (typeof window !== 'undefined') {
    window.miFuncion = miFuncion;
}

return MiLib;
```

La asignación a `MiLib.miFuncion` es la API "limpia". La asignación a `window.miFuncion` es para no romper consumidores históricos que usan el nombre suelto.
<!--lang:en--]
## Recipe A: migrate a UMD library that did top-level `require()`

**Before** (a library served with `<script src=my-lib.js>` that leaves a `MyLib` global):

```js
"use strict";

const otherLib = require("other-lib");

var MyLib = {};
MyLib.something = function(){ return otherLib.thing(); };
```

If `other-lib` becomes ESM, this file breaks.

**After** (wrapped with the codenautas UMD wrapper):

```js
"use strict";

(function codenautasModuleDefinition(root, name, factory) {
    if (typeof root.globalModuleName !== 'string') {
        root.globalModuleName = name;
    }
    if (typeof exports === 'object' && typeof module === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else if (typeof exports === 'object') {
        exports[root.globalModuleName] = factory();
    } else {
        root[root.globalModuleName] = factory();
    }
    root.globalModuleName = null;
})(this, 'MyLib', function() {

const otherLib = require("other-lib");

var MyLib = {};
MyLib.something = function(){ return otherLib.thing(); };

return MyLib;
});
```

The body between `function() {` and `return MyLib;` stays **identical** to the original. Only the wrapper changes. The `require("other-lib")` now runs inside the factory that `require-bro` queues behind `bootstrap()`, so by the time it executes `other-lib` is already loaded.

### If the library exposed other names as globals

If consumers called `myFunction(...)` directly (not `MyLib.myFunction(...)`), expose them as properties of `MyLib` and optionally also as globals, before the `return`:

```js
MyLib.myFunction = myFunction;
if (typeof window !== 'undefined') {
    window.myFunction = myFunction;
}

return MyLib;
```

The assignment to `MyLib.myFunction` is the "clean" API. The assignment to `window.myFunction` keeps historical consumers using the bare name from breaking.
[!--lang:*-->

<!--lang:es-->
## Receta B: migrar el script "main" de un HTML

El script inline que está dentro del HTML y que arma la interfaz también es código que hace `require()` y depende de librerías. Tiene el mismo problema que la librería de arriba, y se resuelve con el mismo patrón: envolverlo en `define()` y, adentro, usar `whenAllReady` para el wiring del DOM.

**Antes**:

```html
<script src="../node_modules/require-bro/lib/require-bro.js"></script>
<script src="../node_modules/best-globals/best-globals.js"></script>
<script src="../lib/mi-lib.js"></script>
<script>
window.addEventListener('load', function(){
    boton.onclick = function(){
        var bg = require('best-globals');
        salida.textContent = bg.date.today().toYmd();
    };
});
</script>
```

**Después**:

```html
<script type="importmap">
{
    "imports": {
        "best-globals":   "/node_modules/best-globals/best-globals.js",
        "when-all-ready": "/node_modules/when-all-ready/when-all-ready.js"
    }
}
</script>
<script src="../node_modules/require-bro/lib/require-bro.js"></script>
<script>window.requireBro.bootstrap(['best-globals', 'when-all-ready']);</script>
<script src="../lib/mi-lib.js"></script>
<script>
define('main-pagina', function(require){
    var whenAllReady = require('when-all-ready').whenAllReady;
    whenAllReady(function(){
        boton.onclick = function(){
            var bg = require('best-globals');
            salida.textContent = bg.date.today().toYmd();
        };
    });
});
</script>
```

Tres cambios:

1. **`<script type="importmap">`** declara los nombres bare. Tiene que ir antes del primer script que los use.
2. **`bootstrap(['best-globals', 'when-all-ready'])`** dispara la carga ESM y abre la cola de `define()`.
3. El inline final se envuelve en `define('nombre', function(require){ ... })`. El `nombre` es una etiqueta cualquiera (en backend-plus suele ser el path o id de la página). Adentro, `whenAllReady` reemplaza al `addEventListener('load')` y garantiza que se ejecute después de bootstrap y de que el DOM esté listo.
<!--lang:en--]
## Recipe B: migrate the "main" script of an HTML

The inline script inside the HTML that wires up the UI is also code that does `require()` and depends on libraries. It has the same problem as the library above, and the same pattern solves it: wrap it in `define()` and, inside, use `whenAllReady` for the DOM wiring.

**Before**:

```html
<script src="../node_modules/require-bro/lib/require-bro.js"></script>
<script src="../node_modules/best-globals/best-globals.js"></script>
<script src="../lib/my-lib.js"></script>
<script>
window.addEventListener('load', function(){
    button.onclick = function(){
        var bg = require('best-globals');
        output.textContent = bg.date.today().toYmd();
    };
});
</script>
```

**After**:

```html
<script type="importmap">
{
    "imports": {
        "best-globals":   "/node_modules/best-globals/best-globals.js",
        "when-all-ready": "/node_modules/when-all-ready/when-all-ready.js"
    }
}
</script>
<script src="../node_modules/require-bro/lib/require-bro.js"></script>
<script>window.requireBro.bootstrap(['best-globals', 'when-all-ready']);</script>
<script src="../lib/my-lib.js"></script>
<script>
define('main-page', function(require){
    var whenAllReady = require('when-all-ready').whenAllReady;
    whenAllReady(function(){
        button.onclick = function(){
            var bg = require('best-globals');
            output.textContent = bg.date.today().toYmd();
        };
    });
});
</script>
```

Three changes:

1. **`<script type="importmap">`** declares the bare names. It must come before the first script that uses them.
2. **`bootstrap(['best-globals', 'when-all-ready'])`** triggers the ESM loading and opens the `define()` queue.
3. The final inline script is wrapped in `define('name', function(require){ ... })`. The `name` is any label (in backend-plus it usually is the path or id of the page). Inside, `whenAllReady` replaces `addEventListener('load')` and guarantees execution after both bootstrap and the DOM are ready.
[!--lang:*-->

<!--lang:es-->
## Receta C: emisión automática desde el server

Mantener el bloque de scripts a mano en cada HTML escala mal. `require-bro` expone una función `htmlScripts(modules)` que, dada una lista de librerías declaradas en un único lugar, emite todo el bloque en el orden correcto.

```js
import {htmlScripts} from 'require-bro/html';

var modules = [
    {path: 'lib',                         js: 'require-bro.js',    special: true},
    {path: 'node_modules/best-globals',   js: 'best-globals.js',   type: 'module', name: 'best-globals'},
    {path: 'node_modules/when-all-ready', js: 'when-all-ready.js', type: 'module', name: 'when-all-ready'},
    {path: 'lib',                         js: 'mi-lib.js'},
];

var html = `<!doctype html>
${htmlScripts(modules)}
<h1>...</h1>
...`;
```

La lista se recorre en orden. Tiras de ESM consecutivos se agrupan en un único `bootstrap([...])`, cada UMD sale en su propio `<script src>`. El importmap (con todos los ESM) y el tag de `require-bro` se emiten al tope porque son prerrequisitos del browser.

Esta es la pieza pensada para vivir adentro de backend-plus: una capa que arma la lista a partir del `package.json` y los manifiestos del proyecto, y la pasa a `htmlScripts` al renderear el layout.
<!--lang:en--]
## Recipe C: emit from the server automatically

Maintaining the script block by hand in every HTML doesn't scale. `require-bro` exposes a `htmlScripts(modules)` function that, given a list of libraries declared in a single place, emits the full block in the right order.

```js
import {htmlScripts} from 'require-bro/html';

var modules = [
    {path: 'lib',                         js: 'require-bro.js',    special: true},
    {path: 'node_modules/best-globals',   js: 'best-globals.js',   type: 'module', name: 'best-globals'},
    {path: 'node_modules/when-all-ready', js: 'when-all-ready.js', type: 'module', name: 'when-all-ready'},
    {path: 'lib',                         js: 'my-lib.js'},
];

var html = `<!doctype html>
${htmlScripts(modules)}
<h1>...</h1>
...`;
```

The list is walked in order. Runs of consecutive ESM are grouped into a single `bootstrap([...])`, each UMD becomes its own `<script src>`. The importmap (with all the ESM) and the `require-bro` tag are emitted at the top because they are browser prerequisites.

This is the piece designed to live inside backend-plus: a layer that builds the list from the project's `package.json` and manifests, and passes it to `htmlScripts` when rendering the layout.
[!--lang:*-->

<!--lang:es-->
## Cosas que conviene tener en cuenta
<!--lang:en--]
## Things worth keeping in mind
[!--lang:*-->

<!--lang:es-->
### `load` se dispara antes de que termine `bootstrap()`

El evento `load` del documento no espera a los `import()` dinámicos. Cualquier `window.addEventListener('load', fn)` en código que dependa de librerías cargadas por bootstrap va a correr con esas librerías todavía sin inicializar. Por eso existe `whenAllReady`. Si vas a tocar código nuevo, usá `whenAllReady` desde el principio.

### El importmap solo lo ven los módulos

`<script type="importmap">` no afecta a los `<script>` clásicos ni a sus `require(...)` (los resuelve `require-bro` por nombre, no el browser). Esto está bien — son dos sistemas que no se pisan. Pero significa que si querés que un consumidor empiece a usar `import 'best-globals'` directo (sin require-bro), ese consumidor tiene que ser un `<script type="module">`.

### Namespaces ESM son read-only

Si una librería históricamente exponía un objeto mutable (`miLib.config = ...`) y migra a ESM, los consumidores que asignaban propiedades al namespace importado rompen — los namespaces ESM son inmutables desde afuera. Solución: que la librería exponga un setter explícito (`miLib.setConfig(...)`) o exporte un objeto config mutable cuyo *contenido* sí se puede modificar.

### Resolución de URLs relativas

Las URLs relativas en `import()` se resuelven contra la URL del **script** que ejecuta el `import()`, no contra la URL del documento (a diferencia de `<script src=>`). Por eso `bootstrap()` solo acepta nombres bare — y el importmap se encarga de mapearlos a URLs absolutas o relativas al documento.
<!--lang:en--]
### `load` fires before `bootstrap()` finishes

The document `load` event does not wait for dynamic `import()`. Any `window.addEventListener('load', fn)` in code that depends on libraries loaded via bootstrap will run with those libraries still uninitialized. That's why `whenAllReady` exists. If you are touching new code, use `whenAllReady` from the start.

### Only modules see the importmap

`<script type="importmap">` does not affect classic `<script>` tags or their `require(...)` (which `require-bro` resolves by name, not the browser). That's fine — they are two systems that don't overlap. But it means that if you want a consumer to start using `import 'best-globals'` directly (without require-bro), that consumer must be a `<script type="module">`.

### ESM namespaces are read-only

If a library historically exposed a mutable object (`myLib.config = ...`) and migrates to ESM, consumers that assigned properties to the imported namespace break — ESM namespaces are immutable from outside. Fix: the library should expose an explicit setter (`myLib.setConfig(...)`) or export a mutable config object whose *contents* can still be modified.

### Relative URL resolution

Relative URLs in `import()` are resolved against the URL of the **script** that executes the `import()`, not against the document URL (unlike `<script src=>`). That's why `bootstrap()` only accepts bare names — and the importmap is what maps them to absolute or document-relative URLs.
[!--lang:*-->

<!--lang:es-->
## Cuándo necesitás cada pieza

| Caso de uso | importmap | require-bro / bootstrap | define / whenAllReady |
|---|---|---|---|
| Página 100% UMD legacy (sin ESM) | no | no | no |
| Página 100% ESM (sin UMD) | sí | no | (whenAllReady sí, si hay async) |
| Mixto: UMD que consume ESM | sí | sí | sí |

El caso mixto es para el que está pensado todo este stack. Mientras tu app esté ahí — UMD legacy + librerías ESM nuevas — las cuatro piezas conviven naturalmente. El día que todo el código consumidor sea ESM nativo, `require-bro` y `bootstrap` quedan obsoletos; importmap y `whenAllReady` siguen siendo útiles.
<!--lang:en--]
## When you need each piece

| Use case | importmap | require-bro / bootstrap | define / whenAllReady |
|---|---|---|---|
| 100% UMD legacy page (no ESM) | no | no | no |
| 100% ESM page (no UMD) | yes | no | (whenAllReady yes, if async involved) |
| Mixed: UMD consuming ESM | yes | yes | yes |

The mixed case is what this whole stack is designed for. While your app is there — legacy UMD + new ESM libraries — the four pieces coexist naturally. The day all consumer code is native ESM, `require-bro` and `bootstrap` become obsolete; importmap and `whenAllReady` remain useful.
[!--lang:*-->
