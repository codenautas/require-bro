"use strict";
const assert = require("assert");

// Ejecutar estos tests SOLO cuando GROUPBY_TESTS=1 (p/ no romper `npm test`)
if (process.env.GROUPBY_TESTS !== "1") { return; }


function npo(obj){ // null-prototype object
  return Object.assign(Object.create(null), obj);
}

const _nativeGroupBy = Object.groupBy;

describe("Polyfill Object.groupBy", function () {
  after(function () {
    if (typeof _nativeGroupBy === "function") {
      Object.groupBy = _nativeGroupBy;
    } else {
      delete Object.groupBy;
    }
  });

  it("lanza TypeError si items es null/undefined", function () {
    assert.throws(() => Object.groupBy(null, () => "k"), TypeError);
    assert.throws(() => Object.groupBy(undefined, () => "k"), TypeError);
  });

  it("lanza TypeError si callback no es función", function () {
    assert.throws(() => Object.groupBy([], null), TypeError);
    assert.throws(() => Object.groupBy([], 123),  TypeError);
  });

  it("ARRAY-LIKE: agrupa un array normal", function () {
    const out = Object.groupBy([1, 2, 3, 2], n => String(n));
    assert.deepStrictEqual(out, npo({ "1":[1], "2":[2,2], "3":[3] }));
  });

  it("ARRAY-LIKE: respeta huecos (sparse)", function () {
    const a = [];
    a[0] = "a";
    a[2] = "b";

    const out = Object.groupBy(a, () => "k");
    assert.deepStrictEqual(out, npo({ k: ["a", "b"] }));
  });

  it("ARRAY-LIKE: funciona con string (length numérico)", function () {
    const out = Object.groupBy("aba", ch => ch);
    assert.deepStrictEqual(out, npo({ a:["a","a"], b:["b"] }));
  });

  it("ITERABLE: agrupa un Set y usa índice creciente", function () {
    const set = new Set(["a", "bb", "c"]);
    const indices = [];
    const out = Object.groupBy(set, (val, idx) => {
      indices.push(idx);
      return String(val.length);
    });
    assert.deepStrictEqual(indices, [0,1,2]); // tu polyfill cuenta 0..n
    assert.deepStrictEqual(out, npo({ "1":["a","c"], "2":["bb"] }));
  });

  it("PLAIN OBJECT: usa solo own properties (via Object.values)", function () {
    const base = Object.create({ inherited: 99 });
    base.a = 1; base.b = 2; base.c = 1;

    const out = Object.groupBy(Object.values(base), v => String(v));
    assert.deepStrictEqual(out, npo({ "1":[1,1], "2":[2] }));
    assert.strictEqual("inherited" in base, true);
  });

  it("convierte la clave a string (callback puede devolver números)", function () {
    const out = Object.groupBy([10, 11, 12], n => n % 2);
    assert.deepStrictEqual(out, npo({ "0":[10,12], "1":[11] }));
  });
});
