import 'source-map-support/register';

import * as assert from 'assert';

import {ListableCollection} from '..';

interface IHuman {
    id: string;
    age: number;
}

interface IHumanFilter {
    minAge: number;
}

function init() {
    const data = [{
        id: '1',
        age: 28,
    }, {
        id: '2',
        age: 25,
    }, {
        id: '3',
        age: 16,
    }, {
        id: '4',
        age: 52,
    }];
    const result = {
        collection: new ListableCollection<IHuman, IHumanFilter>({
            extractId: (human) => human.id,
            loadOne: (id) => {
                result.objectsCounter ++;
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(
                            data.find((item) => item.id === id),
                        );
                    }, 300);
                });
            },
            loadList: (filter) => {
                return {
                    items: data.filter((item) => item.age >= filter.minAge),
                };
            },
        }),
        objectsCounter: 0,
    };
    return result;
}

describe('listable-collection', () => {
    it('makes single request', async () => {
        const test = init();
        assert.deepEqual( await test.collection.getOne('3'), {id: '3', age: 16});
        assert.deepEqual( test.objectsCounter, 1);
    });

    it('makes list request', async () => {
        const test = init();
        assert.deepEqual( await test.collection.getList({
            minAge: 27,
        }), [{
                id: '1',
                age: 28,
        }, {
                id: '4',
                age: 52,
        }]);
        assert.deepEqual( await test.collection.getOne('1'), {
            id: '1',
            age: 28,
        });
        assert.deepEqual( test.objectsCounter, 0);
    });
});
