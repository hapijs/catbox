import { Client, Policy, DecoratedResult, CachedObject, ClientApi, CacheStatisticsObject, PolicyOptions, GenerateFunc, policy as policyFunc } from '..';
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

expect.type<typeof Policy>(policyFunc);

interface CustomId {
    id: string;
    datasetID: string;
    params?: Record<string, string>;
}

interface DataResult {
    data: string;
}

const generateCache = async (id: CustomId): Promise<DataResult> => {

    return { data: id.id + id.datasetID };
};

const customIdOptions: PolicyOptions<DataResult, CustomId> = {
    expiresIn: 5000,
    generateTimeout: 2000,
    generateFunc: generateCache
};

const customIdPolicy = new Policy<DataResult>(customIdOptions, client as any, 'custom');
const customRes = await customIdPolicy.get({ id: 'item1', datasetID: 'set1' });
expect.type<DataResult | null>(customRes);

const defaultOptionsWithCustomFunc: PolicyOptions<DataResult> = {
    expiresIn: 5000,
    generateFunc: generateCache
};

const policyWithObjectKey = new Policy({
    expiresIn: 5000
}, client, 'cache3');

await policyWithObjectKey.set({ id: 'item2', extra: true }, 'baz', 5000);
await policyWithObjectKey.get({ id: 'item2', extra: true });
await policyWithObjectKey.drop({ id: 'item2', extra: true });

expect.error(new Policy<DataResult, any, number>({} as any, client as any, 'invalid'));
