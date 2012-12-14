// Load modules

var Hoek = require('hoek');


// Cache configuration

exports.cache = function (engine) {

    if (engine !== null && typeof engine === 'object') {
        engine = engine.engine;

        if (engine !== null && typeof engine === 'object') {
            return engine;
        }
    }

    if (engine === false) {
        return null;
    }

    Hoek.assert(engine === 'redis' || engine === 'mongodb' || engine === 'memory', 'Unknown cache engine type: ' + engine);

    var config = {
        engine: engine,
        partition: 'hapi-cache'
    };

    if (engine === 'redis') {
        config.host = '127.0.0.1';
        config.port = 6379;
    }
    else if (engine === 'mongodb') {
        config.host = '127.0.0.1';
        config.port = 27017;
        config.poolSize = 5;
    }

    return config;
};