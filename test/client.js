'use strict';

// Load modules

const Catbox = require('..');
const Code = require('code');
const Lab = require('lab');

const Connections = require('./connections');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.experiment;
const it = lab.test;
const expect = Code.expect;


describe('Client', () => {

    it('uses prototype engine', async () => {

        const client = new Catbox.Client(Connections.Callbacks);
        await client.start();

        const key = { id: 'x', segment: 'test' };
        await client.set(key, '123', 1000);

        const result = await client.get(key);

        expect(result.item).to.equal('123');
    });

    it('supports empty keys', async () => {

        const client = new Catbox.Client(Connections.Callbacks);
        await client.start();

        const key = { id: '', segment: 'test' };
        await client.set(key, '123', 1000);

        const result = await client.get(key);

        expect(result.item).to.equal('123');
    });

    it('uses object instance engine', async () => {

        const client = new Catbox.Client(new Connections.Callbacks());
        await client.start();

        const key = { id: 'x', segment: 'test' };
        await client.set(key, '123', 1000);

        const result = await client.get(key);

        expect(result.item).to.equal('123');
    });

    it('errors when calling get on a bad connection', async () => {

        const errorEngine = {
            start: function (callback) {

                callback(null);
            },
            stop: function () { },
            isReady: function () {

                return true;
            },
            validateSegmentName: function () {

                return null;
            },
            get: function (key, callback) {

                return callback(new Error('fail'));
            },
            set: function (key, value, ttl, callback) {

                return callback(new Error('fail'));
            },
            drop: function (key, callback) {

                return callback(new Error('fail'));
            }
        };

        const client = new Catbox.Client(errorEngine);
        const key = { id: 'x', segment: 'test' };

        await expect(client.get(key)).to.reject('fail');
    });

    describe('start()', () => {

        it('passes an error in the callback when one occurs', async () => {

            const engine = {
                start: function (callback) {

                    callback(new Error());
                }
            };

            const client = new Catbox.Client(engine);

            await expect(client.start()).to.reject();
        });
    });

    describe('get()', () => {

        it('returns an error when the connection is not ready', async () => {

            const engine = {
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return false;
                }
            };

            const client = new Catbox.Client(engine);

            await expect(client.get('test')).to.reject(Error, 'Disconnected');
        });

        it('wraps the result with cached details', async () => {

            const engine = {
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return true;
                },
                get: function (key, callback) {

                    const result = {
                        item: 'test1',
                        stored: 'test2'
                    };

                    callback(null, result);
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
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return true;
                },
                get: function (key, callback) {

                    callback(null, null);
                }
            };

            const client = new Catbox.Client(engine);
            const cached = await client.get({ id: 'id', segment: 'segment' });

            expect(cached).to.equal(null);
        });

        it('returns nothing when item is not found (undefined item)', async () => {

            const engine = {
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return true;
                },
                get: function (key, callback) {

                    callback(null, { item: undefined });
                }
            };

            const client = new Catbox.Client(engine);
            const cached = await client.get({ id: 'id', segment: 'segment' });

            expect(cached).to.equal(null);
        });

        it('returns falsey items', async () => {

            const engine = {
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return true;
                },
                get: function (key, callback) {

                    callback(null, {
                        item: false,
                        stored: false
                    });
                }
            };

            const client = new Catbox.Client(engine);
            const cached = await client.get({ id: 'id', segment: 'segment' });

            expect(cached.item).to.equal(false);
        });

        it('expires item', async () => {

            const engine = {
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return true;
                },
                get: function (key, callback) {

                    const result = {
                        item: 'test1',
                        stored: Date.now() - 100,
                        ttl: 50
                    };

                    callback(null, result);
                }
            };

            const client = new Catbox.Client(engine);
            const cached = await client.get({ id: 'id', segment: 'segment' });

            expect(cached).to.equal(null);
        });

        it('errors on empty key', async () => {

            const client = new Catbox.Client(Connections.Callbacks);
            await client.start();

            await expect(client.get({})).to.reject('Invalid key');
        });
    });

    describe('set()', () => {

        it('returns an error when the connection is not ready', async () => {

            const engine = {
                start: function (callback) {

                    callback();
                },
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
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return true;
                },
                drop: function (key, callback) {

                    callback(null, 'success');
                }
            };

            const client = new Catbox.Client(engine);
            const result = await client.drop({ id: 'id', segment: 'segment' });

            expect(result).to.equal('success');
        });
    });

    describe('validateKey()', () => {

        it('errors on missing segment', async () => {

            const client = new Catbox.Client(Connections.Callbacks);
            await client.start();

            const key = { id: 'x' };
            await expect(client.set(key, '123', 1000)).to.reject('Invalid key');
        });
    });
});
