"use strict";

// Fusiona los json de cobertura que dejó cada test de browser en
// coverage/browser/ y emite el reporte final: summary por consola,
// coverage/lcov.info (para el GHA) y coverage/index.html (navegable).

const libCoverage = require("istanbul-lib-coverage");
const libReport = require("istanbul-lib-report");
const reports = require("istanbul-reports");
const fs = require("fs");
const Path = require("path");

const INPUT_DIR = Path.join(__dirname, "..", "coverage", "browser");
const OUTPUT_DIR = Path.join(__dirname, "..", "coverage");

if (!fs.existsSync(INPUT_DIR)) {
    throw new Error("No existe " + INPUT_DIR + ": hay que correr los tests antes de generar el reporte");
}

// Cada test que ejercita require-bro.js deja su propio json. Si falta alguno
// la cobertura baja sin que se note, así que se pide que estén todos.
// groupby no está en la lista: sólo carga polyfills-bro.js, que no se cubre.
const EXPECTED_REPORTS = ["deduce", "example"];

const files = fs.readdirSync(INPUT_DIR).filter(name => name.endsWith(".json"));
const missing = EXPECTED_REPORTS.filter(
    name => !files.includes("coverage-" + name + ".json")
);
if (missing.length) {
    throw new Error(
        "Falta la cobertura de: " + missing.join(", ") +
        ". Los tests de browser tienen que correr completos antes de generar el reporte."
    );
}

const map = libCoverage.createCoverageMap({});
for (const file of files) {
    map.merge(JSON.parse(fs.readFileSync(Path.join(INPUT_DIR, file), "utf8")));
}

const context = libReport.createContext({ dir: OUTPUT_DIR, coverageMap: map });
reports.create("text-summary").execute(context);
reports.create("lcovonly").execute(context);
reports.create("html").execute(context);
