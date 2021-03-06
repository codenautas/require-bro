# require-bro
require for browsers

# Install
```sh
$ npm install require-bro
```

![extending](https://img.shields.io/badge/stability-extending-orange.svg)
[![npm-version](https://img.shields.io/npm/v/require-bro.svg)](https://npmjs.org/package/require-bro)
[![downloads](https://img.shields.io/npm/dm/require-bro.svg)](https://npmjs.org/package/require-bro)
[![build](https://img.shields.io/travis/codenautas/require-bro/master.svg)](https://travis-ci.org/codenautas/require-bro)
[![dependencies](https://img.shields.io/david/codenautas/require-bro.svg)](https://david-dm.org/codenautas/require-bro)


language: ![English](https://raw.githubusercontent.com/codenautas/multilang/master/img/lang-en.png)
also available in:
[![Spanish](https://raw.githubusercontent.com/codenautas/multilang/master/img/lang-es.png)](LEEME.md)

## Electron

Compatibility with Electron is experimental from both AMD and UMD modules.

## Use

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
console.log('dice', MoreMath.intRandom(1, 6));

```

```html
// file index.html

<script src='require-bro.js'></script>
<script src='more-math.js'></script>
<script src='other.js'></script>

```

## require([module-name])


Searchs in the global object `window` a variable with the same name but in camelCase (or CamelCase)

The required module must be included in previous `<scripts>`
and must have define a global variable with the same name.


## Tests with real devices

(tested with [self-explain](https://www.npmjs.com/package/self-explain) )


NPM version |Device                  |OS             |nav
------------|------------------------|---------------|---------------
0.10.0      | HTC Desire             | Android 2.2.2 | Android 2.2.2
0.10.0      | Samgsung Galaxy Note 4 | Android 5.1.1 | Samsung Internet 4.0.0
0.10.0      | Blue Vivo Air LTE      | Android 5.0.2 | Chrome Mobile 50.0.2661
0.10.0      | iPad mini Retina       | iOS 8.4.0     | Mobile Safari 8.0.0
0.10.0      | VMWare                 | WinXP         | IE 8.0.0

## License

[MIT](LICENSE)

