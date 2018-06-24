
# What is _dla_

It's **data loading library**, which can live between your API implementation (e.g. graphql) and database layer.
It operates on elements and lists of elements.

**You implement getters** for elements. _dla_ tries to run them **as seldom as possible**, grouping single get requests
into batches. So, you can make a plenty of asynchronous data requests building nodes for your _graphql_ response tree.
_dla_ runs your getter once.

**_dla_ supports caching**. You can use one of cache wrappers to cache elements locally, in memcache, redis or write
your own one. There are methods to invalidate cache. You just need to call them in places, where your data is changed.

**_dla_ supports lists**. You can specify custom filters to load lists of items.

**It caches lists too**. Actually it caches ids of elements. Cache of list is invalidated as soon as cache of
any of its element is invalidated.
In some more complex cases, you are able to define custom invalidation rules for lists, to invalidate them easily.

## Simple collection

Collection is a key-value storage. It allows you to retrieve elements by their ids.

**Id is a string**.

> You are not required to have _id_ property in your element interface.
> It can be called as you want, have any type or it can even be calculated from other fields.
> But you should be able to identify and load any element by its unique string id.
> You are also required to provide _extractId_ method to extract id from your element.

### Define

```typescript
import {Collection} from 'dla';

interface User {
    id: string;
    name: string;
    age: number;
}
const collection = new Collection<User>({
    extractId: (user) => user.id,
    loadFew: async (ids) => {
        // load data by ids from your db... or somewhere
        // return { id1: User, id2: User, ... } or [User, User, ...];
    },
});
```

> Method _loadFew_ should return:
>
> - object, where keys are element ids and values are elements
> - or array of elements in arbitrary order. In this case method
> _extractId_ will be internally used to match elements to their ids.
>
> E.g.
>
> ```typescript
> import {Collection, index} from 'dla';
> interface User {
>     _id: string;
>     name: string;
>     age: number;
> }
> const collection = new Collection<User>({
>     extractId: (user) => user._id,
>     loadFew: async (ids) => {
>       return await mongoDb.collection('users').find({
>           _id: {$in: ids},
>       }).toArray(),
>     },
> });
> ```

### Load one element

```typescript
collection.getOne('47').then((user) => ...)
```

### Load few elements

```typescript
collection.getFewAsArray(['47', '58']).then((users) => {
    // users = [User, User]
})
```

or

```typescript
collection.getFewAsMap(['47', '58']).then((users) => {
    // users = {'47': User, '58': User}
})
```

## Listable collection

ListableCollection implements Collection functionality.

Also it allows you to define custom filter to load list of elements.

> You can define only one filter for collection.
> So if there are a couple of ways to load list, your filter should combine all of them.

### Define

```typescript
import {ListableCollection} from 'dla';
interface User {
    id: string;
    email: string;
    age: number;
}
interface UserFilter {
    email?: string;
    olderThan?: number;
}
const collection = new ListableCollection<User, UserFilter>({
    extractId: (user) => user.id,
    loadFew: async (ids) => {
        // load data by ids from your db... or somewhere
        // return [User, User, ...];
    },
    loadList: async (filter) => {
        // load list from your db using custom filter
        // return [ User, User, ... ]
    },
});
```

### Load list of items

```typescript
collection.getList({age: 23}).then((users) => {
    // users = [User, User, ...]
})
```

## Caching

### Internal cache

_Collection_ uses internal cache for elements by their id.
So it doesn't send more than one request for the same element.
Even if you try to load them simultaneously.

Because of that, **it's important to create new collection instance for each context**.
E.g. if you use it with graphql or restful API, you may want to create collection instance for each user request.

### External cache  

_dla_ **does not** uses external cache by default.

But you are able to use one of the ready to use cache implementations or implement your own.
To use cache you should pass property _cache_ to constructor of _Collection_ or _ListableCollection_.

```typescript
import {ListableCollection, MemoryCache} from 'dla';
interface User {
    id: string;
    email: string;
    age: number;
}
interface UserFilter {
    email?: string;
    olderThan?: number;
}
const cache = new MemoryCache();
const collection = new ListableCollection<User, UserFilter>({
    cache,
    extractId: (user) => user.id,
    loadFew: async (ids) => {
        // load data by ids from your db... or somewhere
        // return [User, User, ...];
    },
    loadList: async (filter) => {
        // load list from your db using custom filter
        // return [ User, User, ... ]
    },
});
```

### Invalidate single element cache

```typescript
collection.clearCache('47')
```

or

```typescript
collection.clearCache(['47', '48', '49'])
```

### Invalidate cache for lists of elements

As _dla_ caches list as list of element ids, cache of list is
invalidated as soon as cache of any of its elements is invalidated.
So, e.g. if price of your shopping cart item has been changed,
and you invalidate cache for this item, all caches of lists which
contain this item are invalidated automatically.

However, sometimes it's not enough.
For example: user clicks "like" button on some item. You want to invalidate list of his favourite items
to put a new one item there. But no one of items which currently placed in his favourites list has been changed during this action.

In this case you can use _invalidation tag_.

List of retrieved items can be "tagged" by few invalidation tags.
Tag is some string value. In appropriate places you can invalidate all caches tagged by some tag.

So, for user with id=48 you can tag list of their favourite items with a tag "favouriteForUser-48".
Any time when user with id=48 clicks "like" button, you can invalidate appropriate tag.
All caches with this tag will be invalidated.

Let's say, you have following collection:

```typescript
interface Item {
    id: string;
    name: string;
    price: number;
}
interface ItemFilter {
    favouriteForUser?: string; // user id
}

const collection = new ListableCollection<Item, ItemFilter>({
    extractId: (item) => item.id,
    loadFew: (ids) => {
        // return [Item, Item, ...];
    },
    loadList: (filter) => {
        if (filter.favouriteForUser) {
            // loads items from users favourites list
            // return [ Item, Item, ... ]
        }
    },
});
```

First of all, to use invalidation tags, your should define method _invalidationTags_ in ListableCollection options which takes filter and
returns list of invalidation tags.

```typescript
// ...
const collection = new ListableCollection<Item, ItemFilter>({
    cache: new MemoryCache(),
    extractId: (item) => item.id,
    loadFew: (ids) => {
        // return [Item, Item, ... ];
    },
    loadList: (filter) => {
        if (filter.favouriteForUser) {
            // loads items from users favourites list
            // return [ Item, Item, ... ]
        }
    },
    invalidationTags: (filter) => {
        if (filter.favouriteForUser) {
            return [`favouriteForUser-${filter.favouriteForUser}`]
        }
        return [];
    },
});
```

Now, any time you load favourites list, doing:

```typescript
collection.getList({favouriteForUser: '48'}).then((items) => ...)
```

_dla_ caches this list and "attaches" tag "favouriteForUser-48" to this cache.
Whenever, user clicks like/dislike button, you can just call:

```typescript
collection.invalidateCacheTag(`favouriteForUser-${userId}`)
```

to invalidate all caches tagged by this tag.

> Actually, _ListableCollection_ uses three types of cache: _objectCache_, _listCache_ and _invalidatorCache_.
> _Collection_ uses only first one: _objectCache_.
> You can pass cache objects separately for each type, using appropriate properties in constructor options object.
> When you pass _cache_ property, this cache will be used for all cache types, but different prefixes will be added to
> keys of different types of cache. 