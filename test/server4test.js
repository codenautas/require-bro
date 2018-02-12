"use strict";

var INTERNAL_PORT = 39928;

var express = require('express');
var serveContent = require('serve-content');

class Server{
    constructor(){
        this.app = express();
    }
    start(){
        var server = this;
        var baseUrl = '';
        var optsGenericForFiles={
            allowedExts:['', 'js', 'html', 'css', 'jpg', 'jpeg', 'png', 'ico', 'gif', 'eot', 'svg', 'ttf', 'woff', 'woff2', 'appcache']
        }
        server.port = INTERNAL_PORT;
        server.app.use('/example', function(req, res, next){
            res.send(`
<!doctype html>
<script src='lib/require-bro.js'></script>
<script src='node_modules/like-ar/like-ar.js'></script>
<script src='node_modules/best-globals/best-globals.js'></script>
<script src='node_modules/js-to-html/js-to-html.js'></script>
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
            `);
            res.end();
        });
        server.app.use(baseUrl+'/',serveContent(process.cwd(),optsGenericForFiles));
        return new Promise(function(resolve, reject){
            server.listener = server.app.listen(server.port, function(err){
                if(err){
                    reject(err);
                }else{
                    resolve();
                }
            });
        });
    }
    closeServer(){
        var server = this;
        return new Promise(function(resolve,reject){
            try{
                server.listener.close(function(err){
                    if(err){
                        reject(err);
                    }else{
                        resolve();
                    }
                });
            }catch(err){
                reject(err);
            }
        });
    }
}

module.exports = Server;