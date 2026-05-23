"use strict";

import {Server4Test}  from 'server4test';

console.log('Server4Test', Server4Test)

class Server extends Server4Test{
    directServices(){
        return super.directServices().concat([{
            path:'/example',
            html:`
<!doctype html>
<script src='lib/require-bro.js'></script>
<script src='node_modules/like-ar/like-ar.js'></script>
<script src='node_modules/best-globals/best-globals.js'></script>
<script src='node_modules/js-to-html/lib/js-to-html.js'></script>
<script src='node_modules/big.js/big.js'></script>
<script src='node_modules/json4all/json4all.js'></script>
<script src='node_modules/type-store/type-store.js'></script>
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

console.log("starting server");

serverDemo.start();