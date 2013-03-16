// Load modules

var Lab = require('lab');
var Catbox = require('..');
var Defaults = require('../lib/defaults');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Defaults', function () {

    describe('#cache', function () {

        it('returns null when engine is false', function (done) {

            expect(Defaults.cache(false)).to.equal(null);
            done();
        });

        it('returns correct defaults for redis', function (done) {

            var redisDefaults = Defaults.cache('redis');

            expect(redisDefaults.port).to.equal(6379);
            done();
        });

        it('returns correct defaults for mongo', function (done) {

            var mongoDefaults = Defaults.cache('mongodb');

            expect(mongoDefaults.port).to.equal(27017);
            done();
        });
    });
});