
export function mapObjectKeys(obj: any, mapper: (name: string) => string): any {
    const res = {};
    for (const name in obj) {
        if (obj.hasOwnProperty(name)) {
            res[mapper(name)] = obj[name];
        }
    }
    return res;
}

export function mapObjectValues<V1, V2>(
    obj: {[key: string]: V1},
    mapper: (value: V1, name: string) => V2,
): {[key: string]: V2} {
    const res = {};
    for (const name in obj) {
        if (obj.hasOwnProperty(name)) {
            res[name] = mapper(obj[name], name);
        }
    }
    return res;
}
