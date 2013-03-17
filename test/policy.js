// Load modules

var Lab = require('lab');
var Catbox = require('..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Policy', function () {

    it('returns null on get when cache mode is not server', function (done) {

        var cache = new Catbox.Policy({ expiresIn: 1 });

        var key = { id: 'x', segment: 'test' };
        cache.get(key, function (err, result) {

            expect(err).to.not.exist;
            expect(result).to.not.exist;
            done();
        });
    });

    it('returns null on set when cache mode is not server', function (done) {

        var cache = new Catbox.Policy({ expiresIn: 1 });

        var key = { id: 'x', segment: 'test' };
        cache.set(key, 'y', 100, function (err) {

            expect(err).to.not.exist;
            done();
        });
    });

    it('returns null on drop when cache mode is not server', function (done) {

        var cache = new Catbox.Policy({ expiresIn: 1 });

        var key = { id: 'x', segment: 'test' };
        cache.drop(key, function (err) {

            expect(err).to.not.exist;
            done();
        });
    });

    it('returns null on get when item expired', function (done) {

        var client = new Catbox.Client('memory');
        client.start(function () {

            var key = { id: 'x', segment: 'test' };
            client.set(key, 'y', 1, function (err) {

                setTimeout(function () {

                    client.get(key, function (err, result) {

                        expect(err).to.not.exist;
                        expect(result).to.not.exist;
                        done();
                    });
                }, 2);
            });
        });
    });

    describe('#get', function () {

        it('passes an error to the callback when an error occurs getting the item', function (done) {

            var options = {
                partition: 'test',
                engine: {
                    start: function (callback) {

                        callback();
                    },
                    isReady: function () {

                        return true;
                    },
                    get: function (key, callback) {

                        callback(new Error());
                    },
                    validateSegmentName: function () {

                        return null;
                    }
                }
            };
            var policyConfig = {
                expiresIn: 50000
            };

            var client = new Catbox.Client(options);
            var policy = new Catbox.Policy(policyConfig, client, 'test');

            policy.get({ id: 'test1', segment: 'test2' }, function (err, result) {

                expect(err).to.be.instanceOf(Error);
                expect(result).to.not.exist;
                done();
            });
        });

        it('returns the cached result when no error occurs', function (done) {

            var options = {
                partition: 'test',
                engine: {
                    start: function (callback) {

                        callback();
                    },
                    isReady: function () {

                        return true;
                    },
                    get: function (key, callback) {

                        callback(null, {
                            stored: 'stored',
                            item: 'item'
                        });
                    },
                    validateSegmentName: function () {

                        return null;
                    }
                }
            };
            var policyConfig = {
                expiresIn: 50000
            };

            var client = new Catbox.Client(options);
            var policy = new Catbox.Policy(policyConfig, client, 'test');

            policy.get({ id: 'test1', segment: 'test2' }, function (err, result) {

                expect(result.item).to.equal('item');
                expect(result.isStale).to.be.false;
                done();
            });
        });
    });

    describe('#drop', function () {

        it('calls the extension clients drop function', function (done) {

            var options = {
                partition: 'test',
                engine: {
                    start: function (callback) {

                        callback();
                    },
                    isReady: function () {

                        return true;
                    },
                    drop: function (key, callback) {

                        callback(null, 'success');
                    },
                    validateSegmentName: function () {

                        return null;
                    }
                }
            };

            var policyConfig = {
                expiresIn: 50000
            };

            var client = new Catbox.Client(options);
            var policy = new Catbox.Policy(policyConfig, client, 'test');

            policy.drop('test', function (err, result) {

                expect(result).to.equal('success');
                done();
            });
        });
    });

    describe('#ttl', function () {

        it('returns the ttl factoring in the created time', function (done) {

            var options = {
                partition: 'test',
                engine: {
                    start: function (callback) {

                        callback();
                    },
                    isReady: function () {

                        return true;
                    },
                    validateSegmentName: function () {

                        return null;
                    }
                }
            };

            var policyConfig = {
                expiresIn: 50000
            };

            var client = new Catbox.Client(options);
            var policy = new Catbox.Policy(policyConfig, client, 'test');

            var result = policy.ttl(Date.now() - 10000);
            expect(result).to.be.within(39999, 40001);                    // There can occassionally be a 1ms difference
            done();
        });
    });

    describe('#compile', function () {

        it('doesn\'t try to compile a null config', function (done) {

            var rule = Catbox.policy.compile(null);

            expect(rule).to.deep.equal({});

            done();
        });

        it('compiles a single rule', function (done) {

            var config = {
                expiresIn: 50000
            };
            var rule = Catbox.policy.compile(config, false);

            expect(rule.expiresIn).to.equal(config.expiresIn);

            done();
        });

        it('throws an error when segment is missing', function (done) {

            var config = {
                expiresIn: 50000
            };
            var fn = function () {

                var client = new Catbox.Client('memory');
                var cache = new Catbox.Policy(config, client);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('assigns the expiresIn when the rule is cached', function (done) {

            var config = {
                expiresIn: 50000
            };
            var rule = Catbox.policy.compile(config, false);

            expect(rule.expiresIn).to.equal(config.expiresIn);

            done();
        });

        it('throws an error when parsing a rule with both expiresAt and expiresIn', function (done) {

            var config = {
                expiresAt: 50,
                expiresIn: '02:00'
            };
            var fn = function () {

                Catbox.policy.compile(config, false);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when parsing a rule with niether expiresAt or expiresIn', function (done) {

            var config = {
            };
            var fn = function () {

                Catbox.policy.compile(config, false);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when parsing a bad expiresAt value', function (done) {

            var config = {
                expiresAt: function () { }
            };
            var fn = function () {

                Catbox.policy.compile(config, false);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when staleIn is used without staleTimeout', function (done) {

            var config = {
                expiresAt: '03:00',
                staleIn: 1000000
            };
            var fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when staleTimeout is used without staleIn', function (done) {

            var config = {
                expiresAt: '03:00',
                staleTimeout: 100
            };
            var fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when staleIn is greater than a day and using expiresAt', function (done) {

            var config = {
                expiresAt: '03:00',
                staleIn: 100000000,
                staleTimeout: 500
            };
            var fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when staleIn is greater than expiresIn', function (done) {

            var config = {
                expiresIn: 500000,
                staleIn: 1000000,
                staleTimeout: 500
            };
            var fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when staleTimeout is greater than expiresIn', function (done) {

            var config = {
                expiresIn: 500000,
                staleIn: 100000,
                staleTimeout: 500000
            };
            var fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when staleTimeout is greater than expiresIn - staleIn', function (done) {

            var config = {
                expiresIn: 30000,
                staleIn: 20000,
                staleTimeout: 10000
            };
            var fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when staleTimeout is used without server mode', function (done) {

            var config = {
                expiresIn: 1000000,
                staleIn: 500000,
                staleTimeout: 500
            };
            var fn = function () {

                var cache = new Catbox.Policy(config);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('returns rule when staleIn is less than expiresIn', function (done) {

            var config = {
                expiresIn: 1000000,
                staleIn: 500000,
                staleTimeout: 500
            };
            var rule = Catbox.policy.compile(config, true);

            expect(rule.staleIn).to.equal(500 * 1000);
            expect(rule.expiresIn).to.equal(1000 * 1000);

            done();
        });

        it('returns rule when staleIn is less than 24 hours and using expiresAt', function (done) {

            var config = {
                expiresAt: '03:00',
                staleIn: 5000000,
                staleTimeout: 500
            };
            var rule = Catbox.policy.compile(config, true);

            expect(rule.staleIn).to.equal(5000 * 1000);

            done();
        });

        it('throws an error if has only staleTimeout or staleIn', function (done) {

            var config = {
                staleIn: 30000,
                expiresIn: 60000
            };

            var fn = function () {

                Catbox.policy.compile(config, true);
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('doesn\'t throw an error if has both staleTimeout and staleIn', function (done) {

            var config = {
                staleIn: 30000,
                staleTimeout: 300,
                expiresIn: 60000
            };

            var fn = function () {

                Catbox.policy.compile(config, true);
            };
            expect(fn).to.not.throw(Error);
            done();
        });

        it('throws an error if trying to use stale caching on the client', function (done) {

            var config = {
                staleIn: 30000,
                expiresIn: 60000,
                staleTimeout: 300
            };

            var fn = function () {

                Catbox.policy.compile(config, false);
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('converts the stale time to ms', function (done) {

            var config = {
                staleIn: 30000,
                expiresIn: 60000,
                staleTimeout: 300
            };

            var rule = Catbox.policy.compile(config, true);

            expect(rule.staleIn).to.equal(config.staleIn);
            done();
        });

        it('throws an error if staleTimeout is greater than expiresIn', function (done) {

            var config = {
                staleIn: 2000,
                expiresIn: 1000,
                staleTimeout: 3000
            };

            var fn = function () {

                Catbox.policy.compile(config, false);
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error if staleIn is greater than expiresIn', function (done) {

            var config = {
                staleIn: 1000000,
                expiresIn: 60000,
                staleTimeout: 30
            };

            var fn = function () {

                Catbox.policy.compile(config, false);
            };

            expect(fn).to.throw(Error);
            done();
        });
    });

    describe('#ttl', function () {

        it('returns zero when a rule is expired', function (done) {

            var config = {
                expiresIn: 50000
            };
            var rule = Catbox.policy.compile(config, false);
            var created = new Date(Date.now());
            created = created.setMinutes(created.getMinutes() - 5);

            var ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.be.equal(0);
            done();
        });

        it('returns a positive number when a rule is not expired', function (done) {

            var config = {
                expiresIn: 50000
            };
            var rule = Catbox.policy.compile(config, false);
            var created = new Date(Date.now());

            var ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.be.greaterThan(0);
            done();
        });

        it('returns the correct expires time when no created time is provided', function (done) {

            var config = {
                expiresIn: 50000
            };
            var rule = Catbox.policy.compile(config, false);

            var ttl = Catbox.policy.ttl(rule);
            expect(ttl).to.equal(50000);
            done();
        });

        it('returns 0 when created several days ago and expiresAt is used', function (done) {

            var config = {
                expiresAt: '13:00'
            };
            var created = Date.now() - 313200000;                                       // 87 hours (3 days + 15 hours)
            var rule = Catbox.policy.compile(config, false);

            var ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns 0 when created in the future', function (done) {

            var config = {
                expiresIn: '100'
            };
            var created = Date.now() + 1000;
            var rule = Catbox.policy.compile(config, false);

            var ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns 0 for bad rule', function (done) {

            var created = Date.now() - 1000;
            var ttl = Catbox.policy.ttl({}, created);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns 0 when created 60 hours ago and expiresAt is used with an hour before the created hour', function (done) {

            var config = {
                expiresAt: '12:00'
            };
            var created = Date.now() - 342000000;                                       // 95 hours ago (3 days + 23 hours)
            var rule = Catbox.policy.compile(config, false);

            var ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns a positive number when using a future expiresAt', function (done) {

            var hour = new Date(Date.now() + 60 * 60 * 1000).getHours();
            hour = hour === 0 ? 1 : hour;

            var config = {
                expiresAt: hour + ':00'
            };

            var rule = Catbox.policy.compile(config, false);

            var ttl = Catbox.policy.ttl(rule);
            expect(ttl).to.be.greaterThan(0);
            done();
        });

        it('returns the correct number when using a future expiresAt', function (done) {

            var twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            var hours = twoHoursAgo.getHours();
            var minutes = '' + twoHoursAgo.getMinutes();
            var created = twoHoursAgo.getTime() + (60 * 60 * 1000);
            minutes = minutes.length === 1 ? '0' + minutes : minutes;

            var config = {
                expiresAt: hours + ':' + minutes
            };

            var rule = Catbox.policy.compile(config, false);
            var ttl = Catbox.policy.ttl(rule, created);

            expect(ttl).to.be.closeTo(22 * 60 * 60 * 1000, 60 * 1000);
            done();
        });

        it('returns correct number when using an expiresAt time tomorrow', function (done) {

            var hour = new Date(Date.now() - 60 * 60 * 1000).getHours();

            var config = {
                expiresAt: hour + ':00'
            };

            var rule = Catbox.policy.compile(config, false);

            var ttl = Catbox.policy.ttl(rule);
            expect(ttl).to.be.closeTo(23 * 60 * 60 * 1000, 60 * 60 * 1000);
            done();
        });

        it('returns correct number when using a created time from yesterday and expires in 2 hours', function (done) {

            var hour = new Date(Date.now() + 2 * 60 * 60 * 1000).getHours();

            var config = {
                expiresAt: hour + ':00'
            };
            var created = new Date(Date.now());
            created.setHours(new Date(Date.now()).getHours() - 22);

            var rule = Catbox.policy.compile(config, false);

            var ttl = Catbox.policy.ttl(rule, created);
            expect(ttl).to.be.closeTo(60 * 60 * 1000, 60 * 60 * 1000);
            done();
        });
    });
});

