'use strict';

// Load modules


// Declare internals

const internals = {};


exports = module.exports = internals.Pending = function (id, onDidSend) {

    this.id = id;
    this.onDidSend = onDidSend;
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

    clearTimeout(this.timeoutTimer);

    const count = this.count;
    this.count = 0;

    return this.onDidSend(count, report);
};


internals.Pending.prototype.setTimeout = function (fn, timeoutMs) {

    clearTimeout(this.timeoutTimer);

    this.timeoutTimer = setTimeout(fn, timeoutMs);
};
