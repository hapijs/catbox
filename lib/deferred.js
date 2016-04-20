'use strict';

// Declare internals

const internals = {};


module.exports = internals.Deferred = class Deferred {

    constructor() {

        this.promise = new Promise((resolve, reject) => {

            this.resolve = resolve;
            this.reject = reject;
        });
    }

    callback(options) {

        options = options || { full: false };

        return (function () {

            const args = Array.from(arguments);

            if (args[0]) {
                this.reject(options.full ? args : args[0]);
            }
            else {
                this.resolve(options.full ? args : args[1]);
            }
        }).bind(this);
    }

};
