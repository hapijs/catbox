// Load modules

var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Net = require('net');
var NodeUtil = require('util');
var Events = require('events');
var Hapi = require('hapi');
var Catbox = require(libPath);
var Defaults = require(libPath + 'defaults');
var Memory = require(libPath + 'memory');
var Mongo = require(libPath + 'mongo');
var Redis = require(libPath + 'redis');
var Stale = require(libPath + 'stale');


// Declare internals

var internals = {};


module.exports = Hapi;
module.exports.Catbox = Catbox;
module.exports.Catbox.Defaults = Defaults;
module.exports.Catbox.Memory = Memory;
module.exports.Catbox.Mongo = Mongo;
module.exports.Catbox.Redis = Redis;
module.exports.Catbox.Stale = Stale;


module.exports.Server = function (host, port, settings) {

    var server = new Hapi.server(host, port, settings);
    if (settings.cache) {
        server.cache = new Catbox.Client(settings.cache);
    }

    return server;
};


module.exports.redisPortInUse = function (callback) {

    var connection = Net.createConnection(6379);

    connection.once('error', function() {

        exports.redisPortInUse = function (cb) {

            cb(false);
        };
        callback(false);
    });

    connection.once('connect', function() {

        exports.redisPortInUse = function (cb) {

            cb(true);
        };
        callback(true);
    });
};


module.exports.mongoPortInUse = function (callback) {

    var connection = Net.createConnection(27017);

    connection.once('error', function() {

        exports.mongoPortInUse = function (cb) {

            cb(false);
        };
        callback(false);
    });

    connection.once('connect', function() {

        exports.mongoPortInUse = function (cb) {

            cb(true);
        };
        callback(true);
    });
};


internals.Logger = function () {

    Events.EventEmitter.call(this);

    return this;
};

NodeUtil.inherits(internals.Logger, Events.EventEmitter);
module.exports._TEST = internals.logger = new internals.Logger();


// Override Log's console method

Hapi.log.console = function (message) {

    internals.logger.emit('log', message);
};