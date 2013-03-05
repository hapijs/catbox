<a href="https://github.com/spumko"><img src="https://raw.github.com/spumko/spumko/master/images/from.png" align="right" /></a>
![catbox Logo](https://raw.github.com/spumko/catbox/master/images/catbox.png)

Multi-strategy object caching service

[![Build Status](https://secure.travis-ci.org/spumko/catbox.png)](http://travis-ci.org/spumko/catbox)


The provided implementation includes support for Redis, MongoDB, and an experimental memory store (each must be manually installed and configured).  _'Catbox'_ is useful for conveniently managing item cache rules and storage.

### Installing the appropriate module dependency

The _'mongodb'_ and _'redis'_ modules are currently used only in a development environment.  Therefore, to use _'Catbox'_ in production you will need to manually install the _'mongodb'_ or _'redis'_ modules.  One way that these modules can be installed is by running the command `npm install mongodb` or `npm install redis`.  Another way to install the modules is to add the appropriate one to the applications _'package.json'_ `dependencies` section and then by running `npm install`.


### Client

Catbox has a _'Client'_ constructor that takes the following options.

* `engine` - the cache server implementation. Options are redis, mongodb, and memory. (required)
* `partition` - the partition name used to isolate the cached results across different servers. (required)

##### Mongo Specific
* `host` - the cache server hostname. Defaults to _'127.0.0.1'_.
* `port` - the cache server port. Defaults to _'27017'_.
* `username` - when the mongo server requires authentication. Defaults to no authentication.
* `password` - used for authentication.
* `poolSize` - number of connections to leave open that can be used for catbox. Defaults to _'5'_.


##### Redis Specific
* `host` - the cache server hostname. Defaults to _'127.0.0.1'_.
* `port` - the cache server port. Defaults to _'6479'_.


##### Memory Specific
This is an experimental engine and should be avoided in production environments.
* `maxByteSize` - Sets an upper limit on the number of bytes that can be consumed by the total of everything cached in the memory engine. Once this limit is reached no more items will be added to the cache. Defaults to no limit.


#### Client Interface

After constructing a cache client the following methods are available.  After each method description is the method signature.  Please note that _'start'_ should be called before calling any of these methods.

* `start` - creates a connection to the cache server.  (`function (callback)`)
* `stop` - terminates the connection to the cache server. (`function ()`)
* `get` - retrieve an item from the cache engine if its stored. (`function (key, callback)`)
* `set` - store an item in the cache at the given key for a specified length of time. (`function (key, value, ttl, callback)`)
* `drop` - remove the item from cache found at the given key. (`function (key, callback)`)

_'key'_ is an object with the following properties:

* `segment` - the parent category to store the item under
* `id` - should be unique across the segment, used to identify the stored item


### Policy

Instead of dealing directly with the client interface using the _'Policy'_ interface is often preferred.  It provides several helper methods like _'getOrGenerate'_ that will handle retrieving an item from cache when available or generating a new item and storing it in cache.  _'Policy'_ is also useful for creating cache rules for different items and having them enforced.  To construct a new _'Policy'_ the constructor takes the following parameters:

* `config`
* `mode` - determines if the item is cached on the server, client, or both. (required)
* `server+client` - Caches the item on the server and client
* `client` - Won't store the item on the server
* `server` - Caches the item on the server only
* `none` - Disable cache for the item on both the client and server
* `segment` - Required segment name, used to isolate cached items within the cache partition. (required)
* `expiresIn` - relative expiration expressed in the number of milliseconds since the item was saved in the cache. Cannot be used together with `expiresAt`.
* `expiresAt` - time of day expressed in 24h notation using the 'MM:HH' format, at which point all cache records for the route expire. Cannot be used together with `expiresIn`.
* `staleIn` - number of milliseconds to mark an item stored in cache as stale and reload it.  Must be less than _'expiresIn'_.
* `staleTimeout` - number of milliseconds to wait before checking if an item is stale
* `privacy` - optional cache control override for setting _'public'_ or _'private'_ mode. Defaults to _'default'_ (HTTP protocol cache-control defaults).
* `cache` - a cache client that has been started

#### Policy Interface

After a _'Policy'_ is constructed the following methods are available.

* `isMode` - determines if the policy supports the given mode.  (`function (mode)`)
* `isEnabled` - determines if the policy has a mode enabled. (`function ()`)
* `get` - retrieve an item from the cache engine if its stored. (`function (key, callback)`)
* `set` - store an item in the cache at the given key for a specified length of time. (`function (key, value, ttl, callback)`)
* `drop` - remove the item from cache found at the given key. (`function (key, callback)`)
* `ttl` - get the number of milliseconds that an item has left before it is expired from a given time. (`function (created)`)
* `getOrGenerate` - get and item from cache if it exists, or generate it and store it in cache. (`function (key, logFunc, generateFunc, callback)`)

As a result of the _'Policy'_ constructor taking the segment, the key used should just be the item ID instead of the object used in the cache _'Client'_ previously used.


### Examples

For examples of creating a server that uses one of the above engines look in the _'examples'_ folder.
