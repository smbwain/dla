
import {Cache} from './cache';

export type SyncOrAsync<T> = T | Promise<T>;

export interface ICollection<V> {
    getOne(id: string): Promise<V>;
    getFewAsArray(ids: string[]): Promise<V[]>;
    getFewAsMap(ids: string[]): Promise<IMap<V>>;
    clearCache(id: string | string[]): Promise<void>;
}

export interface IMap<V> {
    [id: string]: V;
}

export interface IListData<V> {
    items: V[];
    meta?: any;
}

export interface IListableCollection<V, Filter> extends ICollection<V> {
    getListWithMeta(filter: Filter): Promise<IListData<V>>;
    getList(filter: Filter): Promise<V[]>;
    invalidateCacheTag(invalidators: string[]): Promise<void>;
    // invalidateListCache(invalidator: string | string[]): Promise<void>
}

export type SingleLoader<V> = (id: string) => SyncOrAsync<V>;
export type MultiLoader<V> = (ids: string[]) => SyncOrAsync<IMap<V>>;
export type MultiLoaderDefinition<V> = (ids: string[]) => SyncOrAsync<IMap<V> | V[]>;
export type ListLoader<V, Filter> = (filter: Filter) => SyncOrAsync<V[] | IListData<V>>;
export type IdExtractor<V> = (v: V) => string;

export interface ICollectionOptions<V> {
    loadOne?: SingleLoader<V>;
    loadFew?: MultiLoaderDefinition<V>;
    objectCache?: Cache<ICacheElement<V>>;
    extractId: IdExtractor<V>;
    cache?: Cache<any>;
}

export interface IListableCollectionOptions<V, Filter> extends ICollectionOptions<V> {
    loadList: ListLoader<V, Filter>;
    invalidationTags?: (filter: Filter) => string[];
    listCache?: Cache<IListCacheElement>;
    invalidatorCache?: Cache<number>;
    cowardListCache?: boolean;
}

export interface ICacheElement<V> {
    ts: number;
    dt: V;
}

export interface IListCacheElement {
    ts: number;
    ids: string[];
    meta: any;
}
