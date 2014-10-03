// Load modules

var Hoek = require('hoek');
var Boom = require('boom');


// Declare internals

var internals = {
    day: 24 * 60 * 60 * 1000
};


exports = module.exports = internals.Policy = function (options, cache, segment) {

    Hoek.assert(this.constructor === internals.Policy, 'Cache Policy must be instantiated using new');

    this.rule = internals.Policy.compile(options, !!cache);
    this._pendings = {};                                        // id -> [callbacks]

    if (cache) {
        var nameErr = cache.validateSegmentName(segment);
        Hoek.assert(nameErr === null, 'Invalid segment name: ' + segment + (nameErr ? ' (' + nameErr.message + ')' : ''));

        this._cache = cache;
        this._segment = segment;
    }
};


internals.Policy.prototype.get = function (key, callback, _generateFunc) {     // key: string or { id: 'id' }

    var self = this;

    // Check if request is already pending

    var id = (key && typeof key === 'object') ? key.id : key;
    if (this._pendings[id]) {
        this._pendings[id].push(callback);
        return;
    }

    this._pendings[id] = [callback];

    // Lookup in cache

    var timer = new Hoek.Timer();
    this._get(id, function (err, cached) {

        if (cached) {
            cached.isStale = (self.rule.staleIn ? (Date.now() - cached.stored) >= self.rule.staleIn : false);
        }

        // No generate method

        if (!self.rule.generateFunc &&
            !_generateFunc) {

            return self._finalize(id, err, cached);             // Pass 'cached' as 'value' and omit other arguments for backwards compatibility
        }

        // Error / Not found

        if (err || !cached) {
            return self._generate(id, key, null, { msec: timer.elapsed(), error: err }, callback, _generateFunc);
        }

        // Found

        var report = {
            msec: timer.elapsed(),
            stored: cached.stored,
            ttl: cached.ttl,
            isStale: cached.isStale
        };

        // Check if found and fresh

        if (!cached.isStale) {
            return self._finalize(id, null, cached.item, cached, report);
        }

        return self._generate(id, key, cached, report, callback, _generateFunc);
    });
};


internals.Policy.prototype._get = function (id, callback) {

    if (!this._cache) {
        return Hoek.nextTick(callback)(null, null);
    }

    this._cache.get({ segment: this._segment, id: id }, callback);
};


internals.Policy.prototype._generate = function (id, key, cached, report, callback, _generateFunc) {

    var self = this;

    var finalize = Hoek.once(function (id, err, value, cached, report) {

        return self._finalize(id, err, value, cached, report);
    });

    if (cached &&
        cached.isStale) {

        // Set stale timeout

        cached.ttl -= this.rule.staleTimeout;           // Adjust TTL for when the timeout is invoked (staleTimeout must be valid if isStale is true)
        if (cached.ttl > 0) {
            setTimeout(function () {

                return finalize(id, null, cached.item, cached, report);
            }, this.rule.staleTimeout);
        }
    }
    else if (this.rule.generateTimeout) {

        // Set item generation timeout (when not in cache)

        setTimeout(function () {

            return finalize(id, Boom.serverTimeout(), null, null, report);
        }, this.rule.generateTimeout);
    }

    // Generate new value

    try {
        (this.rule.generateFunc || _generateFunc).call(null, key, function (err, value, ttl) {

            // Error or not cached

            if (err ||
                ttl === 0) {                                // null or undefined means use policy

                self.drop(id);                              // Invalidate cache
            }
            else {
                self.set(id, value, ttl);                   // Lazy save (replaces stale cache copy with late-coming fresh copy)
            }

            return finalize(id, err, value, null, report);      // Ignored if stale value already returned
        });
    }
    catch (err) {
        return finalize(id, err, null, null, report);
    }
};


internals.Policy.prototype._finalize = function (id, err, value, cached, report) {

    var pendings = this._pendings[id];
    delete this._pendings[id];

    for (var i = 0, il = pendings.length; i < il; ++i) {
        Hoek.nextTick(pendings[i])(err, value, cached, report);
    }
};


internals.Policy.prototype.getOrGenerate = function (id, generateFunc, callback) {       // For backwards compatibility

    var self = this;

    var generateFuncWrapper = function (id, next) {

        return generateFunc(next);
    };

    return this.get(id, callback, generateFuncWrapper);
};


internals.Policy.prototype.set = function (key, value, ttl, callback) {

    callback = callback || Hoek.ignore;

    if (!this._cache) {
        return callback(null);
    }

    ttl = ttl || internals.Policy.ttl(this.rule);
    var id = (key && typeof key === 'object') ? key.id : key;
    this._cache.set({ segment: this._segment, id: id }, value, ttl, callback);
};


