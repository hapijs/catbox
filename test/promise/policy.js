'use strict';

// Load modules

const Catbox = require('../../');
const Code = require('code');
const Lab = require('lab');
const Import = require('../import');

// Declare internals

const internals = {};

internals.delay = (time) => {

    return new Promise((fulfill) => {

        setTimeout(fulfill, time);
    });
};

// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.experiment;
const it = lab.test;
const expect = Code.expect;


describe('Policy (promise)', () => {

    it('returns cached item (promise)', (done) => {

        const client = new Catbox.Client(Import);
        const policy = new Catbox.Policy({ expiresIn: 1000 }, client, 'test');

        client.start()
        .then(() => policy.set('x', '123', null))
        .then(() => policy.get('x'))
        .then((value) => {

            expect(value).to.equal('123');
            expect(policy.stats).to.deep.equal({
                sets: 1,
                gets: 1,
                hits: 1,
                stales: 0,
                generates: 0,
                errors: 0
            });
            done();
        });
    });

    it('works with special property names (promise)', (done) => {

        const client = new Catbox.Client(Import);
        const policy = new Catbox.Policy({ expiresIn: 1000 }, client, 'test');

        client.start()
        .then(() => policy.set('__proto__', '123', null))
        .then(() => policy.get('__proto__'))
        .then((value) => {

            expect(value).to.equal('123');
            expect(policy.stats).to.deep.equal({
                sets: 1,
                gets: 1,
                hits: 1,
                stales: 0,
                generates: 0,
                errors: 0
            });
            done();
        });
    });

    it('finds nothing when using empty policy rules (promise)', (done) => {

        const client = new Catbox.Client(Import);
        const policy = new Catbox.Policy({}, client, 'test');

        client.start()
        .then(() => policy.set('x', '123', null))
        .then(() => policy.get('x'))
        .then((value) => {

            expect(value).to.not.exist();
            expect(policy.stats).to.deep.equal({
                sets: 1,
                gets: 1,
                hits: 0,
                stales: 0,
                generates: 0,
                errors: 0
            });
            done();
        });
    });

    it('returns cached item with no global rules and manual ttl (promise)', (done) => {

        const client = new Catbox.Client(Import);
        const policy = new Catbox.Policy({}, client, 'test');

        client.start()
        .then(() => policy.set('x', '123', 1000))
        .then(() => policy.get('x'))
        .then((value) => {

            expect(value).to.equal('123');
            expect(policy.stats).to.deep.equal({
                sets: 1,
                gets: 1,
                hits: 1,
                stales: 0,
                generates: 0,
                errors: 0
            });
            done();
        });
    });

    it('throws an error when segment is missing (promise)', (done) => {

        const config = {
            expiresIn: 50000
        };

        expect(() => {

            const client = new Catbox.Client(Import);
            new Catbox.Policy(config, client);
        }).to.throw('Invalid segment name: undefined (Empty string)');
        done();
    });

    describe('get() (promise)', () => {

        it('returns cached item using object id (promise)', (done) => {

            const client = new Catbox.Client(Import);
            const policy = new Catbox.Policy({ expiresIn: 1000 }, client, 'test');

            client.start()
            .then(() => policy.set({ id: 'x' }, '123', null))
            .then(() => policy.get({ id: 'x' }))
            .then((value) => {

                expect(value).to.equal('123');
                expect(policy.stats).to.deep.equal({
                    sets: 1,
                    gets: 1,
                    hits: 1,
                    stales: 0,
                    generates: 0,
                    errors: 0
                });
                done();
            });

        });


        it('returns error on null id (promise)', (done) => {

            const client = new Catbox.Client(Import);
            const policy = new Catbox.Policy({ expiresIn: 1000 }, client, 'test');

            client.start()
            .then(() => policy.set(null, '123', null))
            .catch((err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Invalid key');

                return policy.get(null);
            })
            .catch((err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Invalid key');
                expect(policy.stats).to.deep.equal({
                    sets: 1,
                    gets: 1,
                    hits: 0,
                    stales: 0,
                    generates: 0,
                    errors: 2
                });
                done();
            });
        });

        it('passes an error to the callback when an error occurs getting the item (promise)', (done) => {

            const engine = {
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return true;
                },
                get: function (key, callback) {

                    callback(new Error());
                },
                validateSegmentName: function () {

                    return null;
                }
            };
            const policyConfig = {
                expiresIn: 50000
            };

            const client = new Catbox.Client(engine);
            const policy = new Catbox.Policy(policyConfig, client, 'test');

            policy.get('test1')
            .catch((err) => {

                expect(err).to.be.instanceOf(Error);
                expect(policy.stats).to.deep.equal({ sets: 0, gets: 1, hits: 0, stales: 0, generates: 0, errors: 1 });
                done();
            });
        });

        it('returns the cached result when no error occurs (promise)', (done) => {

            const engine = {
                start: function () {

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
                validateSegmentName: function () {

                    return null;
                }
            };
            const policyConfig = {
                expiresIn: 50000
            };

            const client = new Catbox.Client(engine);
            const policy = new Catbox.Policy(policyConfig, client, 'test');

            policy.get('test1', { full: true })
            .then((result) => {

                expect(result.value).to.equal('item');
                expect(result.cached.isStale).to.be.false();
                expect(policy.stats).to.deep.equal({ sets: 0, gets: 1, hits: 1, stales: 0, generates: 0, errors: 0 });
                done();
            });
        });


        it('returns null on get when no cache client provided (promise)', (done) => {

            const policy = new Catbox.Policy({ expiresIn: 1 });

            policy.get('x')
            .then((value) => {

                expect(value).to.not.exist();
                expect(policy.stats).to.deep.equal({ sets: 0, gets: 1, hits: 0, stales: 0, generates: 0, errors: 0 });
                done();
            });
        });

    });

    describe('generate (promise)', () => {

        it('returns falsey items (promise)', (done) => {

            const engine = {
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return true;
                },
                get: function (key, callback) {

                    callback(null, {
                        stored: false,
                        item: false
                    });
                },
                validateSegmentName: function () {

                    return null;
                }
            };
            const policyConfig = {
                expiresIn: 50000,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    return next(null, false);
                }
            };

            const client = new Catbox.Client(engine);
            const policy = new Catbox.Policy(policyConfig, client, 'test');

            policy.get('test1')
            .then((value) => {

                expect(value).to.equal(false);
                done();
            });
        });

        it('bypasses cache when not configured (promise)', (done) => {

            const policy = new Catbox.Policy({
                expiresIn: 1,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    return next(null, 'new result');
                }
            });

            policy.get('test', { full: true })
            .then((result) => {

                expect(result.value).to.equal('new result');
                expect(result.cached).to.not.exist();
                done();
            });
        });

        it('returns the processed cached item (promise)', (done) => {

            let gen = 0;
            const rule = {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 5,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    return next(null, { gen: ++gen });
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value) => {

                expect(value.gen).to.equal(1);
                done();
            });
        });

        it('switches rules after construction (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 5,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    return next(null, { gen: ++gen });
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy({ expiresIn: 100 }, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1).to.not.exist();
                policy.rules(rule);
            })
            .then(() => policy.get('test'))
            .then((value2) => {

                expect(value2.gen).to.equal(1);
                expect(policy.stats).to.deep.equal({
                    sets: 1,
                    gets: 2,
                    hits: 0,
                    stales: 0,
                    generates: 1,
                    errors: 0
                });
                done();
            });
        });

        it('returns the processed cached item after cache error (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 5,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    return next(null, { gen: ++gen });
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            client.get = function (key, callback) {

                callback(new Error('bad client'));
            };
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value) => {

                expect(value.gen).to.equal(1);
                done();
            });
        });

        it('returns an error when get fails and generateOnReadError is false (promise)', () => {

            const rule = {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 5,
                generateOnReadError: false,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    return next(null, { gen: ++gen });
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            client.get = function (key, cb) {

                cb(new Error('bad client'));
            };

            const policy = new Catbox.Policy(rule, client, 'test-segment');

            return client.start()
            .then(() => policy.get('test'))
            .catch((err) => {

                expect(err.message).to.equal('bad client');
            });
        });

        it('returns the processed cached item using manual ttl (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 26,
                staleIn: 20,
                staleTimeout: 5,
                generateTimeout: 20,
                generateFunc: function (id, next) {

                    setTimeout(() => {

                        return next(null, { gen: ++gen }, 100);
                    }, 6);
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);        // Fresh
                setTimeout(() => {

                    policy.get('test')
                    .then((value2) => {

                        expect(value2.gen).to.equal(1);        // Stale
                        done();
                    });
                }, 27);
            });
        });

        it('returns stale object then fresh object based on timing (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 5,
                generateTimeout: 20,
                generateFunc: function (id, next) {

                    setTimeout(() => {

                        return next(null, { gen: ++gen }, 100);
                    }, 6);
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);        // Fresh
                setTimeout(() => {

                    policy.get('test')
                    .then((value2) => {

                        expect(value2.gen).to.equal(1);        // Stale
                        setTimeout(() => {

                            policy.get('test')
                            .then((value3) => {

                                expect(value3.gen).to.equal(2);        // Fresh
                                done();
                            });
                        }, 3);
                    });
                }, 21);
            });
        });

        it('returns stale objects then fresh object based on timing, with concurrent generateFunc calls (promise)', (done) => {

            let gen = 0;

            let generateCalled = 0;

            const rule = {
                expiresIn: 1000,
                staleIn: 100,
                staleTimeout: 5,
                generateTimeout: 100,
                generateFunc: function (id, next) {

                    setTimeout(() => {

                        generateCalled++;
                        return next(null, { gen: ++gen }, 1000);
                    }, 50);
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);        // Fresh
                setTimeout(() => {

                    policy.get('test')
                    .then((value2) => {

                        expect(value2.gen).to.equal(1);        // Stale
                        setTimeout(() => {

                            policy.get('test')
                            .then((value3) => {

                                expect(value3.gen).to.equal(1);        // Stale
                                setTimeout(() => {

                                    policy.get('test')
                                    .then((value4) => {

                                        expect(value4.gen).to.equal(3);        // Fresh
                                        expect(generateCalled).to.equal(3); // original generate + 2 calls while stale
                                        done();
                                    });
                                }, 50);
                            });
                        }, 8);
                    });
                }, 101);
            });
        });

        it('returns stale objects then fresh object based on timing, with only 1 concurrent generateFunc call during pendingGenerateTimeout period  (promise)', (done) => {

            let gen = 0;

            let generateCalled = 0;

            const rule = {
                expiresIn: 1000,
                staleIn: 100,
                staleTimeout: 5,
                pendingGenerateTimeout: 200,
                generateTimeout: 100,
                generateFunc: function (id, next) {

                    setTimeout(() => {

                        generateCalled++;
                        return next(null, { gen: ++gen }, 1000);
                    }, 50);
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);        // Fresh
                setTimeout(() => {

                    policy.get('test')
                    .then((value2) => {

                        expect(value2.gen).to.equal(1);        // Stale
                        setTimeout(() => {

                            policy.get('test')
                            .then((value3) => {

                                expect(value3.gen).to.equal(1);        // Stale
                                setTimeout(() => {

                                    policy.get('test')
                                    .then((value4) => {

                                        expect(value4.gen).to.equal(2);        // Fresh
                                        expect(generateCalled).to.equal(2); // original generate + 1 call while stale
                                        done();
                                    });
                                }, 50);
                            });
                        }, 8);
                    });
                }, 101);
            });
        });

        it('returns stale object then fresh object based on timing using staleIn function (promise)', (done) => {

            const staleIn = function (stored, ttl) {

                const expiresIn = (Date.now() - stored) + ttl;
                expect(expiresIn).to.be.about(100, 5);
                return expiresIn - 80;
            };

            let gen = 0;

            const rule = {
                expiresIn: 100,
                staleIn: staleIn,
                staleTimeout: 5,
                generateTimeout: 20,
                generateFunc: function (id, next) {

                    setTimeout(() => {

                        return next(null, { gen: ++gen }, 100);
                    }, 6);
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);        // Fresh
                setTimeout(() => {

                    policy.get('test')
                    .then((value2) => {

                        expect(value2.gen).to.equal(1);        // Stale
                        setTimeout(() => {

                            policy.get('test')
                            .then((value3) => {

                                expect(value3.gen).to.equal(2);        // Fresh
                                done();
                            });
                        }, 3);
                    });
                }, 21);
            });
        });

        it('returns stale object then invalidate cache on error (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 5,
                generateTimeout: 20,
                generateFunc: function (id, next) {

                    ++gen;

                    setTimeout(() => {

                        if (gen !== 2) {
                            return next(null, { gen: gen });
                        }

                        return next(new Error());
                    }, 6);
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);     // Fresh
                setTimeout(() => {

                    policy.get('test')
                    .then((value2) => {


                        // Generates a new one in background which will produce Error and clear the cache

                        expect(value2.gen).to.equal(1);     // Stale
                        setTimeout(() => {

                            policy.get('test')
                            .then((value3) => {

                                expect(value3.gen).to.equal(3);     // Fresh
                                done();
                            });
                        }, 3);
                    });
                }, 21);
            });
        });

        it('returns stale object then invalidate cache on error when dropOnError is true (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 5,
                dropOnError: true,
                generateTimeout: 20,
                generateFunc: function (id, next) {

                    ++gen;

                    setTimeout(() => {

                        if (gen === 1) {
                            return next(null, { gen: gen });
                        }

                        return next(new Error());
                    }, 6);
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);     // Fresh
                setTimeout(() => {

                    policy.get('test')
                    .then((value2) => {

                        // Generates a new one in background which will produce Error and clear the cache

                        expect(value2.gen).to.equal(1);     // Stale
                        setTimeout(() => {

                            policy.get('test')
                            .catch((err) => {

                                expect(err).to.be.instanceof(Error);     // Stale
                                done();
                            });
                        }, 3);
                    });
                }, 21);
            });
        });

        it('returns stale object then invalidate cache on error when dropOnError is not set (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 5,
                generateTimeout: 20,
                generateFunc: function (id, next) {

                    ++gen;

                    setTimeout(() => {

                        if (gen === 1) {
                            return next(null, { gen: gen });
                        }

                        return next(new Error());
                    }, 6);
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);     // Fresh
                setTimeout(() => {

                    policy.get('test')
                    .then((value2) => {

                        // Generates a new one in background which will produce Error and clear the cache

                        expect(value2.gen).to.equal(1);     // Stale
                        setTimeout(() => {

                            policy.get('test')
                            .catch((err) => {

                                expect(err).to.be.instanceof(Error);     // Stale
                                done();
                            });
                        }, 3);
                    });
                }, 21);
            });
        });

        it('returns stale object then does not invalidate cache on timeout if dropOnError is false (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 5,
                dropOnError: false,
                generateTimeout: 20,
                generateFunc: function (id, next) {

                    ++gen;

                    setTimeout(() => {

                        if (gen === 1) {
                            return next(null, { gen: gen });
                        }

                        return next(new Error());
                    }, 6);
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);     // Fresh
                setTimeout(() => {

                    policy.get('test')
                    .then((value2) => {

                        // Generates a new one in background which will produce Error, but not clear the cache

                        expect(value2.gen).to.equal(1);     // Stale
                        setTimeout(() => {

                            policy.get('test')
                            .then((value3) => {

                                expect(value3.gen).to.equal(1);     // Stale
                                done();
                            });
                        }, 3);
                    });
                }, 21);
            });
        });

        it('returns stale object then does not invalidate cache on error if dropOnError is false (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 5,
                dropOnError: false,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    ++gen;

                    if (gen === 1) {
                        return next(null, { gen: gen });
                    }

                    return next(new Error());
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);     // Fresh
                setTimeout(() => {

                    policy.get('test', { full: true })
                    .then((result2) => {

                        expect(result2.err).to.exist();

                        // Generates a new one in background which will produce Error, but not clear the cache

                        expect(result2.value.gen).to.equal(1);     // Stale

                        policy.get('test', { full: true })
                        .then((result3) => {

                            expect(result3.err).to.exist();
                            expect(result3.value.gen).to.equal(1);     // Stale
                            done();
                        });
                    });
                }, 21);
            });
        });


        it('returns stale object then does not invalidate cache on error if dropOnError is false and stats is false (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 5,
                dropOnError: false,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    ++gen;

                    if (gen === 1) {
                        return next(null, { gen: gen });
                    }

                    return next(new Error());
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);     // Fresh
                setTimeout(() => {

                    policy.get('test', { full: false })
                    .then((value2) => {

                        // Generates a new one in background which will produce Error, but not clear the cache

                        expect(value2.gen).to.equal(1);     // Stale

                        policy.get('test', { full: false })
                        .then((value3) => {

                            expect(value3.gen).to.equal(1);     // Stale
                            done();
                        });
                    });
                }, 21);
            });
        });


        it('returns stale object then invalidates cache on error if dropOnError is true (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 5,
                dropOnError: true,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    ++gen;

                    if (gen === 1) {
                        return next(null, { gen: gen });
                    }

                    return next(new Error());
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);     // Fresh
                setTimeout(() => {

                    policy.get('test', { full: true })
                    .catch((result2) => {

                        // Generates a new one in background which will produce Error, but not clear the cache
                        expect(result2.err).to.be.instanceOf(Error);
                        expect(result2.value).to.be.undefined();     // Stale

                        policy.get('test', { full: true })
                        .catch((result3) => {

                            expect(result3.err).to.be.instanceOf(Error);
                            expect(result3.value).to.be.undefined();      // Stale
                            done();
                        });
                    });
                }, 21);
            });
        });


        it('returns stale object then invalidates cache on error if dropOnError is not defined (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 5,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    ++gen;

                    if (gen === 1) {
                        return next(null, { gen: gen });
                    }

                    return next(new Error());
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);     // Fresh
                setTimeout(() => {

                    policy.get('test', { full: true })
                    .catch((result2) => {

                        // Generates a new one in background which will produce Error, but not clear the cache
                        expect(result2.err).to.be.instanceOf(Error);
                        expect(result2.value).to.be.undefined();     // Stale

                        policy.get('test', { full: true })
                        .catch((result3) => {

                            expect(result3.err).to.be.instanceOf(Error);
                            expect(result3.value).to.be.undefined();      // Stale
                            done();
                        });
                    });
                }, 21);
            });
        });


        it('returns fresh objects (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 10,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    return next(null, { gen: ++gen });
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);     // Fresh
                setTimeout(() => {

                    policy.get('test')
                    .then((value2) => {

                        expect(value2.gen).to.equal(2);     // Fresh

                        setTimeout(() => {

                            policy.get('test')
                            .then((value3) => {

                                expect(value3.gen).to.equal(2);     // Stale
                                done();
                            });
                        }, 1);
                    });
                }, 21);
            });
        });

        it('returns error when generated within stale timeout (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 30,
                staleIn: 20,
                staleTimeout: 5,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    ++gen;
                    if (gen !== 2) {
                        return next(null, { gen: gen });
                    }

                    return next(new Error());
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);     // Fresh
                setTimeout(() => {

                    policy.get('test')
                    .catch((err) => {

                        // Generates a new one which will produce Error

                        expect(err).to.be.instanceof(Error);     // Stale
                        done();
                    });
                }, 21);
            });
        });

        it('returns new object when stale has less than staleTimeout time left (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 31,
                staleIn: 15,
                staleTimeout: 15,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    return next(null, { gen: ++gen });
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);        // Fresh
                setTimeout(() => {

                    policy.get('test')
                    .then((value2) => {

                        expect(value2.gen).to.equal(1);        // Fresh
                        setTimeout(() => {

                            policy.get('test')
                            .then((value3) => {

                                expect(value3.gen).to.equal(2);        // Fresh
                                expect(policy.stats).to.deep.equal({
                                    sets: 2,
                                    gets: 3,
                                    hits: 2,
                                    stales: 1,
                                    generates: 2,
                                    errors: 0
                                });
                                done();
                            });
                        }, 12);
                    });
                }, 10);
            });
        });

        it('invalidates cache on error without stale (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 20,
                staleIn: 5,
                staleTimeout: 5,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    ++gen;

                    if (gen === 2) {
                        return next(new Error());
                    }

                    return next(null, { gen: gen });
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .then((value1) => {

                expect(value1.gen).to.equal(1);     // Fresh

                return internals.delay(8)
                .then(() => policy.get('test'))
                .catch((err) => {

                    expect(err).to.exist();

                    policy._get('test', (value3) => {

                        expect(value3).to.equal(null);
                        done();
                    });
                });
            });
        });

        it('returns timeout error when generate takes too long (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 10,
                generateTimeout: 5,
                generateFunc: function (id, next) {

                    setTimeout(() => {

                        return next(null, { gen: ++gen });
                    }, 6);
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .catch((err) => {

                expect(err.output.statusCode).to.equal(503);
                setTimeout(() => {

                    policy.get('test')
                    .then((value2) => {

                        expect(value2.gen).to.equal(1);
                        setTimeout(() => {

                            policy.get('test')
                            .catch((err) => {

                                expect(err.output.statusCode).to.equal(503);
                                done();
                            });
                        }, 10);
                    });
                }, 2);
            });
        });

        it('does not block the queue when generate fails to call back (promise)', (done) => {

            const rule = {
                expiresIn: 50000,
                generateTimeout: 5,
                generateFunc: function () {
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => policy.get('test'))
            .catch((err) => {

                expect(err).to.be.an.instanceOf(Error);

                policy.get('test')
                .catch((err) => {

                    expect(err).to.be.an.instanceOf(Error);
                    done();
                });
            });
        });

        it('blocks the queue when generate fails to call back (promise)', (done) => {

            const rule = {
                expiresIn: 50000,
                generateTimeout: false,
                generateFunc: function () {
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            let called = 0;

            client.start()
            .then(() => {

                policy.get('test').then(() => ++called).catch(() => ++called);
                policy.get('test').then(() => ++called).catch(() => ++called);

                setTimeout(() => {

                    expect(called).to.equal(0);
                    done();
                }, 100);
            });
        });

        it('queues requests while pending (promise)', (done) => {

            let gen = 0;
            const rule = {
                expiresIn: 100,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    return next(null, { gen: ++gen });
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => {

                let result = null;
                const compare = function (value) {

                    if (!result) {
                        result = value;
                        return;
                    }

                    expect(result).to.equal(value);
                    done();
                };

                policy.get('test').then(compare);
                policy.get('test').then(compare);
            });
        });

        it('catches errors thrown in generateFunc and passes to all pending requests (promise)', (done) => {

            const rule = {
                expiresIn: 100,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    throw new Error('generate failed');
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => {

                let result = null;
                const compare = function (err) {

                    if (!result) {
                        result = err;
                        return;
                    }

                    expect(result).to.equal(err);
                    expect(err.message).to.equal('generate failed');
                    done();
                };

                policy.get('test').catch(compare);
                policy.get('test').catch(compare);
            });
        });

        it('does not return stale value from previous request timeout left behind (promise)', { parallel: false }, (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 10,
                generateTimeout: 20,
                generateFunc: function (id, next) {

                    setTimeout(() => {

                        next(null, { gen: ++gen });
                    }, 5);
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });

            const orig = client.connection.get;
            client.connection.get = function (key, callback) {      // Delayed get

                setTimeout(() => {

                    orig.call(client.connection, key, callback);
                }, 10);
            };

            const policy = new Catbox.Policy(rule, client, 'test-segment');

            client.start()
            .then(() => {

                policy.get('test')
                .then((value1) => {                   // Cache lookup takes 10 + generate 5

                    expect(value1.gen).to.equal(1);                                             // Fresh
                    setTimeout(() => {                                                    // Wait for stale

                        policy.get('test')
                        .then((value2) => {           // Cache lookup takes 10, generate comes back after 5

                            expect(value2.gen).to.equal(2);                                     // Fresh
                            policy.get('test')
                            .then((value3) => {       // Cache lookup takes 10

                                expect(value3.gen).to.equal(2);                                 // Cached (10 left to stale)

                                client.connection.get = orig;
                                done();
                            });
                        });
                    }, 21);
                });
            });
        });

        it('passes set error when generateIgnoreWriteError is false (promise)', (done) => {

            let gen = 0;

            const rule = {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 5,
                generateTimeout: 10,
                generateIgnoreWriteError: false,
                generateFunc: function (id, next) {

                    return next(null, { gen: ++gen });
                }
            };

            const client = new Catbox.Client(Import, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            policy.set = function (key, value, ttl, cb) {

                cb(new Error('bad cache'));
            };

            client.start()
            .then(() => policy.get('test', { full: true }))
            .catch((result) => {

                expect(result.err.message).to.equal('bad cache');
                expect(result.value.gen).to.equal(1);
                done();
            });
        });
    });

    describe('set() (promise)', () => {

        it('returns null on set when no cache client provided (promise)', (done) => {

            const policy = new Catbox.Policy({ expiresIn: 1 });

            policy.set('x', 'y', 100).then(() => {

                done();
            });
        });

        it('ignores missing callback (promise)', (done) => {

            const policy = new Catbox.Policy({ expiresIn: 1 });

            expect(() => {

                policy.set('x', 'y', 100);
            }).to.not.throw();

            done();
        });
    });

    describe('drop() (promise)', () => {

        it('returns null on drop when no cache client provided (promise)', (done) => {

            const policy = new Catbox.Policy({ expiresIn: 1 });

            policy.drop('x').then(() => {

                done();
            });
        });

        it('calls the extension clients drop function (promise)', (done) => {

            let called = false;
            const engine = {
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return true;
                },
                drop: function (key, callback) {

                    called = true;
                    callback(null);
                },
                validateSegmentName: function () {

                    return null;
                }
            };

            const policyConfig = {
                expiresIn: 50000
            };

            const client = new Catbox.Client(engine);
            const policy = new Catbox.Policy(policyConfig, client, 'test');

            policy.drop('test').then(() => {

                expect(called).to.be.true();
                done();
            });
        });

        it('ignores missing callback (promise)', (done) => {

            const policy = new Catbox.Policy({ expiresIn: 1 });

            expect(() => {

                policy.drop('x');
            }).to.not.throw();

            done();
        });

        it('counts drop error (promise)', (done) => {

            const engine = {
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return true;
                },
                drop: function (key, callback) {

                    callback(new Error('failed'));
                },
                validateSegmentName: function () {

                    return null;
                }
            };

            const policyConfig = {
                expiresIn: 50000
            };

            const client = new Catbox.Client(engine);
            const policy = new Catbox.Policy(policyConfig, client, 'test');

            policy.drop('test')
            .catch(() => {

                expect(policy.stats.errors).to.equal(1);
                done();
            });
        });

        it('errors on invalid keys (promise)', () => {

            const policyConfig = {
                expiresIn: 50000
            };

            const client = new Catbox.Client(Import);
            const policy = new Catbox.Policy(policyConfig, client, 'test');
            return policy.drop(null)
            .catch((err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Invalid key');
            });
        });

        it('handles objects as keys (promise)', (done) => {

            const policyConfig = {
                expiresIn: 50000
            };

            const client = new Catbox.Client(Import);
            const policy = new Catbox.Policy(policyConfig, client, 'test');
            client.start()
            .then(() => {

                policy.drop({ id: 'id', segment: 'segment' }).then(() => {

                    done();
                });
            });
        });
    });

    describe('ttl() (promise)', () => {

        it('returns the ttl factoring in the created time (promise)', (done) => {

            const engine = {
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return true;
                },
                validateSegmentName: function () {

                    return null;
                }
            };

            const policyConfig = {
                expiresIn: 50000
            };

            const client = new Catbox.Client(engine);
            const policy = new Catbox.Policy(policyConfig, client, 'test');

            const result = policy.ttl(Date.now() - 10000);
            expect(result).to.be.within(39999, 40001);                    // There can occasionally be a 1ms difference
            done();
        });

        it('returns expired when created in the future (promise)', (done) => {

            const config = {
                expiresAt: '10:00'
            };

            const rules = new Catbox.Policy.compile(config);

            const created = new Date('Sat Sep 06 2014 13:00:00').getTime();
            const now = new Date('Sat Sep 06 2014 12:00:00').getTime();

            const ttl = Catbox.Policy.ttl(rules, created, now);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns expired on c-e-n same day (promise)', (done) => {

            const config = {
                expiresAt: '10:00'
            };

            const rules = new Catbox.Policy.compile(config);

            const created = new Date('Sat Sep 06 2014 9:00:00').getTime();
            const now = new Date('Sat Sep 06 2014 11:00:00').getTime();

            const ttl = Catbox.Policy.ttl(rules, created, now);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns expired on c-(midnight)-e-n (promise)', (done) => {

            const config = {
                expiresAt: '10:00'
            };

            const rules = new Catbox.Policy.compile(config);

            const created = new Date('Sat Sep 06 2014 11:00:00').getTime();
            const now = new Date('Sat Sep 07 2014 10:00:01').getTime();

            const ttl = Catbox.Policy.ttl(rules, created, now);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns ttl on c-n-e same day (promise)', (done) => {

            const config = {
                expiresAt: '10:00'
            };

            const rules = new Catbox.Policy.compile(config);

            const created = new Date('Sat Sep 06 2014 9:00:00').getTime();
            const now = new Date('Sat Sep 06 2014 9:30:00').getTime();

            const ttl = Catbox.Policy.ttl(rules, created, now);
            expect(ttl).to.equal(30 * 60 * 1000);
            done();
        });

        it('returns ttl on c-(midnight)-n-e (promise)', (done) => {

            const config = {
                expiresAt: '10:00'
            };

            const rules = new Catbox.Policy.compile(config);

            const created = new Date('Sat Sep 06 2014 11:00:00').getTime();
            const now = new Date('Sat Sep 07 2014 9:00:00').getTime();

            const ttl = Catbox.Policy.ttl(rules, created, now);
            expect(ttl).to.equal(60 * 60 * 1000);
            done();
        });
    });

    describe('compile() (promise)', () => {

        it('does not try to compile a null config (promise)', (done) => {

            const rule = Catbox.policy.compile(null);
            expect(rule).to.deep.equal({});
            done();
        });

        it('compiles a single rule (promise)', (done) => {

            const config = {
                expiresIn: 50000
            };

            const rule = Catbox.policy.compile(config, false);
            expect(rule.expiresIn).to.equal(config.expiresIn);
            done();
        });

        it('ignores external options (promise)', (done) => {

            const config = {
                expiresIn: 50000,
                cache: true
            };

            const rule = Catbox.policy.compile(config, false);
            expect(rule.expiresIn).to.equal(config.expiresIn);
            done();
        });

        it('assigns the expiresIn when the rule is cached (promise)', (done) => {

            const config = {
                expiresIn: 50000
            };

            const rule = Catbox.policy.compile(config, false);
            expect(rule.expiresIn).to.equal(config.expiresIn);
            done();
        });

        it('allows a rule with neither expiresAt or expiresIn (promise)', (done) => {

            const fn = function () {

                Catbox.policy.compile({ cache: 1 }, true);
            };

            expect(fn).to.not.throw();
            done();
        });

        it('allows a rule with expiresAt and undefined expiresIn (promise)', (done) => {

            const fn = function () {

                Catbox.policy.compile({ expiresIn: undefined, expiresAt: '09:00' }, true);
            };

            expect(fn).to.not.throw();
            done();
        });

        it('allows combination of expiresIn, staleTimeout and staleIn function (promise)', (done) => {

            const staleIn = function (stored, ttl) {

                return 1000;
            };

            const config = {
                expiresIn: 500000,
                staleIn: staleIn,
                staleTimeout: 500,
                generateTimeout: 10,
                generateFunc: function () {
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.not.throw();
            done();
        });

        it('throws an error when staleIn is greater than expiresIn (promise)', (done) => {

            const config = {
                expiresIn: 500000,
                staleIn: 1000000,
                staleTimeout: 500,
                generateTimeout: 10,
                generateFunc: function () {
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw('staleIn must be less than expiresIn');
            done();
        });

        it('throws an error when staleTimeout is greater than expiresIn (promise)', (done) => {

            const config = {
                expiresIn: 500000,
                staleIn: 100000,
                staleTimeout: 500000,
                generateTimeout: 10,
                generateFunc: function () {
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw('staleTimeout must be less than expiresIn');
            done();
        });

        it('throws an error when staleTimeout is greater than expiresIn - staleIn (promise)', (done) => {

            const config = {
                expiresIn: 30000,
                staleIn: 20000,
                staleTimeout: 10000,
                generateTimeout: 10,
                generateFunc: function () {
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw('staleTimeout must be less than the delta between expiresIn and staleIn');
            done();
        });

        it('throws an error when staleTimeout is used without server mode (promise)', (done) => {

            const config = {
                expiresIn: 1000000,
                staleIn: 500000,
                staleTimeout: 500,
                generateTimeout: 10,
                generateFunc: function () {
                }
            };

            const fn = function () {

                new Catbox.Policy(config);
            };

            expect(fn).to.throw('Cannot use stale options without server-side caching');
            done();
        });

        it('returns rule when staleIn is less than expiresIn (promise)', (done) => {

            const config = {
                expiresIn: 1000000,
                staleIn: 500000,
                staleTimeout: 500,
                generateTimeout: 10,
                generateFunc: function () {
                }
            };

            const rule = Catbox.policy.compile(config, true);
            expect(rule.staleIn).to.equal(500 * 1000);
            expect(rule.expiresIn).to.equal(1000 * 1000);
            done();
        });

        it('returns rule when staleIn is less than 24 hours and using expiresAt (promise)', (done) => {

            const config = {
                expiresAt: '03:00',
                staleIn: 5000000,
                staleTimeout: 500,
                generateTimeout: 10,
                generateFunc: function () {
                }
            };

            const rule = Catbox.policy.compile(config, true);
            expect(rule.staleIn).to.equal(5000 * 1000);
            done();
        });

        it('does not throw an error if has both staleTimeout and staleIn (promise)', (done) => {

            const config = {
                staleIn: 30000,
                staleTimeout: 300,
                expiresIn: 60000,
                generateTimeout: 10,
                generateFunc: function () {
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };
            expect(fn).to.not.throw();
            done();
        });

        it('throws an error if trying to use stale caching on the client (promise)', (done) => {

            const config = {
                staleIn: 30000,
                expiresIn: 60000,
                staleTimeout: 300,
                generateTimeout: 10,
                generateFunc: function () {
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, false);
            };

            expect(fn).to.throw('Cannot use stale options without server-side caching');
            done();
        });

        it('converts the stale time to ms (promise)', (done) => {

            const config = {
                staleIn: 30000,
                expiresIn: 60000,
                staleTimeout: 300,
                generateTimeout: 10,
                generateFunc: function () {
                }
            };

            const rule = Catbox.policy.compile(config, true);

            expect(rule.staleIn).to.equal(config.staleIn);
            done();
        });

        it('throws an error if staleTimeout is greater than expiresIn (promise)', (done) => {

            const config = {
                staleIn: 2000,
                expiresIn: 10000,
                staleTimeout: 30000,
                generateTimeout: 10,
                generateFunc: function () {
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw('staleTimeout must be less than expiresIn');
            done();
        });

        it('throws an error if staleIn is greater than expiresIn (promise)', (done) => {

            const config = {
                staleIn: 1000000,
                expiresIn: 60000,
                staleTimeout: 30,
                generateTimeout: 10,
                generateFunc: function () {
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, false);
            };

            expect(fn).to.throw('staleIn must be less than expiresIn');
            done();
        });

        it('allows a rule with generateFunc and generateTimeout (promise)', (done) => {

            const config = {
                expiresIn: 50000,
                generateTimeout: 10,
                generateFunc: function () {
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.not.throw();
            done();
        });

        it('throws an error with generateFunc but no generateTimeout (promise)', (done) => {

            const config = {
                expiresIn: 50000,
                generateFunc: function () {
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw(/Invalid cache policy configuration/);
            done();
        });

        it('throws an error with generateTimeout but no generateFunc (promise)', (done) => {

            const config = {
                expiresIn: 50000,
                generateTimeout: 10
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw(/Invalid cache policy configuration/);
            done();
        });

        it('throws an error if staleTimeout is greater than pendingGenerateTimeout (promise)', (done) => {

            const config = {
                staleIn: 30000,
                expiresIn: 60000,
                staleTimeout: 300,
                pendingGenerateTimeout: 200,
                generateTimeout: 10,
                generateFunc: function () {
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw('pendingGenerateTimeout must be greater than staleTimeout if specified');
            done();
        });

        it('should accept a valid pendingGenerateTimeout (promise)', (done) => {

            const config = {
                staleIn: 30000,
                expiresIn: 60000,
                staleTimeout: 300,
                pendingGenerateTimeout: 5000,
                generateTimeout: 10,
                generateFunc: function () {
                }
            };

            const rule = Catbox.policy.compile(config, true);
            expect(rule.pendingGenerateTimeout).to.equal(5000);

            done();
        });
    });

    describe('Policy.ttl() (promise)', () => {

        it('returns zero when a rule is expired (promise)', (done) => {

            const config = {
                expiresIn: 50000
            };
            const rule = Catbox.policy.compile(config, false);
            let created = new Date(Date.now());
            created = created.setMinutes(created.getMinutes() - 5);

            const ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.be.equal(0);
            done();
        });

        it('returns a positive number when a rule is not expired (promise)', (done) => {

            const config = {
                expiresIn: 50000
            };
            const rule = Catbox.policy.compile(config, false);
            const created = new Date(Date.now());

            const ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.be.greaterThan(0);
            done();
        });

        it('returns the correct expires time when no created time is provided (promise)', (done) => {

            const config = {
                expiresIn: 50000
            };
            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule);
            expect(ttl).to.equal(50000);
            done();
        });

        it('returns 0 when created several days ago and expiresAt is used (promise)', (done) => {

            const config = {
                expiresAt: '13:00'
            };
            const created = Date.now() - 313200000;                                       // 87 hours (3 days + 15 hours)
            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns 0 when created in the future (promise)', (done) => {

            const config = {
                expiresIn: 100
            };
            const created = Date.now() + 1000;
            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns 0 for bad rule (promise)', (done) => {

            const created = Date.now() - 1000;
            const ttl = Catbox.policy.ttl({}, created);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns 0 when created 60 hours ago and expiresAt is used with an hour before the created hour (promise)', (done) => {

            const config = {
                expiresAt: '12:00'
            };
            const created = Date.now() - 342000000;                                       // 95 hours ago (3 days + 23 hours)
            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns a positive number when using a future expiresAt (promise)', (done) => {

            let hour = new Date(Date.now() + 60 * 60 * 1000).getHours();
            hour = hour === 0 ? 1 : hour;

            const config = {
                expiresAt: hour + ':00'
            };

            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule);
            expect(ttl).to.be.greaterThan(0);
            done();
        });

        it('returns the correct number when using a future expiresAt (promise)', (done) => {

            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const hours = twoHoursAgo.getHours();
            let minutes = '' + twoHoursAgo.getMinutes();
            const created = twoHoursAgo.getTime() + (60 * 60 * 1000);
            minutes = minutes.length === 1 ? '0' + minutes : minutes;

            const config = {
                expiresAt: hours + ':' + minutes
            };

            const rule = Catbox.policy.compile(config, false);
            const ttl = Catbox.policy.ttl(rule, created);

            expect(ttl).to.be.about(22 * 60 * 60 * 1000, 60 * 1000);
            done();
        });

        it('returns correct number when using an expiresAt time tomorrow (promise)', (done) => {

            const hour = new Date(Date.now() - 60 * 60 * 1000).getHours();

            const config = {
                expiresAt: hour + ':00'
            };

            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule);
            expect(ttl).to.be.about(23 * 60 * 60 * 1000, 60 * 60 * 1000);
            done();
        });

        it('returns correct number when using a created time from yesterday and expires in 2 hours (promise)', (done) => {

            const hour = new Date(Date.now() + 2 * 60 * 60 * 1000).getHours();

            const config = {
                expiresAt: hour + ':00'
            };
            const created = new Date(Date.now());
            created.setHours(new Date(Date.now()).getHours() - 22);

            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.be.about(60 * 60 * 1000, 60 * 60 * 1000);
            done();
        });
    });

    describe('isReady() (promise)', () => {

        it('returns cache engine readiness (promise)', (done) => {

            const expected = true;
            const engine = {
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return expected;
                },
                get: function (key, callback) {

                    callback(new Error());
                },
                validateSegmentName: function () {

                    return null;
                }
            };
            const client = new Catbox.Client(engine);
            const policy = new Catbox.Policy({}, client, 'test');


            client.start()
            .then(() => {

                expect(policy.isReady()).to.equal(expected);
                done();
            });
        });

        it('returns false when no cache client provided (promise)', (done) => {

            const policy = new Catbox.Policy({ expiresIn: 1 });

            expect(policy.isReady()).to.equal(false);
            done();
        });
    });

})
;
