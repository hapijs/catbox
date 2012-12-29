// Load modules

var Hoek = require('hoek');
var Defaults = require('./defaults');
var Stale = require('./stale');
var Memory = require('./memory');


// Declare internals

var internals = {
    day: 24 * 60 * 60 * 1000
};


exports.Client = internals.Client = function (options) {

    var self = this;

    Hoek.assert(this.constructor === internals.Client, 'Cache client must be instantiated using new');
    Hoek.assert(options, 'Missing options');
    options = Hoek.applyToDefaults(Defaults.cache(options), options);
    Hoek.assert(options.partition && options.partition.match(/^[\w\-]+$/), 'Invalid partition name:' + options.partition);

    this.settings = options;

    // Create internal connection

    var engine = self.settings.engine;
    if (typeof engine === 'object') {
        this.connection = engine;
        engine = 'extension';
    }
    else {
        var factory = null;

        if (engine === 'redis') {
            factory = require('./redis');
        }
        else if (engine === 'mongodb') {
            factory = require('./mongo');
        }
        else if (engine === 'memory') {
            factory = Memory;
        }

        Hoek.assert(factory, 'Unknown cache engine type');
        this.connection = new factory.Connection(this.settings);
    }

    this.connection.start(function (err) {

        if (err &&  self.settings.logFunc) {
            self.settings.logFunc(['cache', 'error', engine], 'Failed initializing cache engine');
        }
    });

    return this;
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


exports.Policy = internals.Policy = function (config, cache) {

    Hoek.assert(this.constructor === internals.Policy, 'Cache Policy must be instantiated using new');

    this.rule = exports.compile(config);

    if (this.isMode('server')) {
        Hoek.assert(cache, 'No cache configured for server-side caching');

        var nameErr = cache.validateSegmentName(config.segment);
        Hoek.assert(nameErr === null, 'Invalid segment name: ' + config.segment + (nameErr ? ' (' + nameErr.message + ')' : ''));

        this._cache = cache;
        this._segment = config.segment;
    }

    return this;
};


internals.Policy.prototype.isMode = function (mode) {

    return this.rule.mode[mode] === true;        // Can be undefined
};


internals.Policy.prototype.isEnabled = function () {

    return Object.keys(this.rule.mode).length > 0;
};


internals.Policy.prototype.get = function (key, callback) {

    var self = this;

    if (!this.isMode('server')) {
        return callback(null, null);
    }

    this._cache.get({ segment: this._segment, id: key }, function (err, cached) {

        if (err) {
            return callback(err);
        }

        if (cached) {
            var age = Date.now() - cached.stored;
            cached.isStale = age >= self.rule.staleIn;
        }

        return callback(null, cached);
    });
};


internals.Policy.prototype.set = function (key, value, ttl, callback) {

    if (!this.isMode('server')) {
        return callback(null);
    }

    ttl = ttl || exports.ttl(this.rule);
    this._cache.set({ segment: this._segment, id: key }, value, ttl, callback);
};


internals.Policy.prototype.drop = function (key, callback) {

    if (!this.isMode('server')) {
        return callback(null);
    }

    this._cache.drop({ segment: this._segment, id: key }, callback);
};


internals.Policy.prototype.ttl = function (created) {

    return exports.ttl(this.rule, created);
};


internals.Policy.prototype.getOrGenerate = function (key, logFunc, generateFunc, callback) {

    Stale.process(this, key, logFunc, this._segment, generateFunc, callback);
};


exports.compile = function (config) {
    /*
     *   {
     *       mode: 'server+client',
     *       expiresIn: 30000,
     *       expiresAt: '13:00',
     *       staleIn: 20000,
     *       staleTimeout: 500,
     *       segment: '/path'
     *   }
     */

    var rule = {
        mode: {}
    };

    if (!config) {
        return rule;
    }

    // Mode

    var modes = (config.mode || 'server+client').split('+');
    modes.forEach(function (mode) {

        if (mode !== 'none') {
            rule.mode[mode] = true;
        }
    });

    if (Object.keys(rule.mode).length === 0) {
        Hoek.assert(!config.expiresIn && !config.expiresAt && !config.staleIn && !config.staleTimeout, 'Cannot configure cache rules when mode is none');
        return rule;
    }

    // Validate rule

    Hoek.assert(!!config.expiresIn ^ !!config.expiresAt, 'Rule must include one of expiresIn or expiresAt but not both');                                                // XOR
    Hoek.assert(!config.expiresAt || !config.staleIn || config.staleIn < 86400000, 'staleIn must be less than 86400000 milliseconds (one day) when using expiresAt');
    Hoek.assert(!config.expiresIn || !config.staleIn || config.staleIn < config.expiresIn, 'staleIn must be less than expiresIn');
    Hoek.assert(!(!!config.staleIn ^ !!config.staleTimeout), 'Rule must include both of staleIn and staleTimeout or none');                                      // XNOR
    Hoek.assert(!config.staleTimeout || !config.expiresIn || config.staleTimeout < config.expiresIn, 'staleTimeout must be less than expiresIn');
    Hoek.assert(!config.staleTimeout || !config.expiresIn || config.staleTimeout < (config.expiresIn - config.staleIn), 'staleTimeout must be less than the delta between expiresIn and staleIn');

    // Strict mode

    rule.strict = !!config.strict;

    // Expiration

    if (config.expiresAt) {

        // expiresAt

        var time = /^(\d\d?):(\d\d)$/.exec(config.expiresAt);
        Hoek.assert(time && time.length === 3, 'Invalid time string for expiresAt: ' + config.expiresAt);

        rule.expiresAt = {
            hours: parseInt(time[1], 10),
            minutes: parseInt(time[2], 10)
        };
    }
    else {

        // expiresIn

        rule.expiresIn = config.expiresIn;
    }

    // Stale

    if (config.staleIn) {
        Hoek.assert(rule.mode.server, 'Cannot use stale options without server-side caching');
        rule.staleIn = config.staleIn;
        rule.staleTimeout = config.staleTimeout;
    }

    return rule;
};


exports.ttl = function (rule, created) {

    var now = Date.now();
    created = created || now;
    var age = now - created;

    if (age < 0) {
        return 0;                                                                   // Created in the future, assume expired/bad
    }

    if (rule.expiresIn) {
        var ttl = rule.expiresIn - age;
        return (ttl > 0 ? ttl : 0);                                                // Can be negative
    }

    if (rule.expiresAt) {
        if (created !== now &&
            now - created > internals.day) {                                        // If the item was created more than a 24 hours ago

            return 0;
        }

        var expiresAt = new Date(created);                                          // Assume everything expires in relation to now
        expiresAt.setHours(rule.expiresAt.hours);
        expiresAt.setMinutes(rule.expiresAt.minutes);
        expiresAt.setSeconds(0);

        var expiresIn = expiresAt.getTime() - created;
        if (expiresIn <= 0) {
            expiresIn += internals.day;                                             // Time passed for today, move to tomorrow
        }

        return expiresIn - age;
    }

    return 0;                                                                       // Bad rule
};