internals.Policy.prototype.drop = function (id, callback) {

    callback = callback || Hoek.ignore;

    if (!this._cache) {
        return callback(null);
    }

    this._cache.drop({ segment: this._segment, id: id }, callback);
};


internals.Policy.prototype.ttl = function (created) {

    return internals.Policy.ttl(this.rule, created);
};


internals.Policy.compile = function (options, serverSide) {
    /*
        {
            expiresIn: 30000,
            expiresAt: '13:00',

            generateFunc: function (id, next) { next(err, result, ttl); }
            generateTimeout: 500,
            staleIn: 20000,
            staleTimeout: 500
        }
     */

    var rule = {};

    if (!options ||
        !Object.keys(options).length) {

        return rule;
    }

    // Validate rule

    var hasExpiresIn = options.expiresIn !== undefined && options.expiresIn !== null;
    var hasExpiresAt = options.expiresAt !== undefined && options.expiresAt !== null;

    Hoek.assert(!hasExpiresAt || typeof options.expiresAt === 'string', 'expiresAt must be a string', options);
    Hoek.assert(!hasExpiresIn || Hoek.isInteger(options.expiresIn), 'expiresIn must be an integer', options);
    Hoek.assert(!hasExpiresIn || !hasExpiresAt, 'Rule cannot include both expiresIn and expiresAt', options);                                                // XOR
    Hoek.assert(!hasExpiresAt || !options.staleIn || options.staleIn < 86400000, 'staleIn must be less than 86400000 milliseconds (one day) when using expiresAt');
    Hoek.assert(!hasExpiresIn || !options.staleIn || options.staleIn < options.expiresIn, 'staleIn must be less than expiresIn');
    Hoek.assert(!options.staleIn || serverSide, 'Cannot use stale options without server-side caching');
    Hoek.assert(!(!!options.staleIn ^ !!options.staleTimeout), 'Rule must include both of staleIn and staleTimeout or none');                                                       // XNOR
    Hoek.assert(!options.staleTimeout || !hasExpiresIn || options.staleTimeout < options.expiresIn, 'staleTimeout must be less than expiresIn');
    Hoek.assert(!options.staleTimeout || !hasExpiresIn || options.staleTimeout < (options.expiresIn - options.staleIn), 'staleTimeout must be less than the delta between expiresIn and staleIn');
    // Hoek.assert(options.generateFunc || !options.generateTimeout, 'Rule cannot include generateTimeout without generateFunc');   // Disabled for backwards compatibility
    Hoek.assert(!options.generateFunc || typeof options.generateFunc === 'function', 'generateFunc must be a function');

    // Expiration

    if (hasExpiresAt) {

        // expiresAt

        var time = /^(\d\d?):(\d\d)$/.exec(options.expiresAt);
        Hoek.assert(time && time.length === 3, 'Invalid time string for expiresAt: ' + options.expiresAt);

        rule.expiresAt = {
            hours: parseInt(time[1], 10),
            minutes: parseInt(time[2], 10)
        };
    }
    else {

        // expiresIn

        rule.expiresIn = options.expiresIn || 0;
    }

    // generateTimeout

    if (options.generateFunc) {
        rule.generateFunc = options.generateFunc;
    }

    if (options.generateTimeout) {                              // Keep outside options.generateFunc condition for backwards compatibility
        rule.generateTimeout = options.generateTimeout;
    }

    // Stale

    if (options.staleIn) {                                      // Keep outside options.generateFunc condition for backwards compatibility
        rule.staleIn = options.staleIn;
        rule.staleTimeout = options.staleTimeout;
    }

    return rule;
};


internals.Policy.ttl = function (rule, created, now) {

    now = now || Date.now();
    created = created || now;
    var age = now - created;

    if (age < 0) {
        return 0;                                                                   // Created in the future, assume expired/bad
    }

    if (rule.expiresIn) {
        return Math.max(rule.expiresIn - age, 0);
    }

    if (rule.expiresAt) {
        if (age > internals.day) {                                                  // If the item was created more than a 24 hours ago
            return 0;
        }

        var expiresAt = new Date(created);                                          // Compare expiration time on the same day
        expiresAt.setHours(rule.expiresAt.hours);
        expiresAt.setMinutes(rule.expiresAt.minutes);
        expiresAt.setSeconds(0);
        expiresAt.setMilliseconds(0);
        var expires = expiresAt.getTime();

        if (expires <= created) {
            expires += internals.day;                                               // Move to tomorrow
        }

        if (now >= expires) {                                                       // Expired
            return 0;
        }

        return expires - now;
    }

    return 0;                                                                       // No rule
};
