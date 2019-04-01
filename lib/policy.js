'use strict';

const Boom = require('@hapi/boom');
const Hoek = require('@hapi/hoek');
const Joi = require('@hapi/joi');
const Podium = require('@hapi/podium');

const Pending = require('./pending');


const internals = {
    day: 24 * 60 * 60 * 1000,
    events: Podium.validate([
        { name: 'error', channels: ['generate', 'persist'] }
    ])
};


internals.schema = Joi.object({
    expiresIn: Joi.number().integer().min(1),
    expiresAt: Joi.string().regex(/^\d\d?\:\d\d$/),
    staleIn: [
        Joi.number().integer().min(1).when('expiresAt', { is: Joi.required(), then: Joi.number().max(86400000 - 1) }),       // One day - 1 (max is inclusive)
        Joi.func()
    ],
    staleTimeout: Joi.number().integer().min(1),
    generateFunc: Joi.func(),
    generateTimeout: Joi.number().integer().min(1).allow(false),
    generateOnReadError: Joi.boolean(),
    generateIgnoreWriteError: Joi.boolean(),
    dropOnError: Joi.boolean(),
    pendingGenerateTimeout: Joi.number().integer().min(1),
    getDecoratedValue: Joi.boolean().default(false),

    // Ignored external keys (hapi)

    privacy: Joi.any(),
    cache: Joi.any(),
    segment: Joi.any(),
    shared: Joi.any()
})
    .without('expiresIn', 'expiresAt')
    .with('staleIn', 'generateFunc')
    .with('generateOnReadError', 'generateFunc')
    .with('generateIgnoreWriteError', 'generateFunc')
    .with('dropOnError', 'generateFunc')
    .and('generateFunc', 'generateTimeout')
    .and('staleIn', 'staleTimeout');


