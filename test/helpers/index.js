// Load modules

var Net = require('net');
var Server = require('./server');
var Catbox = require('../../lib/');
var Defaults = require('../../lib/defaults');
var Memory = require('../../lib/memory');
var Mongo = require('../../lib/mongo');
var Redis = require('../../lib/redis');
var Stale = require('../../lib/stale');


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