// Load modules

var Hoek = require('hoek');


// Declare internals

var internals = {};


internals.defaults = {
    partition: 'catbox'
};


module.exports = internals.Client = function (engine, options) {

    Hoek.assert(this.constructor === internals.Client, 'Cache client must be instantiated using new');
    Hoek.assert(engine, 'Missing catbox client engine');
    Hoek.assert(typeof engine !== 'object' || !options, 'Cannot specify options with object instance engine config');

    var settings = Hoek.applyToDefaults(internals.defaults, options || {});
    Hoek.assert(settings.partition.match(/^[\w\-]+$/), 'Invalid partition name:' + settings.partition);

    if (typeof engine === 'string') {
        var Connection = require(engine);
        this.connection = new Connection(settings);
    }
    else if (typeof engine === 'object') {
        this.connection = engine;
    }
    else {
        Hoek.assert(typeof engine === 'function', 'Invalid engine configuration');
        this.connection = new engine(settings);
    }
};


internals.Client.prototype.stop = function () {

    this.connection.stop();
};


internals.Client.prototype.start = function (callback) {

    this.connection.start(callback);
};


internals.Client.prototype.isReady = function () {

    return this.connection.isReady();
};


internals.Client.prototype.validateSegmentName = function (name) {

    return this.connection.validateSegmentName(name);
};


internals.Client.prototype.get = function (key, callback) {

    var self = this;

    if (!this.connection.isReady()) {
        // Disconnected
        return callback(new Error('Disconnected'));
    }

    if (!key) {
        // null key not allowed
        return callback(null, null);
    }

    if (!key.id || !key.segment) {
        return callback(new Error('Invalid key'));
    }

    this.connection.get(key, function (err, result) {

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

        var now = Date.now();
        var expires = result.stored + result.ttl;
        var ttl = expires - now;
        if (ttl <= 0) {
            // Expired
            return callback(null, null);
        }

        // Valid

        var cached = {
            item: result.item,
            stored: result.stored,
            ttl: ttl
        };

        return callback(null, cached);
    });
};


internals.Client.prototype.set = function (key, value, ttl, callback) {

    if (!this.connection.isReady()) {
        // Disconnected
        return callback(new Error('Disconnected'));
    }

    if (!key || !key.id || !key.segment) {
        return callback(new Error('Invalid key'));
    }

    if (ttl > 2147483647) {                                                         // Math.pow(2, 31)
        return callback(new Error('Invalid ttl (greater than 2147483647)'));
    }

    if (ttl <= 0) {
        // Not cachable (or bad rules)
        return callback();
    }

    this.connection.set(key, value, ttl, callback);
};


internals.Client.prototype.drop = function (key, callback) {

    if (!this.connection.isReady()) {
        // Disconnected
        return callback(new Error('Disconnected'));
    }

    if (!key || !key.id || !key.segment) {
        return callback(new Error('Invalid key'));
    }

    this.connection.drop(key, callback);           // Always drop, regardless of caching rules
};


