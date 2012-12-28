// Load modules

var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Net = require('net');
var Server = require('./server');
var Catbox = require(libPath);
var Defaults = require(libPath + 'defaults');
var Memory = require(libPath + 'memory');
var Mongo = require(libPath + 'mongo');
var Redis = require(libPath + 'redis');
var Stale = require(libPath + 'stale');


// Declare internals

var internals = {};


module.exports.Catbox = Catbox;
module.exports.Catbox.Defaults = Defaults;
module.exports.Catbox.Memory = Memory;
module.exports.Catbox.Mongo = Mongo;
module.exports.Catbox.Redis = Redis;
module.exports.Catbox.Stale = Stale;


module.exports.Server = function (settings) {

    return new Server(settings);
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