"use strict";

(function codenautasModuleDefinition(root, name, factory) {
    /* global define */
    /* istanbul ignore next */
    if(typeof root.globalModuleName !== 'string'){
        root.globalModuleName = name;
    }
    /* istanbul ignore next */
    if(typeof exports === 'object' && typeof module === 'object'){
        module.exports = factory();
    }else if(typeof define === 'function' && define.amd){
        define(factory);
    }else if(typeof exports === 'object'){
        exports[root.globalModuleName] = factory();
    }else{
        root[root.globalModuleName] = factory();
    }
    root.globalModuleName = null;
})(/*jshint -W040 */this, 'ejemplo', function() {

var bg = require('best-globals'); /* eslint-disable-line global-require */

window.addEventListener('load', function(){
    var div = document.createElement('div');
    var button = document.createElement('button');
    button.id = 'hoy';
    button.textContent = 'hoy';
    div.appendChild(button);
    var result = document.createElement('div');
    result.id = 'resultHoy';
    div.appendChild(result);
    document.body.appendChild(div);
    button.onclick = function() {
        result.textContent = bg.date.today().toYmd();
    }
})

});
