"use strict";

const { Server4Test } = require("server4test");
const puppeteer = require("puppeteer");

class Server extends Server4Test {
  directServices() {
    return super.directServices().concat([
      {
        path: "/groupby",
        html: `
<!doctype html>
<meta charset="utf-8" />
<title>groupBy polyfill test</title>
<!-- Fuerzo que el polyfill se instale, sin tocar el archivo real -->
<script>
  // En algunos Chrome nuevos ya existe; lo borro para garantizar el camino del polyfill.
  try { delete Object.groupBy; } catch(e){ Object.groupBy = undefined; }

  // La detección que usa polyfills-bro.js
  window.pollyfillBroDetectLackOf = function(name, host){
    return name === "groupBy" && typeof host.groupBy === "undefined";
  };
</script>

<!-- CARGO EL ARCHIVO REAL QUE QUERÉS PROBAR -->
<script src="lib/polyfills-bro.js"></script>

<!-- Marcador simple para verificar que la página terminó de cargar -->
<body><div id="ready">ok</div></body>
</html>
        `,
      },
    ]);
  }
}

describe("Polyfill Object.groupBy (desde lib/polyfills-bro.js)", function () {
  let browser, page, server;

  before(async function () {
    this.timeout(60000);
    server = new Server({
      port: 39930,
      "local-file-repo": { enabled: false, directory: null },
    });
    await server.start();

    const headless =
      process.env.HEADLESS === "false" ? false : "new";
    browser = await puppeteer.launch({ headless });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`http://localhost:${server.port}/groupby`);
    await page.waitForSelector("#ready");
  });

  after(async function () {
    this.timeout(15000);
    if (page) await page.close();
    if (browser) await browser.close();
    if (server) await server.closeServer();
  });

  it("instala Object.groupBy cuando no existe", async function () {
    const exists = await page.evaluate(() => typeof Object.groupBy === "function");
    if (!exists) throw new Error("Object.groupBy no quedó definido por el polyfill");
  });

  it("lanza TypeError si items es null/undefined", async function () {
    await page.evaluate(() => {
      const throws = (fn, re) => {
        let ok = false;
        try { fn(); } catch (e) { ok = re.test(String(e && e.message)); }
        if (!ok) throw new Error("se esperaba TypeError correspondiente");
      };
      throws(() => Object.groupBy(null, () => "k"), /Object\.groupBy called on null or undefined/);
      throws(() => Object.groupBy(undefined, () => "k"), /Object\.groupBy called on null or undefined/);
    });
  });

  it("lanza TypeError si callback no es función", async function () {
    await page.evaluate(() => {
      const throws = (fn, re) => {
        let ok = false;
        try { fn(); } catch (e) { ok = re.test(String(e && e.message)); }
        if (!ok) throw new Error("se esperaba TypeError de callback");
      };
      throws(() => Object.groupBy([], null), /callback must be a function/);
      throws(() => Object.groupBy([], 123), /callback must be a function/);
    });
  });

  it("rama ARRAY-LIKE: agrupa un array normal", async function () {
    await page.evaluate(() => {
      const out = Object.groupBy([1, 2, 3, 2], (n) => String(n));
      const exp = { "1": [1], "2": [2, 2], "3": [3] };
      if (JSON.stringify(out) !== JSON.stringify(exp)) {
        throw new Error("array normal no coincide");
      }
    });
  });

  it("rama ARRAY-LIKE: respeta huecos (sparse) con `i in o`", async function () {
    await page.evaluate(() => {
      const a = [];
      a[0] = "a";
      a[2] = "b"; // hueco en el índice 1
      const seen = [];
      const out = Object.groupBy(a, (_v, i) => {
        seen.push(i);
        return "k";
      });
      const expSeen = [0, 2];
      const exp = { k: ["a", "b"] };
      if (JSON.stringify(seen) !== JSON.stringify(expSeen)) throw new Error("sparse: índices mal");
      if (JSON.stringify(out) !== JSON.stringify(exp)) throw new Error("sparse: resultado mal");
    });
  });

  it("rama ARRAY-LIKE: funciona con string", async function () {
    await page.evaluate(() => {
      const out = Object.groupBy("aba", (ch) => ch);
      const exp = { a: ["a", "a"], b: ["b"] };
      if (JSON.stringify(out) !== JSON.stringify(exp)) {
        throw new Error("string como array-like falló");
      }
    });
  });

  it("rama ITERABLE: agrupa Set y pasa índice creciente", async function () {
    await page.evaluate(() => {
      const set = new Set(["a", "bb", "c"]);
      const indices = [];
      const out = Object.groupBy(set, (val, idx) => {
        indices.push(idx);
        return String(val.length);
      });
      const expIdx = [0, 1, 2];
      const exp = { "1": ["a", "c"], "2": ["bb"] };
      if (JSON.stringify(indices) !== JSON.stringify(expIdx)) {
        throw new Error("iterable: índices mal");
      }
      if (JSON.stringify(out) !== JSON.stringify(exp)) {
        throw new Error("iterable: resultado mal");
      }
    });
  });

  it("rama PLAIN-OBJECT: agrupa solo own properties", async function () {
    await page.evaluate(() => {
      const base = Object.create({ inherited: 99 });
      base.a = 1; base.b = 2; base.c = 1;

      const seen = [];
      const out = Object.groupBy(base, (v, idx) => {
        seen.push(idx);
        return String(v);
      });
      const expSeen = [0, 1, 2];
      const exp = { "1": [1, 1], "2": [2] };

      if (JSON.stringify(seen) !== JSON.stringify(expSeen)) {
        throw new Error("plain-object: posiciones mal");
      }
      if (JSON.stringify(out) !== JSON.stringify(exp)) {
        throw new Error("plain-object: resultado mal");
      }
      if (!("inherited" in base)) throw new Error("setup heredado incorrecto");
    });
  });

  it("convierte la clave a string (callback devuelve números)", async function () {
    await page.evaluate(() => {
      const out = Object.groupBy([10, 11, 12], (n) => n % 2);
      const exp = { "0": [10, 12], "1": [11] };
      if (JSON.stringify(out) !== JSON.stringify(exp)) {
        throw new Error("stringificación de clave falló");
      }
    });
  });

  it("devuelve {} para colecciones vacías", async function () {
    await page.evaluate(() => {
      const asJson = (x) => JSON.stringify(x);
      if (asJson(Object.groupBy([], () => "k")) !== "{}") throw new Error("[] debe dar {}");
      if (asJson(Object.groupBy(new Set(), () => "k")) !== "{}") throw new Error("Set() debe dar {}");
      if (asJson(Object.groupBy({}, () => "k")) !== "{}") throw new Error("{} debe dar {}");
    });
  });
});
