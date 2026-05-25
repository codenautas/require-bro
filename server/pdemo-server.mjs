"use strict";

import {Server4Test}  from 'server4test';
import {htmlScripts} from '../lib/html.mjs';
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

var umdOnlyLibrerias = librerias.filter(function(l){ return l.special || l.js === 'like-ar.js'; });

class Server extends Server4Test{
    directServices(){
        return super.directServices().concat([{
            path:'/favicon.ico',
            method:'get',
            middleware: function(req, res){ res.status(204).end(); }
        },{
            path:'/example',
            html:`
<!doctype html>
${htmlScripts(librerias)}
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
        `},{
            path:'/example-umd-only',
            html:`
<!doctype html>
${htmlScripts(umdOnlyLibrerias)}
<h1>UMD-only example</h1>
<button id=runtest>run</button>
<div id=umdresult></div>
<script>
window.addEventListener('load',function(){
    runtest.onclick=function(){
        var likeAr = require('like-ar');
        var doubled = likeAr({a:1,b:2,c:3}).map(function(v){return v*2}).plain();
        umdresult.textContent = JSON.stringify(doubled);
        umdresult.id='umdresult-ok';
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
