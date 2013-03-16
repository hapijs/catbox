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

    var setup = function (rule, genTimeout, simError, run) {

        var client = new Catbox.Client({ engine: 'memory', partition: 'test-partition' });
        var policy = new Catbox.Policy(rule, client);

        var logFunc = function () { };

        var gen = 0;
        var generateFunc = function (callback) {

            ++gen;

            setTimeout(function () {

                if (!simError || gen !== 2) {
                    return callback(null, gen);
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

    it('returns the processed cached item when using server cache mode', function (done) {

        var rule = {
            expiresIn: 100,
            staleIn: 20,
            staleTimeout: 5,
            mode: 'server',
            segment: 'test-segment'
        };

        setup(rule, 0, false, function (get) {

            get('test', function (result) {

                expect(result).to.equal(1);
                done();
            });
        });
    });

    it('returns an error when trying to use stale without server caching', function (done) {

        var rule = {
            expiresIn: 100,
            staleIn: 20,
            staleTimeout: 5,
            mode: 'client',
            segment: 'test-segment'
        };

        var fn = function () {
            setup(rule, 0, false, function () { });
        };

        expect(fn).to.throw(Error);
        done();
    });

    it('returns stale object then fresh object based on timing when calling a helper using the cache with stale config', function (done) {

        var rule = {
            expiresIn: 100,
            staleIn: 20,
            staleTimeout: 5,
            segment: 'user'
        };

        setup(rule, 6, false, function (get) {

            get('test', function (result1) {

                expect(result1).to.equal(1);        // Fresh
                setTimeout(function () {

                    get('test', function (result2) {

                        expect(result2).to.equal(1);        // Stale
                        setTimeout(function () {

                            get('test', function (result3) {

                                expect(result3).to.equal(2);        // Fresh
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

        setup(rule, 6, true, function (get) {

            get('test', function (result1) {

                expect(result1).to.equal(1);     // Fresh
                setTimeout(function () {

                    get('test', function (result2) {

                        // Generates a new one in background which will produce Error and clear the cache

                        if (result2 !== undefined) {
                            expect(result2).to.equal(1);     // Stale
                        }

                        setTimeout(function () {

                            get('test', function (result3) {

                                expect(result3).to.equal(3);     // Fresh
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

        setup(rule, 0, false, function (get) {

            get('test', function (result1) {

                expect(result1).to.equal(1);     // Fresh
                setTimeout(function () {

                    get('test', function (result2) {

                        expect(result2).to.equal(2);     // Fresh

                        setTimeout(function () {

                            get('test', function (result3) {

                                expect(result3).to.equal(2);     // Fresh
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

        setup(rule, 0, true, function (get) {

            get('test', function (result1) {

                expect(result1).to.equal(1);     // Fresh
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

    describe('#process', function () {

        it('returns errors when they occur', function (done) {

            var cache = new Memory.Connection();
            cache.isMode = function () {

                return true;
            };
            var generateFunc = function (callback) {

                callback(new Error());
            };
            var logFunc = function (tags, data) {

            };

            cache.start(function () {

                Stale.process(cache, 'test', logFunc, ['test'], generateFunc, function (err, result) {

                    expect(err).to.be.instanceOf(Error);
                    expect(result).to.not.exist;
                    done();
                });
            });
        });

        it('returns an error when cache mode is not server', function (done) {

            var cache = new Memory.Connection();
            cache.isMode = function () {

                return false;
            };
            var generateFunc = function (callback) {

                callback(new Error());
            };
            var logFunc = function (tags, data) {

            };

            cache.start(function () {

                Stale.process(cache, 'test', logFunc, ['test'], generateFunc, function (err, result) {

                    expect(err).to.be.instanceOf(Error);
                    expect(result).to.not.exist;
                    done();
                });
            });
        });

        it('logs an error when it occurs from getting the item from cache', function (done) {

            var cache = new Memory.Connection();
            cache.isMode = function () {

                return true;
            };
            cache.get = function (key, callback) {

                callback(new Error('myerror'));
            };
            var generateFunc = function (callback) {

                callback(null, 'test');
            };
            var logFunc = function (tags, data) {

                if (data && data.error) {
                    expect(data.error).to.equal('myerror');
                    done();
                }
            };

            cache.start(function () {

                Stale.process(cache, 'test', logFunc, ['test'], generateFunc, function (err, result) {
                });
            });
        });

        it('returns the item when it is found', function (done) {

            var cache = new Memory.Connection();
            cache.isMode = function () {

                return true;
            };
            cache.get = function (key, callback) {

                callback(null, { item: 'testitem' });
            };
            var generateFunc = function (callback) {

                callback(null, 'test');
            };
            var logFunc = function (tags, data) {
            };

            cache.start(function () {

                Stale.process(cache, 'test', logFunc, ['test'], generateFunc, function (err, result) {

                    expect(result.item).to.equal('testitem');
                    done();
                });
            });
        });

        it('uses the toCache function when it exists on the generateFunc result', function (done) {

            var cache = new Memory.Connection();
            cache.rule = {
                staleTimeout: 5
            };
            cache.isMode = function () {

                return true;
            };
            cache.get = function (key, callback) {

                callback(null, { item: 'testitem', isStale: true, ttl: 10 });
            };
            cache.set = function (key, value, ttl, callback) {

                expect(value).to.equal('fromToCache');
                callback(null);
            };
            var generateFunc = function (callback) {

                callback(null, {
                    toCache: function () {

                        return 'fromToCache';
                    }
                });
            };
            var logFunc = function (tags, data) {
            };

            cache.start(function () {

                Stale.process(cache, 'test', logFunc, ['test'], generateFunc, function (result) {

                    done();
                });
            });
        });

        it('doesn\'t set an item that is not set to server cache mode', function (done) {

            var cache = new Memory.Connection();
            var isSetCalled = false;

            cache.rule = {
                staleTimeout: 5
            };
            cache.isMode = function () {

                return false;
            };
            cache.get = function (key, callback) {

                callback(null, { item: 'testitem', isStale: true, ttl: 10 });
            };
            cache.set = function (key, value, ttl, callback) {

                isSetCalled = true;
                callback(null);
            };
            var generateFunc = function (callback) {

                callback(null, 'testing');
            };
            var logFunc = function (tags, data) {
            };

            cache.start(function () {

                Stale.process(cache, 'test', logFunc, ['test'], generateFunc, function (result) {

                    expect(result).to.equal('testing');
                    expect(isSetCalled).to.equal(false);
                    done();
                });
            });
        });

        it('getTtl function is used when it exists in result', function (done) {

            var cache = new Memory.Connection();
            var isGetTtlCalled = false;

            cache.rule = {
                staleTimeout: 1
            };
            cache.isMode = function () {

                return true;
            };
            cache.get = function (key, callback) {

                callback(null, { item: 'testitem', isStale: true, ttl: 10 });
            };
            var generateFunc = function (callback) {

                callback(null, {
                    getTtl: function () {

                        isGetTtlCalled = true;
                        return 2;
                    }
                });
            };
            var logFunc = function (tags, data) {
            };

            cache.start(function () {

                Stale.process(cache, 'test', logFunc, ['test'], generateFunc, function (result) {

                    expect(isGetTtlCalled).to.equal(true);
                    done();
                });
            });
        });

        it('stores fresh copy when generation takes longer than ttl to return value', function (done) {

            var cache = new Memory.Connection();
            var isGetTtlCalled = false;

            cache.rule = {
                staleTimeout: 1
            };
            cache.isMode = function () {

                return true;
            };
            cache.get = function (key, callback) {

                callback(null, { item: 'testitem', isStale: true, ttl: 3 });
            };
            cache.set = function (key) {

                expect(key).to.equal('test');
            };

            var generateFunc = function (callback) {

                setTimeout(function () {

                    callback(null, {
                        getTtl: function () {

                            isGetTtlCalled = true;
                            return 2;
                        }
                    });
                }, 10);

            };
            var logFunc = function (tags, data) {
            };

            cache.start(function () {

                Stale.process(cache, 'test', logFunc, ['test'], generateFunc, function (result) {

                    expect(result).to.equal('testitem');
                    done();
                });
            });
        });

        it('drops cached item when generation takes longer than ttl and returns an error', function (done) {

            var cache = new Memory.Connection();
            var isGetTtlCalled = false;

            cache.rule = {
                staleTimeout: 1
            };
            cache.isMode = function () {

                return true;
            };
            cache.get = function (key, callback) {

                callback(null, { item: 'testitem', isStale: true, ttl: 3 });
            };
            cache.drop = function (key, callback) {

                expect(key).to.equal('test');
                callback();
            };

            var generateFunc = function (callback) {

                setTimeout(function () {

                    callback(new Error());
                }, 10);

            };
            var logFunc = function (tags, data) {
            };

            cache.start(function () {

                Stale.process(cache, 'test', logFunc, ['test'], generateFunc, function (result) {

                    expect(result).to.equal('testitem');
                    done();
                });
            });
        });
    });
});