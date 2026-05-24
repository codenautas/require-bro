"use strict";

import {Server4Test}  from 'server4test';
import {fileURLToPath} from 'url';
import path from 'path';

console.log('Server4Test', Server4Test)

var umdScripts = [
    '/node_modules/like-ar/like-ar.js',
    '/node_modules/js-to-html/lib/js-to-html.js',
    '/node_modules/big.js/big.js',
    '/node_modules/json4all/json4all.js',
    '/node_modules/type-store/type-store.js',
    '/server/ejemplo.js',
]

var esmModules = [
    {name: 'best-globals',   url: '/node_modules/best-globals/best-globals.js'},
    {name: 'when-all-ready', url: '/node_modules/when-all-ready/when-all-ready.js'},
]

class Server extends Server4Test{
    directServices(){
        return super.directServices().concat([{
            path:'/example',
            html:`
<!doctype html>
<script src='/lib/require-bro.js'></script>
${umdScripts.map(function(u){ return "<script src='"+u+"'></script>"; }).join('\n')}
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
