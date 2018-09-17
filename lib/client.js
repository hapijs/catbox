'use strict';

// Load modules

const Hoek = require('hoek');
const Boom = require('boom');


// Declare internals

const internals = {};


internals.defaults = {
    partition: 'catbox'
};


module.exports = class {

    constructor(engine, options) {

        Hoek.assert(engine, 'Missing catbox client engine');
        Hoek.assert(typeof engine === 'object' || typeof engine === 'function', 'engine must be an engine object or engine prototype (function)');
        Hoek.assert(typeof engine === 'function' || !options, 'Can only specify options with function engine config');

        const settings = Hoek.applyToDefaults(internals.defaults, options || {});
        Hoek.assert(settings.partition.match(/^[\w\-]+$/), 'Invalid partition name:' + settings.partition);

        this.connection = (typeof engine === 'object' ? engine : new engine(settings));
    };


    async start() {

        await this.connection.start();
    }

    async stop() {

        await this.connection.stop();
    }

    isReady() {

        return this.connection.isReady();
    }

    validateSegmentName(name) {

        return this.connection.validateSegmentName(name);
    }

    async get(key) {

        if (!this.connection.isReady()) {
            throw Boom.internal('Disconnected');                                // Disconnected
        }

        if (!key) {
            return null;                                                        // Not found on null
        }

        if (!internals.validateKey(key)) {
            throw Boom.internal('Invalid key');
        }

        const result = await this.connection.get(key);
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
    }

    async set(key, value, ttl) {

        if (!this.connection.isReady()) {
            throw Boom.internal('Disconnected');                                // Disconnected
        }

        if (!internals.validateKey(key)) {
            throw Boom.internal('Invalid key');
        }

        if (ttl <= 0) {
            return;                                                             // Not cachable (or bad rules)
        }

        await this.connection.set(key, value, ttl);
    }

    async drop(key) {

        if (!this.connection.isReady()) {
            throw Boom.internal('Disconnected');                                // Disconnected
        }

        if (!internals.validateKey(key)) {
            throw Boom.internal('Invalid key');
        }

        await this.connection.drop(key);                                       // Always drop, regardless of caching rules
    }
};


internals.validateKey = function (key) {

    return (key && typeof key.id === 'string' && key.segment && typeof key.segment === 'string');
};
