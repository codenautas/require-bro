<!--multilang v0 es:LEEME.md en:README.md -->
# require-bro
require for browsers

<!--lang:es-->
# Instalación
<!--lang:en--]
# Install
[!--lang:*-->
```sh
$ npm install require-bro
```

<!-- cucardas -->
![designing](https://img.shields.io/badge/stability-designing-red.svg)
[![npm-version](https://img.shields.io/npm/v/require-bro.svg)](https://npmjs.org/package/require-bro)
[![downloads](https://img.shields.io/npm/dm/require-bro.svg)](https://npmjs.org/package/require-bro)
[![build](https://img.shields.io/travis/codenautas/require-bro/master.svg)](https://travis-ci.org/codenautas/require-bro)
[![climate](https://img.shields.io/codeclimate/github/codenautas/require-bro.svg)](https://codeclimate.com/github/codenautas/require-bro)
[![dependencies](https://img.shields.io/david/codenautas/require-bro.svg)](https://david-dm.org/codenautas/require-bro)
[![qa-control](http://codenautas.com/github/codenautas/require-bro.svg)](http://codenautas.com/github/codenautas/require-bro)

<!--multilang buttons-->

idioma: ![castellano](https://raw.githubusercontent.com/codenautas/multilang/master/img/lang-es.png)
también disponible en:
[![inglés](https://raw.githubusercontent.com/codenautas/multilang/master/img/lang-en.png)](README.md)

<!--lang:es-->
## Uso
<!--lang:en--]
## Use
[!--lang:*-->

```js
// file more-math.js

var MoreMath = {}; // module

MoreMath.real_roots_quadratic_equation = function(a,b,c){
    var delta=b*b-4*a*c;
    if(delta<0) return [];
    var r=-b/(2*a);
    if(delta==0) return [r];
    return [r-s,r+s];
}

MoreMath.intRandom = function (min, max){
    return Math.floor(Math.random()*(max-min+1)+min);
}

```

```js
// file other.js

var MoreMath = require('more-math'); 

console.log(MoreMath.real_roots_quadratic_equation(1,-2,1));
console.log('dice', MoreMath.intRandom = function (1, 6));

```

```html
// file index.html

<script src='require-bro.js'></script>
<script src='more-math.js'></script>
<script src='other.js'></script>

```

## require([module-name])

<!--lang:es-->
Busca en el objeto global `window` una variable cuyo nombre sea igual al parámetro pasado
pero transformado en camelCase (o CamelCase) y retorna su valor

El módulo requerido debe estar incluido en los `<scripts>` previos
y debe definir la variable global con el mismo nombre de módulo (en camelCase que puede empezar en minúscula o mayúscula).
<!--lang:en--]
Searchs in the global object `window` a variable with the same name but in camelCase (or CamelCase)

The required module must be included in previous `<scripts>` 
and must have define a global variable with the same name. 
[!--lang:*-->


<!--lang:es-->
## Licencia
<!--lang:en--]
## License
[!--lang:*-->

[MIT](LICENSE)

