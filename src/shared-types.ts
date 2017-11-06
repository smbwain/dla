
import {Cache} from './cache';

export type SyncOrAsync<T> = T | Promise<T>;

export interface ICollection<Type> {
    getOne(id: string): Promise<Type>;
    getFewAsArray(ids: string[]): Promise<Type[]>;
    getFewAsMap(ids: string[]): Promise<{[key: string]: Type}>;
    clearCache(id: string | string[]): Promise<void>;
}

export interface IListData<V> {
    items: V[];
    meta?: any;
}

export interface IListableCollection<V, Filter> extends ICollection<V> {
    getListWithMeta(filter: Filter): Promise<IListData<V>>;
    getList(filter: Filter): Promise<V[]>;
    invalidateListCache(invalidators: string[]): Promise<void>;
    // invalidateListCache(invalidator: string | string[]): Promise<void>
}

export type SingleLoader<V> = (id: string) => SyncOrAsync<V>;
export type MultiLoader<V> = (ids: string[]) => SyncOrAsync<{[name: string]: V}>;
export type ListLoader<V, Filter> = (filter: Filter) => SyncOrAsync<V[] | IListData<V>>;
export type IdExtractor<V> = (v: V) => string;

export interface ICollectionOptions<V> {
    loadOne?: SingleLoader<V>;
    loadFew?: MultiLoader<V>;
    objectCache?: Cache<ICacheElement<V>>;
    cache?: Cache<any>;
}

export interface IListableCollectionOptions<V, Filter> extends ICollectionOptions<V> {
    loadList: ListLoader<V, Filter>;
    listCacheInvalidators?: (filter: Filter) => string[];
    idExtractor?: IdExtractor<V>;
    listCache?: Cache<IListCacheElement>;
    invalidatorCache?: Cache<number>;
    cowardListCache?: boolean
}

export interface ICacheElement<V> {
    ts: number
    dt: V
}

export interface IListCacheElement {
    ts: number;
    ids: string[];
    meta: any;
}
