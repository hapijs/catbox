'use strict';

// Load modules

const Catbox = require('../../');
const Code = require('code');
const Lab = require('lab');
const Import = require('../import');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.experiment;
const it = lab.test;
const expect = Code.expect;


describe('Catbox', () => {

    it('creates a new connection', (done) => {

        const client = new Catbox.Client(Import);
        client.start().then(() => {

            expect(client.isReady()).to.equal(true);
            done();
        });
    });

    it('closes the connection', (done) => {

        const client = new Catbox.Client(Import);
        client.start().then(() => {

            expect(client.isReady()).to.equal(true);
            client.stop();
            expect(client.isReady()).to.equal(false);
            done();
        });
    });

    it('gets an item after setting it', (done) => {

        const client = new Catbox.Client(Import);
        const key = { id: 'x', segment: 'test' };

        client.start()
        .then(() => client.set(key, '123', 500))
        .then(() => client.get(key))
        .then((result) => {

            expect(result.item).to.equal('123');
            done();
        });
    });

    it('fails setting an item circular references', (done) => {

        const client = new Catbox.Client(Import);
        client.start().then(() => {

            const key = { id: 'x', segment: 'test' };
            const value = { a: 1 };
            value.b = value;
            client.set(key, value, 10)
            .catch((err) => {

                expect(err.message).to.equal('Converting circular structure to JSON');
                done();
            });
        });
    });

    it('ignored starting a connection twice on same event', (done) => {

        const client = new Catbox.Client(Import);
        let x = 2;
        const start = function () {

            client.start().then(() => {

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

    it('ignored starting a connection twice chained', (done) => {

        const client = new Catbox.Client(Import);
        client.start().then(() => {

            expect(client.isReady()).to.equal(true);

            client.start().then(() => {

                expect(client.isReady()).to.equal(true);
                done();
            });
        });
    });

    it('returns not found on get when using null key', (done) => {

        const client = new Catbox.Client(Import);
        client.start()
        .then(() => client.get(null))
        .then((result) => {

            expect(result).to.equal(null);
            done();
        });
    });

    it('returns not found on get when item expired', (done) => {

        const client = new Catbox.Client(Import);
        const key = { id: 'x', segment: 'test' };

        client.start()
        .then(() => client.set(key, 'x', 1))
        .then(() => {

            setTimeout(() => {

                client.get(key).then((result) => {

                    expect(result).to.equal(null);
                    done();
                });
            }, 2);
        });
    });

    it('returns error on set when using null key', (done) => {

        const client = new Catbox.Client(Import);
        client.start()
        .then(() => client.set(null, {}, 1000))
        .catch((err) => {

            expect(err instanceof Error).to.equal(true);
            done();
        });
    });

    it('returns error on get when using invalid key', (done) => {

        const client = new Catbox.Client(Import);

        client.start()
        .then(() => client.get({}))
        .catch((err) => {

            expect(err instanceof Error).to.equal(true);
            done();
        });
    });

    it('returns error on drop when using invalid key', (done) => {

        const client = new Catbox.Client(Import);
        client.start()
        .then(() => client.drop({}))
        .catch((err) => {

            expect(err instanceof Error).to.equal(true);
            done();
        });
    });

    it('returns error on set when using invalid key', (done) => {

        const client = new Catbox.Client(Import);
        client.start()
        .then(() => client.set({}, {}, 1000))
        .catch((err) => {

            expect(err instanceof Error).to.equal(true);
            done();
        });
    });

    it('ignores set when using non-positive ttl value', (done) => {

        const client = new Catbox.Client(Import);
        const key = { id: 'x', segment: 'test' };

        client.start()
        .then(() => client.set(key, 'y', 0))
        .then(() => {

            done();
        });
    });

    it('returns error on drop when using null key', (done) => {

        const client = new Catbox.Client(Import);
        client.start()
        .then(() => client.drop(null))
        .catch((err) => {

            expect(err instanceof Error).to.equal(true);
            done();
        });
    });

    it('returns error on get when stopped', (done) => {

        const client = new Catbox.Client(Import);
        client.stop();
        const key = { id: 'x', segment: 'test' };
        client.get(key).catch((err) => {

            expect(err).to.exist();
            done();
        });
    });

    it('returns error on set when stopped', (done) => {

        const client = new Catbox.Client(Import);
        client.stop();
        const key = { id: 'x', segment: 'test' };
        client.set(key, 'y', 1).catch((err) => {

            expect(err).to.exist();
            done();
        });
    });

    it('returns error on drop when stopped', (done) => {

        const client = new Catbox.Client(Import);
        client.stop();
        const key = { id: 'x', segment: 'test' };
        client.drop(key).catch((err) => {

            expect(err).to.exist();
            done();
        });
    });

    it('returns error on missing segment name', (done) => {

        const config = {
            expiresIn: 50000
        };
        const fn = function () {

            const client = new Catbox.Client(Import);
            new Catbox.Policy(config, client, '');
        };
        expect(fn).to.throw(Error);
        done();
    });

    it('returns error on bad segment name', (done) => {

        const config = {
            expiresIn: 50000
        };
        const fn = function () {

            const client = new Catbox.Client(Import);
            new Catbox.Policy(config, client, 'a\0b');
        };
        expect(fn).to.throw(Error);
        done();
    });

    it('returns error when cache item dropped while stopped', (done) => {

        const client = new Catbox.Client(Import);
        client.stop();
        client.drop('a').catch((err) => {

            expect(err).to.exist();
            done();
        });
    });
});
