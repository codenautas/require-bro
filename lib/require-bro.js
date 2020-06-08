"use strict";

(function(){
    /*global window*/
    /* eslint no-return-assign: 0 */
    if(!window){
        throw new Error("require-bro is only for browser");
    }
    if(window.require){
        if(!(window.require.cache||{}).electron){
            throw new Error("require-bro is incompatible here. 'window.require' found");
        }else{
            window.FromElectron = {
                require: window.require,
                module: window.module
            };
            delete window.module;
        }
    }
    if(!window.define){
        window.define = function define(){
            var argPos=0;
            var name;
            var dependencies=['require'];
            var factory;
            if(argPos<arguments.length && typeof arguments[argPos] === "string"){
                name=arguments[argPos];
                argPos++;
            }else{
                name=window.globalModuleName || document.currentScript.src.replace(/.*\/([^/\.]*)(.js(\?[0-9a-zA-Z]+)?)?/,function(all,part){ return part; });
            }
            if(argPos<arguments.length && arguments[argPos] instanceof Array){
                dependencies=arguments[argPos];
                argPos++;
            }
            if(argPos<arguments.length && arguments[argPos] instanceof Function){
                factory=arguments[argPos];
                argPos++;
            }else{
                throw new Error("require-bro define miss factory Function");
            }
            var exports={};
            var createdModule = factory.apply(window, dependencies.map(function(moduleName){ 
                if(moduleName==='require'){
                    return requireBro;
                }
                if(moduleName==='exports'){
                    return exports || module.exports;
                }
                return requireBro(moduleName) 
            }));
            window.requireBro.definedModules[name] = window[name] = createdModule === undefined ? exports : createdModule;
        }
        window.define.amd='powered by require-bro';
    }
    window.requireBro = function requireBro(name){
        if(window.FromElectron){
            try{
                return  window.FromElectron.require.apply(window,arguments);
            }catch(err){
                // search in require-bro system
            }
        }
        if(window.requireBro.definedModules[name]){
            return window.requireBro.definedModules[name];
        }else{
            var moduleName=name.replace(/^(\.\/)?(.*\/)*([^./]+)(\.js)?$/, function(match, fromThisPath, path, moduleName, extJs){
                return moduleName;
            });
            var camelName=moduleName.replace(/-([a-z])/g, function(match, letter){
                return letter.toUpperCase();
            });
            var namesForTry=[
                camelName.substr(0,1).toUpperCase()+camelName.substr(1),
                camelName,
                camelName.toLowerCase(),
                moduleName
            ];
            var foundName;
            while(namesForTry.length){
                var foundName=namesForTry.shift();
                if((window.require.cache||{})[foundName]){
                    /* jshint -W093 */ 
                    return window.requireBro.definedModules[foundName] = (window.require.cache||{})[foundName];
                    /* jshint +W093 */ 
                }
                if(window[foundName]){
                    /* jshint -W093 */ 
                    return window.requireBro.definedModules[foundName] = window[foundName];
                    /* jshint +W093 */ 
                }
            }
            throw new Error("require-bro: module "+JSON.stringify(name)+" not found. It must included manually");
        }
    };
    window.requireBro.definedModules = {};
    window.require = window.requireBro;
})();