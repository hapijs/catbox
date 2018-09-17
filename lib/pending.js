'use strict';

// Load modules


// Declare internals

const internals = {};


exports = module.exports = class {

    constructor(id, rule) {

        this.id = id;
        this.timeoutTimer = null;
        this.count = 1;
        this.rule = rule;

        this.promise = new Promise((resolve, reject) => {

            this.resolve = resolve;
            this.reject = reject;
        });
    }

    join() {

        ++this.count;
        return this.promise;
    }

    send(err, value, cached, report) {

        clearTimeout(this.timeoutTimer);

        if (err &&
            !cached) {

            this.reject(err);
            return;
        }

        if (!this.rule.getDecoratedValue) {
            this.resolve(value);
            return;
        }

        if (err) {
            report.error = err;
        }

        this.resolve({ value, cached, report });
    }

    setTimeout(fn, timeoutMs) {

        clearTimeout(this.timeoutTimer);
        this.timeoutTimer = setTimeout(fn, timeoutMs);
    }
};
