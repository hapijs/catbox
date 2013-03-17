// Load modules

var Hoek = require('hoek');
var Stale = require('./stale');


// Declare internals

var internals = {
    day: 24 * 60 * 60 * 1000
};


module.exports = internals.Policy = function (config, cache) {

    Hoek.assert(this.constructor === internals.Policy, 'Cache Policy must be instantiated using new');

    this.rule = internals.Policy.compile(config, !!cache);

    if (cache) {
        var nameErr = cache.validateSegmentName(config.segment);
        Hoek.assert(nameErr === null, 'Invalid segment name: ' + config.segment + (nameErr ? ' (' + nameErr.message + ')' : ''));

        this._cache = cache;
        this._segment = config.segment;
    }

    return this;
};


internals.Policy.prototype.get = function (key, callback) {

    var self = this;

    if (!this._cache) {
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

    if (!this._cache) {
        return callback(null);
    }

    ttl = ttl || internals.Policy.ttl(this.rule);
    this._cache.set({ segment: this._segment, id: key }, value, ttl, callback);
};


internals.Policy.prototype.drop = function (key, callback) {

    if (!this._cache) {
        return callback(null);
    }

    this._cache.drop({ segment: this._segment, id: key }, callback);
};


internals.Policy.prototype.ttl = function (created) {

    return internals.Policy.ttl(this.rule, created);
};


internals.Policy.prototype.getOrGenerate = function (key, logFunc, generateFunc, callback) {

    Stale.process(this, key, logFunc, this._segment, generateFunc, callback);
};


internals.Policy.compile = function (config, serverSide) {
    /*
     *   {
     *       mode: -- reserved --
     *       strict: -- reserved --
     *       privacy: -- reserved --,
     *       expiresIn: 30000,
     *       expiresAt: '13:00',
     *       staleIn: 20000,
     *       staleTimeout: 500,
     *       segment: '/path'
     *   }
     */

    var rule = {};

    if (!config) {
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
        Hoek.assert(serverSide, 'Cannot use stale options without server-side caching');
        rule.staleIn = config.staleIn;
        rule.staleTimeout = config.staleTimeout;
    }

    return rule;
};


internals.Policy.ttl = function (rule, created) {

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