// Load modules

var Lab = require('lab');
var IndependentDomain = require('../lib/independent-domain');
var Domain = require('domain');

// Test shortcuts

var expect = Lab.expect;
var beforeEach = Lab.beforeEach;
var afterEach = Lab.afterEach;
var describe = Lab.experiment;
var it = Lab.test;

describe('Independent Domain', function() {

  var existingDomain;

  beforeEach(function(done) {

    existingDomain = process.domain;
    done();
  });
  afterEach(function(done) {

    process.domain = existingDomain;
    done();
  });


  it('should execute in a separate domain if one exists', function(done) {

    var domain = Domain.create();
    domain.run(function() {

      IndependentDomain.run(function() {

        expect(process.domain).to.not.equal(domain);
        done();
      });
    });
  });
  it('should execute without a domain', function(done) {

    process.domain = undefined;
    IndependentDomain.run(done);
  });
});
