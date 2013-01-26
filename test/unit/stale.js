// Load modules

var Chai = require('chai');
var Helpers = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;
var Cache = Helpers.Catbox;


describe('Stale', function () {

    it('returns the processed cached item when using server cache mode', function (done) {

        var options = {
            engine: 'memory',
            partition: 'test-partition'
        };
        var rule = {
            expiresIn: 100,
            staleIn: 20,
            staleTimeout: 5,
            mode: 'server',
            segment: 'test-segment'
        };
        var key = {
            id: 'test' + Math.random(),
            segment: 'test-segment'
        };
        var logFunc = function (text) {

        };
        var generateFunc = function (callback) {

            callback(null, 'hello');
        };

        var client = new Cache.Client(options);
        var policy = new Cache.Policy(rule, client);

        policy.getOrGenerate(key, logFunc, generateFunc, function (result) {

            expect(result).to.equal('hello');
            done();
        });
    });

    it('returns an error when trying to use stale without server caching', function (done) {

        var options = {
            engine: 'memory',
            partition: 'test-partition'
        };
        var rule = {
            expiresIn: 100,
            staleIn: 20,
            staleTimeout: 5,
            mode: 'client',
            segment: 'test-segment'
        };

        var fn = function() {
            var client = new Cache.Client(options);
            var policy = new Cache.Policy(rule, client);
        };

        expect(fn).to.throw(Error);
        done();
    });

    describe('#process', function () {

        it('returns errors when they occur', function (done) {

            var key = { id: 'test', segment: 'test' };
            var cache = new Cache.Memory.Connection();
            cache.isMode = function () {

                return true;
            };
            var generateFunc = function (callback) {

                callback(new Error());
            };
            var logFunc = function (tags, data) {

            };

            cache.start(function () {

                Cache.Stale.process(cache, key, logFunc, ['test'], generateFunc, function (err, result) {

                    expect(err).to.be.instanceOf(Error);
                    expect(result).to.not.exist;
                    done();
                });
            });
        });

        it('returns an error when cache mode is not server', function (done) {

            var key = { id: 'test', segment: 'test' };
            var cache = new Cache.Memory.Connection();
            cache.isMode = function () {

                return false;
            };
            var generateFunc = function (callback) {

                callback(new Error());
            };
            var logFunc = function (tags, data) {

            };

            cache.start(function () {

                Cache.Stale.process(cache, key, logFunc, ['test'], generateFunc, function (err, result) {

                    expect(err).to.be.instanceOf(Error);
                    expect(result).to.not.exist;
                    done();
                });
            });
        });

        it('logs an error when it occurs from getting the item from cache', function (done) {

            var key = { id: 'test', segment: 'test' };
            var cache = new Cache.Memory.Connection();
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

                Cache.Stale.process(cache, key, logFunc, ['test'], generateFunc, function (err, result) {
                });
            });
        });

        it('returns the item when it is found', function (done) {

            var key = { id: 'test', segment: 'test' };
            var cache = new Cache.Memory.Connection();
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

                Cache.Stale.process(cache, key, logFunc, ['test'], generateFunc, function (err, result) {

                    expect(result.item).to.equal('testitem');
                    done();
                });
            });
        });

        it('uses the toCache function when it exists on the generateFunc result', function (done) {

            var key = { id: 'test', segment: 'test' };
            var cache = new Cache.Memory.Connection();
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

                callback(null, { toCache: function () {

                    return 'fromToCache';
                }});
            };
            var logFunc = function (tags, data) {
            };

            cache.start(function () {

                Cache.Stale.process(cache, key, logFunc, ['test'], generateFunc, function (result) {

                    done();
                });
            });
        });

        it('doesn\'t set an item that is not set to server cache mode', function (done) {

            var key = { id: 'test', segment: 'test' };
            var cache = new Cache.Memory.Connection();
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

                Cache.Stale.process(cache, key, logFunc, ['test'], generateFunc, function (result) {

                    expect(result).to.equal('testing');
                    expect(isSetCalled).to.equal(false);
                    done();
                });
            });
        });

        it('getTtl function is used when it exists in result', function (done) {

            var key = { id: 'test', segment: 'test' };
            var cache = new Cache.Memory.Connection();
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

                callback(null, { getTtl: function () {

                    isGetTtlCalled = true;
                    return 2;
                }});
            };
            var logFunc = function (tags, data) {
            };

            cache.start(function () {

                Cache.Stale.process(cache, key, logFunc, ['test'], generateFunc, function (result) {

                    expect(isGetTtlCalled).to.equal(true);
                    done();
                });
            });
        });

        it('stores fresh copy when generation takes longer than ttl to return value', function (done) {

            var key = { id: 'test', segment: 'test' };
            var cache = new Cache.Memory.Connection();
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

                expect(key.id).to.equal('test');
            };

            var generateFunc = function (callback) {

                setTimeout(function () {

                    callback(null, { getTtl: function () {

                        isGetTtlCalled = true;
                        return 2;
                    }});
                }, 10);

            };
            var logFunc = function (tags, data) {
            };

            cache.start(function () {

                Cache.Stale.process(cache, key, logFunc, ['test'], generateFunc, function (result) {

                    expect(result).to.equal('testitem');
                    done();
                });
            });
        });

        it('drops cached item when generation takes longer than ttl and returns an error', function (done) {

            var key = { id: 'test', segment: 'test' };
            var cache = new Cache.Memory.Connection();
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

                expect(key.id).to.equal('test');
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

                Cache.Stale.process(cache, key, logFunc, ['test'], generateFunc, function (result) {

                    expect(result).to.equal('testitem');
                    done();
                });
            });
        });
    });
});