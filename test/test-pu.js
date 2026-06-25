"use strict";

var {serverDemo} = require('../server/pdemo-server.mjs');

const puppeteer = require('puppeteer');

var {date} = require('best-globals')

const MiniTools = require('mini-tools');
const discrepances = require('discrepances');

const config = {
    test:{
        "view-chrome": true
    }
};

const headless = !!process.env.GITHUB_ACTIONS || !!process.env.TRAVIS || !config.test["view-chrome"]
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
        server = serverDemo;
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
    it("calculate yes", async function(){
        this.timeout(5000);
        await page.waitForSelector('#calculate');
        await page.click('#calculate');
        await page.waitForSelector('#result');
        var obtained = await page.$eval('#result', div => div.textContent);
        discrepances.showAndThrow(obtained,'yes');
        return 1;
    });
    it("get today", async function(){
        this.timeout(5000);
        await page.waitForSelector('#hoy');
        await page.click('#hoy');
        await page.waitForSelector('#resultHoy');
        var obtained = await page.$eval('#resultHoy', div => div.textContent);
        var hoy = date.today().toYmd();
        discrepances.showAndThrow(obtained,hoy);
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
