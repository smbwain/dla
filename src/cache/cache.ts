
import * as Types from './shared-types';

export abstract class Cache<V> implements Types.ICache<V> {
    public abstract get(key: string): Promise<V>;
    public abstract set(key: string, value: V, options?: Types.IOptionsTTL): Promise<void>;
    public abstract remove(key: string): Promise<void>;

    public async has(key: string): Promise<boolean> {
        return (await this.get(key)) != null;
    }

    public async mhas(keys: string[]): Promise<{[id: string]: boolean}> {
        const arr = await Promise.all(keys.map((key) => this.has(key)));
        const res = {};
        keys.forEach((id, i) => {
            res[id] = arr[i];
        });
        return res;
    }

    public async mget(keys: string[]): Promise<{[key: string]: V}> {
        const res = {};
        (await Promise.all(
            keys.map((key) => this.get(key)),
        )).forEach((val, i) => {
            if ((val) !== undefined) {
                res[keys[i]] = val;
            }
        });
        return res;
    }

    public async mset(few: {[key: string]: V}, options?: Types.IOptionsTTL): Promise<void> {
        await Promise.all(
            Object.keys(few).map((key) => this.set(key, few[key], options)),
        );
    }

    public async setnx(key: string, value: V, options?: Types.IOptionsTTL): Promise<void> {
        if (!await this.has(key)) {
            await this.set(key, value, options);
        }
    }

    public async msetnx(few: {[key: string]: V}, options?: Types.IOptionsTTL): Promise<void> {
        await Promise.all(
            Object.keys(few).map(
                (key) => this.setnx(key, few[key], options),
            ),
        );
    }

    public async mremove(keys: string[]): Promise<void> {
        await Promise.all(
            keys.map((key) => this.remove(key)),
        );
    }

    public async load(
        key: string,
        loader: () => Types.SyncOrAsync<V>,
        options: Types.IOptionsTTL & Types.IOptionsFast = {},
    ): Promise<V> {
        let cached = await this.get(key);
        if (cached === undefined) {
            cached = await loader();
            const setPromise = this.set(key, cached, options);
            if (!options.fast) {
                await setPromise;
            }
        }
        return cached;
    }

    public async mload(
        keys: string[],
        loader: (keys: string[]) => Types.SyncOrAsync<{[id: string]: V}>,
        options: Types.IOptionsTTL & Types.IOptionsFast = {},
    ): Promise<{[id: string]: V}> {
        const cached = await this.mget(keys);
        const restKeys = keys.filter((key) => cached[key] === undefined);
        if (!restKeys.length) {
            return cached;
        }

        const storaged = await loader(restKeys);
        /*for(const key of restKeys) {
            if(!(key in storaged)) {
                storaged[key] = null;
            }
        }*/
        const setPromise = this.mset(storaged, options);
        if (!options.fast) {
            await setPromise;
        }
        return {
            ...cached,
            ...storaged,
        };
    }
}
