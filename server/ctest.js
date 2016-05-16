"use strict";

var keys = null;
var baseUrl = 'http://localhost:43098';
var testUrl = baseUrl + '/demo';
var coverageUrl = baseUrl + '/coverage';
var numErrors = 0;

function sendToCoverage(covUrl, method, headers) {
    var sentCover = casper.page.evaluate(function(wsurl, method, headers) {
        //console.log("url", wsurl, "method", method, "headers", headers);
        var dataReq = JSON.stringify(window.__coverage__);
        var data = __utils__.sendAJAX(wsurl, method, dataReq, false, headers);
        //console.log("data",  data);
        return JSON.parse(data);
    }, coverageUrl+'/'+covUrl, method, headers);
    //console.log("sent coverage", sentCover);
    return sentCover;
};

function sendCoverage() { sendToCoverage('client', 'POST', {contentType: 'application/json'}); };

casper.test.on("fail", function () {
    ++numErrors;
});

// hooks para errores
casper.on("remote.message", function(msg) {
    this.echo("Console: " + msg);
});

casper.on("page.error", function(msg, trace) {
    this.echo("page Error: " + msg);
    for(var t in trace) {
        var tra = trace[t];
        this.echo("  ["+tra.file+":"+tra.line+"] "+tra.function)
    }
});

casper.on("resource.error", function(msg, trace) {
    this.echo("Res.Error: " + msg);
});

// Inicio de los tests
casper.test.begin("Test require-bro", function suite(test) {
    casper.start(testUrl, function() {
        var result=casper.page.evaluate(function() {
            return JSON.stringify(change({a:'one', b:'two'}, {a:3, c:4}));
        });
        test.assertEquals(result, JSON.stringify({a:3, b:"two", c:4}));
    }).run(function() {
        test.done();
    });    
});

casper.test.begin("Finish", function(test) {
    casper.start(testUrl, function() {
        this.echo("# errores: "+numErrors);
    }).run(function() {
        this.test.done(numErrors === 0);
    });    
});

casper.test.begin("save coverage", function suite(test) {
    casper.start(testUrl, function() {
        var sentCover = sendToCoverage('object', 'GET');
        fs.write('coverage/Casper/coverage-final.json', JSON.stringify(sentCover, undefined, 4)); 
    }).run(function() {
        test.done();
    });    
});