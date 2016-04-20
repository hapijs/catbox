'use strict';

// Load modules

const Catbox = require('../../');
const Code = require('code');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.experiment;
const it = lab.test;
const expect = Code.expect;


describe('Client (promise)', () => {

    it('uses prototype engine (promise)', () => {

        const Obj = require('../import');
        const client = new Catbox.Client(Obj);

        const key = { id: 'x', segment: 'test' };

        return client.start()
        .then(() => client.set(key, '123', 1000))
        .then(() => client.get(key))
        .then((result) => {

            expect(result.item).to.equal('123');
        });
    });

    it('supports empty keys (promise)', () => {

        const Obj = require('../import');
        const client = new Catbox.Client(Obj);

        const key = { id: '', segment: 'test' };

        return client.start()
        .then(() => client.set(key, '123', 1000))
        .then(() => client.get(key))
        .then((result) => {

            expect(result.item).to.equal('123');
        });
    });

    it('uses object instance engine (promise)', () => {

        const Obj = require('../import');
        const client = new Catbox.Client(new Obj());

        const key = { id: 'x', segment: 'test' };

        return client.start()
        .then(() => client.set(key, '123', 1000))
        .then(() => client.get(key))
        .then((result) => {

            expect(result.item).to.equal('123');
        });
    });

    it('errors when calling get on a bad connection (promise)', () => {

        const errorEngine = {
            start: function (callback) {

                callback(null);
            },
            stop: function () {
            },
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

        return client.get(key).catch((err) => {

            expect(err).to.exist();
            expect(err.message).to.equal('fail');
        });
    });

    describe('start() (promise)', () => {

        it('passes an error in the callback when one occurs (promise)', () => {

            const engine = {
                start: function (callback) {

                    callback(new Error());
                }
            };

            const client = new Catbox.Client(engine);
            return client.start().catch((err) => {

                expect(err).to.exist();
            });
        });
    });

    describe('get() (promise)', () => {

        it('returns an error when the connection is not ready (promise)', () => {

            const engine = {
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return false;
                }
            };

            const client = new Catbox.Client(engine);
            return client.get('test').catch((err) => {

                expect(err).to.be.instanceOf(Error);
                expect(err.message).to.equal('Disconnected');
            });
        });

        it('wraps the result with cached details (promise)', () => {

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
            return client.get({ id: 'id', segment: 'segment' })
            .then((cached) => {

                expect(cached.item).to.equal('test1');
                expect(cached.stored).to.equal('test2');
                expect(cached.ttl).to.exist();
            });
        });

        it('returns nothing when item is not found (promise)', () => {

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
            return client.get({ id: 'id', segment: 'segment' })
            .then((cached) => {

                expect(cached).to.equal(null);
            });
        });

        it('returns nothing when item is not found (undefined item) (promise)', () => {

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
            return client.get({ id: 'id', segment: 'segment' })
            .then((cached) => {

                expect(cached).to.equal(null);
            });
        });

        it('returns falsey items (promise)', () => {

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
            return client.get({ id: 'id', segment: 'segment' })
            .then((cached) => {

                expect(cached.item).to.equal(false);
            });
        });

        it('expires item (promise)', (done) => {

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
            return client.get({ id: 'id', segment: 'segment' })
            .then((cached) => {

                expect(cached).to.equal(null);
            });
        });

        it('errors on empty key (promise)', () => {

            const client = new Catbox.Client(require('../import'));

            return client.start()
            .then(() => client.get({}))
            .catch((err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Invalid key');
            });
        });

    });

    describe('set() (promise)', () => {

        it('returns an error when the connection is not ready (promise)', () => {

            const engine = {
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return false;
                }
            };

            const client = new Catbox.Client(engine);

            return client.set('test', 'test', 'test')
            .catch((err) => {

                expect(err).to.be.instanceOf(Error);
                expect(err.message).to.equal('Disconnected');
            });
        });
    });

    describe('drop() (promise)', () => {

        it('calls the extension clients drop function (promise)', (done) => {

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

            return client.drop({ id: 'id', segment: 'segment' })
            .then((result) => {

                expect(result).to.equal('success');
            });
        });
    });

    describe('validateKey() (promise)', () => {

        it('errors on missing segment (promise)', (done) => {

            const Obj = require('../import');
            const client = new Catbox.Client(Obj);

            const key = { id: 'x' };

            return client.start()
            .then(() => client.set(key, '123', 1000))
            .catch((err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Invalid key');
            });
        });
    });
});
