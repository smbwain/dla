
import {Cache, PrefixCache} from './cache';
import {MultiQuery} from './multi-query';
import * as Types from './shared-types';

export class Collection<V> implements Types.ICollection<V> {
    protected extractId: Types.IdExtractor<V>;

    /**
     * External cache wrapper
     */
    protected objectCache: Cache<Types.ICacheElement<V>>;

    /**
     * Cache of objects requested during collection life
     */
    protected promiseCache: {[id: string]: Promise<V>} = {};

    private loadFew: Types.MultiLoader<V>;
    private query: MultiQuery<V>;

    constructor(options: Types.ICollectionOptions<V>) {
        this.extractId = options.extractId;
        if (options.loadFew) {
            const loadFew = options.loadFew;
            this.loadFew = async (ids: string[]): Promise<Types.IMap<V>> => {
                const loaded = await loadFew(ids);
                if (Array.isArray(loaded)) {
                    const res: Types.IMap<V> = {};
                    for (const item of loaded) {
                        res[this.extractId(item)] = item;
                    }
                    return res;
                } else {
                    return loaded;
                }
            };
        } else if (options.loadOne) {
            const loadOne = options.loadOne;
            this.loadFew = async (ids: string[]) => {
                const res = {};
                (await Promise.all(ids.map(loadOne))).forEach((obj, i) => {
                    res[ids[i]] = obj;
                });
                return res;
            };
        } else {
            throw new Error('There should loadFew or loadOne method implemented');
        }

        if (options.objectCache !== undefined) {
            this.objectCache = options.objectCache;
        } else if (options.cache) {
            this.objectCache = new PrefixCache<Types.ICacheElement<V>>('o:', options.cache);
        }
    }
    public getOne(id: string): Promise<V> {
        if (!this.promiseCache[id]) {
            if (!this.query || this.query.sent) {
                this.query = new MultiQuery<V>(this.loadFew, this.objectCache);
            }
            this.promiseCache[id] = this.query.getOne(id);
        }
        return this.promiseCache[id];
    }
    public getFewAsArray(ids: string[]): Promise<V[]> {
        return Promise.all(ids.map((id) => this.getOne(id)));
    }
    public async getFewAsMap(ids: string[]): Promise<{[key: string]: V}> {
        const res = {};
        (await this.getFewAsArray(ids)).forEach((v, i) => {
            res[ids[i]] = v;
        });
        return res;
    }
    public async clearCache(idS: string | string[]): Promise<void> {
        if (Array.isArray(idS)) {
            if (this.objectCache) {
                await this.objectCache.mremove(idS);
            }
            for (const id of idS) {
                delete this.promiseCache[id];
            }
            if (this.query && idS.some((id) => this.query.has(id))) {
                this.query = null;
            }
        } else {
            if (this.objectCache) {
                await this.objectCache.remove(idS);
            }
            delete this.promiseCache[idS];
            if (this.query && this.query.has(idS)) {
                this.query = null;
            }
        }
    }
}
