"use strict";

import {Server4Test}  from 'server4test';
import {fileURLToPath} from 'url';
import path from 'path';

console.log('Server4Test', Server4Test)

var librerias = [
    {path: 'lib', js:'require-bro.js', special:true},
    {path: 'node_modules/best-globals', js:'best-globals.js'},
    {path: 'node_modules/like-ar', js:'like-ar.js'},
    {path: 'node_modules/js-to-html/lib', js:'js-to-html.js'},
    {path: 'node_modules/big.js', js:'big.js'},
    {path: 'node_modules/json4all', js:'json4all.js'},
    {path: 'node_modules/type-store', js:'type-store.js'},
    {path: 'server', js:'ejemplo.js'},
]

class Server extends Server4Test{
    directServices(){
        return super.directServices().concat([{
            path:'/example',
            html:`
<!doctype html>
${librerias.map(l=>`<script src='${l.path}/${l.js}'></script>`).join('\n')}
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
