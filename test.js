var Catbox = require('./');

var client = new Catbox.Client({
    engine: 'redis',
    partition: 'examples',
    port: 3
});

client.start(function (err) {
    console.log(err);
    client.stop();
});
