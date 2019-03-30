'use strict';

const Catbox = require('..');
const Code = require('@hapi/code');
const Lab = require('@hapi/lab');

const Connection = require('./connection');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Client', () => {

    it('uses prototype engine', async () => {

        const client = new Catbox.Client(Connection);
        await client.start();

        const key = { id: 'x', segment: 'test' };
        await client.set(key, '123', 1000);

        const result = await client.get(key);

        expect(result.item).to.equal('123');
    });

    it('supports empty keys', async () => {

        const client = new Catbox.Client(Connection);
        await client.start();

        const key = { id: '', segment: 'test' };
        await client.set(key, '123', 1000);

        const result = await client.get(key);

        expect(result.item).to.equal('123');
    });

    it('uses object instance engine', async () => {

        const client = new Catbox.Client(new Connection());
        await client.start();

        const key = { id: 'x', segment: 'test' };
        await client.set(key, '123', 1000);

        const result = await client.get(key);

        expect(result.item).to.equal('123');
    });

    it('passes options with default partition', () => {

        const client = new Catbox.Client(Connection);

        expect(client.connection.options).to.contain({ partition: 'catbox' });
    });

    it('passes options with custom partition', () => {

        const client = new Catbox.Client(Connection, { partition: 'custom' });

        expect(client.connection.options).to.contain({ partition: 'custom' });
    });

    it('supports shallow copied option properties', () => {

        const obj = {};
        const client = new Catbox.Client(Connection, { shallow: obj, deep: obj });

        expect(client.connection.options.shallow).to.shallow.equal(obj);
        expect(client.connection.options.deep).to.not.shallow.equal(obj);
    });

    it('errors when calling get on a bad connection', async () => {

        const errorEngine = {
            start: function () { },
            stop: function () { },
            isReady: function () {

                return true;
            },
            validateSegmentName: function () {

                return null;
            },
            get: function (key) {

                throw new Error('fail');
            }
        };

        const client = new Catbox.Client(errorEngine);
        const key = { id: 'x', segment: 'test' };

        await expect(client.get(key)).to.reject('fail');
    });

    describe('start()', () => {

        it('passes an error', async () => {

            const engine = {
                start: function () {

                    return Promise.reject(new Error());
                }
            };

            const client = new Catbox.Client(engine);
            await expect(client.start()).to.reject();
        });
    });

    describe('get()', () => {

        it('returns an error when the connection is not ready', async () => {

            const engine = {
                start: function () { },
                isReady: function () {

                    return false;
                }
            };

            const client = new Catbox.Client(engine);

            await expect(client.get('test')).to.reject(Error, 'Disconnected');
        });

        it('wraps the result with cached details', async () => {

            const engine = {
                start: function () { },
                isReady: function () {

                    return true;
                },
                get: function (key) {

                    const result = {
                        item: 'test1',
                        stored: 'test2'
                    };

                    return result;
                }
            };

            const client = new Catbox.Client(engine);
            const cached = await client.get({ id: 'id', segment: 'segment' });

            expect(cached.item).to.equal('test1');
            expect(cached.stored).to.equal('test2');
            expect(cached.ttl).to.exist();
        });

        it('returns nothing when item is not found', async () => {

            const engine = {
                start: function () { },
                isReady: function () {

                    return true;
                },
                get: function (key) {

                    return null;
                }
            };

            const client = new Catbox.Client(engine);
            const cached = await client.get({ id: 'id', segment: 'segment' });

            expect(cached).to.equal(null);
        });

        it('returns nothing when item is not found (undefined item)', async () => {

            const engine = {
                start: function () { },
                isReady: function () {

                    return true;
                },
                get: function (key) {

                    return { item: undefined };
                }
            };

            const client = new Catbox.Client(engine);
            const cached = await client.get({ id: 'id', segment: 'segment' });

            expect(cached).to.equal(null);
        });

        it('returns nothing when item is not found (null item)', async () => {

            const engine = {
                start: function () { },
                isReady: function () {

                    return true;
                },
                get: function (key) {

                    return { item: null };
                }
            };

            const client = new Catbox.Client(engine);
            const cached = await client.get({ id: 'id', segment: 'segment' });

            expect(cached).to.equal(null);
        });

        it('returns falsey items', async () => {

            const engine = {
                start: function () { },
                isReady: function () {

                    return true;
                },
                get: function (key) {

                    return { item: false, stored: false };
                }
            };

            const client = new Catbox.Client(engine);
            const cached = await client.get({ id: 'id', segment: 'segment' });

            expect(cached.item).to.equal(false);
        });

        it('expires item', async () => {

            const engine = {
                start: function () { },
                isReady: function () {

                    return true;
                },
                get: function (key) {

                    const result = {
                        item: 'test1',
                        stored: Date.now() - 100,
                        ttl: 50
                    };

                    return result;
                }
            };

            const client = new Catbox.Client(engine);
            const cached = await client.get({ id: 'id', segment: 'segment' });

            expect(cached).to.equal(null);
        });

        it('errors on empty key', async () => {

            const client = new Catbox.Client(Connection);
            await client.start();

            await expect(client.get({})).to.reject('Invalid key');
        });
    });

    describe('set()', () => {

        it('returns an error when the connection is not ready', async () => {

            const engine = {
                start: function () { },
                isReady: function () {

                    return false;
                }
            };

            const client = new Catbox.Client(engine);
            await expect(client.set('test', 'test', 'test')).to.reject(Error, 'Disconnected');
        });
    });

    describe('drop()', () => {

        it('calls the extension clients drop function', async () => {

            const engine = {
                start: function () { },
                isReady: function () {

                    return true;
                },
                drop: function (key) {

                    throw new Error('meh');
                }
            };

            const client = new Catbox.Client(engine);
            await expect(client.drop({ id: 'id', segment: 'segment' })).to.reject('meh');
        });
    });

    describe('validateKey()', () => {

        it('errors on missing segment', async () => {

            const client = new Catbox.Client(Connection);
            await client.start();

            const key = { id: 'x' };
            await expect(client.set(key, '123', 1000)).to.reject('Invalid key');
        });
    });
});
