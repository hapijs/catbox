'use strict';

const Catbox = require('..');
const Code = require('@hapi/code');
const Hoek = require('@hapi/hoek');
const Lab = require('@hapi/lab');

const Connection = require('./connection');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Policy', () => {

    it('returns cached item', async () => {

        const client = new Catbox.Client(Connection);
        const policy = new Catbox.Policy({ expiresIn: 1000 }, client, 'test');

        await client.start();

        await policy.set('x', '123', null);

        const value = await policy.get('x');

        expect(value).to.equal('123');
        expect(policy.stats).to.equal({ sets: 1, gets: 1, hits: 1, stales: 0, generates: 0, errors: 0 });
    });

    it('works with special property names', async () => {

        const client = new Catbox.Client(Connection);
        const policy = new Catbox.Policy({ expiresIn: 1000 }, client, 'test');

        await client.start();

        await policy.set('__proto__', '123', null);

        const value = await policy.get('__proto__');

        expect(value).to.equal('123');
        expect(policy.stats).to.equal({ sets: 1, gets: 1, hits: 1, stales: 0, generates: 0, errors: 0 });
    });

    it('finds nothing when using empty policy rules', async () => {

        const client = new Catbox.Client(Connection);
        const policy = new Catbox.Policy({}, client, 'test');

        await client.start();

        await policy.set('x', '123', null);

        const value = await policy.get('x');

        expect(value).to.not.exist();
        expect(policy.stats).to.equal({ sets: 1, gets: 1, hits: 0, stales: 0, generates: 0, errors: 0 });
    });

    it('returns cached item with no global rules and manual ttl', async () => {

        const client = new Catbox.Client(Connection);
        const policy = new Catbox.Policy({}, client, 'test');

        await client.start();

        await policy.set('x', '123', 1000);

        const value = await policy.get('x');

        expect(value).to.equal('123');
        expect(policy.stats).to.equal({ sets: 1, gets: 1, hits: 1, stales: 0, generates: 0, errors: 0 });
    });

    it('throws an error when segment is missing', () => {

        const config = {
            expiresIn: 50000
        };

        expect(() => {

            const client = new Catbox.Client(Connection);
            new Catbox.Policy(config, client);
        }).to.throw('Invalid segment name: undefined (Empty string)');
    });

    describe('get()', () => {

        it('returns cached item using object id', async () => {

            const client = new Catbox.Client(Connection);
            const policy = new Catbox.Policy({ expiresIn: 1000 }, client, 'test');

            await client.start();

            await policy.set({ id: 'x' }, '123', null);

            const value = await policy.get({ id: 'x' });

            expect(value).to.equal('123');
            expect(policy.stats).to.equal({ sets: 1, gets: 1, hits: 1, stales: 0, generates: 0, errors: 0 });
        });

        it('rejects the promise on null id', async () => {

            const client = new Catbox.Client(Connection);
            const policy = new Catbox.Policy({ expiresIn: 1000 }, client, 'test');

            await client.start();

            await expect(policy.set(null, '123', null)).to.reject('Invalid key');
            await expect(policy.get(null)).to.reject('Invalid key');
            expect(policy.stats).to.equal({ sets: 1, gets: 1, hits: 0, stales: 0, generates: 0, errors: 2 });
        });

        it('rejects the promise when an error occurs getting the item', async () => {

            const engine = {
                start: function () { },
                isReady: function () {

                    return true;
                },
                get: function (key) {

                    throw new Error();
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

            await expect(policy.get('test1')).to.reject(Error);
            expect(policy.stats).to.equal({ sets: 0, gets: 1, hits: 0, stales: 0, generates: 0, errors: 1 });
        });

        it('returns the cached result when no error occurs', async () => {

            const engine = {
                start: function () { },
                isReady: function () {

                    return true;
                },
                get: function (key) {

                    return {
                        stored: 'stored',
                        item: 'item'
                    };
                },
                validateSegmentName: function () {

                    return null;
                }
            };
            const policyConfig = {
                expiresIn: 50000,
                getDecoratedValue: true
            };

            const client = new Catbox.Client(engine);
            const policy = new Catbox.Policy(policyConfig, client, 'test');

            const { value, report } = await policy.get('test1');

            expect(value).to.equal('item');
            expect(report.isStale).to.be.false();
            expect(policy.stats).to.equal({ sets: 0, gets: 1, hits: 1, stales: 0, generates: 0, errors: 0 });
        });

        it('returns null on get when no cache client provided', async () => {

            const policy = new Catbox.Policy({ expiresIn: 1 });

            const value = await policy.get('x');

            expect(value).to.not.exist();
            expect(policy.stats).to.equal({ sets: 0, gets: 1, hits: 0, stales: 0, generates: 0, errors: 0 });
        });

        it('errors when staleIn function throws', async () => {

            let gen = 0;

            const staleIn = function () {

                if (++gen === 1) {
                    throw new TypeError();
                }

                return 100;
            };

            const rule = {
                expiresIn: 100,
                staleIn,
                staleTimeout: 5,
                generateTimeout: 20,
                generateFunc() {

                    return true;
                }
            };

            const client = new Catbox.Client(Connection, { partition: 'test-partition' });
            const policy = new Catbox.Policy(rule, client, 'test-segment');

            await client.start();

            expect(await policy.get('test')).to.equal(true);
            await expect(policy.get('test')).to.reject(TypeError);
            expect(await policy.get('test')).to.equal(true);
        });

        describe('generate', () => {

            it('returns falsey items', async () => {

                const engine = {
                    start: function () { },
                    isReady: function () {

                        return true;
                    },
                    get: function (key) {

                        return {
                            stored: false,
                            item: false
                        };
                    },
                    validateSegmentName: function () {

                        return null;
                    }
                };
                const policyConfig = {
                    expiresIn: 50000,
                    generateTimeout: 10,
                    generateFunc: (id) => false
                };

                const client = new Catbox.Client(engine);
                const policy = new Catbox.Policy(policyConfig, client, 'test');

                const value = await policy.get('test1');

                expect(value).to.equal(false);
            });

            it('bypasses cache when not configured', async () => {

                const policy = new Catbox.Policy({
                    expiresIn: 1,
                    generateTimeout: 10,
                    generateFunc: (id) => 'new result',
                    getDecoratedValue: true
                });

                const { value, cached } = await policy.get('test');

                expect(value).to.equal('new result');
                expect(cached).to.not.exist();
            });

            it('returns the processed cached item', async () => {

                let gen = 0;
                const rule = {
                    expiresIn: 100,
                    staleIn: 20,
                    staleTimeout: 5,
                    generateTimeout: 10,
                    generateFunc: (id) => ({ gen: ++gen })
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const value = await policy.get('test');

                expect(value.gen).to.equal(1);
            });

            it('drops entry if flags.ttl is 0', async () => {

                let gen = 0;
                const rule = {
                    expiresIn: 100,
                    staleIn: 20,
                    staleTimeout: 5,
                    generateTimeout: 10,
                    generateFunc(id, flags) {

                        if (++gen === 2) {
                            flags.ttl = 0;
                        }

                        return gen;
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                expect(await policy.get('test')).to.equal(1);
                expect(await policy.get('test')).to.equal(1);

                await Hoek.wait(25);

                expect(await policy.get('test')).to.equal(2);
                expect(await policy.get('test')).to.equal(3);
                expect(await policy.get('test')).to.equal(3);
            });

            it('switches rules after construction', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 100,
                    staleIn: 20,
                    staleTimeout: 5,
                    generateTimeout: 10,
                    generateFunc: (id) => ({ gen: ++gen })
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy({ expiresIn: 100 }, client, 'test-segment');

                await client.start();

                const value1 = await policy.get('test');

                expect(value1).to.not.exist();
                policy.rules(rule);

                const value2 = await policy.get('test');

                expect(value2.gen).to.equal(1);
                expect(policy.stats).to.equal({ sets: 1, gets: 2, hits: 0, stales: 0, generates: 1, errors: 0 });
            });

            it('returns the processed cached item after cache error', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 100,
                    staleIn: 20,
                    staleTimeout: 5,
                    generateTimeout: 10,
                    generateFunc: (id) => ({ gen: ++gen })
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                client.get = function (key) {

                    return Promise.reject(new Error('bad client'));
                };

                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const value = await policy.get('test');

                expect(value.gen).to.equal(1);
            });

            it('returns an error when get fails and generateOnReadError is false', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 100,
                    staleIn: 20,
                    staleTimeout: 5,
                    generateOnReadError: false,
                    generateTimeout: 10,
                    generateFunc: (id) => ({ gen: ++gen })
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                client.get = function (key) {

                    return Promise.reject(new Error('bad client'));
                };

                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                await expect(policy.get('test')).to.reject(Error, 'bad client');
            });

            it('returns the processed cached item using manual ttl', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 100,
                    staleIn: 50,
                    staleTimeout: 10,
                    generateTimeout: 50,
                    generateFunc: async function (id, flags) {

                        await Hoek.wait(15);
                        flags.ttl = 200;
                        return { gen: ++gen };
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const value1 = await policy.get('test');
                expect(value1.gen).to.equal(1);         // Fresh

                await Hoek.wait(110);

                const value2 = await policy.get('test');
                expect(value2.gen).to.equal(1);         // Stale
            });

            it('returns stale object then fresh object based on timing', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 200,
                    staleIn: 50,
                    staleTimeout: 10,
                    generateTimeout: 50,
                    generateFunc: async function (id, flags) {

                        await Hoek.wait(15);
                        return { gen: ++gen };
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const value1 = await policy.get('test');
                expect(value1.gen).to.equal(1);         // Fresh

                await Hoek.wait(60);

                const value2 = await policy.get('test');
                expect(value2.gen).to.equal(1);         // Stale

                await Hoek.wait(15);

                const value3 = await policy.get('test');
                expect(value3.gen).to.equal(2);         // Fresh
            });

            it('returns stale objects then fresh object based on timing, with concurrent generateFunc calls', async () => {

                let gen = 0;

                let generateCalled = 0;

                const rule = {
                    expiresIn: 1000,
                    staleIn: 100,
                    staleTimeout: 5,
                    generateTimeout: 100,
                    generateFunc: async function (id, flags) {

                        ++generateCalled;
                        await Hoek.wait(50);
                        flags.ttl = 1000;
                        return { gen: ++gen };
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const value1 = await policy.get('test');
                expect(value1.gen).to.equal(1);         // Fresh

                await Hoek.wait(101);

                const value2 = await policy.get('test');
                expect(value2.gen).to.equal(1);         // Stale

                const value3 = await policy.get('test');
                expect(value3.gen).to.equal(1);         // Stale

                await Hoek.wait(60);

                const value4 = await policy.get('test');
                expect(value4.gen).to.equal(3);         // Fresh

                expect(generateCalled).to.equal(3);     // original generate + 2 calls while stale
            });

            it('generateTimeout is triggered when staleTimeout is greater than ttl and generation is slow', async () => {

                let gen = 0;

                let generateCalled = 0;

                const rule = {
                    expiresIn: 121,
                    staleIn: 1,
                    staleTimeout: 50,
                    generateTimeout: 100,
                    generateFunc: async function (id, flags) {

                        await Hoek.wait(generateCalled++ === 1 ? 2500 : 1);
                        return { gen: ++gen };
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const value1 = await policy.get('test');

                expect(value1.gen).to.equal(1);        // Fresh

                await Hoek.wait(80);
                const error = await expect(policy.get('test')).to.reject(Error);

                expect(error).to.exist();
                expect(error.output.statusCode).to.equal(503);       // Service Unavailable

                await Hoek.wait(8);
                const value3 = await policy.get('test');

                expect(value3.gen).to.equal(2);        // Fresh
            });

            it('returns stale objects then fresh object based on timing, with only 1 concurrent generateFunc call during pendingGenerateTimeout period ', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 1000,
                    staleIn: 150 * 3,
                    staleTimeout: 5 * 3,
                    pendingGenerateTimeout: 250 * 3,
                    generateTimeout: 100 * 3,
                    generateFunc: async function (id, flags) {

                        await Hoek.wait(50 * 3);
                        return { gen: ++gen };
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const value1 = await policy.get('test');
                expect(value1.gen).to.equal(1);        // Fresh

                await Hoek.wait(160 * 3);

                const value2 = await policy.get('test');
                expect(value2.gen).to.equal(1);        // Stale

                await Hoek.wait(10 * 3);

                const value3 = await policy.get('test');
                expect(value3.gen).to.equal(1);        // Stale

                await Hoek.wait(50 * 3);

                const value4 = await policy.get('test');
                expect(value4.gen).to.equal(2);         // Fresh

                expect(gen).to.equal(2);     // original generate + 1 call while stale
            });

            it('returns fresh object after cache is expired and called during a pendingGenerateTimeout period', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 1000,
                    staleIn: 100,
                    staleTimeout: 5,
                    pendingGenerateTimeout: 200,
                    generateTimeout: false,
                    generateFunc: async function (id, flags) {

                        await Hoek.wait(100);
                        return { gen: ++gen };
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const value1 = await policy.get('test');
                expect(value1.gen).to.equal(1);         // Fresh

                await Hoek.wait(960);

                const value2 = await policy.get('test');
                expect(value2.gen).to.equal(1);         // Stale

                await Hoek.wait(40);

                const value3 = await policy.get('test');
                expect(value3.gen).to.equal(2);         // New
            });

            it('returns stale object then fresh object based on timing using staleIn function', async () => {

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
                    generateFunc: async function (id, flags) {

                        await Hoek.wait(6);
                        flags.ttl = 100;
                        return { gen: ++gen };
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const value1 = await policy.get('test');

                expect(value1.gen).to.equal(1);        // Fresh

                await Hoek.wait(21);
                const value2 = await policy.get('test');

                expect(value2.gen).to.equal(1);        // Stale

                await Hoek.wait(3);
                const value3 = await policy.get('test');

                expect(value3.gen).to.equal(2);        // Fresh
            });

            it('returns stale object then invalidate cache on error', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 100,
                    staleIn: 20,
                    staleTimeout: 5,
                    generateTimeout: 20,
                    generateFunc: async function (id) {

                        ++gen;
                        await Hoek.wait(6);
                        if (gen !== 2) {
                            return { gen };
                        }

                        throw new Error();
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const value1 = await policy.get('test');

                expect(value1.gen).to.equal(1);     // Fresh

                await Hoek.wait(21);
                const value2 = await policy.get('test');

                // Generates a new one in background which will produce Error and clear the cache

                expect(value2.gen).to.equal(1);     // Stale

                await Hoek.wait(3);
                const value3 = await policy.get('test');

                expect(value3.gen).to.equal(3);     // Fresh
            });

            it('returns stale object then invalidate cache on error when dropOnError is true', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 100,
                    staleIn: 20,
                    staleTimeout: 5,
                    dropOnError: true,
                    generateTimeout: 20,
                    generateFunc: async function (id) {

                        ++gen;
                        await Hoek.wait(6);
                        if (gen === 1) {
                            return { gen };
                        }

                        throw new Error();
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const value1 = await policy.get('test');

                expect(value1.gen).to.equal(1);     // Fresh

                await Hoek.wait(21);
                const value2 = await policy.get('test');

                // Generates a new one in background which will produce Error and clear the cache

                expect(value2.gen).to.equal(1);     // Stale

                await Hoek.wait(3);
                await expect(policy.get('test')).to.reject(Error);   // Stale
            });

            it('returns stale object then invalidate cache on error when dropOnError is not set', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 100,
                    staleIn: 20,
                    staleTimeout: 5,
                    generateTimeout: 20,
                    generateFunc: async function (id) {

                        ++gen;
                        await Hoek.wait(6);
                        if (gen === 1) {
                            return { gen };
                        }

                        throw new Error();
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const value1 = await policy.get('test');

                expect(value1.gen).to.equal(1);     // Fresh

                await Hoek.wait(21);
                const value2 = await policy.get('test');

                // Generates a new one in background which will produce Error and clear the cache

                expect(value2.gen).to.equal(1);     // Stale

                await Hoek.wait(3);
                await expect(policy.get('test')).to.reject(Error);    // Stale
            });

            it('returns stale object then does not invalidate cache on timeout if dropOnError is false', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 100,
                    staleIn: 20,
                    staleTimeout: 5,
                    dropOnError: false,
                    generateTimeout: 20,
                    generateFunc: async function (id) {

                        ++gen;
                        await Hoek.wait(6);
                        if (gen === 1) {
                            return { gen };
                        }

                        throw new Error();
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const value1 = await policy.get('test');

                expect(value1.gen).to.equal(1);     // Fresh

                await Hoek.wait(21);
                const value2 = await policy.get('test');

                // Generates a new one in background which will produce Error, but not clear the cache

                expect(value2.gen).to.equal(1);     // Stale

                await Hoek.wait(3);
                const value3 = await policy.get('test');

                expect(value3.gen).to.equal(1);     // Stale
            });

            it('returns stale object then does not invalidate cache on error if dropOnError is false', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 100,
                    staleIn: 20,
                    staleTimeout: 5,
                    dropOnError: false,
                    generateTimeout: 10,
                    generateFunc: function (id) {

                        ++gen;
                        if (gen === 1) {
                            return { gen };
                        }

                        throw new Error();
                    },
                    getDecoratedValue: true
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const { value: value1 } = await policy.get('test');

                expect(value1.gen).to.equal(1);     // Fresh

                await Hoek.wait(21);
                const { value: value2, report: report2 } = await policy.get('test');

                // Generates a new one in background which will produce Error, but not clear the cache

                expect(report2.error).to.exist();
                expect(value2.gen).to.equal(1);     // Stale

                const { value: value3, report: report3 } = await policy.get('test');
                expect(report3.error).to.exist();
                expect(value3.gen).to.equal(1);     // Stale
            });

            it('invalidates cache on error if dropOnError is true', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 100,
                    staleIn: 20,
                    staleTimeout: 5,
                    dropOnError: true,
                    generateTimeout: 10,
                    generateFunc: function (id) {

                        ++gen;
                        if (gen === 1) {
                            return { gen };
                        }

                        throw new Error();
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const value1 = await policy.get('test');

                expect(value1.gen).to.equal(1);     // Fresh

                await Hoek.wait(21);

                await expect(policy.get('test')).to.reject(Error);      // Generates a new one in background which will produce Error and clear the cache
                await expect(policy.get('test')).to.reject(Error);
            });

            it('returns stale object then invalidates cache on error if dropOnError is not defined', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 100,
                    staleIn: 20,
                    staleTimeout: 5,
                    generateTimeout: 10,
                    generateFunc: function (id) {

                        ++gen;
                        if (gen === 1) {
                            return { gen };
                        }

                        throw new Error('boom');
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const value = await policy.get('test');
                expect(value.gen).to.equal(1);     // Fresh

                await Hoek.wait(21);

                await expect(policy.get('test')).to.reject('boom');         // Generates a new one in background which will produce Error, but not clear the cache
                await expect(policy.get('test')).to.reject('boom');
            });

            it('returns fresh objects', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 100,
                    staleIn: 20,
                    staleTimeout: 10,
                    generateTimeout: 10,
                    generateFunc: (id) => ({ gen: ++gen }),
                    getDecoratedValue: true
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const { value: value1, report: report1 } = await policy.get('test');

                expect(report1.error).to.not.exist();
                expect(value1.gen).to.equal(1);     // Fresh

                await Hoek.wait(21);
                const { value: value2, report: report2 } = await policy.get('test');

                expect(report2.error).to.not.exist();
                expect(value2.gen).to.equal(2);     // Fresh

                await Hoek.wait(1);
                const { value: value3, report: report3 } = await policy.get('test');

                expect(report3.error).to.not.exist();
                expect(value3.gen).to.equal(2);     // Fresh
            });

            it('invalidates cache on error without stale', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 20,
                    staleIn: 5,
                    staleTimeout: 5,
                    generateTimeout: 10,
                    generateFunc: function (id) {

                        ++gen;
                        if (gen !== 2) {
                            return { gen };
                        }

                        throw new Error();
                    },
                    getDecoratedValue: true
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const { value: value1, report: report1 } = await policy.get('test');
                expect(value1.gen).to.equal(1);     // Fresh
                expect(report1.error).to.not.exist();

                await Hoek.wait(8);

                await expect(policy.get('test')).to.reject(Error);

                const value3 = await policy._cache.get({ segment: policy._segment, id: 'test' });
                expect(value3).to.equal(null);
            });

            it('returns timeout error when generate takes too long', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 15 * 3,
                    generateTimeout: 5 * 3,
                    generateFunc: async function (id) {

                        await Hoek.wait(10 * 3);
                        return { gen: ++gen };
                    },
                    getDecoratedValue: true
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const error1 = await expect(policy.get('test')).to.reject(Error);
                expect(error1.output.statusCode).to.equal(503);

                await Hoek.wait(10 * 3);

                const { value: value2, report: report2 } = await policy.get('test');

                expect(value2.gen).to.equal(1);
                expect(report2.error).to.not.exist();

                await Hoek.wait(15 * 3);

                const error3 = await expect(policy.get('test')).to.reject(Error);
                expect(error3.output.statusCode).to.equal(503);
            });

            it('does not block the queue when generate fails to call back', async () => {

                const rule = {
                    expiresIn: 50000,
                    generateTimeout: 5,
                    generateFunc: async function (id) {

                        await Hoek.block();
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const id = 'test';

                await expect(policy.get(id)).to.reject(Error);
                await expect(policy.get(id)).to.reject(Error);
            });

            it('blocks the queue when generate fails to call back', async () => {

                const rule = {
                    expiresIn: 50000,
                    generateTimeout: false,
                    generateFunc: async function (id) {

                        await Hoek.block();
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const id = 'test';
                let called = 0;

                policy.get(id).then(() => {

                    ++called;
                });

                policy.get(id).then(() => {

                    ++called;
                });

                await Hoek.wait(20);

                expect(called).to.equal(0);
            });

            it('queues requests while pending', async () => {

                let gen = 0;
                const rule = {
                    expiresIn: 100,
                    generateTimeout: 10,
                    generateFunc: (id) => ({ gen: ++gen })
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                let result = null;
                const compare = async () => {

                    const value = await policy.get('test');

                    if (!result) {
                        result = value;
                        return;
                    }

                    expect(result).to.equal(value);
                };

                await Promise.all([compare(), compare()]);
            });

            it('catches errors thrown in generateFunc and passes to all pending requests', async () => {

                const rule = {
                    expiresIn: 100,
                    generateTimeout: 10,
                    generateFunc: (id) => {

                        throw new Error('generate failed');
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                let result = null;
                const compare = async () => {

                    const error = await expect(policy.get('test')).to.reject(Error, 'generate failed');

                    if (!result) {
                        result = error;
                        return;
                    }

                    expect(result).to.equal(error);
                };

                await Promise.all([compare(), compare()]);
            });

            it('catches system errors thrown in generateFunc and passes to all pending requests', async () => {

                const rule = {
                    expiresIn: 100,
                    generateTimeout: 10,
                    generateFunc: (id) => {

                        throw new TypeError('generate failed');
                    }
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                let result = null;
                const compare = async () => {

                    const error = await expect(policy.get('test')).to.reject(TypeError, 'generate failed');

                    if (!result) {
                        result = error;
                        return;
                    }

                    expect(result).to.equal(error);
                };

                await Promise.all([compare(), compare()]);
            });

            it('does not return stale value from previous request timeout left behind', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 100,
                    staleIn: 20,
                    staleTimeout: 10,
                    generateTimeout: 20,
                    generateFunc: async (id) => {

                        await Hoek.wait(5);
                        return { gen: ++gen };
                    },
                    getDecoratedValue: true
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });

                const orig = client.connection.get;
                client.connection.get = async function (key) {      // Delayed get

                    await Hoek.wait(10);
                    return orig.call(client.connection, key);
                };

                const policy = new Catbox.Policy(rule, client, 'test-segment');

                await client.start();

                const { value: value1, report: report1 } = await policy.get('test');       // Cache lookup takes 10 + generate 5

                expect(value1.gen).to.equal(1);                      // Fresh
                expect(report1.error).to.not.exist();

                await Hoek.wait(21);                           // Wait for stale
                const { value: value2, report: report2 } = await policy.get('test');       // Cache lookup takes 10, generate comes back after 5

                expect(value2.gen).to.equal(2);                      // Fresh
                expect(report2.error).to.not.exist();

                const { value: value3, report: report3 } = await policy.get('test');       // Cache lookup takes 10

                expect(value3.gen).to.equal(2);                                 // Cached (10 left to stale)
                expect(report3.error).to.not.exist();

                client.connection.get = orig;
            });

            it('passes set error when generateIgnoreWriteError is false', async () => {

                let gen = 0;

                const rule = {
                    expiresIn: 100,
                    staleIn: 20,
                    staleTimeout: 5,
                    generateTimeout: 10,
                    generateIgnoreWriteError: false,
                    generateFunc: (id) => ({ gen: ++gen })
                };

                const client = new Catbox.Client(Connection, { partition: 'test-partition' });
                const policy = new Catbox.Policy(rule, client, 'test-segment');

                policy.set = function (key, value, ttl) {

                    throw new Error('bad cache');
                };

                await client.start();

                await expect(policy.get('test')).to.reject('bad cache');
            });
        });
    });

    describe('set()', () => {

        it('returns null on set when no cache client provided', async () => {

            const policy = new Catbox.Policy({ expiresIn: 1 });

            await policy.set('x', 'y', 100);
        });
    });

    describe('drop()', () => {

        it('returns null on drop when no cache client provided', async () => {

            const policy = new Catbox.Policy({ expiresIn: 1 });

            await policy.drop('x');
        });

        it('calls the extension clients drop function', async () => {

            let called = false;
            const engine = {
                start: function () { },
                isReady: function () {

                    return true;
                },
                drop: function (key) {

                    called = true;
                    return null;
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

            await policy.drop('test');

            expect(called).to.be.true();
        });

        it('counts drop error', async () => {

            const engine = {
                start: function () { },
                isReady: function () {

                    return true;
                },
                drop: function (key) {

                    throw new Error('failed');
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

            await expect(policy.drop('test')).to.reject(Error);
            expect(policy.stats.errors).to.equal(1);
        });

        it('errors on invalid keys', async () => {

            const policyConfig = {
                expiresIn: 50000
            };

            const client = new Catbox.Client(Connection);
            const policy = new Catbox.Policy(policyConfig, client, 'test');
            await client.start();

            await expect(policy.drop(null)).to.reject(Error);
        });

        it('handles objects as keys', async () => {

            const policyConfig = {
                expiresIn: 50000
            };

            const client = new Catbox.Client(Connection);
            const policy = new Catbox.Policy(policyConfig, client, 'test');
            await client.start();

            await policy.drop({ id: 'id', segment: 'segment' });
        });
    });

    describe('ttl()', () => {

        it('returns the ttl factoring in the created time', () => {

            const engine = {
                start: function () { },
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
        });

        it('returns expired when created in the future', () => {

            const config = {
                expiresAt: '10:00'
            };

            const rules = Catbox.Policy.compile(config);

            const created = new Date('Sat Sep 06 2014 13:00:00').getTime();
            const now = new Date('Sat Sep 06 2014 12:00:00').getTime();

            const ttl = Catbox.Policy.ttl(rules, created, now);
            expect(ttl).to.equal(0);
        });

        it('returns expired on c-e-n same day', () => {

            const config = {
                expiresAt: '10:00'
            };

            const rules = Catbox.Policy.compile(config);

            const created = new Date('Sat Sep 06 2014 9:00:00').getTime();
            const now = new Date('Sat Sep 06 2014 11:00:00').getTime();

            const ttl = Catbox.Policy.ttl(rules, created, now);
            expect(ttl).to.equal(0);
        });

        it('returns expired on c-(midnight)-e-n', () => {

            const config = {
                expiresAt: '10:00'
            };

            const rules = Catbox.Policy.compile(config);

            const created = new Date('Sat Sep 06 2014 11:00:00').getTime();
            const now = new Date('Sat Sep 07 2014 10:00:01').getTime();

            const ttl = Catbox.Policy.ttl(rules, created, now);
            expect(ttl).to.equal(0);
        });

        it('returns ttl on c-n-e same day', () => {

            const config = {
                expiresAt: '10:00'
            };

            const rules = Catbox.Policy.compile(config);

            const created = new Date('Sat Sep 06 2014 9:00:00').getTime();
            const now = new Date('Sat Sep 06 2014 9:30:00').getTime();

            const ttl = Catbox.Policy.ttl(rules, created, now);
            expect(ttl).to.equal(30 * 60 * 1000);
        });

        it('returns ttl on c-(midnight)-n-e', () => {

            const config = {
                expiresAt: '10:00'
            };

            const rules = Catbox.Policy.compile(config);

            const created = new Date('Sat Sep 06 2014 11:00:00').getTime();
            const now = new Date('Sat Sep 07 2014 9:00:00').getTime();

            const ttl = Catbox.Policy.ttl(rules, created, now);
            expect(ttl).to.equal(60 * 60 * 1000);
        });
    });

    describe('compile()', () => {

        it('does not try to compile a null config', () => {

            const rule = Catbox.policy.compile(null);
            expect(rule).to.equal({});
        });

        it('compiles a single rule', () => {

            const config = {
                expiresIn: 50000
            };

            const rule = Catbox.policy.compile(config, false);
            expect(rule.expiresIn).to.equal(config.expiresIn);
        });

        it('ignores external options', () => {

            const config = {
                expiresIn: 50000,
                cache: true
            };

            const rule = Catbox.policy.compile(config, false);
            expect(rule.expiresIn).to.equal(config.expiresIn);
        });

        it('assigns the expiresIn when the rule is cached', () => {

            const config = {
                expiresIn: 50000
            };

            const rule = Catbox.policy.compile(config, false);
            expect(rule.expiresIn).to.equal(config.expiresIn);
        });

        it('allows a rule with neither expiresAt or expiresIn', () => {

            const fn = function () {

                Catbox.policy.compile({ cache: 1 }, true);
            };

            expect(fn).to.not.throw();
        });

        it('allows a rule with expiresAt and undefined expiresIn', () => {

            const fn = function () {

                Catbox.policy.compile({ expiresIn: undefined, expiresAt: '09:00' }, true);
            };

            expect(fn).to.not.throw();
        });

        it('allows combination of expiresIn, staleTimeout and staleIn function', () => {

            const staleIn = function (stored, ttl) {

                return 1000;
            };

            const config = {
                expiresIn: 500000,
                staleIn,
                staleTimeout: 500,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.not.throw();
        });

        it('throws an error when staleIn is greater than expiresIn', () => {

            const config = {
                expiresIn: 500000,
                staleIn: 1000000,
                staleTimeout: 500,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw('staleIn must be less than expiresIn');
        });

        it('throws an error when staleTimeout is greater than expiresIn', () => {

            const config = {
                expiresIn: 500000,
                staleIn: 100000,
                staleTimeout: 500000,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw('staleTimeout must be less than expiresIn');
        });

        it('throws an error when staleTimeout is greater than expiresIn - staleIn', () => {

            const config = {
                expiresIn: 30000,
                staleIn: 20000,
                staleTimeout: 10000,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw('staleTimeout must be less than the delta between expiresIn and staleIn');
        });

        it('throws an error when staleTimeout is used without server mode', () => {

            const config = {
                expiresIn: 1000000,
                staleIn: 500000,
                staleTimeout: 500,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const fn = function () {

                new Catbox.Policy(config);
            };

            expect(fn).to.throw('Cannot use stale options without server-side caching');
        });

        it('returns rule when staleIn is less than expiresIn', () => {

            const config = {
                expiresIn: 1000000,
                staleIn: 500000,
                staleTimeout: 500,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const rule = Catbox.policy.compile(config, true);
            expect(rule.staleIn).to.equal(500 * 1000);
            expect(rule.expiresIn).to.equal(1000 * 1000);
        });

        it('returns rule when staleIn is less than 24 hours and using expiresAt', () => {

            const config = {
                expiresAt: '03:00',
                staleIn: 5000000,
                staleTimeout: 500,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const rule = Catbox.policy.compile(config, true);
            expect(rule.staleIn).to.equal(5000 * 1000);
        });

        it('does not throw an error if has both staleTimeout and staleIn', () => {

            const config = {
                staleIn: 30000,
                staleTimeout: 300,
                expiresIn: 60000,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.not.throw();
        });

        it('throws an error if trying to use stale caching on the client', () => {

            const config = {
                staleIn: 30000,
                expiresIn: 60000,
                staleTimeout: 300,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, false);
            };

            expect(fn).to.throw('Cannot use stale options without server-side caching');
        });

        it('converts the stale time to ms', () => {

            const config = {
                staleIn: 30000,
                expiresIn: 60000,
                staleTimeout: 300,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const rule = Catbox.policy.compile(config, true);

            expect(rule.staleIn).to.equal(config.staleIn);
        });

        it('throws an error if staleTimeout is greater than expiresIn', () => {

            const config = {
                staleIn: 2000,
                expiresIn: 10000,
                staleTimeout: 30000,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw('staleTimeout must be less than expiresIn');
        });

        it('throws an error if staleIn is greater than expiresIn', () => {

            const config = {
                staleIn: 1000000,
                expiresIn: 60000,
                staleTimeout: 30,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, false);
            };

            expect(fn).to.throw('staleIn must be less than expiresIn');
        });

        it('allows a rule with generateFunc and generateTimeout', () => {

            const config = {
                expiresIn: 50000,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.not.throw();
        });

        it('throws an error with generateFunc but no generateTimeout', () => {

            const config = {
                expiresIn: 50000,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw(/Invalid cache policy configuration/);
        });

        it('throws an error with generateTimeout but no generateFunc', () => {

            const config = {
                expiresIn: 50000,
                generateTimeout: 10
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw(/Invalid cache policy configuration/);
        });

        it('throws an error if staleTimeout is greater than pendingGenerateTimeout', () => {

            const config = {
                staleIn: 30000,
                expiresIn: 60000,
                staleTimeout: 300,
                pendingGenerateTimeout: 200,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw('pendingGenerateTimeout must be greater than staleTimeout if specified');
        });

        it('should accept a valid pendingGenerateTimeout', () => {

            const config = {
                staleIn: 30000,
                expiresIn: 60000,
                staleTimeout: 300,
                pendingGenerateTimeout: 5000,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const rule = Catbox.policy.compile(config, true);
            expect(rule.pendingGenerateTimeout).to.equal(5000);
        });

        it('throws an error if staleIn is greater than one day when expiredAt is used', () => {

            const config = {
                staleIn: 1000 * 60 * 60 * 24 + 1,
                expiresAt: '12:00',
                staleTimeout: 300,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw();
        });

        it('allows staleIn to be greater than one day when expiredAt is not used', () => {

            const config = {
                staleIn: 1000 * 60 * 60 * 24 + 1,
                expiresIn: 1000 * 60 * 60 * 24 + 400,
                staleTimeout: 300,
                generateTimeout: 10,
                generateFunc: async (id) => {

                    await Hoek.block();
                }
            };

            const fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.not.throw();
        });
    });

    describe('Policy.ttl()', () => {

        it('returns zero when a rule is expired', () => {

            const config = {
                expiresIn: 50000
            };
            const rule = Catbox.policy.compile(config, false);
            let created = new Date(Date.now());
            created = created.setMinutes(created.getMinutes() - 5);

            const ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.be.equal(0);
        });

        it('returns a positive number when a rule is not expired', () => {

            const config = {
                expiresIn: 50000
            };
            const rule = Catbox.policy.compile(config, false);
            const created = new Date(Date.now());

            const ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.be.greaterThan(0);
        });

        it('returns the correct expires time when no created time is provided', () => {

            const config = {
                expiresIn: 50000
            };
            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule);
            expect(ttl).to.equal(50000);
        });

        it('returns 0 when created several days ago and expiresAt is used', () => {

            const config = {
                expiresAt: '13:00'
            };
            const created = Date.now() - 313200000;                                       // 87 hours (3 days + 15 hours)
            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.equal(0);
        });

        it('returns 0 when created in the future', () => {

            const config = {
                expiresIn: 100
            };
            const created = Date.now() + 1000;
            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.equal(0);
        });

        it('returns 0 for bad rule', () => {

            const created = Date.now() - 1000;
            const ttl = Catbox.policy.ttl({}, created);
            expect(ttl).to.equal(0);
        });

        it('returns 0 when created 60 hours ago and expiresAt is used with an hour before the created hour', () => {

            const config = {
                expiresAt: '12:00'
            };
            const created = Date.now() - 342000000;                                       // 95 hours ago (3 days + 23 hours)
            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.equal(0);
        });

        it('returns a positive number when using a future expiresAt', () => {

            let hour = new Date(Date.now() + 60 * 60 * 1000).getHours();
            hour = hour === 0 ? 1 : hour;

            const config = {
                expiresAt: hour + ':00'
            };

            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule);
            expect(ttl).to.be.greaterThan(0);
        });

        it('returns the correct number when using a future expiresAt', () => {

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
        });

        it('returns correct number when using an expiresAt time tomorrow', () => {

            const hour = new Date(Date.now() - 60 * 60 * 1000).getHours();

            const config = {
                expiresAt: hour + ':00'
            };

            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule);
            expect(ttl).to.be.about(23 * 60 * 60 * 1000, 60 * 60 * 1000);
        });

        it('returns correct number when using a created time from yesterday and expires in 2 hours', () => {

            const hour = new Date(Date.now() + 2 * 60 * 60 * 1000).getHours();

            const config = {
                expiresAt: hour + ':00'
            };
            const created = new Date(Date.now());
            created.setHours(new Date(Date.now()).getHours() - 22);

            const rule = Catbox.policy.compile(config, false);

            const ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.be.about(60 * 60 * 1000, 60 * 60 * 1000);
        });
    });

    describe('isReady()', () => {

        it('returns cache engine readiness', async () => {

            const expected = true;
            const engine = {
                start: function () { },
                isReady: function () {

                    return expected;
                },
                get: function (key) {

                    throw new Error();
                },
                validateSegmentName: function () {

                    return null;
                }
            };
            const client = new Catbox.Client(engine);
            const policy = new Catbox.Policy({}, client, 'test');


            await client.start();

            expect(policy.isReady()).to.equal(expected);
        });

        it('returns false when no cache client provided', () => {

            const policy = new Catbox.Policy({ expiresIn: 1 });

            expect(policy.isReady()).to.equal(false);
        });
    });
});
