import 'source-map-support/register';

import * as assert from 'assert';

import {Collection, index} from '..';

interface Item {
    id: string;
}

function init() {
    const result = {
        collection: new Collection<Item>({
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

describe('collection', () => {
    it('makes single request', async () => {
        const test = init();
        assert.deepEqual( await test.collection.getOne('5'), {id: '5'});
        assert.deepEqual( test.queryCounter, 1);
        assert.deepEqual( test.objectsCounter, 1);
    });

    it('makes few simultaneous request', async () => {
        const test = init();
        assert.deepEqual(
            await Promise.all([
                test.collection.getOne('5'),
                test.collection.getOne('5'),
                test.collection.getOne('6'),
                test.collection.getOne('7'),
            ]),
            [{id: '5'}, {id: '5'}, {id: '6'}, {id: '7'}],
        );
        assert.equal(test.queryCounter, 1);
        assert.equal(test.objectsCounter, 3);
    });

    it('makes one multi request as array', async () => {
        const test = init();
        assert.deepEqual(
            await test.collection.getFewAsArray(['5', '5', '6', '7']),
            [{id: '5'}, {id: '5'}, {id: '6'}, {id: '7'}],
        );
        assert.equal(test.queryCounter, 1);
        assert.equal(test.objectsCounter, 3);
    });

    it('makes one multi request as map', async () => {
        const test = init();
        assert.deepEqual(
            await test.collection.getFewAsMap(['5', '5', '6', '7']),
            {
                5: {id: '5'},
                6: {id: '6'},
                7: {id: '7'},
            },
        );
        assert.equal(test.queryCounter, 1);
        assert.equal(test.objectsCounter, 3);
    });

    it('makes mix of requests', async () => {
        const test = init();
        assert.deepEqual(
            await Promise.all([
                test.collection.getOne('5'),
                test.collection.getOne('5'),
                test.collection.getOne('6'),
                test.collection.getOne('7'),
                test.collection.getFewAsArray(['7', '8', '10']),
                test.collection.getFewAsMap(['5', '8', '9']),
            ]),
            [
                {id: '5'}, {id: '5'}, {id: '6'}, {id: '7'},
                [{id: '7'}, {id: '8'}, {id: '10'}],
                {5: {id: '5'}, 8: {id: '8'}, 9: {id: '9'}},
            ],
        );
        assert.equal(test.queryCounter, 1);
        assert.equal(test.objectsCounter, 6);
    });

    it('uses internal cache', async () => {
        const test = init();
        assert.deepEqual(
            await test.collection.getFewAsArray(['7', '8', '9']),
            [{id: '7'}, {id: '8'}, {id: '9'}],
        );
        assert.equal(test.queryCounter, 1);
        assert.equal(test.objectsCounter, 3);

        assert.deepEqual(
            await test.collection.getFewAsArray(['8']),
            [{id: '8'}],
        );
        assert.equal(test.queryCounter, 1);
        assert.equal(test.objectsCounter, 3);

        assert.deepEqual(
            await test.collection.getFewAsArray(['10', '8', '11']),
            [{id: '10'}, {id: '8'}, {id: '11'}],
        );
        assert.equal(test.queryCounter, 2);
        assert.equal(test.objectsCounter, 5);
    });
});
