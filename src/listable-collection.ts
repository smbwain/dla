
import {MD5} from 'object-hash';

import {Cache, PrefixCache} from './cache';
import {Collection} from './collection';
import * as Types from './shared-types';

function unpackListData<V>(data: V[] | Types.IListData<V>): Types.IListData<V> {
    return Array.isArray(data) ? {
        items: data,
        meta: undefined,
    } : {
        items: data.items,
        meta: data.meta || undefined,
    };
}

export class ListableCollection<V, Filter> extends Collection<V> implements Types.IListableCollection<V, Filter> {
    // private promiseListCache;
    private loadList: Types.ListLoader<V, Filter>;
    private invalidationTags: (filter: Filter) => string[];
    private listCache: Cache<Types.IListCacheElement>;
    private invalidatorCache: Cache<number>;
    private cowardListCache: boolean = true;
    constructor(options: Types.IListableCollectionOptions<V, Filter>) {
        super(options);
        this.loadList = options.loadList;
        this.invalidationTags = options.invalidationTags;
        if (options.cowardListCache !== undefined) {
            this.cowardListCache = options.cowardListCache;
        }
        if (options.listCache !== undefined) {
            this.listCache = options.listCache;
        } else if (options.cache) {
            this.listCache = new PrefixCache<Types.IListCacheElement>('l:', options.cache);
        }
        if (options.invalidatorCache !== undefined) {
            this.invalidatorCache = options.invalidatorCache;
        } else if (options.cache) {
            this.invalidatorCache = new PrefixCache<number>('i:', options.cache);
        }
    }
    public async getListWithMeta(filter: Filter): Promise<Types.IListData<V>> {
        let loaded: Types.IListData<V>;
        if (!this.listCache) {
            loaded = unpackListData(await this.loadList(filter));
        } else {
            // try to load list data from cache
            const now = Date.now();
            const cacheKey = MD5(filter);
            let loadedFromCache = await this.listCache.get(cacheKey);
            const invalidationTags = this.invalidationTags ? this.invalidationTags(filter) : null;
            if (
                loadedFromCache &&
                invalidationTags &&
                !(await this.checkInvalidators(invalidationTags, loadedFromCache.ts))
            ) {
                loadedFromCache = null;
            }
            if (loadedFromCache) {
                if (this.cowardListCache) {
                    // return cached list if all items stored in cache
                    // and no one item has been recached after list cache was built
                    const cachedObjects = await this.objectCache.mget(loadedFromCache.ids);
                    if (loadedFromCache.ids.every(
                            (id) => !!cachedObjects[id] && cachedObjects[id].ts <= loadedFromCache.ts,
                    )) {
                        return {
                            items: loadedFromCache.ids.map((id) => cachedObjects[id].dt),
                            meta: loadedFromCache.meta,
                        };
                    }
                } else {
                    // return cached list if all could be loaded (from cache or with loader)
                    const items = await this.getFewAsArray(loadedFromCache.ids);
                    if (items.every((item) => !!item)) {
                        return {
                            items,
                            meta: loadedFromCache.meta,
                        };
                    }
                }
            }

            // load list with loader
            loaded = unpackListData(await this.loadList(filter));

            const few: {[id: string]: Types.ICacheElement<V>} = {};
            for (const item of loaded.items) {
                few[this.extractId(item)] = {
                    ts: now,
                    dt: item,
                };
            }
            await this.objectCache.msetnx(few);

            await this.listCache.set(cacheKey, {
                ids: loaded.items.map(this.extractId),
                meta: loaded.meta,
                ts: now,
            });

            if (invalidationTags) {
                await this.setInvalidators(invalidationTags, now);
            }
        }

        // save loaded items into collection's cache
        for (const item of loaded.items) {
            const id = this.extractId(item);
            if (!this.promiseCache[id]) {
                this.promiseCache[id] = Promise.resolve(item);
            }
        }

        return loaded;
    }
    public async getList(filter: Filter): Promise<V[]> {
        return (await this.getListWithMeta(filter)).items;
    }
    public async invalidateCacheTag(invalidator: string | string[]): Promise<void> {
        if (Array.isArray(invalidator)) {
            await this.invalidatorCache.mremove(invalidator);
        } else {
            await this.invalidatorCache.remove(invalidator);
        }
    }
    private async checkInvalidators(invalidators: string[], stamp: number): Promise<boolean> {
        if (!invalidators.length) {
            return true;
        }
        const invalidatorValues = await this.invalidatorCache.mget(invalidators);
        return invalidators.every(
            (invalidator) => invalidatorValues[invalidator] && invalidatorValues[invalidator] <= stamp,
        );
    }
    private async setInvalidators(invalidators: string[], now: number): Promise<void> {
        if (invalidators.length) {
            const set = {};
            for (const invalidator of invalidators) {
                set[invalidator] = now;
            }
            await this.invalidatorCache.msetnx(set);
        }
    }
}
