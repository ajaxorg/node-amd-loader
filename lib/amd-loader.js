var path = require("path");
var fs = require("fs");
var Module = require("module");
var currentModule;
var defaultCompile = module.constructor.prototype._compile;

module.constructor.prototype._compile = function(content, filename){  
    currentModule = this;
    try {
        return defaultCompile.call(this, content, filename);
    }
    finally {
        currentModule = null;
    }
};

var requireModule = module;

global.define = function (id, injects, factory) {

    // infere the module
    var module = currentModule;
    if (!module) {
        module = requireModule;
        while (module.parent)
            module = module.parent;
    }

    // parse arguments
    if (!factory) {
        // two or less arguments
        factory = injects;
        if (factory) {
            // two args
            if (typeof id === "string") {
                if (id !== module.id) {
                    throw new Error("Can not assign module to a different id than the current file");
                }
                // default injects
                injects = [];
            }
            else{
                // anonymous, deps included
                injects = id;          
            }
        }
        else {
            // only one arg, just the factory
            factory = id;
            injects = [];
        }
    }

    var req = function(requireModule, relativeId, callback) {
        if (Array.isArray(relativeId)) {
            // async require
            return callback.apply(this, relativeId.map(req))
        }
        
        var chunks = relativeId.split("!");
        if (chunks.length >= 2) {
            var prefix = chunks[0];
            relativeId = chunks.slice(1).join("!");
        }
        
        var id = Module._resolveFilename(relativeId, requireModule.parent)[0];
        
        if (prefix && prefix.indexOf("text") !== -1) {
            return fs.readFileSync(id);
        } else
            return require(id);
    }.bind(this, requireModule);

    injects.unshift("require", "exports", "module");
    
    id = module.id;
    if (typeof factory !== "function") {
        // we can just provide a plain object
        return module.exports = factory;
    }
    var returned = factory.apply(module.exports, injects.map(function (injection) {
        switch (injection) {
            // check for CommonJS injection variables
            case "require": return req;
            case "exports": return module.exports;
            case "module": return module;
            default:
              // a module dependency
              return req(injection);
        }
    }));
    
    if(returned) {
          // since AMD encapsulates a function/callback, it can allow the factory to return the exports.
          module.exports = returned;
    }
};