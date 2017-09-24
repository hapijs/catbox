'use strict';

// Load modules


// Declare internals

const internals = {};


exports = module.exports = internals.Pending = function (id) {

    this.id = id;
    this.timeoutTimer = null;
    this.count = 1;

    this.promise = new Promise((resolve, reject) => {

        this.resolve = resolve;
        this.reject = reject;
    });
};


internals.Pending.prototype.join = function () {

    ++this.count;
    return this.promise;
};


internals.Pending.prototype.send = function (err, value, cached, report) {

    clearTimeout(this.timeoutTimer);

    if (err) {
        if (!cached) {
            this.reject(err);
        }
        else {
            report.error = err;
            this.resolve({ value, cached, report });
        }
    }
    else {
        this.resolve({ value, cached, report });
    }
};


internals.Pending.prototype.setTimeout = function (fn, timeoutMs) {

    clearTimeout(this.timeoutTimer);
    this.timeoutTimer = setTimeout(fn, timeoutMs);
};
