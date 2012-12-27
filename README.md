<a href="/walmartlabs/blammo"><img src="https://raw.github.com/walmartlabs/blammo/master/images/from.png" align="right" /></a>
![catbox Logo](https://raw.github.com/walmartlabs/catbox/master/images/catbox.png)

Multi-strategy object caching service

[![Build Status](https://secure.travis-ci.org/walmartlabs/catbox.png)](http://travis-ci.org/walmartlabs/catbox)


### Overview

The provided implementations include Redis and MongoDB support (each must be manually installed and configured).  Catbox has a _'Client'_ constructor that takes the following options.

* `engine` - the cache server implementation. Options are redis, mongodb, and memory. (required)
* `host` - the cache server hostname.
* `port` - the cache server port.
* `partition` - the partition name used to isolate the cached results across different servers. (required)
** username, password, poolSize - MongoDB-specific options.

For convenience, pre-configured options are provided for Redis, MongoDB, and an experimental memory store. Below are the defaults used for each of the stores.

* 'redis' - Connects to 127.0.0.1:6379.
* 'mongodb' - Connects to 127.0.0.1:27017, no authentication, and pool size 5.
* 'memory' - This is an experimental engine and should be avoided in production environments. The memory engine will run within the node process and supports the following option:
   * maxByteSize - Sets an upper limit on the number of bytes that can be consumed by the total of everything cached in the memory engine. Once this limit is reached no more items will be added to the cache.


#### Client Interface

After constructing a cache client the following methods are available.  After each method description is the method signature.  Please note that _'start'_ should be called before calling any of these methods.

* `start` - creates a connection to the cache server.  (_'function (callback)'_)
* `stop` - terminates the connection to the cache server. (_'function ()'_)
* `get` - retrieve an item from the cache engine if its stored. (_'function (key, callback)'_)
* `set` - store an item in the cache at the given key for a specified length of time. (_'function (key, value, ttl, callback)'_)
* `drop` - remove the item from cache found at the given key. (_'function (key, callback)'_)

_'key'_ is an object with the following properties:

* segment - the parent category to store the item under
* id - should be unique across the segment, used to identify the stored item


#### Policy

Instead of dealing directly with the client interface using the _'Policy'_ interface is often preferred.  It provides several helper methods like _'getOrGenerate'_ that will handle retrieving an item from cache when available or generating a new item and storing it in cache.  _'Policy'_ is also useful for creating cache rules for different items and having them enforced.  To construct a new _'Policy'_ the constructor takes the following parameters:

* `config`
    * `mode` - determines if the item is cached on the server, client, or both.
        * `server+client` - Caches the item on the server and client
        * `client` - Won't store the item on the server
        * `server` - Caches the item on the server only
        * `none` - Disable cache for the item on both the client and server
    * `segment` - Required segment name, used to isolate cached items within the cache partition.
    * `expiresIn` - relative expiration expressed in the number of milliseconds since the item was saved in the cache. Cannot be used together with `expiresAt`.
    * `expiresAt` - time of day expressed in 24h notation using the 'MM:HH' format, at which point all cache records for the route expire. Cannot be used together with `expiresIn`.
    * `staleIn` - number of milliseconds to mark an item stored in cache as stale and reload it.  Must be less than _'expiresIn'_.
    * `staleTimeout` - number of milliseconds to wait before checking if an item is stale
* `cache` - a cache client that has been started

After a _'Policy'_ is constructed the following methods are available.

* `isMode` - determines if the policy supports the given mode.  (_'function (mode)'_)
* `isEnabled` - determines if the policy has a mode enabled. (_'function ()'_)
* `get` - retrieve an item from the cache engine if its stored. (_'function (key, callback)'_)
* `set` - store an item in the cache at the given key for a specified length of time. (_'function (key, value, ttl, callback)'_)
* `drop` - remove the item from cache found at the given key. (_'function (key, callback)'_)
* `ttl` - get the number of milliseconds that an item has left before it is expired from a given time. (_'function (created)'_)
* `getOrGenerate` - get and item from cache if it exists, or generate it and store it in cache. (_'function (key, logFunc, generateFunc, callback)'_)

As a result of the _'Policy'_ constructor taking the segment, the key used should just be the item ID instead of the object used in the cache _'Client'_ previously used.


### Examples

For examples of creating a server that uses one of the above engines look in the _'examples'_ folder.