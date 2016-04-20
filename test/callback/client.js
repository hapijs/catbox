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


describe('Client', () => {

    it('uses prototype engine', (done) => {

        const Obj = require('../import');
        const client = new Catbox.Client(Obj);
        client.start((err) => {

            expect(err).to.not.exist();

            const key = { id: 'x', segment: 'test' };
            client.set(key, '123', 1000, (err) => {

                expect(err).to.not.exist();

                client.get(key, (err, result) => {

                    expect(err).to.not.exist();
                    expect(result.item).to.equal('123');
                    done();
                });
            });
        });
    });

    it('supports empty keys', (done) => {

        const Obj = require('../import');
        const client = new Catbox.Client(Obj);
        client.start((err) => {

            expect(err).to.not.exist();

            const key = { id: '', segment: 'test' };
            client.set(key, '123', 1000, (err) => {

                expect(err).to.not.exist();

                client.get(key, (err, result) => {

                    expect(err).to.not.exist();
                    expect(result.item).to.equal('123');
                    done();
                });
            });
        });
    });

    it('uses object instance engine', (done) => {

        const Obj = require('../import');
        const client = new Catbox.Client(new Obj());
        client.start((err) => {

            expect(err).to.not.exist();

            const key = { id: 'x', segment: 'test' };
            client.set(key, '123', 1000, (err) => {

                expect(err).to.not.exist();

                client.get(key, (err, result) => {

                    expect(err).to.not.exist();
                    expect(result.item).to.equal('123');
                    done();
                });
            });
        });
    });

    it('errors when calling get on a bad connection', (done) => {

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
        client.get(key, (err, result) => {

            expect(err).to.exist();
            expect(err.message).to.equal('fail');
            done();
        });
    });

    describe('start()', () => {

        it('passes an error in the callback when one occurs', (done) => {

            const engine = {
                start: function (callback) {

                    callback(new Error());
                }
            };

            const client = new Catbox.Client(engine);
            client.start((err) => {

                expect(err).to.exist();
                done();
            });
        });
    });

    describe('get()', () => {

        it('returns an error when the connection is not ready', (done) => {

            const engine = {
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return false;
                }
            };

            const client = new Catbox.Client(engine);
            client.get('test', (err) => {

                expect(err).to.be.instanceOf(Error);
                expect(err.message).to.equal('Disconnected');
                done();
            });
        });

        it('wraps the result with cached details', (done) => {

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
            client.get({ id: 'id', segment: 'segment' }, (err, cached) => {

                expect(err).to.not.exist();
                expect(cached.item).to.equal('test1');
                expect(cached.stored).to.equal('test2');
                expect(cached.ttl).to.exist();
                done();
            });
        });

        it('returns nothing when item is not found', (done) => {

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
            client.get({ id: 'id', segment: 'segment' }, (err, cached) => {

                expect(err).to.equal(null);
                expect(cached).to.equal(null);
                done();
            });
        });

        it('returns nothing when item is not found (undefined item)', (done) => {

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
            client.get({ id: 'id', segment: 'segment' }, (err, cached) => {

                expect(err).to.equal(null);
                expect(cached).to.equal(null);
                done();
            });
        });

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
                        item: false,
                        stored: false
                    });
                }
            };

            const client = new Catbox.Client(engine);
            client.get({ id: 'id', segment: 'segment' }, (err, cached) => {

                expect(err).to.equal(null);
                expect(cached.item).to.equal(false);
                done();
            });
        });

        it('expires item', (done) => {

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
            client.get({ id: 'id', segment: 'segment' }, (err, cached) => {

                expect(err).to.equal(null);
                expect(cached).to.equal(null);
                done();
            });
        });

        it('errors on empty key', (done) => {

            const client = new Catbox.Client(require('../import'));
            client.start((err) => {

                expect(err).to.not.exist();

                client.get({}, (err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Invalid key');
                    done();
                });
            });
        });
    });

    describe('set()', () => {

        it('returns an error when the connection is not ready', (done) => {

            const engine = {
                start: function (callback) {

                    callback();
                },
                isReady: function () {

                    return false;
                }
            };

            const client = new Catbox.Client(engine);
            client.set('test', 'test', 'test', (err) => {

                expect(err).to.be.instanceOf(Error);
                expect(err.message).to.equal('Disconnected');
                done();
            });
        });
    });

    describe('drop()', () => {

        it('calls the extension clients drop function', (done) => {

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
            client.drop({ id: 'id', segment: 'segment' }, (err, result) => {

                expect(err).to.not.exist();
                expect(result).to.equal('success');
                done();
            });
        });
    });

    describe('validateKey()', () => {

        it('errors on missing segment', (done) => {

            const Obj = require('../import');
            const client = new Catbox.Client(Obj);
            client.start((err) => {

                expect(err).to.not.exist();

                const key = { id: 'x' };
                client.set(key, '123', 1000, (err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Invalid key');
                    done();
                });
            });
        });
    });
});
