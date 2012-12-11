// Load modules

var Net = require('net');


exports.redisPortInUse = function (callback) {

    var connection = Net.createConnection(6379);

    connection.once('error', function() {

        callback(false);
    });

    connection.once('connect', function() {

        callback(true);
    });
};

exports.mongoPortInUse = function (callback) {

    var connection = Net.createConnection(27017);

    connection.once('error', function() {

        callback(false);
    });

    connection.once('connect', function() {

        callback(true);
    });
};