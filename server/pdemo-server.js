"use strict";

var PORT = 43098;

var Path = require('path');
var winOS = Path.sep==='\\';

var _ = require('lodash');
var express = require('express');
var app = express();

var coverageON = process.argv.indexOf('--coverage') !== -1;

if(coverageON) {
    var urlParse = require('url').parse;
    var im = require('istanbul-middleware');
}

var extensionServeStatic = require('extension-serve-static');
        
var changing = require('best-globals').changing;

function coverageMatcher(req) {
    var parsed = urlParse(req.url);
    var r = (parsed.pathname && parsed.pathname.match(/\.js$/) && parsed.pathname.match(/\/lib\//)) ? true : false;
    return r;
}

function coveragePathTransformer(req) {
    return function (req) {
        var parsed = urlParse(req.url),
            pathName = parsed.pathname;
        var r = pathName;
        if (pathName && pathName.match(/\/lib\/tedede.js/)) {
            r = Path.resolve('./lib/tedede.js');
        } else {
            r = Path.normalize(__dirname + r);
        }
        return r;
    }(req);
}

if(coverageON) {
    console.log('Activando coverage');
    im.hookLoader(__dirname, { verbose: true });
    app.use('/coverage', im.createHandler({ verbose: true, resetOnGet: true }));
    app.use(im.createClientHandler(__dirname, { matcher:coverageMatcher, pathTransformer:coveragePathTransformer }));
}

app.get('/demo', function(req,res){
    res.end(
        "<script src='/lib/require-bro.js'></script>\n"+
        "<script src='/lib2/best-globals.js'></script>\n"+
        "<script>\n"+
        "var changing = require('best-globals').changing;\n"+
        "function change(a,b){ return changing(a,b); };\n"+
        "</script>"
    );
});

app.use('/lib2',extensionServeStatic('./node_modules/best-globals', {staticExtensions: ['js']}));
app.use('/lib',extensionServeStatic('./lib', {staticExtensions: ['js']}));

app.use('/',extensionServeStatic('./server', {
    extensions: ['html', 'htm'], 
    index: 'index.html', 
    staticExtensions: ['', 'html', 'htm', 'png', 'jpg', 'jpeg', 'gif', 'js', 'css']
})); 

var pidBrowser;

var server = app.listen(PORT, function(){
    console.log('Listening on port %d', server.address().port);
    console.log('launch browser');
    var spawn = require('child_process').spawn;
    var args = process.argv;
    var phantomPath=process.env.TRAVIS && process.env.TRAVIS_NODE_VERSION<'4.0'?'phantomjs':'./node_modules/phantomjs-prebuilt/lib/phantom/'+(winOS?'bin/phantomjs.exe':'bin/phantomjs');
    var slimerPath=process.env.TRAVIS?'slimerjs':'./node_modules/slimerjs/lib/slimer/'+(winOS?'slimerjs.bat':'bin/slimerjs');
    
    pidBrowser = spawn(
        (process.env.TRAVIS && false?'casperjs':'./node_modules/casperjs/bin/'+(winOS?'casperjs.exe':'casperjs')),
        ['test',
         '--verbose',
         // '--loglevel=debug',
         //'--value=true',
         //'--engine=slimerjs',
         //'--fail-fast',
         Path.resolve('./server/ctest.js')
        ],
        { stdio: 'inherit' , env: changing(process.env,{PHANTOMJS_EXECUTABLE: phantomPath, SLIMERJS_EXECUTABLE:slimerPath})}
    );
    pidBrowser.on('close', function (code, signal) {
        console.log('browser closed', code, signal);
        pidBrowser = null;
        if(!(process.argv.indexOf('--hold')>0)){
            process.exit(code);
        }
    });
    console.log('all launched');
});

process.on('exit', function(code){
    console.log('process exit',code);
    if(pidBrowser){
        pidBrowser.kill('SIGHUP');
        console.log('SIGHUP sended to browser');
    }else{
        console.log('browser already closed');
    }
});


process.on('uncaughtException', function(err){
    console.log('process NOT CAPTURED ERROR',err);
    console.log(err.stack);
    process.exit(1);
});

