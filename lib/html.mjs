"use strict";

export function importmap(modules) {
    var imports = {};
    modules.forEach(function(m){
        if (m.type === 'module' && m.name) {
            imports[m.name] = '/' + m.path + '/' + m.js;
        }
    });
    return { imports };
}

export function htmlScripts(modules) {
    var pieces = [];
    var esmModules = modules.filter(function(m){ return m.type === 'module'; });
    var umdScripts = modules.filter(function(m){ return !m.special && m.type !== 'module'; });
    var requireBro = modules.find(function(m){ return m.special; });
    if (esmModules.length) {
        pieces.push('<script type="importmap">' + JSON.stringify(importmap(modules)) + '</script>');
    }
    if (requireBro) {
        pieces.push('<script src="/' + requireBro.path + '/' + requireBro.js + '"></script>');
    }
    if (esmModules.length) {
        var names = esmModules.map(function(m){ return m.name; });
        pieces.push('<script>window.requireBro.bootstrap(' + JSON.stringify(names) + ');</script>');
    }
    umdScripts.forEach(function(m){
        pieces.push('<script src="/' + m.path + '/' + m.js + '"></script>');
    });
    return pieces.join('\n');
}
