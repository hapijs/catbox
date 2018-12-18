'use strict';

const Hoek = require('hoek');

// Load modules


// Declare internals

const internals = {
    defaults: {
        a: 123
    }
};


module.exports = class {

    constructor(options) {

        this.options = Hoek.applyToDefaultsWithShallow(internals.defaults, options, ['shallow']);
        this.cache = null;
    }

    start() {

        if (!this.cache) {
            this.cache = {};
        }
    }

    stop() {

        this.cache = null;
        return;
    }

    isReady() {

        return (!!this.cache);
    }

    validateSegmentName(name) {

        if (!name) {
            return new Error('Empty string');
        }

        if (name.indexOf('\0') !== -1) {
            return new Error('Includes null character');
        }

        return null;
    }

    get(key) {

        if (!this.cache) {
            throw new Error('Callbacks not started');
        }

        const segment = this.cache[key.segment];
        if (!segment) {
            return null;
        }

        const envelope = segment[key.id];
        if (!envelope) {
            return null;
        }

        let value = null;
        try {
            value = JSON.parse(envelope.item);
        }
        catch (ignoreErr) {
            throw new Error('Bad value content');
        }

        const result = {
            item: value,
            stored: envelope.stored,
            ttl: envelope.ttl
        };

        return result;
    }

    set(key, value, ttl, callback) {

        const orig = callback;
        callback = (...args) => setImmediate(() => orig(...args));

        if (!this.cache) {
            throw new Error('Callbacks not started');
        }

        const envelope = {
            item: JSON.stringify(value),
            stored: Date.now(),
            ttl
        };

        this.cache[key.segment] = this.cache[key.segment] || {};
        const segment = this.cache[key.segment];

        const cachedItem = segment[key.id];
        if (cachedItem && cachedItem.timeoutId) {
            clearTimeout(cachedItem.timeoutId);
        }

        const timeoutId = setTimeout(() => {

            this.drop(key, () => { });
        }, ttl);

        envelope.timeoutId = timeoutId;

        segment[key.id] = envelope;
        return null;
    }

    drop(key, callback) {

        const orig = callback;
        callback = (...args) => setImmediate(() => orig(...args));

        if (!this.cache) {
            throw new Error('Callbacks not started');
        }

        const segment = this.cache[key.segment];
        if (segment) {
            delete segment[key.id];
        }
    }
};
