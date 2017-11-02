'use strict';

// Load modules

const Catbox = require('..');
const Code = require('code');
const Lab = require('lab');

const Connection = require('./connection');


// Declare internals

const internals = {};


internals.delay = function (duration) { // TODO: move to hoek

    return new Promise((resolve) => setTimeout(resolve, duration));
};


// Test shortcuts

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Catbox', () => {

    it('creates a new connection', async () => {

        const client = new Catbox.Client(Connection);
        await client.start();

        expect(client.isReady()).to.equal(true);
    });

    it('closes the connection', async () => {

        const client = new Catbox.Client(Connection);
        await client.start();

        expect(client.isReady()).to.equal(true);
        client.stop();
        expect(client.isReady()).to.equal(false);
    });

    it('gets an item after setting it', async () => {

        const client = new Catbox.Client(Connection);
        await client.start();

        const key = { id: 'x', segment: 'test' };
        await client.set(key, '123', 500);

        const result = await client.get(key);

        expect(result.item).to.equal('123');
    });

    it('fails setting an item circular references', async () => {

        const client = new Catbox.Client(Connection);
        await client.start();

        const key = { id: 'x', segment: 'test' };
        const value = { a: 1 };
        value.b = value;

        await expect(client.set(key, value, 10)).to.reject('Converting circular structure to JSON');
    });

    it('ignored starting a connection twice on same event', async () => {

        const client = new Catbox.Client(Connection);
        client.start();
        await client.start();
    });

    it('ignored starting a connection twice chained', async () => {

        const client = new Catbox.Client(Connection);
        await client.start();

        expect(client.isReady()).to.equal(true);

        await client.start();

        expect(client.isReady()).to.equal(true);
    });

    it('returns not found on get when using null key', async () => {

        const client = new Catbox.Client(Connection);
        await client.start();

        const result = await client.get(null);

        expect(result).to.equal(null);
    });

    it('returns not found on get when item expired', async () => {

        const client = new Catbox.Client(Connection);
        await client.start();

        const key = { id: 'x', segment: 'test' };
        await client.set(key, 'x', 1);

        await internals.delay(2);

        const result = await client.get(key);

        expect(result).to.equal(null);
    });

    it('returns error on set when using null key', async () => {

        const client = new Catbox.Client(Connection);
        await client.start();

        await expect(client.set(null, {}, 1000)).to.reject(Error);
    });

    it('returns error on get when using invalid key', async () => {

        const client = new Catbox.Client(Connection);
        await client.start();

        await expect(client.get({})).to.reject(Error);
    });

    it('returns error on drop when using invalid key', async () => {

        const client = new Catbox.Client(Connection);
        await client.start();

        await expect(client.drop({})).to.reject(Error);
    });

    it('returns error on set when using invalid key', async () => {

        const client = new Catbox.Client(Connection);
        await client.start();

        await expect(client.set({}, {}, 1000)).to.reject(Error);
    });

    it('ignores set when using non-positive ttl value', async () => {

        const client = new Catbox.Client(Connection);
        await client.start();

        const key = { id: 'x', segment: 'test' };
        await client.set(key, 'y', 0);
    });

    it('returns error on drop when using null key', async () => {

        const client = new Catbox.Client(Connection);
        await client.start();

        await expect(client.drop(null)).to.reject(Error);
    });

    it('returns error on get when stopped', async () => {

        const client = new Catbox.Client(Connection);
        client.stop();
        const key = { id: 'x', segment: 'test' };
        await expect(client.get(key)).to.reject(Error);
    });

    it('returns error on set when stopped', async () => {

        const client = new Catbox.Client(Connection);
        client.stop();
        const key = { id: 'x', segment: 'test' };
        await expect(client.set(key, 'y', 1)).to.reject(Error);
    });

    it('returns error on drop when stopped', async () => {

        const client = new Catbox.Client(Connection);
        client.stop();
        const key = { id: 'x', segment: 'test' };
        await expect(client.drop(key)).to.reject(Error);
    });

    it('throws error on missing segment name', () => {

        const config = {
            expiresIn: 50000
        };
        const fn = function () {

            const client = new Catbox.Client(Connection);
            new Catbox.Policy(config, client, '');
        };
        expect(fn).to.throw(Error);
    });

    it('throws error on bad segment name', () => {

        const config = {
            expiresIn: 50000
        };
        const fn = function () {

            const client = new Catbox.Client(Connection);
            new Catbox.Policy(config, client, 'a\0b');
        };
        expect(fn).to.throw(Error);
    });

    it('rejects with error when cache item dropped while stopped', async () => {

        const client = new Catbox.Client(Connection);
        client.stop();
        await expect(client.drop('a')).to.reject(Error);
    });
});
