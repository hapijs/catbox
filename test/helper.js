// Load modules

var Net = require('net');


// Declare internals

var internals = {};


exports.testRedis = function (callback) {

    var redis = Net.createConnection(6379);
    redis.once('error', function () {

        callback(false);
    });
    redis.once('connect', function () {

        redis.end();
        callback(true);
    });
};


exports.testMongo = function (callback) {

    var mongo = Net.createConnection(27017);
    mongo.once('error', function () {

        callback(false);
    });
    mongo.once('connect', function () {

        mongo.end();
        callback(true);
    });
};

