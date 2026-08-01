"use strict";

const { Server4Test } = require("server4test");
const puppeteer = require("puppeteer");
const discrepances = require("discrepances");

const config = {
    test:{
        "view-chrome": true
    }
};

const headless = !!process.env.GITHUB_ACTIONS || !!process.env.TRAVIS || !config.test["view-chrome"]
const slowMo = headless ? 1 : 50;
const args = process.env.GITHUB_ACTIONS
  ? ['--no-sandbox', '--disable-setuid-sandbox']
  : [];

class Server extends Server4Test {
  directServices() {
    return super.directServices().concat([
      {
        path: "/deduce",
        html: `
<!doctype html>
<meta charset="utf-8" />
<title>deduceModuleName test</title>
<script src="lib/require-bro.js"></script>
<body><div id="ready">ok</div></body>
</html>
        `,
      },
    ]);
  }
}

// [url del script, nombre de modulo esperado]
const casos = [
    // sufijos en el nombre del archivo
    ['http://localhost:1234/lib/mi-lib.js', 'mi-lib'],
    ['http://localhost:1234/lib/mi-lib.min.js', 'mi-lib'],
    ['http://localhost:1234/lib/mi-lib.umd.min.js', 'mi-lib'],
    ['http://localhost:1234/lib/mi-lib.umd.js', 'mi-lib'],
    // query string y fragmento
    ['http://localhost:1234/lib/mi-lib.js?v=123', 'mi-lib'],
    ['http://localhost:1234/lib/mi-lib.js#frag', 'mi-lib'],
    // index.js: el nombre viene del directorio
    ['http://localhost:1234/mi-lib/index.js', 'mi-lib'],
    ['http://localhost:1234/mi-lib/umd/index.js', 'mi-lib'],
    ['http://localhost:1234/mi-lib/dist/index.js', 'mi-lib'],
    ['http://localhost:1234/mi-lib/lib/index.js', 'mi-lib'],
    // directorios de build encadenados
    ['http://localhost:1234/mi-lib/dist/umd/index.js', 'mi-lib'],
    // index.js con sufijos
    ['http://localhost:1234/mi-lib/umd/index.min.js', 'mi-lib'],
    ['http://localhost:1234/mi-lib/umd/index.umd.min.js', 'mi-lib'],
    // sin directorio anterior al de build: queda el nombre del servidor
    ['http://servidor/umd/index.js', 'servidor'],
    ['http://cdn.midominio.com/umd/index.js', 'cdn.midominio.com'],
    // paquete dentro de node_modules
    ['http://localhost:1234/node_modules/foo/lib/index.js', 'foo'],
];

describe("deduceModuleName (desde lib/require-bro.js)", function () {
  let browser, page, server;

  before(async function () {
    this.timeout(60000);
    server = new Server({
      port: 39931,
      "local-file-repo": { enabled: false, directory: null },
    });
    await server.start();

    browser = await puppeteer.launch({ headless, slowMo, args });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`http://localhost:${server.port}/deduce`);
    await page.waitForSelector("#ready");
  });

  after(async function () {
    this.timeout(15000);
    if (page) await page.close();
    if (browser) await browser.close();
    if (server) await server.closeServer();
  });

  it("deduce el nombre del modulo para cada forma de url", async function () {
    const obtained = await page.evaluate((urls) =>
      urls.map((url) => window.requireBro.deduceModuleName(url))
    , casos.map(([url]) => url));
    discrepances.showAndThrow(obtained, casos.map(([, name]) => name));
  });
});
