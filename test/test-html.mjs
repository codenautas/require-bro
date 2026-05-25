"use strict";

import {importmap, htmlScripts} from '../lib/html.mjs';
import discrepances from 'discrepances';
import 'mocha';

describe("importmap", function(){
    it("mapea sólo módulos ESM con name", function(){
        var result = importmap([
            {path: 'lib',                         js: 'require-bro.js',    special: true},
            {path: 'node_modules/best-globals',   js: 'best-globals.js',   type: 'module', name: 'best-globals'},
            {path: 'node_modules/when-all-ready', js: 'when-all-ready.js', type: 'module', name: 'when-all-ready'},
            {path: 'node_modules/like-ar',        js: 'like-ar.js'},
        ]);
        discrepances.showAndThrow(result, {
            imports: {
                'best-globals':   '/node_modules/best-globals/best-globals.js',
                'when-all-ready': '/node_modules/when-all-ready/when-all-ready.js'
            }
        });
    });
    it("objeto vacío cuando no hay ESM", function(){
        var result = importmap([
            {path: 'lib',                  js: 'require-bro.js', special: true},
            {path: 'node_modules/like-ar', js: 'like-ar.js'},
        ]);
        discrepances.showAndThrow(result, {imports: {}});
    });
});

describe("htmlScripts", function(){
    it("emite importmap, require-bro, bootstrap y UMD en orden", function(){
        var html = htmlScripts([
            {path: 'lib',                         js: 'require-bro.js',    special: true},
            {path: 'node_modules/best-globals',   js: 'best-globals.js',   type: 'module', name: 'best-globals'},
            {path: 'node_modules/when-all-ready', js: 'when-all-ready.js', type: 'module', name: 'when-all-ready'},
            {path: 'node_modules/like-ar',        js: 'like-ar.js'},
        ]);
        var posImportmap = html.indexOf('<script type="importmap">');
        var posRequireBro = html.indexOf('<script src="/lib/require-bro.js">');
        var posBootstrap = html.indexOf('window.requireBro.bootstrap(');
        var posUmd = html.indexOf('<script src="/node_modules/like-ar/like-ar.js">');
        discrepances.showAndThrow(posImportmap >= 0 && posImportmap < posRequireBro, true, {showContext:'importmap antes de require-bro'});
        discrepances.showAndThrow(posRequireBro < posBootstrap, true, {showContext:'require-bro antes de bootstrap'});
        discrepances.showAndThrow(posBootstrap < posUmd, true, {showContext:'bootstrap antes de UMD'});
        discrepances.showAndThrow(html.indexOf('["best-globals","when-all-ready"]') >= 0, true, {showContext:'bootstrap con nombres bare'});
    });
    it("sin ESM: no emite importmap ni bootstrap", function(){
        var html = htmlScripts([
            {path: 'lib',                  js: 'require-bro.js', special: true},
            {path: 'node_modules/like-ar', js: 'like-ar.js'},
        ]);
        discrepances.showAndThrow(html.indexOf('<script type="importmap">'), -1, {showContext:'no importmap'});
        discrepances.showAndThrow(html.indexOf('bootstrap('), -1, {showContext:'no bootstrap'});
        discrepances.showAndThrow(html.indexOf('<script src="/lib/require-bro.js">') >= 0, true, {showContext:'sí require-bro'});
        discrepances.showAndThrow(html.indexOf('<script src="/node_modules/like-ar/like-ar.js">') >= 0, true, {showContext:'sí UMD'});
    });
});
