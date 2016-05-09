;(function(){
    if(!window){
        throw new Error("require-bro is only for browser");
    }
    ['require'].forEach(function(name){
        if(window[name]){
            throw new Error("require-bro is incompatible here. 'window."+name+"' found");
        }
    });
    window.require = function requireBro(name){
        if(window.require.definedModules[name]){
            return window.require.definedModules[name];
        }else{
            var camelName=name.replace(/-([a-z])/g, function(match, letter){
                return letter.toUpperCase();
            }).replace(/^(.*\/)*([^./]+)(\.js)?$/, function(match, path, moduleName, extJs){
                return moduleName;
            });
            if(window[camelName]){
                return window.require.definedModules[name] = window[camelName];
            }else{
                camelName=camelName.substr(0,1).toUpperCase()+camelName.substr(1);
                if(window[camelName]){
                    return window.require.definedModules[name] = window[camelName];
                }else{
                    throw new Error("require-bro: module "+JSON.stringify(name)+" not found. It must included manually");
                }
            }
        }
    }
    window.require.definedModules = {};
})();