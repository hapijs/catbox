// Load modules

var Hoek = require('hoek');


// Declare internals

var internals = {};

// Declare next tick shortcut

var nextTick = process.nextTick;


exports.Connection = internals.Connection = function (options) {

    Hoek.assert(this.constructor === internals.Connection, 'Memory cache client must be instantiated using new');

    this.settings = options || {};
    this.cache = null;
    return this;
};


internals.Connection.prototype.start = function (callback) {

    if (!this.cache) {
        this.cache = {};
        this.byteSize = 0;
    }

    return nextTick(callback);
};


internals.Connection.prototype.stop = function () {

    this.cache = null;
    this.byteSize = 0;
    return;
};


internals.Connection.prototype.isReady = function () {

    return (!!this.cache);
};


internals.Connection.prototype.validateSegmentName = function (name) {

    if (!name) {
        return new Error('Empty string');
    }

    if (name.indexOf('\0') !== -1) {
        return new Error('Includes null character');
    }

    return null;
};


internals.Connection.prototype.get = function (key, callback) {

    if (!this.cache) {
        return callback(new Error('Connection not started'));
    }

    var segment = this.cache[key.segment];
    if (!segment) {
        return nextTick(function(){
            callback(null, null);
        });
    }

    var envelope = segment[key.id];
    if (!envelope) {
        return nextTick(function(){
            callback(null, null);
        });
    }

    var value = null;
    try {
        value = JSON.parse(envelope.item);
    }
    catch (err) {
        return nextTick(function(){
            callback(new Error('Bad value content'));
        });
    }

    var result = {
        item: value,
        stored: envelope.stored,
        ttl: envelope.ttl
    };

    return nextTick(function(){
        callback(null, result);
    });
};


internals.Connection.prototype.set = function (key, value, ttl, callback) {

    var self = this;

    if (!this.cache) {
        return callback(new Error('Connection not started'));
    }

    var stringifiedValue = null;                                    // stringify() to prevent value from changing while in the cache
    try {
        stringifiedValue = JSON.stringify(value);
    }
    catch (err) {
        return nextTick(function(){
            callback(err);
        });
    }

    var envelope = {
        item: stringifiedValue,
        stored: Date.now(),
        ttl: ttl
    };

    this.cache[key.segment] = this.cache[key.segment] || {};
    var segment = this.cache[key.segment];

    var cachedItem = segment[key.id];
    if (cachedItem && cachedItem.timeoutId) {
        clearTimeout(cachedItem.timeoutId);

        if (cachedItem.byteSize) {
            self.byteSize -= cachedItem.byteSize;                   // If the item existed, decrement the byteSize as the value could be different
        }
    }

    if (this.settings.maxByteSize &&
        this.settings.maxByteSize > 0) {

        envelope.byteSize = 53 + Buffer.byteLength(envelope.item) + Buffer.byteLength(key.segment) + Buffer.byteLength(key.id);     // Envelope size without value: 53 bytes
        if (self.byteSize + envelope.byteSize > this.settings.maxByteSize) {
            return callback(new Error('Cache size limit reached'));
        }
    }

    var timeoutId = setTimeout(function () {

        self.drop(key, function () { });
    }, ttl);

    envelope.timeoutId = timeoutId;

    segment[key.id] = envelope;

    return nextTick(callback.bind(null, null));
};


internals.Connection.prototype.drop = function (key, callback) {

    if (!this.cache) {
        return callback(new Error('Connection not started'));
    }

    var segment = this.cache[key.segment];
    if (segment) {
        var item = segment[key.id];

        if (item && item.byteSize) {
            this.byteSize -= item.byteSize;
        }

        delete segment[key.id];
    }

    return nextTick(callback);
};
