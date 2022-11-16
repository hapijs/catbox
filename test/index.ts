import { Client, Policy, DecoratedResult, CachedObject, ClientApi, CacheStatisticsObject } from '..';
import * as Lab from '@hapi/lab';

const { expect } = Lab.types;

const Memory: ClientApi<any> = {
    async start(): Promise<void> {},
    stop(): void {},
    async get(): Promise<null | CachedObject<string>> {
        return {
            item: 'asd',
            stored: 12,
            ttl: 123,
        };
    },
    async set(): Promise<void> {},
    async drop(): Promise<void> {},
    isReady(): boolean { return true; },
    validateSegmentName(segment: string): null { return null; },
};

expect.error(new Client<string>(Memory, { partition: 'test' }));

const client = new Client<string>(Memory);

await client.start();
await client.stop();

const client2 = new Client<string>(Memory);

await client2.start();
await client2.stop();

const policy = new Policy({
    expiresIn: 5000,
}, client, 'cache');

await policy.set('foo', 'bar', 5000);
await policy.get('foo');
await policy.drop('foo');

expect.type<boolean>(policy.isReady());
expect.type<CacheStatisticsObject>(policy.stats);

const decoratedCache = new Policy({
    getDecoratedValue: true,
}, client, 'cache2');

const a: DecoratedResult<string> = await decoratedCache.get('test');
expect.type<string>(a.value);
