"use strict";

const assert = require("assert");

/*
  Configuro el entorno para forzar la instalación del polyfill:
  – Guardo el Object.groupBy nativo (si existe) para restaurarlo al final.
  – Elimino Object.groupBy para simular que no existe.
  – Defino pollyfillBroDetectLackOf para que devuelva true.
  – Inyecto el código del polyfill (tal cual el usado en producción).
*/

const _nativeGroupBy = Object.groupBy;
delete Object.groupBy;

global.pollyfillBroDetectLackOf = function (name, host) {
  return name === "groupBy" && typeof host.groupBy === "undefined";
};

// ====== POLYFILL INYECTADO ======
(function () {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy
  if (pollyfillBroDetectLackOf("groupBy", Object)) {
    Object.groupBy = function (items, callback) {
      if (items == null) {
        throw new TypeError("Object.groupBy called on null or undefined");
      }
      if (typeof callback !== "function") {
        throw new TypeError("callback must be a function");
      }

      var o = Object(items);
      var result = {};

      if (typeof o.length === "number") {
        var len = o.length >>> 0;
        for (var i = 0; i < len; i++) {
          if (i in o) {
            var item = o[i];
            var key = String(callback(item, i, o));
            (result[key] || (result[key] = [])).push(item);
          }
        }
        return result;
      }

      if (typeof o[Symbol.iterator] === "function") {
        var idx = 0;
        for (var it of o) {
          var k = String(callback(it, idx++, o));
          (result[k] || (result[k] = [])).push(it);
        }
        return result;
      }

      var idx2 = 0;
      for (var prop in o) {
        if (Object.prototype.hasOwnProperty.call(o, prop)) {
          var v = o[prop];
          var k2 = String(callback(v, idx2++, o));
          (result[k2] || (result[k2] = [])).push(v);
        }
      }
      return result;
    };
  }
})();
// ====== FIN POLYFILL ======

describe("Polyfill Object.groupBy", function () {
  after(function () {
    // Restauro el nativo si existía
    if (typeof _nativeGroupBy === "function") {
      Object.groupBy = _nativeGroupBy;
    } else {
      delete Object.groupBy;
    }
  });

  it("lanza TypeError si items es null/undefined", function () {
    assert.throws(
      () => Object.groupBy(null, () => "k"),
      /Object\.groupBy called on null or undefined/
    );
    assert.throws(
      () => Object.groupBy(undefined, () => "k"),
      /Object\.groupBy called on null or undefined/
    );
  });

  it("lanza TypeError si callback no es función", function () {
    assert.throws(() => Object.groupBy([], null), /callback must be a function/);
    assert.throws(() => Object.groupBy([], 123), /callback must be a function/);
  });

  it("ARRAY-LIKE: agrupa un array normal", function () {
    const out = Object.groupBy([1, 2, 3, 2], (n) => String(n));
    assert.deepStrictEqual(out, { "1": [1], "2": [2, 2], "3": [3] });
  });

  it("ARRAY-LIKE: respeta huecos (sparse) con `i in o`", function () {
    const a = [];
    a[0] = "a";
    a[2] = "b"; // hueco en 1

    const seenIdx = [];
    const out = Object.groupBy(a, (v, i) => {
      seenIdx.push(i);
      return "k";
    });

    // Procesa 0 y 2; omite 1
    assert.deepStrictEqual(seenIdx, [0, 2]);
    assert.deepStrictEqual(out, { k: ["a", "b"] });
  });

  it("ARRAY-LIKE: funciona con string (length numérico)", function () {
    const out = Object.groupBy("aba", (ch) => ch);
    assert.deepStrictEqual(out, { a: ["a", "a"], b: ["b"] });
  });

  it("ITERABLE: agrupa un Set y usa índice creciente", function () {
    const set = new Set(["a", "bb", "c"]);
    const indices = [];
    const out = Object.groupBy(set, (val, idx) => {
      indices.push(idx);
      return String(val.length);
    });
    assert.deepStrictEqual(indices, [0, 1, 2]);
    assert.deepStrictEqual(out, { "1": ["a", "c"], "2": ["bb"] });
  });

  it("PLAIN OBJECT: usa solo own properties", function () {
    const base = Object.create({ inherited: 99 });
    base.a = 1;
    base.b = 2;
    base.c = 1;

    const seenIdx = [];
    const out = Object.groupBy(base, (v, idx) => {
      seenIdx.push(idx);
      return String(v);
    });

    assert.deepStrictEqual(seenIdx, [0, 1, 2]);
    assert.deepStrictEqual(out, { "1": [1, 1], "2": [2] });
    assert.strictEqual("inherited" in base, true);
  });

  it("convierte la clave a string (callback puede devolver números)", function () {
    const out = Object.groupBy([10, 11, 12], (n) => n % 2);
    assert.deepStrictEqual(out, { "0": [10, 12], "1": [11] });
  });
});
