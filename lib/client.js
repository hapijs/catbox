// Load modules

var Hoek = require('hoek');
var Memory = require('./memory');


// Declare internals

var internals = {};

/*
    if (settings.engine === 'redis') {
        settings.host = settings.host || '127.0.0.1';
        settings.port = settings.port || 6379;
    }
    else if (settings.engine === 'mongodb') {
        settings.host = settings.host || '127.0.0.1';
        settings.port = settings.port || 27017;
        settings.poolSize = settings.poolSize || 5;
    }
    else if (settings.engine === 'riak') {
        settings.host = settings.host || '127.0.0.1';
        settings.port = settings.port || 8087
    }
    else if (settings.engine === 'memcache') {

        Hoek.assert(!options.location || (!options.host && !options.port), 'Cannot specify both location and host/port when using memcache');

        settings.location = settings.location || ((options.host || '127.0.0.1') + ':' + (options.port || 11211));
        delete options.port;
        delete options.host;
    }
*/


internals.defaults = {
    partition: 'catbox'
};


module.exports = internals.Client = function (engine, options, loader) {

    Hoek.assert(this.constructor === internals.Client, 'Cache client must be instantiated using new');
    Hoek.assert(engine, 'Missing catbox client engine');
    Hoek.assert(typeof engine === 'string' || !loader, 'Cannot specify loader with non string engine config');
    Hoek.assert(typeof engine !== 'object' || !options, 'Cannot specify options with object instance engine config');

    var settings = Hoek.applyToDefaults(internals.defaults, options || {});
    Hoek.assert(settings.partition.match(/^[\w\-]+$/), 'Invalid partition name:' + settings.partition);

    if (typeof engine === 'string') {
        var Connection = (engine === 'memory' ? Memory : (loader || require)(engine));
        this.connection = new Connection(settings);
    }
    else if (typeof engine === 'object') {
        this.connection = engine;
    }
    else if (typeof engine === 'function') {
        this.connection = new engine(settings);
    }

    Hoek.assert(this.connection, 'Invalid engine configuration');
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

    if (key === null) {
        // null key not allowed
        return callback(null, null);
    }

    if (!key || !key.id || !key.segment) {
        return callback(new Error('Invalid key'));
    }

    this.connection.get(key, function (err, result) {

        if (err) {
            // Connection error
            return callback(err);
        }

        if (!result ||
            !result.item) {

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


