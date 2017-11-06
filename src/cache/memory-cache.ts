
import {Cache} from './cache';
import * as Types from './shared-types';

export class MemoryCache<V> extends Cache<V> {
    public store: {[id: string]: V} = {};

    public async has(key: string): Promise<boolean> {
        return key in this.store;
    }

    public async get(key: string): Promise<V> {
        return this.store[key];
    }

    public async set(key: string, value: V, options?: Types.IOptionsTTL): Promise<void> {
        this.store[key] = value;
    }

    public async setnx(key: string, value: V, options?: Types.IOptionsTTL): Promise<void> {
        if (!(key in this.store)) {
            this.store[key] = value;
        }
    }

    public async remove(key: string): Promise<void> {
        delete this.store[key];
    }

    public flush() {
        this.store = {};
    }
}