exports = module.exports = internals.Policy = class {

    constructor(options, cache, segment) {

        this._events = null;
        this._cache = cache;
        this._pendings = new Map();                       // id -> Pending
        this._pendingGenerateCall = new Map();            // id -> timer
        this.rules(options);

        this.stats = {
            sets: 0,
            gets: 0,
            hits: 0,
            stales: 0,
            generates: 0,
            errors: 0
        };

        if (cache) {
            const nameErr = cache.validateSegmentName(segment);
            Hoek.assert(nameErr === null, 'Invalid segment name: ' + segment + (nameErr ? ' (' + nameErr.message + ')' : ''));

            this._segment = segment;
        }
    }

    get events() {

        if (!this._events) {
            this._events = new Podium(internals.events);
        }

        return this._events;
    }

    _error(source, error) {

        if (!this._events) {
            return;
        }

        this._events.emit({ name: 'error', channel: source }, { source, error });
    }

    rules(options) {

        this.rule = internals.Policy.compile(options, !!this._cache);
    }

    async get(key) {     // key: string or { id: 'id' }

        ++this.stats.gets;

        // Check if request is already pending

        const id = (key && typeof key === 'object') ? key.id : key;
        let pending = this._pendings.get(id);
        if (pending !== undefined) {
            return await pending.join();
        }

        pending = new Pending(id, this.rule);
        this._pendings.set(id, pending);

        try {
            await this._get(pending, key);
        }
        catch (err) {
            this._send(pending, err);               // Safeguard to ensure that the pending rejects on any processing errors
        }

        return pending.promise;
    }

    async _get(pending, key) {

        // Prepare report

        const report = {};

        // Lookup in cache

        const timer = new Hoek.Bench();

        let cached = null;
        if (this._cache) {
            try {
                cached = await this._cache.get({ segment: this._segment, id: pending.id });
            }
            catch (err) {
                report.error = err;
                ++this.stats.errors;
                this._error('persist', err);
            }
        }

        report.msec = timer.elapsed();

        if (cached) {
            report.stored = cached.stored;
            report.ttl = cached.ttl;
            const staleIn = typeof this.rule.staleIn === 'function' ? this.rule.staleIn(cached.stored, cached.ttl) : this.rule.staleIn;
            cached.isStale = (staleIn ? (Date.now() - cached.stored) >= staleIn : false);
            report.isStale = cached.isStale;

            if (cached.isStale) {
                ++this.stats.stales;
            }
        }

        // No generate method

        if (!this.rule.generateFunc ||
            (report.error && !this.rule.generateOnReadError)) {

            this._send(pending, report.error, cached ? cached.item : null, cached, report);
            return;
        }

        // Check if found and fresh

        if (cached &&
            !cached.isStale) {

            this._send(pending, null, cached.item, cached, report);
            return;
        }

        // Wait until generated or otherwise resolved

        await Promise.race([
            pending.promise,
            this._generate(pending, key, cached, report)
        ]);
    }

    _generate(pending, key, cached, report) {

        if (cached) {                                       // Must be stale

            // Set stale timeout

            cached.ttl = cached.ttl - this.rule.staleTimeout;       // Adjust TTL for when the timeout is invoked (staleTimeout must be valid if isStale is true)
        }

        if (cached &&
            cached.ttl > 0) {

            pending.setTimeout(() => this._send(pending, null, cached.item, cached, report), this.rule.staleTimeout);
        }
        else if (this.rule.generateTimeout) {

            // Set item generation timeout (when not in cache)

            pending.setTimeout(() => this._send(pending, Boom.serverUnavailable(), null, null, report), this.rule.generateTimeout);
        }

        // Check if a generate call is already in progress

        if (this._pendingGenerateCall.has(pending.id)) {
            return;
        }

        // Generate new value

        ++this.stats.generates;                                 // Record generation before call in case it times out

        if (this.rule.pendingGenerateTimeout) {
            const timeout = setTimeout(() => this._pendingGenerateCall.delete(pending.id), this.rule.pendingGenerateTimeout);
            this._pendingGenerateCall.set(pending.id, timeout);
        }

        return this._callGenerateFunc(pending, key, cached, report);
    }

    async _callGenerateFunc(pending, key, cached, report) {

        const flags = {};

        try {
            var value = await this.rule.generateFunc(key, flags);
        }
        catch (err) {
            var generateError = err;
            this._error('generate', err);
        }

        const pendingTimeout = this._pendingGenerateCall.get(pending.id);
        if (pendingTimeout) {
            clearTimeout(pendingTimeout);
            this._pendingGenerateCall.delete(pending.id);

            pending = this._pendings.get(pending.id) || pending;                    // Fetch latest - it might have changed
        }

        // Error (if dropOnError is not set to false) or not cached

        try {
            if (flags.ttl === 0 ||                                                  // null or undefined means use policy
                (generateError && this.rule.dropOnError)) {

                await this.drop(pending.id);                                        // Invalidate cache
            }
            else if (!generateError) {
                await this.set(pending.id, value, flags.ttl);                       // Replace stale cache copy with late-coming fresh copy
            }
        }
        catch (err) {
            var persistError = err;
            this._error('persist', err);
        }

        const error = generateError || (this.rule.generateIgnoreWriteError ? null : persistError);
        if (cached &&
            error &&
            !this.rule.dropOnError) {

            this._send(pending, error, cached.item, cached, report);
            return;
        }

        this._send(pending, error, value, null, report);                            // Ignored if stale value already returned
    }

    _send(pending, err, value, cached, report) {

        pending.send(err, value, cached, report);
        this._pendings.delete(pending.id);

        if (report && report.isStale !== undefined) {
            this.stats.hits = this.stats.hits + pending.count;
        }
    }

    async set(key, value, ttl) {

        ++this.stats.sets;

        if (!this._cache) {
            return;
        }

        ttl = ttl || internals.Policy.ttl(this.rule);
        const id = (key && typeof key === 'object') ? key.id : key;

        try {
            await this._cache.set({ segment: this._segment, id }, value, ttl);
        }
        catch (err) {
            ++this.stats.errors;
            throw err;
        }
    }

    async drop(key) {

        if (!this._cache) {
            return;
        }

        const id = (key && typeof key === 'object') ? key.id : key;

        try {
            await this._cache.drop({ segment: this._segment, id });
            return;
        }
        catch (err) {
            ++this.stats.errors;
            throw err;
        }
    }

    ttl(created) {

        return internals.Policy.ttl(this.rule, created);
    }

    isReady() {

        if (!this._cache) {
            return false;
        }

        return this._cache.connection.isReady();
    }

    static compile(options, serverSide) {

        /*
            {
                expiresIn: 30000,
                expiresAt: '13:00',
                generateFunc: (id, flags) => { throw err; } / { return result; } / { flags.ttl = ttl; return result; }
                generateTimeout: 500,
                generateOnReadError: true,
                generateIgnoreWriteError: true,
                staleIn: 20000,
                staleTimeout: 500,
                dropOnError: true,
                getDecoratedValue: false
            }
         */

        const rule = {};

        if (!options ||
            !Object.keys(options).length) {

            return rule;
        }

        // Validate rule

        options = Joi.attempt(options, internals.schema, 'Invalid cache policy configuration');

        const hasExpiresIn = options.expiresIn !== undefined && options.expiresIn !== null;
        const hasExpiresAt = options.expiresAt !== undefined && options.expiresAt !== null;

        Hoek.assert(!hasExpiresIn || !options.staleIn || typeof options.staleIn === 'function' || options.staleIn < options.expiresIn, 'staleIn must be less than expiresIn');
        Hoek.assert(!options.staleIn || serverSide, 'Cannot use stale options without server-side caching');
        Hoek.assert(!options.staleTimeout || !hasExpiresIn || options.staleTimeout < options.expiresIn, 'staleTimeout must be less than expiresIn');
        Hoek.assert(!options.staleTimeout || !hasExpiresIn || typeof options.staleIn === 'function' || options.staleTimeout < (options.expiresIn - options.staleIn), 'staleTimeout must be less than the delta between expiresIn and staleIn');
        Hoek.assert(!options.staleTimeout || !options.pendingGenerateTimeout || options.staleTimeout < options.pendingGenerateTimeout, 'pendingGenerateTimeout must be greater than staleTimeout if specified');

        // Expiration

        if (hasExpiresAt) {

            // expiresAt

            const time = /^(\d\d?):(\d\d)$/.exec(options.expiresAt);
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
            rule.generateTimeout = options.generateTimeout;

            // Stale

            if (options.staleIn) {
                rule.staleIn = options.staleIn;
                rule.staleTimeout = options.staleTimeout;
            }

            rule.dropOnError = options.dropOnError !== undefined ? options.dropOnError : true;                                          // Defaults to true
            rule.pendingGenerateTimeout = options.pendingGenerateTimeout !== undefined ? options.pendingGenerateTimeout : 0;            // Defaults to zero
        }

        rule.generateOnReadError = options.generateOnReadError !== undefined ? options.generateOnReadError : true;                      // Defaults to true
        rule.generateIgnoreWriteError = options.generateIgnoreWriteError !== undefined ? options.generateIgnoreWriteError : true;       // Defaults to true

        // Decorations

        rule.getDecoratedValue = options.getDecoratedValue;

        return rule;
    }

    static ttl(rule, created, now) {

        now = now || Date.now();
        created = created || now;
        const age = now - created;

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

            const expiresAt = new Date(created);                                        // Compare expiration time on the same day
            expiresAt.setHours(rule.expiresAt.hours);
            expiresAt.setMinutes(rule.expiresAt.minutes);
            expiresAt.setSeconds(0);
            expiresAt.setMilliseconds(0);
            let expires = expiresAt.getTime();

            if (expires <= created) {
                expires = expires + internals.day;                                     // Move to tomorrow
            }

            if (now >= expires) {                                                      // Expired
                return 0;
            }

            return expires - now;
        }

        return 0;                                                                       // No rule
    }
};
