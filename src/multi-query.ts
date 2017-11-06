
import {Cache} from './cache';
import * as Types from './shared-types';

import {mapObjectValues} from './utils';

export class MultiQuery<V> {
    public touched: boolean = false;
    public sent: boolean = false;
    private cache: Cache<Types.ICacheElement<V>>;

    private loadFew: Types.MultiLoader<V>;

    private promiseCache: {[id: string]: Promise<V>} = {};
    private resolvers: {[id: string]: [(v: V) => void, (err: any) => void]} = {};

    constructor(loadFew: Types.MultiLoader<V>, cache?: Cache<Types.ICacheElement<V>>) {
        this.loadFew = loadFew;
        this.cache = cache;
    }

    public async getOne(id: string): Promise<V> {
        if (this.sent) {
            throw new Error('Try to use MultiQuery after query has been sent');
        }
        if (!this.touched) {
            this.touched = true;
            Promise.resolve().then(() => {
                process.nextTick(() => {
                    this.load();
                });
            });
        }
        if (!this.promiseCache[id]) {
            this.promiseCache[id] = new Promise<V>((resolve, reject) => {
                this.resolvers[id] = [resolve, reject];
            });
        }
        return this.promiseCache[id];
    }

    public has(id: string): boolean {
        return id in this.promiseCache;
    }

    private async load(): Promise<void> {
        let res;
        this.sent = true;
        try {
            if (this.cache) {
                const now = Date.now();
                res = mapObjectValues<Types.ICacheElement<V>, V>(
                    await this.cache.mload(Object.keys(this.resolvers), async (ids) => {
                        return mapObjectValues<V, Types.ICacheElement<V>>(await this.loadFew(ids), (object) => ({
                            ts: now,
                            dt: object
                        }));
                    }, {fast: true}),
                    object => object.dt
                );
            } else {
                res = await this.loadFew(Object.keys(this.resolvers));
            }
        } catch (err) {
            for (const id of Object.keys(this.resolvers)) {
                this.resolvers[id][1](err);
            }
            return;
        }
        for (const id of Object.keys(this.resolvers)) {
            this.resolvers[id][0](res[id]);
        }
    }
}
