// Load modules

var Chai = require('chai');
var Helpers = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;
var Cache = Helpers.Catbox;


describe('Cache', function () {

    var key = { id: 'x', segment: 'test' };
    var engines = {
        memory: true
    };

    before(function (done) {

        var bothCalled = false;
        Helpers.redisPortInUse(function (useRedis) {

            engines.redis = useRedis;
            if (bothCalled) {
                done();
            }
            else {
                bothCalled = true;
            }
        });

        Helpers.mongoPortInUse(function (useMongo) {

            engines.mongodb = useMongo;
            if (bothCalled) {
                done();
            }
            else {
                bothCalled = true;
            }
        });
    });

    setTimeout(function () {

        describe('Client', function () {

            it('throws an error if using an unknown engine type', function (done) {

                var fn = function () {
                    var options = {
                        engine: 'bob'
                    };

                    var client = new Cache.Client(options);
                };

                expect(fn).to.throw(Error);
                done();
            });

            it('doesn\'t initialize client when engine is none', function (done) {

                var fn = function () {
                    var client = new Cache.Client('none');
                };

                expect(fn).to.throw(Error);
                done();
            });

            var testEngine = function (engine) {

                if (!engines[engine]) {
                    return;
                }

                var clientStart = function (next) {

                    var client = new Cache.Client(engine);
                    client.start(function (err) {

                        next(err, client);
                    });
                };

                it('creates a new connection using ' + engine, function (done) {

                    clientStart(function (err, client) {

                        expect(client.isReady()).to.equal(true);
                        done();
                    });
                });

                it('closes the connection using ' + engine, function (done) {

                    clientStart(function (err, client) {

                        expect(client.isReady()).to.equal(true);
                        client.stop();
                        expect(client.isReady()).to.equal(false);
                        done();
                    });
                });

                it('ignored starting a connection twice on same event using ' + engine, function (done) {

                    var client = new Cache.Client(engine);
                    var x = 2;
                    var start = function () {

                        client.start(function (err) {

                            expect(client.isReady()).to.equal(true);
                            --x;
                            if (!x) {
                                done();
                            }
                        });
                    };

                    start();
                    start();
                });

                it('ignored starting a connection twice chained using ' + engine, function (done) {

                    clientStart(function (err, client) {

                        expect(err).to.not.exist;
                        expect(client.isReady()).to.equal(true);

                        client.start(function (err) {

                            expect(err).to.not.exist;
                            expect(client.isReady()).to.equal(true);
                            done();
                        });
                    });
                });

                it('returns not found on get when using null key using ' + engine, function (done) {

                    clientStart(function (err, client) {

                        client.get(null, function (err, result) {

                            expect(err).to.equal(null);
                            expect(result).to.equal(null);
                            done();
                        });
                    });
                });

                it('returns not found on get when item expired using ' + engine, function (done) {

                    clientStart(function (err, client) {

                        client.set(key, 'x', 1, function (err) {

                            expect(err).to.not.exist;
                            setTimeout(function () {

                                client.get(key, function (err, result) {

                                    expect(err).to.equal(null);
                                    expect(result).to.equal(null);
                                    done();
                                });
                            }, 2);
                        });
                    });
                });

                it('returns error on set when using null key using ' + engine, function (done) {

                    clientStart(function (err, client) {

                        client.set(null, {}, 1000, function (err) {

                            expect(err instanceof Error).to.equal(true);
                            done();
                        });
                    });
                });

                it('returns error on get when using invalid key using ' + engine, function (done) {

                    clientStart(function (err, client) {

                        client.get({}, function (err) {

                            expect(err instanceof Error).to.equal(true);
                            done();
                        });
                    });
                });

                it('returns error on drop when using invalid key using ' + engine, function (done) {

                    clientStart(function (err, client) {

                        client.drop({}, function (err) {

                            expect(err instanceof Error).to.equal(true);
                            done();
                        });
                    });
                });

                it('returns error on set when using invalid key using ' + engine, function (done) {

                    clientStart(function (err, client) {

                        client.set({}, {}, 1000, function (err) {

                            expect(err instanceof Error).to.equal(true);
                            done();
                        });
                    });
                });

                it('ignores set when using non-positive ttl value using ' + engine, function (done) {

                    clientStart(function (err, client) {

                        client.set(key, 'y', 0, function (err) {

                            expect(err).to.not.exist;
                            done();
                        });
                    });
                });

                it('returns error on drop when using null key using ' + engine, function (done) {

                    clientStart(function (err, client) {

                        client.drop(null, function (err) {

                            expect(err instanceof Error).to.equal(true);
                            done();
                        });
                    });
                });

                it('returns error on get when stopped using ' + engine, function (done) {

                    var client = new Cache.Client(engine);
                    client.stop();
                    client.connection.get(key, function (err, result) {

                        expect(err).to.exist;
                        expect(result).to.not.exist;
                        done();
                    });
                });

                it('returns error on set when stopped using ' + engine, function (done) {

                    var client = new Cache.Client(engine);
                    client.stop();
                    client.connection.set(key, 'y', 1, function (err) {

                        expect(err).to.exist;
                        done();
                    });
                });

                it('returns error on drop when stopped using ' + engine, function (done) {

                    var client = new Cache.Client(engine);
                    client.stop();
                    client.connection.drop(key, function (err) {

                        expect(err).to.exist;
                        done();
                    });
                });

                it('returns error on missing segment name using ' + engine, function (done) {

                    var config = {
                        expiresIn: 50000,
                        segment: ''
                    };
                    var fn = function () {
                        var client = new Cache.Client(engine);
                        var cache = new Cache.Policy(config, client);
                    };
                    expect(fn).to.throw(Error);
                    done();
                });

                it('returns error on bad segment name using ' + engine, function (done) {

                    var config = {
                        expiresIn: 50000,
                        segment: 'a\0b'
                    };
                    var fn = function () {
                        var client = new Cache.Client(engine);
                        var cache = new Cache.Policy(config, client);
                    };
                    expect(fn).to.throw(Error);
                    done();
                });

                it('returns error when cache item dropped while stopped using ' + engine, function (done) {

                    var client = new Cache.Client(engine);
                    client.stop();
                    client.drop('a', function (err) {

                        expect(err).to.exist;
                        done();
                    });
                });
            };

            testEngine('memory');
            testEngine('mongodb');
            testEngine('redis');

            // Error engine

            var failOn = function (method) {

                var err = new Error('FAIL');
                var errorEngineImp = {

                    start: function (callback) { callback(method === 'start' ? err : null); },
                    stop: function () { },
                    isReady: function () { return method !== 'isReady'; },
                    validateSegmentName: function () { return method === 'validateSegmentName' ? err : null; },
                    get: function (key, callback) { return callback(method === 'get' ? err : null); },
                    set: function (key, value, ttl, callback) { return callback(method === 'set' ? err : null); },
                    drop: function (key, callback) { return callback(method === 'drop' ? err : null); }
                };

                var options = {
                    engine: errorEngineImp,
                    partition: 'hapi-cache'
                };

                return new Cache.Client(options);
            };

            it('returns error when calling get on a bad connection', function (done) {

                var client = failOn('get');
                client.get(key, function (err, result) {

                    expect(err).to.exist;
                    expect(err.message).to.equal('FAIL');
                    done();
                });
            });
        });
    }, 15);

    describe('Policy', function () {

        var getCache = function (callback) {

            var config = {
                mode: 'client',
                expiresIn: 1
            };
            var client = new Cache.Client('memory');

            client.start(function () {

                var cache = new Cache.Policy(config, client);
                callback(cache);
            });
        };

        it('returns null on get when cache mode is not server', function (done) {

            getCache(function (cache) {

                cache.get(key, function (err, result) {

                    expect(err).to.not.exist;
                    expect(result).to.not.exist;
                    done();
                });
            });
        });

        it('returns null on set when cache mode is not server', function (done) {

            getCache(function (cache) {

                cache.set(key, 'y', 100, function (err) {

                    expect(err).to.not.exist;
                    done();
                });
            });
        });

        it('returns null on drop when cache mode is not server', function (done) {

            getCache(function (cache) {

                cache.drop(key, function (err) {

                    expect(err).to.not.exist;
                    done();
                });
            });
        });

        it('returns null on get when item expired', function (done) {

            var client = new Cache.Client('memory');
            client.start(function () {

                client.set(key, 'y', 1, function (err) {

                    setTimeout(function () {

                        client.get(key, function (err, result) {

                            expect(err).to.not.exist;
                            expect(result).to.not.exist;
                            done();
                        });
                    }, 2);
                });
            });
        });

        describe('#get', function () {

            it('passes an error to the callback when an error occurs getting the item', function (done) {

                var options = {
                    partition: 'test',
                    engine: {
                        start: function (callback) {

                            callback();
                        },
                        isReady: function () {

                            return true;
                        },
                        get: function (key, callback) {

                            callback(new Error());
                        },
                        validateSegmentName: function() {

                            return null;
                        }
                    }
                };
                var policyConfig = {
                    expiresIn: 50000,
                    segment: 'test',
                    mode: 'server'
                };

                var client = new Cache.Client(options);
                var policy = new Cache.Policy(policyConfig, client);

                policy.get({ id: 'test1', segment: 'test2' }, function (err, result) {

                    expect(err).to.be.instanceOf(Error);
                    expect(result).to.not.exist;
                    done();
                });
            });

            it('returns the cached result when no error occurs', function (done) {

                var options = {
                    partition: 'test',
                    engine: {
                        start: function (callback) {

                            callback();
                        },
                        isReady: function () {

                            return true;
                        },
                        get: function (key, callback) {

                            callback(null, {
                                stored: 'stored',
                                item: 'item'
                            });
                        },
                        validateSegmentName: function() {

                            return null;
                        }
                    }
                };
                var policyConfig = {
                    expiresIn: 50000,
                    segment: 'test',
                    mode: 'server'
                };

                var client = new Cache.Client(options);
                var policy = new Cache.Policy(policyConfig, client);

                policy.get({ id: 'test1', segment: 'test2' }, function (err, result) {

                    expect(result.item).to.equal('item');
                    expect(result.isStale).to.be.false;
                    done();
                });
            });
        });

        describe('#drop', function () {

            it('calls the extension clients drop function', function (done) {

                var options = {
                    partition: 'test',
                    engine: {
                        start: function (callback) {

                            callback();
                        },
                        isReady: function () {

                            return true;
                        },
                        drop: function (key, callback) {

                            callback(null, 'success');
                        },
                        validateSegmentName: function() {

                            return null;
                        }
                    }
                };

                var policyConfig = {
                    expiresIn: 50000,
                    segment: 'test',
                    mode: 'server'
                };

                var client = new Cache.Client(options);
                var policy = new Cache.Policy(policyConfig, client);

                policy.drop('test', function (err, result) {

                    expect(result).to.equal('success');
                    done();
                });
            });
        });

        describe('#ttl', function () {

            it('returns the ttl factoring in the created time', function (done) {

                var options = {
                    partition: 'test',
                    engine: {
                        start: function (callback) {

                            callback();
                        },
                        isReady: function () {

                            return true;
                        },
                        validateSegmentName: function() {

                            return null;
                        }
                    }
                };

                var policyConfig = {
                    expiresIn: 50000,
                    segment: 'test',
                    mode: 'server'
                };

                var client = new Cache.Client(options);
                var policy = new Cache.Policy(policyConfig, client);

                var result = policy.ttl(Date.now() - 10000);
                expect(result).to.be.within(39999, 40001);                    // There can occassionally be a 1ms difference
                done();
            });
        });
    });

    describe('Rules', function () {

        describe('#compile', function () {

            it('doesn\'t try to compile a null config', function (done) {

                var rule = Cache.compile(null);

                expect(rule).exist;
                expect(rule.mode.length).to.not.exist;

                done();
            });

            it('compiles a single rule', function (done) {

                var config = {
                    expiresIn: 50000
                };
                var rule = Cache.compile(config);

                expect(rule.expiresIn).to.equal(config.expiresIn);

                done();
            });

            it('is enabled for both client and server by defaults', function (done) {

                var config = {
                    expiresIn: 50000,
                    segment: 'test'
                };
                var client = new Cache.Client('memory');
                var cache = new Cache.Policy(config, client);

                expect(cache.isMode('server')).to.equal(true);
                expect(cache.isMode('client')).to.equal(true);
                expect(Object.keys(cache.rule.mode).length).to.equal(2);

                done();
            });

            it('is disabled when mode is none', function (done) {

                var config = {
                    mode: 'none'
                };
                var client = new Cache.Client('memory');
                var cache = new Cache.Policy(config, client);

                expect(cache.isEnabled()).to.equal(false);
                expect(Object.keys(cache.rule.mode).length).to.equal(0);

                done();
            });

            it('throws an error when mode is none and config has other options set', function (done) {

                var config = {
                    mode: 'none',
                    expiresIn: 50000
                };
                var fn = function () {

                    var cache = new Cache.Policy(config, {});
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when segment is missing', function (done) {

                var config = {
                    expiresIn: 50000
                };
                var fn = function () {

                    var client = new Cache.Client('memory');
                    var cache = new Cache.Policy(config, client);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('assigns the expiresIn when the rule is cached', function (done) {

                var config = {
                    expiresIn: 50000
                };
                var rule = Cache.compile(config);

                expect(rule.expiresIn).to.equal(config.expiresIn);

                done();
            });

            it('throws an error when parsing a rule with both expiresAt and expiresIn', function (done) {

                var config = {
                    expiresAt: 50,
                    expiresIn: '02:00'
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when parsing a rule with niether expiresAt or expiresIn', function (done) {

                var config = {
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when parsing a bad expiresAt value', function (done) {

                var config = {
                    expiresAt: function () { }
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when staleIn is used without staleTimeout', function (done) {

                var config = {
                    expiresAt: '03:00',
                    staleIn: 1000000
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when staleTimeout is used without staleIn', function (done) {

                var config = {
                    expiresAt: '03:00',
                    staleTimeout: 100
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when staleIn is greater than a day and using expiresAt', function (done) {

                var config = {
                    expiresAt: '03:00',
                    staleIn: 100000000,
                    staleTimeout: 500
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when staleIn is greater than expiresIn', function (done) {

                var config = {
                    expiresIn: 500000,
                    staleIn: 1000000,
                    staleTimeout: 500
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when staleTimeout is greater than expiresIn', function (done) {

                var config = {
                    expiresIn: 500000,
                    staleIn: 100000,
                    staleTimeout: 500000
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when staleTimeout is greater than expiresIn - staleIn', function (done) {

                var config = {
                    expiresIn: 30000,
                    staleIn: 20000,
                    staleTimeout: 10000
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when staleTimeout is used without server mode', function (done) {

                var config = {
                    mode: 'client',
                    expiresIn: 1000000,
                    staleIn: 500000,
                    staleTimeout: 500
                };
                var fn = function () {

                    var cache = new Cache.Policy(config, {});
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('returns rule when staleIn is less than expiresIn', function (done) {

                var config = {
                    expiresIn: 1000000,
                    staleIn: 500000,
                    staleTimeout: 500
                };
                var rule = Cache.compile(config);

                expect(rule.staleIn).to.equal(500 * 1000);
                expect(rule.expiresIn).to.equal(1000 * 1000);

                done();
            });

            it('returns rule when staleIn is less than 24 hours and using expiresAt', function (done) {

                var config = {
                    expiresAt: '03:00',
                    staleIn: 5000000,
                    staleTimeout: 500
                };
                var rule = Cache.compile(config);

                expect(rule.staleIn).to.equal(5000 * 1000);

                done();
            });

            it('throws an error if has only staleTimeout or staleIn', function (done) {

                var config = {
                    mode: 'server',
                    staleIn: 30000,
                    expiresIn: 60000
                };

                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);
                done();
            });

            it('doesn\'t throw an error if has both staleTimeout and staleIn', function (done) {

                var config = {
                    mode: 'server',
                    staleIn: 30000,
                    staleTimeout: 300,
                    expiresIn: 60000
                };

                var fn = function () {

                    Cache.compile(config);
                };
                expect(fn).to.not.throw(Error);
                done();
            });

            it('throws an error if trying to use stale caching on the client', function (done) {

                var config = {
                    mode: 'client',
                    staleIn: 30000,
                    expiresIn: 60000,
                    staleTimeout: 300
                };

                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);
                done();
            });

            it('converts the stale time to ms', function (done) {

                var config = {
                    mode: 'server+client',
                    staleIn: 30000,
                    expiresIn: 60000,
                    staleTimeout: 300
                };

                var rule = Cache.compile(config);

                expect(rule.staleIn).to.equal(config.staleIn);
                done();
            });

            it('throws an error if staleTimeout is greater than expiresIn', function (done) {

                var config = {
                    mode: 'client',
                    staleIn: 2000,
                    expiresIn: 1000,
                    staleTimeout: 3000
                };

                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);
                done();
            });

            it('throws an error if staleIn is greater than expiresIn', function (done) {

                var config = {
                    mode: 'client',
                    staleIn: 1000000,
                    expiresIn: 60000,
                    staleTimeout: 30
                };

                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);
                done();
            });
        });

        describe('#ttl', function () {

            it('returns zero when a rule is expired', function (done) {

                var config = {
                    expiresIn: 50000
                };
                var rule = Cache.compile(config);
                var created = new Date(Date.now());
                created = created.setMinutes(created.getMinutes() - 5);

                var ttl = Cache.ttl(rule, created);
                expect(ttl).to.be.equal(0);
                done();
            });

            it('returns a positive number when a rule is not expired', function (done) {

                var config = {
                    expiresIn: 50000
                };
                var rule = Cache.compile(config);
                var created = new Date(Date.now());

                var ttl = Cache.ttl(rule, created);
                expect(ttl).to.be.greaterThan(0);
                done();
            });

            it('returns the correct expires time when no created time is provided', function (done) {

                var config = {
                    expiresIn: 50000
                };
                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule);
                expect(ttl).to.equal(50000);
                done();
            });

            it('returns 0 when created several days ago and expiresAt is used', function (done) {

                var config = {
                    expiresAt: '13:00'
                };
                var created = Date.now() - 313200000;                                       // 87 hours (3 days + 15 hours)
                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule, created);
                expect(ttl).to.equal(0);
                done();
            });

            it('returns 0 when created in the future', function (done) {

                var config = {
                    expiresIn: '100'
                };
                var created = Date.now() + 1000;
                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule, created);
                expect(ttl).to.equal(0);
                done();
            });

            it('returns 0 for bad rule', function (done) {

                var created = Date.now() - 1000;
                var ttl = Cache.ttl({}, created);
                expect(ttl).to.equal(0);
                done();
            });

            it('returns 0 when created 60 hours ago and expiresAt is used with an hour before the created hour', function (done) {

                var config = {
                    expiresAt: '12:00'
                };
                var created = Date.now() - 342000000;                                       // 95 hours ago (3 days + 23 hours)
                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule, created);
                expect(ttl).to.equal(0);
                done();
            });

            it('returns a positive number when using a future expiresAt', function (done) {

                var hour = new Date(Date.now() + 60 * 60 * 1000).getHours();
                hour = hour === 0 ? 1 : hour;

                var config = {
                    expiresAt: hour + ':00'
                };

                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule);
                expect(ttl).to.be.greaterThan(0);
                done();
            });

            it('returns the correct number when using a future expiresAt', function (done) {

                var twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
                var hours = twoHoursAgo.getHours();
                var minutes = '' + twoHoursAgo.getMinutes();
                var created = twoHoursAgo.getTime() + (60 * 60 * 1000);
                minutes = minutes.length === 1 ? '0' + minutes : minutes;

                var config = {
                    expiresAt: hours + ':' + minutes
                };

                var rule = Cache.compile(config);
                var ttl = Cache.ttl(rule, created);

                expect(ttl).to.be.closeTo(22 * 60 * 60 * 1000, 60 * 1000);
                done();
            });

            it('returns correct number when using an expiresAt time tomorrow', function (done) {

                var hour = new Date(Date.now() - 60 * 60 * 1000).getHours();

                var config = {
                    expiresAt: hour + ':00'
                };

                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule);
                expect(ttl).to.be.closeTo(23 * 60 * 60 * 1000, 60 * 60 * 1000);
                done();
            });

            it('returns correct number when using a created time from yesterday and expires in 2 hours', function (done) {

                var hour = new Date(Date.now() + 2 * 60 * 60 * 1000).getHours();

                var config = {
                    expiresAt: hour + ':00'
                };
                var created = new Date(Date.now());
                created.setHours(new Date(Date.now()).getHours() - 22);

                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule, created);
                expect(ttl).to.be.closeTo(60 * 60 * 1000, 60 * 60 * 1000);
                done();
            });
        });
    });

    describe('Extension client', function () {

        describe('#start', function () {

            it('passes an error in the callback when one occurs', function (done) {

                var options = {
                    partition: 'test',
                    engine: {
                        start: function (callback) {

                            callback(new Error());
                        }
                    }
                };

                var client = new Cache.Client(options);
                client.start(function (err) {

                    expect(err).to.exist;
                    done();
                });
            });
        });

        describe('#get', function () {

            it('returns an error when the connection is not ready', function (done) {

                var options = {
                    partition: 'test',
                    engine: {
                        start: function (callback) {

                            callback();
                        },
                        isReady: function () {

                            return false;
                        }
                    }
                };

                var client = new Cache.Client(options);
                client.get('test', function (err) {

                    expect(err).to.be.instanceOf(Error);
                    expect(err.message).to.equal('Disconnected');
                    done();
                });
            });

            it('wraps the result with cached details', function (done) {

                var options = {
                    partition: 'test',
                    engine: {
                        start: function (callback) {

                            callback();
                        },
                        isReady: function () {

                            return true;
                        },
                        get: function (key, callback) {

                            var result = {
                                item: 'test1',
                                stored: 'test2'
                            };

                            callback(null, result);
                        }
                    }
                };

                var client = new Cache.Client(options);
                client.get({ id: 'id', segment: 'segment' }, function (err, cached) {

                    expect(cached.item).to.equal('test1');
                    expect(cached.stored).to.equal('test2');
                    expect(cached.ttl).to.exist;
                    done();
                });
            });
        });

        describe('#set', function () {

            it('returns an error when the connection is not ready', function (done) {

                var options = {
                    partition: 'test',
                    engine: {
                        start: function (callback) {

                            callback();
                        },
                        isReady: function () {

                            return false;
                        }
                    }
                };

                var client = new Cache.Client(options);
                client.set('test', 'test', 'test', function (err) {

                    expect(err).to.be.instanceOf(Error);
                    expect(err.message).to.equal('Disconnected');
                    done();
                });
            });
        });

        describe('#drop', function () {

            it('calls the extension clients drop function', function (done) {

                var options = {
                    partition: 'test',
                    engine: {
                        start: function (callback) {

                            callback();
                        },
                        isReady: function () {

                            return true;
                        },
                        drop: function (key, callback) {

                            callback(null, 'success');
                        }
                    }
                };

                var client = new Cache.Client(options);
                client.drop({ id: 'id', segment: 'segment' }, function (err, result) {

                    expect(result).to.equal('success');
                    done();
                });
            });
        });
    });
});