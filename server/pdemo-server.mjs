"use strict";

import {Server4Test}  from 'server4test';
import {fileURLToPath} from 'url';
import path from 'path';

console.log('Server4Test', Server4Test)

var librerias = [
    {path: 'lib',                            js: 'require-bro.js',    special: true},
    {path: 'node_modules/best-globals',      js: 'best-globals.js',   type: 'module', name: 'best-globals'},
    {path: 'node_modules/when-all-ready',    js: 'when-all-ready.js', type: 'module', name: 'when-all-ready'},
    {path: 'node_modules/like-ar',           js: 'like-ar.js'},
    {path: 'node_modules/js-to-html/lib',    js: 'js-to-html.js'},
    {path: 'node_modules/big.js',            js: 'big.js'},
    {path: 'node_modules/json4all',          js: 'json4all.js'},
    {path: 'node_modules/type-store',        js: 'type-store.js'},
    {path: 'server',                         js: 'ejemplo.js'},
]

class Server extends Server4Test{
    directServices(){
        var umdScripts = librerias.filter(function(l){ return !l.special && l.type !== 'module'; });
        var esmModules = librerias.filter(function(l){ return l.type === 'module'; })
            .map(function(l){ return {name: l.name, url: '/'+l.path+'/'+l.js}; });
        return super.directServices().concat([{
            path:'/example',
            html:`
<!doctype html>
<script src='/lib/require-bro.js'></script>
${umdScripts.map(function(l){ return "<script src='/"+l.path+"/"+l.js+"'></script>"; }).join('\n')}
<script type="module">
await window.requireBro.bootstrap(${JSON.stringify(esmModules)});
</script>
<h1>example</h1>
<button id=calculate>calculate</button>
<div id=layout></div>
<script>
window.addEventListener('load',function(){
calculate.onclick=function(){
    layout.textContent=TypeStore.i18n.messages.en.boolean.true;
    layout.id='result';
}
});
</script>
</html>
        `}])
    }
}

export const serverDemo = new Server({port:39929, "local-file-repo":{enabled:false, directory:null}});

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
    console.log("starting server");
    serverDemo.start().catch(console.error);
}
