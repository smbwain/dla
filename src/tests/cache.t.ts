import 'source-map-support/register';

import * as assert from 'assert';

import {Collection, index, ListableCollection, MemoryCache} from '..';

interface Item {
    id: string;
}

interface IHuman {
    id: string;
    sex: string;
    age: number;
}

interface IHumanFilter {
    minAge?: number;
    sex?: string;
}

function initCollection(cache) {
    const result = {
        collection: new Collection<Item>({
            cache,
            loadFew: (ids) => {
                result.queryCounter++;
                result.objectsCounter += ids.length;
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(
                            index(
                                ids.map((id) => ({
                                    id,
                                })),
                                (item) => item.id,
                            ),
                        );
                    }, 300);
                });
            },
        }),
        objectsCounter: 0,
        queryCounter: 0,
    };
    return result;
}

function initListableCollection(cache) {
    const data = [{
        id: '1',
        age: 28,
        sex: 'm',
    }, {
        id: '2',
        age: 25,
        sex: 'f',
    }, {
        id: '3',
        age: 16,
        sex: 'm',
    }, {
        id: '4',
        age: 52,
        sex: 'f',
    }];
    const result = {
        collection: new ListableCollection<IHuman, IHumanFilter>({
            cache,
            loadOne: (id) => {
                result.objectsCounter++;
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(
                            data.find((item) => item.id === id),
                        );
                    }, 300);
                });
            },
            loadList: (filter) => {
                result.listsCounter++;
                return {
                    items: data.filter(
                        (item) =>
                            (!('minAge' in filter) || item.age >= filter.minAge) &&
                            (!('sex' in filter) || item.sex === filter.sex),
                    ),
                };
            },
            listCacheInvalidators: (filter) => {
                const invalidators = [];
                if ('sex' in filter) {
                    invalidators.push(`sex=${filter.sex}`);
                }
                return invalidators;
            },
        }),
        listsCounter: 0,
        objectsCounter: 0,
    };
    return result;
}

