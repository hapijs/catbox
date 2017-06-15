'use strict';

// Load modules

const Catbox = require('..');
const Code = require('code');
const Lab = require('lab');
const Import = require('./import');
const Domain = require('domain');

// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.experiment;
const it = lab.test;
const expect = Code.expect;


describe('Policy', () => {

    it('returns cached item', (done) => {

        const client = new Catbox.Client(Import);
        const policy = new Catbox.Policy({ expiresIn: 1000 }, client, 'test');

        client.start((err) => {

            expect(err).to.not.exist();

            policy.set('x', '123', null, (err) => {

                expect(err).to.not.exist();

                policy.get('x', (err, value, cached, report) => {

                    expect(err).to.not.exist();
                    expect(value).to.equal('123');
                    expect(policy.stats).to.equal({ sets: 1, gets: 1, hits: 1, stales: 0, generates: 0, errors: 0 });
                    done();
                });
            });
        });
    });

    it('works with special property names', (done) => {

        const client = new Catbox.Client(Import);
        const policy = new Catbox.Policy({ expiresIn: 1000 }, client, 'test');

        client.start((err) => {

            expect(err).to.not.exist();

            policy.set('__proto__', '123', null, (err) => {

                expect(err).to.not.exist();

                policy.get('__proto__', (err, value, cached, report) => {

                    expect(err).to.not.exist();
                    expect(value).to.equal('123');
                    expect(policy.stats).to.equal({ sets: 1, gets: 1, hits: 1, stales: 0, generates: 0, errors: 0 });
                    done();
                });
            });
        });
    });

    it('finds nothing when using empty policy rules', (done) => {

        const client = new Catbox.Client(Import);
        const policy = new Catbox.Policy({}, client, 'test');

        client.start((err) => {

            expect(err).to.not.exist();

            policy.set('x', '123', null, (err) => {

                expect(err).to.not.exist();

                policy.get('x', (err, value, cached, report) => {

                    expect(err).to.not.exist();
                    expect(value).to.not.exist();
                    expect(policy.stats).to.equal({ sets: 1, gets: 1, hits: 0, stales: 0, generates: 0, errors: 0 });
                    done();
                });
            });
        });
    });

    it('returns cached item with no global rules and manual ttl', (done) => {

        const client = new Catbox.Client(Import);
        const policy = new Catbox.Policy({}, client, 'test');

        client.start((err) => {

            expect(err).to.not.exist();

            policy.set('x', '123', 1000, (err) => {

                expect(err).to.not.exist();

                policy.get('x', (err, value, cached, report) => {

                    expect(err).to.not.exist();
                    expect(value).to.equal('123');
                    expect(policy.stats).to.equal({ sets: 1, gets: 1, hits: 1, stales: 0, generates: 0, errors: 0 });
                    done();
                });
            });
        });
    });

    it('throws an error when segment is missing', (done) => {

        const config = {
            expiresIn: 50000
        };

        expect(() => {

            const client = new Catbox.Client(Import);
            new Catbox.Policy(config, client);
        }).to.throw('Invalid segment name: undefined (Empty string)');
        done();
    });

    describe('get()', () => {

        it('returns cached item using object id', (done) => {

            const client = new Catbox.Client(Import);
            const policy = new Catbox.Policy({ expiresIn: 1000 }, client, 'test');

            client.start((err) => {

                expect(err).to.not.exist();

                policy.set({ id: 'x' }, '123', null, (err) => {

                    expect(err).to.not.exist();

                    policy.get({ id: 'x' }, (err, value, cached, report) => {

                        expect(err).to.not.exist();
                        expect(value).to.equal('123');
                        expect(policy.stats).to.equal({ sets: 1, gets: 1, hits: 1, stales: 0, generates: 0, errors: 0 });
                        done();
                    });
                });
            });
        });

        it('returns error on null id', (done) => {

            const client = new Catbox.Client(Import);
            const policy = new Catbox.Policy({ expiresIn: 1000 }, client, 'test');

            client.start((err) => {

                expect(err).to.not.exist();

                policy.set(null, '123', null, (err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Invalid key');

                    policy.get(null, (err, value, cached, report) => {

                        expect(err).to.exist();
                        expect(err.message).to.equal('Invalid key');
                        expect(policy.stats).to.equal({ sets: 1, gets: 1, hits: 0, stales: 0, generates: 0, errors: 2 });
                        done();
                    });
                });
            });
        });

        it('passes an error to the callback when an error occurs getting the item', (done) => {

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

            policy.get('test1', (err, value, cached, report) => {

                expect(err).to.be.instanceOf(Error);
                expect(value).to.not.exist();
                expect(policy.stats).to.equal({ sets: 0, gets: 1, hits: 0, stales: 0, generates: 0, errors: 1 });
                done();
            });
        });

        it('returns the cached result when no error occurs', (done) => {

            const engine = {
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
                validateSegmentName: function () {

                    return null;
                }
            };
            const policyConfig = {
                expiresIn: 50000
            };

            const client = new Catbox.Client(engine);
            const policy = new Catbox.Policy(policyConfig, client, 'test');

            policy.get('test1', (err, value, cached, report) => {

                expect(err).to.not.exist();
                expect(value).to.equal('item');
                expect(cached.isStale).to.be.false();
                expect(policy.stats).to.equal({ sets: 0, gets: 1, hits: 1, stales: 0, generates: 0, errors: 0 });
                done();
            });
        });

        it('returns null on get when no cache client provided', (done) => {

            const policy = new Catbox.Policy({ expiresIn: 1 });

            policy.get('x', (err, value, cached, report) => {

                expect(err).to.not.exist();
                expect(value).to.not.exist();
                expect(policy.stats).to.equal({ sets: 0, gets: 1, hits: 0, stales: 0, generates: 0, errors: 0 });
                done();
            });
        });

        it('it only binds if domain exists', (done) => {

            const policy = new Catbox.Policy({
                expiresIn: 1000,
                staleIn: 100,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    setTimeout(() => {

                        return next(null, true);
                    }, 20);
                },
                staleTimeout: 50
            }, new Catbox.Client(Import), 'test');

            let tests = 0;
            let completed = 0;

            const checkAndDone = process.domain.bind((expected, actual) => {    // Bind back to the lab domain

                expect(actual).to.not.exist();
                expect(expected).to.not.exist();
                expect(actual).to.not.equal(expected, process.domain);      // This should be the lab domain

                if (tests === completed) {
                    done();
                }
            });

            const test = function (domain) {

                tests++;

                Domain.create().run(() => {

                    process.domain = domain;

                    policy.get('', (err, result) => {

                        expect(err).to.exist();
                        completed++;
                        checkAndDone(domain, process.domain);
                    });
                });
            };

            test(null);
            test(null);
        });

        it('it returns with the correct process domain', (done) => {

            const policy = new Catbox.Policy({
                expiresIn: 1000,
                staleIn: 100,
                generateTimeout: 10,
                generateFunc: function (id, next) {

                    setTimeout(() => {

                        return next(null, true);
                    }, 20);
                },
                staleTimeout: 50
            }, new Catbox.Client(Import), 'test');

            let tests = 0;
            let completed = 0;

            const checkAndDone = process.domain.bind((expected, actual) => {

                expect(actual).to.equal(expected);

                if (tests === completed) {
                    done();
                }
            });

            const test = function (id) {

                tests++;

                Domain.create().run(() => {

                    process.domain.name = id;

                    policy.get('', (err, result) => {

                        expect(err).to.exist();
                        completed++;
                        checkAndDone(id, process.domain.name);
                    });
                });
            };

            for (let i = 0; i < 10; ++i) {
                test(i);
            }
        });

        describe('generate', () => {

            it('returns falsey items', (done) => {

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

                policy.get('test1', (err, value, cached, report) => {

                    expect(err).to.equal(null);
                    expect(value).to.equal(false);
                    done();
                });
            });

            it('bypasses cache when not configured', (done) => {

                const policy = new Catbox.Policy({
                    expiresIn: 1,
                    generateTimeout: 10,
                    generateFunc: function (id, next) {

                        return next(null, 'new result');
                    }
                });

                policy.get('test', (err, value, cached, report) => {

                    expect(err).to.not.exist();
                    expect(value).to.equal('new result');
                    expect(cached).to.not.exist();
                    done();
                });
            });

            it('returns the processed cached item', (done) => {

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

                client.start(() => {

                    policy.get('test', (err, value, cached, report) => {

                        expect(err).to.not.exist();
                        expect(value.gen).to.equal(1);
                        done();
                    });
                });
            });

            it('switches rules after construction', (done) => {

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

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1).to.not.exist();
                        policy.rules(rule);

                        policy.get('test', (err, value2, cached2, report2) => {

                            expect(err).to.not.exist();
                            expect(value2.gen).to.equal(1);
                            expect(policy.stats).to.equal({ sets: 1, gets: 2, hits: 0, stales: 0, generates: 1, errors: 0 });
                            done();
                        });
                    });
                });
            });

            it('returns the processed cached item after cache error', (done) => {

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

                client.start(() => {

                    policy.get('test', (err, value, cached, report) => {

                        expect(err).to.not.exist();
                        expect(value.gen).to.equal(1);
                        done();
                    });
                });
            });

            it('returns an error when get fails and generateOnReadError is false', (done) => {

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
                client.get = function (key, callback) {

                    callback(new Error('bad client'));
                };

                const policy = new Catbox.Policy(rule, client, 'test-segment');

                client.start(() => {

                    policy.get('test', (err, value, cached, report) => {

                        expect(err.message).to.equal('bad client');
                        expect(value).to.not.exist();
                        done();
                    });
                });
            });

            it('returns the processed cached item using manual ttl', (done) => {

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

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);        // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2, report2) => {

                                expect(err).to.not.exist();
                                expect(value2.gen).to.equal(1);        // Stale
                                done();
                            });
                        }, 27);
                    });
                });
            });

            it('returns stale object then fresh object based on timing', (done) => {

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

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);        // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2, report2) => {

                                expect(err).to.not.exist();
                                expect(value2.gen).to.equal(1);        // Stale
                                setTimeout(() => {

                                    policy.get('test', (err, value3, cached3, report3) => {

                                        expect(err).to.not.exist();
                                        expect(value3.gen).to.equal(2);        // Fresh
                                        done();
                                    });
                                }, 3);
                            });
                        }, 21);
                    });
                });
            });

            it('returns stale objects then fresh object based on timing, with concurrent generateFunc calls', (done) => {

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

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);        // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2, report2) => {

                                expect(err).to.not.exist();
                                expect(value2.gen).to.equal(1);        // Stale
                                setTimeout(() => {

                                    policy.get('test', (err, value3, cached3, report3) => {

                                        expect(err).to.not.exist();
                                        expect(value3.gen).to.equal(1);        // Stale
                                        setTimeout(() => {

                                            policy.get('test', (err, value4, cached4, report4) => {

                                                expect(err).to.not.exist();
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
            });

            it('generateTimeout is triggered when staleTimeout is greater than ttl and generation is slow', (done) => {

                let gen = 0;

                let generateCalled = 0;

                const rule = {
                    expiresIn: 121,
                    staleIn: 1,
                    staleTimeout: 50,
                    generateTimeout: 100,
                    generateFunc: function (id, next) {

                        setTimeout(() => {

                            return next(null, { gen: ++gen });
                        }, generateCalled++ === 1 ? 2500 : 1);
                    }
                };

                const client = new Catbox.Client(Import, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);        // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2, report2) => {

                                expect(err).to.exist();
                                expect(err.output.statusCode).to.equal(503);       // Service Unavailable
                                setTimeout(() => {

                                    policy.get('test', (err, value3, cached3, report3) => {

                                        expect(err).to.not.exist();
                                        expect(value3.gen).to.equal(2);        // Fresh
                                        done();
                                    });
                                }, 8);
                            });
                        }, 80);
                    });
                });
            });

            it('returns stale objects then fresh object based on timing, with only 1 concurrent generateFunc call during pendingGenerateTimeout period ', (done) => {

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

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);        // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2, report2) => {

                                expect(err).to.not.exist();
                                expect(value2.gen).to.equal(1);        // Stale
                                setTimeout(() => {

                                    policy.get('test', (err, value3, cached3, report3) => {

                                        expect(err).to.not.exist();
                                        expect(value3.gen).to.equal(1);        // Stale
                                        setTimeout(() => {

                                            policy.get('test', (err, value4, cached4, report4) => {

                                                expect(err).to.not.exist();
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
            });

            it('returns fresh object when cache is expired and called during a pendingGenerateTimeout period ', (done) => {

                let gen = 0;

                const rule = {
                    expiresIn: 1000,
                    staleIn: 100,
                    staleTimeout: 5,
                    pendingGenerateTimeout: 200,
                    generateTimeout: false,
                    generateFunc: function (id, next) {

                        setTimeout(() => {

                            return next(null, { gen: ++gen }, 1000);
                        }, 50);
                    }
                };

                const client = new Catbox.Client(Import, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);        // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2, report2) => {

                                expect(err).to.not.exist();
                                expect(value2.gen).to.equal(1);        // Stale
                                setTimeout(() => {

                                    policy.get('test', (err, value3, cached3, report3) => {

                                        expect(err).to.not.exist();
                                        expect(value3.gen).to.equal(3);        // New
                                        done();
                                    });
                                }, 40); // just after cache expiration
                            });
                        }, 980); // just before cache expiration
                    });
                });
            });

            it('returns stale object then fresh object based on timing using staleIn function', (done) => {

                const staleIn = function (stored, ttl) {

                    const expiresIn = (Date.now() - stored) + ttl;
                    expect(expiresIn).to.be.about(100, 5);
                    return expiresIn - 80;
                };

                let gen = 0;

                const rule = {
                    expiresIn: 100,
                    staleIn,
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

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);        // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2, report2) => {

                                expect(err).to.not.exist();
                                expect(value2.gen).to.equal(1);        // Stale
                                setTimeout(() => {

                                    policy.get('test', (err, value3, cached3, report3) => {

                                        expect(err).to.not.exist();
                                        expect(value3.gen).to.equal(2);        // Fresh
                                        done();
                                    });
                                }, 3);
                            });
                        }, 21);
                    });
                });
            });

            it('returns stale object then invalidate cache on error', (done) => {

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
                                return next(null, { gen });
                            }

                            return next(new Error());
                        }, 6);
                    }
                };

                const client = new Catbox.Client(Import, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);     // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2, report2) => {

                                expect(err).to.not.exist();

                                // Generates a new one in background which will produce Error and clear the cache

                                expect(value2.gen).to.equal(1);     // Stale
                                setTimeout(() => {

                                    policy.get('test', (err, value3, cached3, report3) => {

                                        expect(err).to.not.exist();
                                        expect(value3.gen).to.equal(3);     // Fresh
                                        done();
                                    });
                                }, 3);
                            });
                        }, 21);
                    });
                });
            });

            it('returns stale object then invalidate cache on error when dropOnError is true', (done) => {

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
                                return next(null, { gen });
                            }

                            return next(new Error());
                        }, 6);
                    }
                };

                const client = new Catbox.Client(Import, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);     // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2, report2) => {

                                expect(err).to.not.exist();

                                // Generates a new one in background which will produce Error and clear the cache

                                expect(value2.gen).to.equal(1);     // Stale
                                setTimeout(() => {

                                    policy.get('test', (err, value3, cached3, report3) => {

                                        expect(err).to.be.instanceof(Error);     // Stale
                                        done();
                                    });
                                }, 3);
                            });
                        }, 21);
                    });
                });
            });

            it('returns stale object then invalidate cache on error when dropOnError is not set', (done) => {

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
                                return next(null, { gen });
                            }

                            return next(new Error());
                        }, 6);
                    }
                };

                const client = new Catbox.Client(Import, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);     // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2, report2) => {

                                expect(err).to.not.exist();

                                // Generates a new one in background which will produce Error and clear the cache

                                expect(value2.gen).to.equal(1);     // Stale
                                setTimeout(() => {

                                    policy.get('test', (err, value3, cached3, report3) => {

                                        expect(err).to.be.instanceof(Error);     // Stale
                                        done();
                                    });
                                }, 3);
                            });
                        }, 21);
                    });
                });
            });

            it('returns stale object then does not invalidate cache on timeout if dropOnError is false', (done) => {

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
                                return next(null, { gen });
                            }

                            return next(new Error());
                        }, 6);
                    }
                };

                const client = new Catbox.Client(Import, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);     // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2, report2) => {

                                expect(err).to.not.exist();

                                // Generates a new one in background which will produce Error, but not clear the cache

                                expect(value2.gen).to.equal(1);     // Stale
                                setTimeout(() => {

                                    policy.get('test', (err, value3, cached3, report3) => {

                                        expect(err).to.not.exist();
                                        expect(value3.gen).to.equal(1);     // Stale
                                        done();
                                    });
                                }, 3);
                            });
                        }, 21);
                    });
                });
            });

            it('returns stale object then does not invalidate cache on error if dropOnError is false', (done) => {

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
                            return next(null, { gen });
                        }

                        return next(new Error());
                    }
                };

                const client = new Catbox.Client(Import, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                client.start(() => {

                    policy.get('test', (err, value1, cached1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);     // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2) => {

                                expect(err).to.exist();

                                // Generates a new one in background which will produce Error, but not clear the cache

                                expect(value2.gen).to.equal(1);     // Stale

                                policy.get('test', (err, value3, cached3) => {

                                    expect(err).to.exist();
                                    expect(value3.gen).to.equal(1);     // Stale
                                    done();
                                });
                            });
                        }, 21);
                    });
                });
            });

            it('returns stale object then invalidates cache on error if dropOnError is true', (done) => {

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
                            return next(null, { gen });
                        }

                        return next(new Error());
                    }
                };

                const client = new Catbox.Client(Import, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                client.start(() => {

                    policy.get('test', (err, value1, cached1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);     // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2) => {

                                // Generates a new one in background which will produce Error, but not clear the cache
                                expect(err).to.be.instanceOf(Error);
                                expect(value2).to.be.undefined();     // Stale

                                policy.get('test', (err, value3, cached3) => {

                                    expect(err).to.be.instanceOf(Error);
                                    expect(value3).to.be.undefined();      // Stale
                                    done();
                                });
                            });
                        }, 21);
                    });
                });
            });


            it('returns stale object then invalidates cache on error if dropOnError is not defined', (done) => {

                let gen = 0;

                const rule = {
                    expiresIn: 100,
                    staleIn: 20,
                    staleTimeout: 5,
                    generateTimeout: 10,
                    generateFunc: function (id, next) {

                        ++gen;

                        if (gen === 1) {
                            return next(null, { gen });
                        }

                        return next(new Error());
                    }
                };

                const client = new Catbox.Client(Import, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                client.start(() => {

                    policy.get('test', (err, value1, cached1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);     // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2) => {

                                // Generates a new one in background which will produce Error, but not clear the cache
                                expect(err).to.be.instanceOf(Error);
                                expect(value2).to.be.undefined();     // Stale

                                policy.get('test', (err, value3, cached3) => {

                                    expect(err).to.be.instanceOf(Error);
                                    expect(value3).to.be.undefined();      // Stale
                                    done();
                                });
                            });
                        }, 21);
                    });
                });
            });

            it('returns fresh objects', (done) => {

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

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);     // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2, report2) => {

                                expect(err).to.not.exist();
                                expect(value2.gen).to.equal(2);     // Fresh

                                setTimeout(() => {

                                    policy.get('test', (err, value3, cached3, report3) => {

                                        expect(err).to.not.exist();
                                        expect(value3.gen).to.equal(2);     // Fresh
                                        done();
                                    });
                                }, 1);
                            });
                        }, 21);
                    });
                });
            });

            it('returns error when generated within stale timeout', (done) => {

                let gen = 0;

                const rule = {
                    expiresIn: 30,
                    staleIn: 20,
                    staleTimeout: 5,
                    generateTimeout: 10,
                    generateFunc: function (id, next) {

                        ++gen;
                        if (gen !== 2) {
                            return next(null, { gen });
                        }

                        return next(new Error());
                    }
                };

                const client = new Catbox.Client(Import, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);     // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2, report2) => {

                                // Generates a new one which will produce Error

                                expect(err).to.be.instanceof(Error);     // Stale
                                done();
                            });
                        }, 21);
                    });
                });
            });

            it('returns new object when stale has less than staleTimeout time left', (done) => {

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

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);        // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2, report2) => {

                                expect(err).to.not.exist();
                                expect(value2.gen).to.equal(1);        // Fresh
                                setTimeout(() => {

                                    policy.get('test', (err, value3, cached3, report3) => {

                                        expect(err).to.not.exist();
                                        expect(value3.gen).to.equal(2);        // Fresh
                                        expect(policy.stats).to.equal({ sets: 2, gets: 3, hits: 2, stales: 1, generates: 2, errors: 0 });
                                        done();
                                    });
                                }, 11);
                            });
                        }, 10);
                    });
                });
            });

            it('invalidates cache on error without stale', (done) => {

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

                        return next(null, { gen });
                    }
                };

                const client = new Catbox.Client(Import, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);     // Fresh
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2, report2) => {

                                expect(err).to.exist();

                                policy._get('test', (err, value3) => {

                                    expect(err).to.not.exist();
                                    expect(value3).to.equal(null);
                                    done();
                                });
                            });
                        }, 8);
                    });
                });
            });

            it('returns timeout error when generate takes too long', (done) => {

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

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {

                        expect(err.output.statusCode).to.equal(503);
                        setTimeout(() => {

                            policy.get('test', (err, value2, cached2, report2) => {

                                expect(err).to.not.exist();
                                expect(value2.gen).to.equal(1);
                                setTimeout(() => {

                                    policy.get('test', (err, value3, cached3, report3) => {

                                        expect(err.output.statusCode).to.equal(503);
                                        done();
                                    });
                                }, 10);
                            });
                        }, 2);
                    });
                });
            });

            it('does not block the queue when generate fails to call back', (done) => {

                const rule = {
                    expiresIn: 50000,
                    generateTimeout: 5,
                    generateFunc: function () { }
                };

                const client = new Catbox.Client(Import, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                client.start(() => {

                    const id = 'test';
                    policy.get(id, (err, value1, cached1, report1) => {

                        expect(err).to.be.an.instanceOf(Error);
                        expect(value1).to.not.exist();

                        policy.get(id, (err, value2, cached2, report2) => {

                            expect(err).to.be.an.instanceOf(Error);
                            expect(value2).to.not.exist();
                            done();
                        });
                    });
                });
            });

            it('blocks the queue when generate fails to call back', (done) => {

                const rule = {
                    expiresIn: 50000,
                    generateTimeout: false,
                    generateFunc: function () { }
                };

                const client = new Catbox.Client(Import, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                client.start(() => {

                    const id = 'test';
                    let called = 0;
                    policy.get(id, (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        ++called;
                    });

                    policy.get(id, (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        ++called;
                    });

                    setTimeout(() => {

                        expect(called).to.equal(0);
                        done();
                    }, 100);
                });
            });

            it('queues requests while pending', (done) => {

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

                client.start(() => {

                    let result = null;
                    const compare = function (err, value, cached, report) {

                        expect(err).to.not.exist();
                        if (!result) {
                            result = value;
                            return;
                        }

                        expect(result).to.equal(value);
                        done();
                    };

                    policy.get('test', compare);
                    policy.get('test', compare);
                });
            });

            it('catches errors thrown in generateFunc and passes to all pending requests', (done) => {

                const rule = {
                    expiresIn: 100,
                    generateTimeout: 10,
                    generateFunc: function (id, next) {

                        throw new Error('generate failed');
                    }
                };

                const client = new Catbox.Client(Import, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                client.start(() => {

                    let result = null;
                    const compare = function (err, value, cached, report) {

                        if (!result) {
                            result = err;
                            return;
                        }

                        expect(result).to.equal(err);
                        expect(err.message).to.equal('generate failed');
                        done();
                    };

                    policy.get('test', compare);
                    policy.get('test', compare);
                });
            });

            it('does not return stale value from previous request timeout left behind', { parallel: false }, (done) => {

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

                client.start(() => {

                    policy.get('test', (err, value1, cached1, report1) => {                   // Cache lookup takes 10 + generate 5

                        expect(err).to.not.exist();
                        expect(value1.gen).to.equal(1);                                             // Fresh
                        setTimeout(() => {                                                    // Wait for stale

                            policy.get('test', (err, value2, cached2, report2) => {           // Cache lookup takes 10, generate comes back after 5

                                expect(err).to.not.exist();
                                expect(value2.gen).to.equal(2);                                     // Fresh
                                policy.get('test', (err, value3, cached3, report3) => {       // Cache lookup takes 10

                                    expect(err).to.not.exist();
                                    expect(value3.gen).to.equal(2);                                 // Cached (10 left to stale)

                                    client.connection.get = orig;
                                    done();
                                });
                            });
                        }, 21);
                    });
                });
            });

            it('passes set error when generateIgnoreWriteError is false', (done) => {

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

                policy.set = function (key, value, ttl, callback) {

                    return callback(new Error('bad cache'));
                };

                client.start(() => {

                    policy.get('test', (err, value, cached, report) => {

                        expect(err.message).to.equal('bad cache');
                        expect(value.gen).to.equal(1);
                        done();
                    });
                });
            });
        });
    });

    describe('set()', () => {

        it('returns null on set when no cache client provided', (done) => {

            const policy = new Catbox.Policy({ expiresIn: 1 });

            policy.set('x', 'y', 100, (err) => {

                expect(err).to.not.exist();
                done();
            });
        });

        it('ignores missing callback', (done) => {

            const policy = new Catbox.Policy({ expiresIn: 1 });

            expect(() => {

                policy.set('x', 'y', 100);
            }).to.not.throw();

            done();
        });
    });

    describe('drop()', () => {

        it('returns null on drop when no cache client provided', (done) => {

            const policy = new Catbox.Policy({ expiresIn: 1 });

            policy.drop('x', (err) => {

                expect(err).to.not.exist();
                done();
            });
        });

        it('calls the extension clients drop function', (done) => {

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

            policy.drop('test', (err) => {

                expect(err).to.not.exist();
                expect(called).to.be.true();
                done();
            });
        });

        it('ignores missing callback', (done) => {

            const policy = new Catbox.Policy({ expiresIn: 1 });

            expect(() => {

                policy.drop('x');
            }).to.not.throw();

            done();
        });

        it('counts drop error', (done) => {

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

            policy.drop('test', (err) => {

                expect(err).to.exist();
                expect(policy.stats.errors).to.equal(1);
                done();
            });
        });

        it('errors on invalid keys', (done) => {

            const policyConfig = {
                expiresIn: 50000
            };

            const client = new Catbox.Client(Import);
            const policy = new Catbox.Policy(policyConfig, client, 'test');
            client.start((err) => {

                expect(err).to.not.exist();
                policy.drop(null, (err) => {

                    expect(err).to.exist();
                    done();
                });
            });
        });

        it('handles objects as keys', (done) => {

            const policyConfig = {
                expiresIn: 50000
            };

            const client = new Catbox.Client(Import);
            const policy = new Catbox.Policy(policyConfig, client, 'test');
            client.start((err) => {

                expect(err).to.not.exist();
                policy.drop({ id: 'id', segment: 'segment' }, (err) => {

                    expect(err).to.not.exist();
                    done();
                });
            });
        });
    });

    describe('ttl()', () => {

        it('returns the ttl factoring in the created time', (done) => {

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

        it('returns expired when created in the future', (done) => {

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

        it('returns expired on c-e-n same day', (done) => {

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

        it('returns expired on c-(midnight)-e-n', (done) => {

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

        it('returns ttl on c-n-e same day', (done) => {

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

        it('returns ttl on c-(midnight)-n-e', (done) => {

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

    describe('compile()', () => {

        it('does not try to compile a null config', (done) => {

            const rule = Catbox.policy.compile(null);
            expect(rule).to.equal({});
            done();
        });

        it('compiles a single rule', (done) => {

            const config = {
                expiresIn: 50000
            };

            const rule = Catbox.policy.compile(config, false);
            expect(rule.expiresIn).to.equal(config.expiresIn);
            done();
        });

        it('ignores external options', (done) => {

            const config = {
                expiresIn: 50000,
                cache: true
            };

            const rule = Catbox.policy.compile(config, false);
            expect(rule.expiresIn).to.equal(config.expiresIn);
            done();
        });

        it('assigns the expiresIn when the rule is cached', (done) => {

            const config = {
                expiresIn: 50000
            };

            const rule = Catbox.policy.compile(config, false);
            expect(rule.expiresIn).to.equal(config.expiresIn);
            done();
        });

        it('allows a rule with neither expiresAt or expiresIn', (done) => {

            const fn = function () {

                Catbox.policy.compile({ cache: 1 }, true);
            };

            expect(fn).to.not.throw();
            done();
        });

        it('allows a rule with expiresAt and undefined expiresIn', (done) => {

            const fn = function () {

                Catbox.policy.compile({ expiresIn: undefined, expiresAt: '09:00' }, true);
            };

            expect(fn).to.not.throw();
            done();
        });

        it('allows combination of expiresIn, staleTimeout and staleIn function', (done) => {

            const staleIn = function (stored, ttl) {

                return 1000;
            };

            const config = {
                expiresIn: 500000,
                staleIn,
                staleTimeout: 500,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.not.throw();
            done();
        });

        it('throws an error when staleIn is greater than expiresIn', (done) => {

            const config = {
                expiresIn: 500000,
                staleIn: 1000000,
                staleTimeout: 500,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw('staleIn must be less than expiresIn');
            done();
        });

        it('throws an error when staleTimeout is greater than expiresIn', (done) => {

            const config = {
                expiresIn: 500000,
                staleIn: 100000,
                staleTimeout: 500000,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw('staleTimeout must be less than expiresIn');
            done();
        });

        it('throws an error when staleTimeout is greater than expiresIn - staleIn', (done) => {

            const config = {
                expiresIn: 30000,
                staleIn: 20000,
                staleTimeout: 10000,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw('staleTimeout must be less than the delta between expiresIn and staleIn');
            done();
        });

        it('throws an error when staleTimeout is used without server mode', (done) => {

            const config = {
                expiresIn: 1000000,
                staleIn: 500000,
                staleTimeout: 500,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const fn = function () {

                new Catbox.Policy(config);
            };

            expect(fn).to.throw('Cannot use stale options without server-side caching');
            done();
        });

        it('returns rule when staleIn is less than expiresIn', (done) => {

            const config = {
                expiresIn: 1000000,
                staleIn: 500000,
                staleTimeout: 500,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const rule = Catbox.policy.compile(config, true);
            expect(rule.staleIn).to.equal(500 * 1000);
            expect(rule.expiresIn).to.equal(1000 * 1000);
            done();
        });

        it('returns rule when staleIn is less than 24 hours and using expiresAt', (done) => {

            const config = {
                expiresAt: '03:00',
                staleIn: 5000000,
                staleTimeout: 500,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const rule = Catbox.policy.compile(config, true);
            expect(rule.staleIn).to.equal(5000 * 1000);
            done();
        });

        it('does not throw an error if has both staleTimeout and staleIn', (done) => {

            const config = {
                staleIn: 30000,
                staleTimeout: 300,
                expiresIn: 60000,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };
            expect(fn).to.not.throw();
            done();
        });

        it('throws an error if trying to use stale caching on the client', (done) => {

            const config = {
                staleIn: 30000,
                expiresIn: 60000,
                staleTimeout: 300,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const fn = function () {

                Catbox.policy.compile(config, false);
            };

            expect(fn).to.throw('Cannot use stale options without server-side caching');
            done();
        });

        it('converts the stale time to ms', (done) => {

            const config = {
                staleIn: 30000,
                expiresIn: 60000,
                staleTimeout: 300,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const rule = Catbox.policy.compile(config, true);

            expect(rule.staleIn).to.equal(config.staleIn);
            done();
        });

        it('throws an error if staleTimeout is greater than expiresIn', (done) => {

            const config = {
                staleIn: 2000,
                expiresIn: 10000,
                staleTimeout: 30000,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw('staleTimeout must be less than expiresIn');
            done();
        });

        it('throws an error if staleIn is greater than expiresIn', (done) => {

            const config = {
                staleIn: 1000000,
                expiresIn: 60000,
                staleTimeout: 30,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const fn = function () {

                Catbox.policy.compile(config, false);
            };

            expect(fn).to.throw('staleIn must be less than expiresIn');
            done();
        });

        it('allows a rule with generateFunc and generateTimeout', (done) => {

            const config = {
                expiresIn: 50000,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.not.throw();
            done();
        });

        it('throws an error with generateFunc but no generateTimeout', (done) => {

            const config = {
                expiresIn: 50000,
                generateFunc: function () { }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw(/Invalid cache policy configuration/);
            done();
        });

        it('throws an error with generateTimeout but no generateFunc', (done) => {

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

        it('throws an error if staleTimeout is greater than pendingGenerateTimeout', (done) => {

            const config = {
                staleIn: 30000,
                expiresIn: 60000,
                staleTimeout: 300,
                pendingGenerateTimeout: 200,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw('pendingGenerateTimeout must be greater than staleTimeout if specified');
            done();
        });

        it('should accept a valid pendingGenerateTimeout', (done) => {

            const config = {
                staleIn: 30000,
                expiresIn: 60000,
                staleTimeout: 300,
                pendingGenerateTimeout: 5000,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const rule = Catbox.policy.compile(config, true);
            expect(rule.pendingGenerateTimeout).to.equal(5000);

            done();
        });

        it('throws an error if staleIn is greater than one day when expiredAt is used', (done) => {

            const config = {
                staleIn: 1000 * 60 * 60 * 24 + 1,
                expiresAt: '12:00',
                staleTimeout: 300,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw();
            done();
        });

        it('allows staleIn to be greater than one day when expiredAt is not used', (done) => {

            const config = {
                staleIn: 1000 * 60 * 60 * 24 + 1,
                expiresIn: 1000 * 60 * 60 * 24 + 400,
                staleTimeout: 300,
                generateTimeout: 10,
                generateFunc: function () { }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.not.throw();
            done();
        });
    });

    describe('Policy.ttl()', () => {

        it('returns zero when a rule is expired', (done) => {

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

        it('returns a positive number when a rule is not expired', (done) => {

            const config = {
                expiresIn: 50000
            };
            const rule = Catbox.policy.compile(config, false);
            const created = new Date(Date.now());

            const ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.be.greaterThan(0);
            done();
        });

        it('returns the correct expires time when no created time is provided', (done) => {

            const config = {
                expiresIn: 50000
            };
            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule);
            expect(ttl).to.equal(50000);
            done();
        });

        it('returns 0 when created several days ago and expiresAt is used', (done) => {

            const config = {
                expiresAt: '13:00'
            };
            const created = Date.now() - 313200000;                                       // 87 hours (3 days + 15 hours)
            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns 0 when created in the future', (done) => {

            const config = {
                expiresIn: 100
            };
            const created = Date.now() + 1000;
            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns 0 for bad rule', (done) => {

            const created = Date.now() - 1000;
            const ttl = Catbox.policy.ttl({}, created);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns 0 when created 60 hours ago and expiresAt is used with an hour before the created hour', (done) => {

            const config = {
                expiresAt: '12:00'
            };
            const created = Date.now() - 342000000;                                       // 95 hours ago (3 days + 23 hours)
            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns a positive number when using a future expiresAt', (done) => {

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

        it('returns the correct number when using a future expiresAt', (done) => {

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

        it('returns correct number when using an expiresAt time tomorrow', (done) => {

            const hour = new Date(Date.now() - 60 * 60 * 1000).getHours();

            const config = {
                expiresAt: hour + ':00'
            };

            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule);
            expect(ttl).to.be.about(23 * 60 * 60 * 1000, 60 * 60 * 1000);
            done();
        });

        it('returns correct number when using a created time from yesterday and expires in 2 hours', (done) => {

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

    describe('isReady()', () => {

        it('returns cache engine readiness', (done) => {

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


            client.start(() => {

                expect(policy.isReady()).to.equal(expected);
                done();
            });
        });

        it('returns false when no cache client provided', (done) => {

            const policy = new Catbox.Policy({ expiresIn: 1 });

            expect(policy.isReady()).to.equal(false);
            done();
        });
    });
});
