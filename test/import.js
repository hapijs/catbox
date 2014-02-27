// Load modules


// Declare internals

var internals = {};


exports = module.exports = internals.Connection = function (options) {

};


internals.Connection.prototype.start = function (callback) {

    return callback();
};


internals.Connection.prototype.stop = function () {

    return;
};


internals.Connection.prototype.isReady = function () {

    return true;
};


internals.Connection.prototype.validateSegmentName = function (name) {

    return null;
};


internals.Connection.prototype.get = function (key, callback) {

    return callback(null, { item: this.result });
};


internals.Connection.prototype.set = function (key, value, ttl, callback) {

    this.result = value;
    return callback();
};


internals.Connection.prototype.drop = function (key, callback) {

    this.result = undefined;
    return callback();
};
