// Load modules

var Chai = require('chai');
var Cache = process.env.TEST_COV ? require('../../lib-cov/') : require('../../lib/');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Stale', function () {

    it('returns the processed cached item when using server cache mode', function (done) {

        var options = {
            engine: 'memory',
            partition: 'test-partition'
        };
        var rule = {
            expiresIn: 100,
            staleIn: 20,
            staleTimeout: 5,
            mode: 'server',
            segment: 'test-segment'
        };
        var key = {
            id: 'test' + Math.random(),
            segment: 'test-segment'
        };
        var logFunc = function (text) {

        };
        var generateFunc = function (callback) {

            callback(null, 'hello');
        };


        var client = new Cache.Client(options);
        var policy = new Cache.Policy(rule, client);

        policy.getOrGenerate(key, logFunc, generateFunc, function (result) {

            expect(result).to.equal('hello');
            done();
        });
    });

    it('returns an error when trying to use stale without server caching', function (done) {

        var options = {
            engine: 'memory',
            partition: 'test-partition'
        };
        var rule = {
            expiresIn: 100,
            staleIn: 20,
            staleTimeout: 5,
            mode: 'client',
            segment: 'test-segment'
        };

        var fn = function() {
            var client = new Cache.Client(options);
            var policy = new Cache.Policy(rule, client);
        };

        expect(fn).to.throw(Error);
        done();
    });
});