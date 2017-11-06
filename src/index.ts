
export * from './collection';
export * from './listable-collection';
export * from './cache';

export function index<V>(list: V[], idExtractor: (v: V) => string): {[id: string]: V} {
    const res = {};
    for (const item of list) {
        res[idExtractor(item)] = item;
    }
    return res;
}
