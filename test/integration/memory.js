// Load modules

var Chai = require('chai');
var Stream = require('stream');
var Helpers = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Memory Cache', function () {

    var _server = null;

    var activeItemGenerator = function () {

        return {
            'id': '55cf687663',
            'name': 'Active Item'
        };
    };

    var badGenerator = function () {

        return new Stream();
    };

    var errorGenerator = function () {

        return new Error('myerror');
    };

    function setupServer(done) {

        _server = Helpers.Server({ engine: 'memory' });

        _server.addRoute('/item', activeItemGenerator, { mode: 'server', expiresIn: 120000, segment: '/item' });
        _server.addRoute('/error', errorGenerator, { mode: 'server', expiresIn: 120000, strict: true, segment: '/error' });
        _server.addRoute('/empty', badGenerator, { mode: 'server', expiresIn: 120000, segment: '/empty' });
        _server.addRoute('/expired', activeItemGenerator, { mode: 'server', expiresIn: 10, segment: '/expired' });

        done();
    }

    before(setupServer);


    it('doesn\'t cache error responses', function (done) {

        _server.getResponse('/error', function () {

            _server.client.get({ segment: '/error', id: '/error' }, function (err, cached) {

                expect(cached).to.not.exist;
                done();
            });
        });
    });


    it('caches non-error responses', function (done) {

        _server.getResponse('/item', function () {

            _server.client.get({ segment: '/item', id: '/item' }, function (err, cached) {

                expect(cached).to.exist;
                done();
            });
        });
    });

    it('handles situation where item from cache is expired', function (done) {

        var get = _server.client.connection.get;
        _server.client.connection.get = function (options, callback) {

            var now = Date.now();

            callback(null, {
                item: 'myValue',
                stored: now - 20,
                ttl: 1
            });
            _server.client.connection.get = get;
        };

        _server.getResponse('/expired', function (result) {

            expect(result.id).to.equal(activeItemGenerator().id);
            done();
        });
    });

    it('doesn\'t throw an error caching empty streams', function (done) {

        _server.getResponse('/empty', function (result) {

            expect(result).to.not.be.instanceOf(Error);
            done();
        });
    });
});