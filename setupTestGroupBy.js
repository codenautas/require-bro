// setupTestGroupBy.js
if (process.env.GROUPBY_TESTS !== "1") {
  return;
}

(function () {
  const native = typeof Object.groupBy === "function" ? Object.groupBy : null;

  function holeSafe(items, cb) {
    if (items == null) throw new TypeError("Object.groupBy called on null or undefined");
    if (typeof cb !== "function") throw new TypeError("callback must be a function");
    const o = Object(items), out = Object.create(null), len = o.length >>> 0;
    for (let i = 0; i < len; i++) {
      if (!Object.prototype.hasOwnProperty.call(o, i)) continue;
      const v = o[i], k = String(cb(v, i, o));
      (out[k] || (out[k] = [])).push(v);
    }
    return out;
  }

  Object.defineProperty(Object, "groupBy", {
    configurable: true, writable: true, enumerable: false,
    value(items, cb) {
      if (Array.isArray(items) || typeof items === "string") return holeSafe(items, cb);
      return native ? native(items, cb) : holeSafe(Object.values(items), cb);
    }
  });
})();
