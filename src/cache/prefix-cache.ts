
import {Cache} from './cache';
import * as Types from './shared-types';

import {mapObjectKeys} from '../utils';

export class PrefixCache<V> extends Cache<V> {
    public origin: Types.ICache<V>;
    public prefix: string;

    constructor(prefix: string, origin: Types.ICache<V>) {
        super();
        this.origin = origin;
        this.prefix = prefix;
    }

    public has(key: string): Promise<boolean> {
        return this.origin.has(this.prefix + key);
    }

    public get(key: string): Promise<V> {
        return this.origin.get(this.prefix + key);
    }

    public set(key: string, value: V, options: Types.IOptionsTTL): Promise<void> {
        return this.origin.set(this.prefix + key, value, options);
    }

    public setnx(key: string, value: V, options: Types.IOptionsTTL): Promise<void> {
        return this.origin.setnx(this.prefix + key, value, options);
    }

    public remove(key: string): Promise<void> {
        return this.origin.remove(this.prefix + key);
    }

    public mhas(keys: string[]): Promise<{[key: string]: boolean}> {
        return mapObjectKeys(
            this.origin.mhas(keys.map((key) => this.prefix + key)),
            (key) => key.slice(this.prefix.length),
        );
    }

    public async mget(keys: string[]): Promise<{[key: string]: V}> {
        return mapObjectKeys(
            await this.origin.mget(keys.map((key) => this.prefix + key)),
            (key) => key.slice(this.prefix.length),
        );
    }

    public mset(few: {[key: string]: V}): Promise<void> {
        return this.origin.mset(mapObjectKeys(
            few,
            (key) => this.prefix + key,
        ));
    }

    public msetnx(few: {[key: string]: V}): Promise<void> {
        return this.origin.msetnx(mapObjectKeys(
            few,
            (key) => this.prefix + key,
        ));
    }

    public mremove(keys: string[]): Promise<void> {
        return this.origin.mremove(keys.map((key) => this.prefix + key));
    }

    public load(
        key: string,
        loader: () => Types.SyncOrAsync<V>,
        options?: {fast?: boolean},
    ): Promise<V> {
        return this.origin.load(this.prefix + key, loader, options);
    }

    public async mload(
        keys: string[],
        loader: (keys: string[]) => Types.SyncOrAsync<{[id: string]: V}>,
        options: {fast?: boolean},
    ): Promise<{[id: string]: V}> {
        return mapObjectKeys(
            await this.origin.mload(
                keys.map((key) => this.prefix + key),
                async (ids) => mapObjectKeys(
                    (await loader(ids.map((id) => id.slice(this.prefix.length)))),
                    (id) => this.prefix + id,
                ),
                options,
            ),
            (key) => key.slice(this.prefix.length),
        );
    }
}

export function prefixCache<V>(prefix: string, origin: Types.ICache<V>) {
    return origin ? new PrefixCache<V>(prefix, origin) : null;
}
