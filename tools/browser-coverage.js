"use strict";

// Captura la cobertura del código que corre en el browser (lib/*.js) y la
// acumula en coverage/browser/ como reportes istanbul-json.
// Los tests corren la librería con <script src>, así que c8 (que sólo ve el
// proceso de node) no puede medirla: hay que pedírsela a Chrome.

const v8toIstanbul = require("v8-to-istanbul");
const fs = require("fs");
const Path = require("path");

const PROJECT_DIR = Path.join(__dirname, "..");
const OUTPUT_DIR = Path.join(PROJECT_DIR, "coverage", "browser");

// Sólo interesa el módulo de la librería. polyfills-bro.js queda afuera:
// es código de compatibilidad, no lo que se está desarrollando acá.
const COVERED_FILES = ["/lib/require-bro.js"];

async function startCoverage(page) {
    await page.coverage.startJSCoverage({
        resetOnNavigation: false,
        includeRawScriptCoverage: true
    });
}

async function stopAndSaveCoverage(page, reportName) {
    const entries = await page.coverage.stopJSCoverage();
    const coverageMap = {};
    for (const entry of entries) {
        const url = new URL(entry.url);
        if (!COVERED_FILES.includes(url.pathname)) continue;
        if (!entry.rawScriptCoverage) continue;
        const filePath = Path.join(PROJECT_DIR, url.pathname);
        if (!fs.existsSync(filePath)) {
            throw new Error("browser-coverage: no existe el archivo " + filePath + " (url " + entry.url + ")");
        }
        const converter = v8toIstanbul(filePath, 0, { source: entry.text });
        await converter.load();
        converter.applyCoverage(entry.rawScriptCoverage.functions);
        Object.assign(coverageMap, converter.toIstanbul());
        converter.destroy();
    }
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(
        Path.join(OUTPUT_DIR, "coverage-" + reportName + ".json"),
        JSON.stringify(coverageMap)
    );
}

module.exports = { startCoverage, stopAndSaveCoverage, OUTPUT_DIR };
