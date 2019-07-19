# couchdb-dispatcher

> Massive getter by ID for CouchDB, with multiple collections

## Getting started

In order to install, simply use npm.

```bash
npm i couchdb-dispatcher
```

Then, import it in you file.

```ts
import { Routes } from 'couchdb-dispatcher';
```

## Usage

Dispatcher can hold two differents use cases: Dispatch into differents collection according to IDs, or serve access to a collection with a specific URL.

### Automatic dispatch into collections

According to some ID patterns, you can choose in which collection you want to fetch from.

```ts
import { EndpointAccepters, Routes } from 'couchdb-dispatcher';


// Set accepters
const accepters: EndpointAccepters = {
    /**
     * 'collection_fetched_if_function_is_true_or_regex_is_valid': (Function ~> boolean|string) | Regex
     */
    // Function are accepted, truthy values mean id is accepted in corresponding collection,
    // falsy values continues search in other endpoints. ONE match stop the search !
    'crispr_1': function(id: string) {
        return id.match(/arbitary_pattern/i);
    },
    'crispr_2': (id: string) => id.includes('cc'),

    // You can also specify regexps
    'crispr_3': /test/i,

    // If your function returns a string, 
    // returned string will be search in this collection instead of original id
    'crispr_4': (id: string) => id.match(/iiii/i) ? id.replace(/iiii/g, 'aaaa') : false
};

// Set URL
const database_url = "http://localhost:5984";

// Create object
const routes = new Routes(accepters, database_url);

// Create a route that listen to request
routes.set({
    method: 'POST',
    route: '/bulk',
    get_keys: function (request, response) {
        if (request.body.keys && Array.isArray(request.body.keys)) {
            // If ok, return an array of ID string
            return request.body.keys;
        }

        // Otherwise, return nothing
        response.status(400).json({ error: "Request is invalid" });
    },

    // During request, collection will be automatically be choosen using EndpointAccepters

    post_data: function (_, response, data) {
        // Return database response as HTTP response
        response.json(data);
    }
})
``` 
---

### Serve access to differents collections

You can set multiple route for targeting a specific route for a URL.

```ts
import { Routes } from 'couchdb-dispatcher';

const database_url = "http://localhost:5984";

const routes = new Routes({}, database_url);

// Set route targeting a specific collection
route.set({
    method: 'POST',
    // Target all /:specie requests
    route: '/bulk/:specie',
    // Construct collection name to be searched with a function
    endpoint: req => 'id_map_' + req.params.specie,

    // Keys / data treatment...
    get_keys: (req, res) => req.body.keys ? req.body.keys : void res.status(400).json({ error: "Unwell-formed request" }),
    post_data: (_, res, data) => res.json({ request: data }),
    on_error: (_, res, error) => res.status(500).json({ error: "Database error" })
});
```
