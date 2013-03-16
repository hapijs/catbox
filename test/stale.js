// Load modules

var Lab = require('lab');
var Catbox = require('..');
var Memory = require('../lib/memory');
var Stale = require('../lib/stale');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Stale', function () {

    it('bypasses cache when not configured', function (done) {

        var logFunc = function () { };
        var generateFunc = function (callback) {

            callback(null, 'new result');
        };

        Stale.process({}, 'test', logFunc, ['test'], generateFunc, function (result) {

            expect(result).to.equal('new result');
            done();
        });
    });

    var setup = function (rule, genTimeout, simError, ttl, run, broken) {

        var client = new Catbox.Client({ engine: 'memory', partition: 'test-partition' });
        if (broken) {
            client.get = function (key, callback) { callback(new Error('bad client')); };
        }

        var policy = new Catbox.Policy(rule, client);

        var logFunc = function () { };

        var gen = 0;
        var generateFunc = function (callback) {

            ++gen;

            setTimeout(function () {

                if (!simError || gen !== 2) {
                    var item = {
                        gen: gen,
                        toCache: function () { return { gen: gen }; }
                    };

                    if (ttl) {
                        item.getTtl = function () { return ttl; };
                    }

                    return callback(null, item);
                }

                return callback(new Error());
            }, genTimeout);
        };

        client.start(function () {

            run(function (key, callback) {

                policy.getOrGenerate(key, logFunc, generateFunc, callback);
            });
        });
    };

    it('returns the processed cached item', function (done) {

        var rule = {
            expiresIn: 100,
            staleIn: 20,
            staleTimeout: 5,
            segment: 'test-segment'
        };

        setup(rule, 0, false, 0, function (get) {

            get('test', function (result) {

                expect(result.gen).to.equal(1);
                done();
            });
        });
    });

    it('returns the processed cached item after cache error', function (done) {

        var rule = {
            expiresIn: 100,
            staleIn: 20,
            staleTimeout: 5,
            segment: 'test-segment'
        };

        setup(rule, 0, false, 0, function (get) {

            get('test', function (result) {

                expect(result.gen).to.equal(1);
                done();
            });
        }, true);
    });

    it('returns the processed cached item using manual ttl', function (done) {

        var rule = {
            expiresIn: 26,
            staleIn: 20,
            staleTimeout: 5,
            segment: 'test-segment'
        };

        setup(rule, 6, false, 100, function (get) {

            get('test', function (result1) {

                expect(result1.gen).to.equal(1);        // Fresh
                setTimeout(function () {

                    get('test', function (result2) {

                        expect(result2.gen).to.equal(1);        // Stale
                        done();
                    });
                }, 27);
            });
        });
    });

    it('returns stale object then fresh object based on timing when calling a helper using the cache with stale config', function (done) {

        var rule = {
            expiresIn: 100,
            staleIn: 20,
            staleTimeout: 5,
            segment: 'user'
        };

        setup(rule, 6, false, 100, function (get) {

            get('test', function (result1) {

                expect(result1.gen).to.equal(1);        // Fresh
                setTimeout(function () {

                    get('test', function (result2) {

                        expect(result2.gen).to.equal(1);        // Stale
                        setTimeout(function () {

                            get('test', function (result3) {

                                expect(result3.gen).to.equal(2);        // Fresh
                                done();
                            });
                        }, 3);
                    });
                }, 21);
            });
        });
    });

    it('returns stale object then invalidate cache on error when calling a helper using the cache with stale config', function (done) {

        var rule = {
            expiresIn: 100,
            staleIn: 20,
            staleTimeout: 5,
            segment: 'user'
        };

        setup(rule, 6, true, 0, function (get) {

            get('test', function (result1) {

                expect(result1.gen).to.equal(1);     // Fresh
                setTimeout(function () {

                    get('test', function (result2) {

                        // Generates a new one in background which will produce Error and clear the cache

                        expect(result2.gen).to.equal(1);     // Stale
                        setTimeout(function () {

                            get('test', function (result3) {

                                expect(result3.gen).to.equal(3);     // Fresh
                                done();
                            });
                        }, 3);
                    });
                }, 21);
            });
        });
    });

    it('returns fresh object calling a helper using the cache with stale config', function (done) {

        var rule = {
            expiresIn: 100,
            staleIn: 20,
            staleTimeout: 10,
            segment: 'user'
        };

        setup(rule, 0, false, 0, function (get) {

            get('test', function (result1) {

                expect(result1.gen).to.equal(1);     // Fresh
                setTimeout(function () {

                    get('test', function (result2) {

                        expect(result2.gen).to.equal(2);     // Fresh

                        setTimeout(function () {

                            get('test', function (result3) {

                                expect(result3.gen).to.equal(2);     // Fresh
                                done();
                            });
                        }, 1);
                    });
                }, 21);
            });
        });
    });

    it('returns error when calling a helper using the cache with stale config when arrives within stale timeout', function (done) {

        var rule = {
            expiresIn: 30,
            staleIn: 20,
            staleTimeout: 5,
            segment: 'user'
        };

        setup(rule, 0, true, 0, function (get) {

            get('test', function (result1) {

                expect(result1.gen).to.equal(1);     // Fresh
                setTimeout(function () {

                    get('test', function (result2) {

                        // Generates a new one which will produce Error

                        expect(result2).to.be.instanceof(Error);     // Stale
                        done();
                    });
                }, 21);
            });
        });
    });

    it('uses result toCache() when available', function (done) {
        done();
    });
});
