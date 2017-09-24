'use strict';

// Load modules

const Hoek = require('hoek');


// Declare internals

const internals = {};


exports.Callbacks = class {
    constructor(options) {

        this.cache = null;
    }

    start(callback) {

        callback = Hoek.nextTick(callback);

        if (!this.cache) {
            this.cache = {};
        }

        return callback();
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

    get(key, callback) {

        callback = Hoek.nextTick(callback);

        if (!this.cache) {
            return callback(new Error('Callbacks not started'));
        }

        const segment = this.cache[key.segment];
        if (!segment) {
            return callback(null, null);
        }

        const envelope = segment[key.id];
        if (!envelope) {
            return callback(null, null);
        }

        let value = null;
        try {
            value = JSON.parse(envelope.item);
        }
        catch (ignoreErr) {
            return callback(new Error('Bad value content'));
        }

        const result = {
            item: value,
            stored: envelope.stored,
            ttl: envelope.ttl
        };

        return callback(null, result);
    }

    set(key, value, ttl, callback) {

        callback = Hoek.nextTick(callback);

        if (!this.cache) {
            return callback(new Error('Callbacks not started'));
        }

        let stringifiedValue = null;
        try {
            stringifiedValue = JSON.stringify(value);
        }
        catch (err) {
            return callback(err);
        }

        const envelope = {
            item: stringifiedValue,
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
        return callback(null);
    }

    drop(key, callback) {

        callback = Hoek.nextTick(callback);

        if (!this.cache) {
            return callback(new Error('Callbacks not started'));
        }

        const segment = this.cache[key.segment];
        if (segment) {
            delete segment[key.id];
        }

        return callback();
    }
};

exports.Promises = class extends exports.Callbacks {

    start() {

        return new Promise((resolve, reject) => {

            super.start((err) => {

                return (err ? reject(err) : resolve());
            });
        });
    }

    get(key) {

        return new Promise((resolve, reject) => {

            super.get(key, (err, result) => {

                return (err ? reject(err) : resolve(result));
            });
        });
    }

    set(key, value, ttl) {

        return new Promise((resolve, reject) => {

            super.set(key, value, ttl, (err) => {

                return (err ? reject(err) : resolve());
            });
        });
    }

    drop(key) {

        return new Promise((resolve, reject) => {

            super.drop(key, (err) => {

                return (err ? reject(err) : resolve());
            });
        });
    }
};
