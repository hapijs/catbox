// Load modules

var Chai = require('chai');
var Stream = require('stream');
var Helpers = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


Helpers.mongoPortInUse(function (useMongo) {

    if (!useMongo) {
       return;
    }

    describe('Mongo Cache', function () {

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

            _server = Helpers.Server({ engine: 'mongodb', partition: 'catbox-test' });

            _server.addRoute('/item', activeItemGenerator, { mode: 'server', expiresIn: 120000, segment: '/item' });
            _server.addRoute('/error', errorGenerator, { mode: 'server', expiresIn: 120000, strict: true, segment: '/error' });
            _server.addRoute('/empty', badGenerator, { mode: 'server', expiresIn: 120000, segment: '/empty' });

            _server.client.start(done);
        }

        before(setupServer);

        it('doesn\'t throw an error when calling start when connection already started', function (done) {

            _server.client.start(done);
        });

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

        it('doesn\'t throw an error caching empty streams', function (done) {

            _server.getResponse('/empty', function (result) {

                expect(result).to.not.be.instanceOf(Error);
                done();
            });
        });
    });
});