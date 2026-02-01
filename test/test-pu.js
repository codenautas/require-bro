"use strict";

var {Server4Test} = require('server4test');

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

const puppeteer = require('puppeteer');

const MiniTools = require('mini-tools');
const discrepances = require('discrepances');

const config = {
    test:{
        "view-chrome": true
    }
};

const headless = !!process.env.GITHUB_ACTIONS && !!process.env.TRAVIS || !config.test["view-chrome"]
const slowMo = headless ? 1 : 50;
const args = process.env.GITHUB_ACTIONS
  ? ['--no-sandbox', '--disable-setuid-sandbox']
  : [];

describe("interactive ",function(){
    var browser;
    var page;
    var server;
    before(async function(){
        this.timeout(50000);
        server = new Server({port:39929, "local-file-repo":{enabled:false, directory:null}});
        console.log("starting server");
        await server.start();
        browser = await puppeteer.launch({headless, slowMo, args});
        page = await browser.newPage();
        page.on('console', msg => { 
            console.log('console.'+msg.type(), msg.text()) 
        });
        await page.setViewport({width:1360, height:768});
        await page.goto('http://localhost:'+server.port+'/example');
        console.log('system ready');
    });
    it("calculate", async function(){
        this.timeout(5000);
        await page.waitForSelector('#calculate');
        await page.click('#calculate');
        await page.waitForSelector('#result');
        var obtained = await page.$eval('#result', div => div.textContent);
        discrepances.showAndThrow(obtained,'yes');
        return 1;
    });
    after(async function () {
        this.timeout(4500);
        //await page.waitFor(process.env.TRAVIS?10:1000);
        //reemplazo page.waitFor(...) ya no existe por:
        await new Promise(r => setTimeout(r, 200));
        await browser.close();
        await server.closeServer();
    });
});

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});