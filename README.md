<a href="https://github.com/spumko"><img src="https://raw.github.com/spumko/spumko/master/images/from.png" align="right" /></a>
![catbox Logo](https://raw.github.com/spumko/catbox/master/images/catbox.png)

Multi-strategy object caching service
Version: **2.x**

[![Build Status](https://secure.travis-ci.org/spumko/catbox.png)](http://travis-ci.org/spumko/catbox)

**catbox** is a multi-strategy key-value object store. It comes with extensions supporting a memory cache,
[Redis](http://redis.io/), [MongoDB](http://www.mongodb.org/), [Memcached](http://memcached.org/), and [Riak](http://basho.com/riak/).
**catbox** provides two interfaces: a low-level `Client` and a high-level `Policy`.


### Installation

In order to reduce module dependencies, **catbox** does not includes the external caching strategies. To use other strategies,
each service must be manually installed via npm or package dependencies manually. The available strategies are:

- [Memory](https://github.com/spumko/catbox-memory)
- [Redis](https://github.com/spumko/catbox-redis)
- [MongoDB](https://github.com/spumko/catbox-mongodb)
- [Memcached](https://github.com/spumko/catbox-memcached)
- [Riak](https://github.com/DanielBarnes/catbox-riak)


### `Client`

The `Client` object provides a low-level cache abstraction. The object is constructed using `new Client(engine, options, loader)` where:

- `engine` - is a string, object, or function detailing the cache strategy implementation details:
    - string - the node module name used via `require()`. The required module must export a prototype function with the signature
      `function(options)`. **catbox** will call `new require(name)(options)` with the provided `name` string.
    - function - a prototype function with the signature `function(options)`. **catbox** will call `new func(options)`.
    - object - a pre instantiated client implementation object. Does not support passing `options`.
- `options` - the strategy configuration object. Each strategy defines its own configuration options with the following common options:
    - `partition` - the partition name used to isolate the cached results across multiple clients. The partition name is used
      as the MongoDB database name, the Riak bucket, or as a key prefix in Redis and Memcached. To share the cache across multiple clients,
      use the same partition name.

Note that any implementation of client strategies must return deep copies of the stored data as the API assumes that the object returned
from a `get()` is owned by the called and can be safely modified without affecting the cache copy.


#### API

The `Client` object provides the following methods:

- `start(callback)` - creates a connection to the cache server. Must be called before any other method is available.
  The `callback` signature is `function(err)`.
- `stop()` - terminates the connection to the cache server.
- `get(key, callback)` - retrieve an item from the cache engine if found where:
    - `key` - a cache key object (see below).
    - `callback` - a function with the signature `function(err, cached)`. If the item is not found, both `err` and `cached` are `null`.
      If found, the `cached` object contains the following:
        - `item` - the value stored in the cache using `set()`.
        - `stored` - the timestamp when the item was stored in the cache (in milliseconds).
        - `ttl` - the remaining time-to-live (not the original value used when storing the object).
- `set(key, value, ttl, callback)` - store an item in the cache for a specified length of time, where:
    - `key` - a cache key object (see below).
    - `value` - the string or object value to be stored.
    - `ttl` - a time-to-live value in milliseconds after which the item is automatically removed from the cache (or is marked invalid).
    - `callback` - a function with the signature `function(err)`.
- `drop(key, callback)` - remove an item from cache where:
    - `key` - a cache key object (see below).
    - `callback` - a function with the signature `function(err)`.

Any method with a `key` argument takes an object with the following required properties:
- `segment` - a caching segment name. Enables using a single cache server for storing different sets of items with overlapping ids.
- `id` - a unique item identifies (per segment).


### `Policy`

The `Policy` object provides a convenient cache interface by setting a global policy which is automatically applied to every storage action.
The object is constructed using `new Policy(options, [cache, segment])` where:

- `options` - is an object with the following keys:
    - `expiresIn` - relative expiration expressed in the number of milliseconds since the item was saved in the cache. Cannot be used
      together with `expiresAt`.
    - `expiresAt` - time of day expressed in 24h notation using the 'HH:MM' format, at which point all cache records for the route
      expire. Uses local time. Cannot be used together with `expiresIn`.
    - `staleIn` - number of milliseconds to mark an item stored in cache as stale and reload it.  Must be less than `expiresIn`.
    - `staleTimeout` - number of milliseconds to wait before checking if an item is stale.
- `cache` - a `Client` instance (which has already been started).
- `segment` - required when `cache` is provided. The segment name used to isolate cached items within the cache partition.


#### API

The `Policy` object provides the following methods:

- `get(id, callback)` - retrieve an item from the cache where:
    - `id` - the unique item identifier (within the policy segment).
    - `callback` - a function with the signature `function(err, cached)` where `cached` is the object returned by the `client.get()` with
      the additional `isStale` boolean key.
- `set(id, value, ttl, callback)` - store an item in the cache where:
    - `id` - the unique item identifier (within the policy segment).
    - `value` - the string or object value to be stored.
    - `ttl` - a time-to-live **override** value in milliseconds after which the item is automatically removed from the cache (or is marked invalid).
      This should be set to `0` in order to use the caching rules configured when creating the `Policy` object.
    - `callback` - a function with the signature `function(err)`.
- `drop(id, callback)` - remove the item from cache where:
    - `id` - the unique item identifier (within the policy segment).
    - `callback` - a function with the signature `function(err)`.
- `ttl(created)` - given a `created` timestamp in milliseconds, returns the time-to-live left based on the configured rules.
- `getOrGenerate(id, generateFunc, callback)` - get an item from the cache if found, otherwise calls the `generateFunc` to produce a new value
  and stores it in the cache. This method applies the staleness rules. Its arguments are:
    - `id` - the unique item identifier (within the policy segment).
    - `generateFunc` - the function used to generate a new cache item if one is not found in the cache. The method's signature is
      `function(err, value, ttl)` where:
        - `err` - an error condition.
        - `value` - the new value generated.
        - `ttl` - the cache ttl value in milliseconds. Set to `0` to skip storing in the cache. Defaults to the cache global policy.
    - `callback` - a function with the signature `function(err, value, cached, report)` where:
        - `err` - any errors encountered.
        - `value` - the fetched or generated value.
        - `cached` - the `cached` object returned by `policy.get()` is the item was found in the cache.
        - `report` - an object with logging information about the operation.
