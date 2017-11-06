
# What is _dla_

It's one more **data loading library**, which could live between your API implementation (e.g. graphql) and 
data retrieving logic.
In contrast with [dataloader](https://github.com/facebook/dataloader) it deals with custom filters and lists of items.

**You implement getters** for elements. _dla_ tries to run them **as seldom as possible**, grouping single get requests
into batches. So, you could make a plenty of asynchronous data requests building nodes for your _graphql_ response tree.
_dla_ runs your getter once.

**_dla_ supports caching**. You could use one of cache wrappers to cache objects locally/in memcache/in redis or write
your own one. There are methods to invalidate caches. So you could call them in places, where your data is being changed.

**_dla_ supports lists**. You could specify custom filters to load lists of items.

**It caches lists too**. Actually it caches ids of elements. So list cache is invalidated as soon as cache of any
of its element is invalidated. Also you could define custom invalidation keys for lists, to invalidate them easily.

## @TODO: add example of cache initialization 

## Simple collection

Simple collection allows you to retrieve elements by their ids.

**Id is a string**.

> You are not required to have _id_ property in your element.
> In element it could be called as you want, have any type or it could even be calculated from other fields.
> But you should be able to identify and load any element by its unique string id. 

### Init

```typescript
import {Collection} from 'dla';

interface User {
    id: string;
    name: string;
    age: number;
}
const collection = new Collection<User>({
    loadFew: async (ids) => {
        // load data by ids from your db... or somewhere
        // return { id1: User, id2: User, ... };
    }
});
```

> Method _loadFew_ should return object, where keys are elements ids.
> If you retrieved array of elements, you could use helper method _index_ to convert array to object. 
> ```typescript
> import {Collection, index} from 'dla';
> interface User {
>     _id: string;
>     name: string;
>     age: number;
> }
> const collection = new Collection<User>({
>     loadFew: async (ids) => {
>         return index(
>             await mongoDb.collection('users').find({
>                 _id: {$in: ids},
>             }).toArray(),
>             user => user._id,
>         );
>     },
> });
> ```

### Load one element

```typescript
collection.getOne('47').then(user => ...)
```

### Load few elements

```typescript
collection.getFewAsArray(['47', '58']).then(usersArray => {
    // usersArray = Array(User, User)
})
```

or

```typescript
collection.getFewAsMap(['47', '58']).then(usersMap => {
    // usersMap = {'47': User, '58': User}
})
```

## Listable collection

ListableCollection implements Collection functionality.

Also it allows you to define custom filter to load list of elements.

> You could define only one filter for collection.
> So if there are a couple of ways to load list, your filter should combine all of them.

### Init

```typescript
import {ListableCollection} from 'dla';
interface User {
    email: string
    age: number
}
interface UserFilter {
    email?: string
    olderThan?: number
}
const collection = new ListableCollection<User, UserFilter>({
    loadFew: async (ids) => {
        // load data by ids from your db... or somewhere
        // return { id1: User, id2: User, ... };
    },
    loadList: async (filter) => {
        // load list from your db using custom filter
        // return [ User, User, ... ]
    }
});
```

### Load list of items

```typescript
collection.loadList({age: 23}).then(usersArray => ...)
```

## Caching

### Internal cache

_Collection_ uses internal cache for elements by id.
So it doesn't send more than one request for the same element.
Even if you try to load it few times simultaneously.

Because of that, **it's important to create new collection instance for each context**.
E.g. if you use it with graphql or restful API, you may want to crete collection instance for each user request.

### External cache  

_dla_ **does not** uses external cache by default.
To use cache you should pass property _cache_ to constructor of _Collection_ or _ListableCollection_.

You could use one of ready to use cache implementation or implement your own.

### Invalidate cache of object

```typescript
collection.clearCache(47)
```

or

```typescript
collection.clearCache([47, 48, 49])
```

### Invalidating cache for lists of elements

As _dla_ caches list as list of element ids, cache of list is invalidated as soon as cache for any of its elements
is invalidated.
So, e.g. if price of your shopping cart item has been changed, and you invalidate cache for this item,
all caches of lists which contain this item are invalidated automatically.

However, sometimes it's not enough.
For example: user clicks "like" button on some item. You want to invalidate list of his favourite items.
But no one of items which currently placed in his favourites list isn't changed during this action.

In this case you could use invalidation keys.

Any list of items could be "tagged" by few invalidators. Invalidator is just some string value.
In appropriate places you could invalidate all caches tagged by some invalidator.

So, for user with id=48 you could tag lists of favourite items by invalidator "favouriteForUser-48".
Any time when user 48 clicks favourite button, you could invalidate appropriate invalidator.
All caches with this invalidator will be invalidated.

Let's say, you have following collection:

```typescript
interface Item {
    name: string
    price: number
}
interface ItemFilter {
    favouriteForUser?: string // user id
}

const collection = new ListableCollection<Item, ItemFilter>({
    loadFew: ids => {
        // return { id1: Item, id2: Item, ... };
    },
    loadList: filter => {
        if(filter.favouriteForUser) {
            // loads items from users favourites list
            // return [ Item, Item, ... ]
        }
    }
});
```

First for all, your should define method _listCacheInvalidators_ in ListableCollection options which takes filter and
returns list of invalidation keys.

```typescript
// ...
const collection = new ListableCollection<Item, ItemFilter>({
    cache: new MemCache(),
    loadFew: ids => {
        // return { id1: Item, id2: Item, ... };
    },
    loadList: filter => {
        if(filter.favouriteForUser) {
            // loads items from users favourites list
            // return [ Item, Item, ... ]
        }
    },
    listCacheInvalidators: filter => {
        if(filter.favouriteForUser) {
            return [`favouriteForUser-${filter.favouriteForUser}`]
            // loads items from users favourites list
            // return [ Item, Item, ... ]
        }
    }
});
```

Now, any time you load favourites list, doing:

```typescript
collection.loadList({favouriteForUser: '47'}).then(items => ...)
```

_dla_ caches this list and "attaches" invalidator "favouriteForUser-47" to this cache.
Whenever, user clicks like/dislike button, you could just call:

```typescript
collection.invalidateListCache(`favouriteForUser-${userId}`)
```

to invalidate all caches tagged by this invalidator.

> Actually, _ListableCollection_ uses three types of cache: _objectCache_, _listCache_ and _invalidatorCache_.
> _Collection_ uses only one of them: _objectCache_.
> You could pass cache objects separately for each type, using appropriate properties in constructor options object. 
> When you pass _cache_ property, this cache will be used for all cache types, but different prefixes will be added to
> keys of different types of cache. 