// Load modules

var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Catbox = require(libPath);

// Declare internals

var internals = {};


module.exports = internals.Server = function (settings) {

    this.client = new Catbox.Client(settings);
    this._routes = {};
    this.helpers = {};
};


internals.Server.prototype.addRoute = function (path, generator, policyOptions) {

    this._routes[path] = {
        generator: this._generatorWrapper(generator),
        policy: new Catbox.Policy(policyOptions, this.client)
    };
};


internals.Server.prototype._generatorWrapper = function (generator) {

    var generatedValue = generator();
    var error = null;
    var result = null;

    if (generatedValue instanceof Error) {
        error = generatedValue;
    }
    else {
        result = generatedValue;
    }

    return function (callback) {

        callback(error, result);
    };
};


internals.Server.prototype.getResponse = function (path, callback) {

    var route = this._routes[path];

    if (!route) {
        return callback(new Error());
    }

    route.policy.getOrGenerate(path, this._logger, route.generator, callback);
};


internals.Server.prototype._logger = function (value) {

};


internals.Server.prototype.addHelper = function (name, method, options) {

    var self = this;
    this.client.segment = options.segment || '#' + name;
    var cache = new Catbox.Policy(options, this.client);

    var helper = function (/* arguments, next */) {

        // Prepare arguments

        var args = arguments;
        var lastArgPos = args.length - 1;
        var next = args[lastArgPos];

        var generateFunc = function (callback) {

            args[lastArgPos] = function (result) {

                if (result instanceof Error) {
                    return callback(result);
                }

                return callback(null, result);
            };

            method.apply(null, args);
        };

        var key = (cache.isEnabled() ? internals.generateKey(args) : null);
        cache.getOrGenerate(key, self._logger, generateFunc, function (response, cached) {

            return next(response);
        });
    };

    this.helpers[name] = helper;
};


internals.generateKey = function (args) {

    var key = '';
    for (var i = 0, il = args.length - 1; i < il; ++i) {        // 'args.length - 1' to skip 'next'
        var arg = args[i];
        if (typeof arg !== 'string' &&
            typeof arg !== 'number' &&
            typeof arg !== 'boolean') {

            return null;
        }

        key += (i > 0 ? ':' : '') + encodeURIComponent(arg);
    }

    return key;
};