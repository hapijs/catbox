'use strict';

// Load modules

const Hoek = require('hoek');
const Boom = require('boom');


// Declare internals

const internals = {};


internals.defaults = {
    partition: 'catbox'
};


module.exports = internals.Client = function (engine, options) {

    Hoek.assert(this instanceof internals.Client, 'Cache client must be instantiated using new');
    Hoek.assert(engine, 'Missing catbox client engine');
    Hoek.assert(typeof engine === 'object' || typeof engine === 'function', 'engine must be an engine object or engine prototype (function)');
    Hoek.assert(typeof engine === 'function' || !options, 'Can only specify options with function engine config');

    const settings = Hoek.applyToDefaults(internals.defaults, options || {});
    Hoek.assert(settings.partition.match(/^[\w\-]+$/), 'Invalid partition name:' + settings.partition);

    this.connection = (typeof engine === 'object' ? engine : new engine(settings));
};


internals.Client.prototype.start = function () {

    return internals.promised(this.connection, 'start');
};


internals.Client.prototype.stop = function () {

    return this.connection.stop();
};


internals.Client.prototype.isReady = function () {

    return this.connection.isReady();
};


internals.Client.prototype.validateSegmentName = function (name) {

    return this.connection.validateSegmentName(name);
};


internals.Client.prototype.get = async function (key, callback) {

    if (!this.connection.isReady()) {
        throw Boom.internal('Disconnected');                                // Disconnected
    }

    if (!key) {
        return null;                                                        // Not found on null
    }

    if (!internals.validateKey(key)) {
        throw Boom.internal('Invalid key');
    }

    const result = await internals.promised(this.connection, 'get', key);
    if (!result ||
        result.item === undefined ||
        result.item === null) {

        return null;                                                        // Not found
    }

    const now = Date.now();
    const expires = result.stored + result.ttl;
    const ttl = expires - now;
    if (ttl <= 0) {
        return null;                                                        // Expired
    }

    const cached = {
        item: result.item,
        stored: result.stored,
        ttl
    };

    return cached;                                                          // Valid
};


internals.Client.prototype.set = async function (key, value, ttl) {

    if (!this.connection.isReady()) {
        throw Boom.internal('Disconnected');                                // Disconnected
    }

    if (!internals.validateKey(key)) {
        throw Boom.internal('Invalid key');
    }

    if (ttl <= 0) {
        return;                                                             // Not cachable (or bad rules)
    }

    return await internals.promised(this.connection, 'set', key, value, ttl);
};


internals.Client.prototype.drop = async function (key) {

    if (!this.connection.isReady()) {
        throw Boom.internal('Disconnected');                                // Disconnected
    }

    if (!internals.validateKey(key)) {
        throw Boom.internal('Invalid key');
    }

    return await internals.promised(this.connection, 'drop', key);          // Always drop, regardless of caching rules
};


internals.validateKey = function (key) {

    return (key && typeof key.id === 'string' && key.segment && typeof key.segment === 'string');
};


internals.promised = function (obj, method, ...args) {

    const deferred = {};
    const callbackPromise = new Promise((resolve, reject) => {

        deferred.resolve = resolve;
        deferred.reject = reject;
    });

    const result = obj[method](...args, (err, value) => {

        return err ? deferred.reject(err) : deferred.resolve(value);
    });

    const isPromiseResult = !!(result && result.then);
    return isPromiseResult ? result : callbackPromise;
};
