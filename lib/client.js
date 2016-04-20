'use strict';

// Load modules

const Hoek = require('hoek');
const Boom = require('boom');
const Deferred = require('./deferred');


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


internals.Client.prototype.stop = function () {

    this.connection.stop();
};


internals.Client.prototype.start = function (callback) {

    let promise;
    if (!callback) {
        promise = new Deferred();
        callback = promise.callback();
    }

    this.connection.start(callback);

    if (promise) {
        return promise.promise;
    }
};


internals.Client.prototype.isReady = function () {

    return this.connection.isReady();
};


internals.Client.prototype.validateSegmentName = function (name) {

    return this.connection.validateSegmentName(name);
};


internals.Client.prototype.get = function (key, callback) {

    let promise;
    if (!callback) {
        promise = new Deferred();
        callback = promise.callback();
    }

    if (!this.connection.isReady()) {
        // Disconnected
        callback(Boom.internal('Disconnected'));
    }
    else if (!key) {
        // Not found on null
        callback(null, null);
    }
    else if (!internals.validateKey(key)) {
        callback(Boom.internal('Invalid key'));
    }
    else {
        this.connection.get(key, (err, result) => {

            if (err) {
                // Connection error
                return callback(err);
            }

            if (!result ||
                result.item === undefined ||
                result.item === null) {

                // Not found
                return callback(null, null);
            }

            const now = Date.now();
            const expires = result.stored + result.ttl;
            const ttl = expires - now;
            if (ttl <= 0) {
                // Expired
                return callback(null, null);
            }

            // Valid

            const cached = {
                item: result.item,
                stored: result.stored,
                ttl: ttl
            };

            return callback(null, cached);
        });
    }

    if (promise) {
        return promise.promise;
    }
};


internals.Client.prototype.set = function (key, value, ttl, callback) {

    let promise;
    if (!callback) {
        promise = new Deferred();
        callback = promise.callback();
    }

    if (!this.connection.isReady()) {
        // Disconnected
        callback(Boom.internal('Disconnected'));
    }
    else if (!internals.validateKey(key)) {
        callback(Boom.internal('Invalid key'));
    }
    else if (ttl <= 0) {
        // Not cachable (or bad rules)
        callback();
    }
    else {
        this.connection.set(key, value, ttl, callback);
    }

    if (promise) {
        return promise.promise;
    }
};


internals.Client.prototype.drop = function (key, callback) {

    let promise;
    if (!callback) {
        promise = new Deferred();
        callback = promise.callback();
    }

    if (!this.connection.isReady()) {
        // Disconnected
        callback(Boom.internal('Disconnected'));
    }
    else if (!internals.validateKey(key)) {
        callback(Boom.internal('Invalid key'));
    }
    else {
        this.connection.drop(key, callback);           // Always drop, regardless of caching rules
    }

    if (promise) {
        return promise.promise;
    }
};


internals.validateKey = function (key) {

    return (key && typeof key.id === 'string' && key.segment && typeof key.segment === 'string');
};
