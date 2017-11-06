
export type SyncOrAsync<T> = T | Promise<T>;

export interface ICache<V> {
    has(key: string): Promise<boolean>;
    get(key: string): Promise<V>;
    set(key: string, value: V, options?: IOptionsTTL): Promise<void>;
    setnx(key: string, value: V, options?: IOptionsTTL): Promise<void>;
    remove(key: string): Promise<void>;
    mhas(keys: string[]): Promise<{[key: string]: boolean}>;
    mget(keys: string[]): Promise<{[key: string]: V}>;
    mset(few: {[key: string]: V}, options?: IOptionsTTL): Promise<void>;
    msetnx(few: {[key: string]: V}, options?: IOptionsTTL): Promise<void>;
    mremove(keys: string[]): Promise<void>;
    load(
        key: string,
        loader: () => SyncOrAsync<V>,
        options?: IOptionsTTL & IOptionsFast,
    ): Promise<V>;
    mload(
        keys: string[],
        loader: (keys: string[]) => SyncOrAsync<{[key: string]: V}>,
        options?: IOptionsTTL & IOptionsFast,
    ): Promise<{[key: string]: V}>;
}

export interface IOptionsTTL {
    ttl?: number;
}

export interface IOptionsFast {
    fast?: boolean;
}
