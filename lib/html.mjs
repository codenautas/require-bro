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
    var hasEsm = modules.some(function(m){ return m.type === 'module'; });
    var requireBro = modules.find(function(m){ return m.special; });
    if (hasEsm) {
        pieces.push('<script type="importmap">' + JSON.stringify(importmap(modules)) + '</script>');
    }
    if (requireBro) {
        pieces.push('<script src="/' + requireBro.path + '/' + requireBro.js + '"></script>');
    }
    var rest = modules.filter(function(m){ return !m.special; });
    var i = 0;
    while (i < rest.length) {
        if (rest[i].type === 'module') {
            var batch = [];
            while (i < rest.length && rest[i].type === 'module') {
                batch.push(rest[i].name);
                i++;
            }
            pieces.push('<script>window.requireBro.bootstrap(' + JSON.stringify(batch) + ');</script>');
        } else {
            pieces.push('<script src="/' + rest[i].path + '/' + rest[i].js + '"></script>');
            i++;
        }
    }
    return pieces.join('\n');
}
