// Load modules

var Net = require('net');


exports.redisPortInUse = function (callback) {

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

exports.mongoPortInUse = function (callback) {

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