describe('cache', () => {
    it('get/set/remove', async () => {
        const cache = new MemoryCache();
        assert(!await cache.get('a'));
        await cache.set('a', {a: 55});
        assert.deepEqual(await cache.get('a'), {a: 55});
        await cache.remove('a');
        assert(!await cache.get('a'));
    });

    it('objects cache', async () => {
        const cache = new MemoryCache();
        const test1 = initCollection(cache);
        assert.deepEqual(
            await test1.collection.getFewAsArray(['5', '5', '6', '7']),
            [{id: '5'}, {id: '5'}, {id: '6'}, {id: '7'}],
        );
        assert.equal(test1.queryCounter, 1);
        assert.equal(test1.objectsCounter, 3);

        const test2 = initCollection(cache);
        assert.deepEqual(
            await test2.collection.getFewAsArray(['4', '6', '8']),
            [{id: '4'}, {id: '6'}, {id: '8'}],
        );
        assert.equal(test2.queryCounter, 1);
        assert.equal(test2.objectsCounter, 2);

        await test2.collection.clearCache('5');
        await test2.collection.clearCache(['6', '8']);

        assert.deepEqual(
            await test2.collection.getFewAsArray(['4', '5', '6', '7', '8']),
            [{id: '4'}, {id: '5'}, {id: '6'}, {id: '7'}, {id: '8'}],
        );
        assert.equal(test2.queryCounter, 2);
        assert.equal(test2.objectsCounter, 5);
    });

    it('lists cache', async () => {
        const cache = new MemoryCache();
        const test1 = initListableCollection(cache);
        assert.deepEqual( await test1.collection.getList({
            minAge: 27,
        }), [{
            id: '1',
            age: 28,
            sex: 'm',
        }, {
            id: '4',
            age: 52,
            sex: 'f',
        }]);
        assert.equal(test1.objectsCounter, 0);
        assert.equal(test1.listsCounter, 1);
        assert.deepEqual( await test1.collection.getList({
            minAge: 27,
        }), [{
            id: '1',
            age: 28,
            sex: 'm',
        }, {
            id: '4',
            age: 52,
            sex: 'f',
        }]);
        assert.equal(test1.objectsCounter, 0);
        assert.equal(test1.listsCounter, 1);

        const test2 = initListableCollection(cache);
        assert.deepEqual( await test2.collection.getList({
            minAge: 27,
        }), [{
            id: '1',
            age: 28,
            sex: 'm',
        }, {
            id: '4',
            age: 52,
            sex: 'f',
        }]);
        assert.equal(test2.objectsCounter, 0);
        assert.equal(test2.listsCounter, 0);

        assert.deepEqual( await test2.collection.getList({
            minAge: 29,
        }), [{
            id: '4',
            age: 52,
            sex: 'f',
        }]);
        assert.equal(test2.objectsCounter, 0);
        assert.equal(test2.listsCounter, 1);

        await test2.collection.clearCache('1');

        assert.deepEqual( await test2.collection.getList({
            minAge: 27,
        }), [{
            id: '1',
            age: 28,
            sex: 'm',
        }, {
            id: '4',
            age: 52,
            sex: 'f',
        }]);
        assert.equal(test2.objectsCounter, 0);
        assert.equal(test2.listsCounter, 2);

        assert.deepEqual( await test2.collection.getList({
            minAge: 29,
        }), [{
            id: '4',
            age: 52,
            sex: 'f',
        }]);
        assert.equal(test2.objectsCounter, 0);
        assert.equal(test2.listsCounter, 2);
    });

    it('invalidate list cache', async () => {
        const cache = new MemoryCache();
        const test1 = initListableCollection(cache);
        assert.deepEqual( await test1.collection.getList({
            sex: 'm',
        }), [{
            id: '1',
            age: 28,
            sex: 'm',
        }, {
            id: '3',
            age: 16,
            sex: 'm',
        }]);
        assert.deepEqual( await test1.collection.getList({
            sex: 'f',
        }), [{
            id: '2',
            age: 25,
            sex: 'f',
        }, {
            id: '4',
            age: 52,
            sex: 'f',
        }]);
        assert.equal(test1.objectsCounter, 0);
        assert.equal(test1.listsCounter, 2);

        await test1.collection.invalidateListCache('sex=m');

        assert.deepEqual( await test1.collection.getList({
            sex: 'm',
        }), [{
            id: '1',
            age: 28,
            sex: 'm',
        }, {
            id: '3',
            age: 16,
            sex: 'm',
        }]);
        assert.equal(test1.objectsCounter, 0);
        assert.equal(test1.listsCounter, 3);
        assert.deepEqual( await test1.collection.getList({
            sex: 'f',
        }), [{
            id: '2',
            age: 25,
            sex: 'f',
        }, {
            id: '4',
            age: 52,
            sex: 'f',
        }]);
        assert.equal(test1.objectsCounter, 0);
        assert.equal(test1.listsCounter, 3);

        const test2 = initListableCollection(cache);
        assert.deepEqual( await test2.collection.getList({
            sex: 'm',
        }), [{
            id: '1',
            age: 28,
            sex: 'm',
        }, {
            id: '3',
            age: 16,
            sex: 'm',
        }]);
        assert.equal(test2.objectsCounter, 0);
        assert.equal(test2.listsCounter, 0);
        assert.deepEqual( await test1.collection.getList({
            sex: 'f',
        }), [{
            id: '2',
            age: 25,
            sex: 'f',
        }, {
            id: '4',
            age: 52,
            sex: 'f',
        }]);
        assert.equal(test2.objectsCounter, 0);
        assert.equal(test2.listsCounter, 0);

        test2.collection.invalidateListCache('sex=f');
        assert.deepEqual( await test2.collection.getList({
            sex: 'f',
        }), [{
            id: '2',
            age: 25,
            sex: 'f',
        }, {
            id: '4',
            age: 52,
            sex: 'f',
        }]);
        assert.equal(test2.objectsCounter, 0);
        assert.equal(test2.listsCounter, 1);
    });
});
