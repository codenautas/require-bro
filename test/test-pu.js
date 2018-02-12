"use strict";

var Server = require('../test/server4test.js');

const puppeteer = require('puppeteer');

const MiniTools = require('mini-tools');
const discrepances = require('discrepances');

const config = {
    test:{
        "view-chrome": true
    }
};

describe("interactive ",function(){
    var browser;
    var page;
    var server;
    before(async function(){
        this.timeout(50000);
        server = new Server();
        console.log("starting server");
        await server.start();
        browser = await puppeteer.launch(process.env.TRAVIS?null:{headless: process.env.TRAVIS || !config.test["view-chrome"], slowMo: 50});
        page = await browser.newPage();
        page.on('console', msg => { 
            console.log('console.'+msg.type(), msg.text()) 
        });
        await page.setViewport({width:1360, height:768});
        await page.goto('http://localhost:'+server.port+'/example');
        console.log('system ready');
    });
    it("calculate", async function(){
        this.timeout(2000);
        await page.click('#calculate');
        await page.waitForSelector('#result');
        var obtained = await page.$eval('#result', div => div.textContent);
        discrepances.showAndThrow(obtained,'yes');
        return 1;
    });
    after(async function(){
        await page.waitFor(process.env.TRAVIS?10:1000);
        await browser.close()
        await server.closeServer();
    });
});

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});