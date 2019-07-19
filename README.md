# couchdb-dispatcher

> Massive getter by ID for CouchDB, with multiple collections

## Getting started

In order to install, simply use npm.

```bash
npm i couchdb-dispatcher
```

Then, import it in you file.

```ts
import { Routes, Route } from 'couchdb-dispatcher';
```

## Usage

Dispatcher can hold two differents use cases: Dispatch into differents collection according to IDs, or serve access to a collection with a specific URL.

### Dispatch into collections

According to some ID patterns, you can choose in which collection you want to fetch from.

```ts
import { EndpointAccepters, Routes } from 'couchdb-dispatcher';


// Set accepters
const accepters: EndpointAccepters = {
    'crispr_1': function(id: string) {
        return id.match(/arbitary_pattern/i);
    },
    'crispr_2': /test/i,
    'crispr_3': (id: string) => id.includes('cc')
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
    post_data: function (_, response, data) {
        // Return database response as HTTP response
        response.json(data);
    }
})
```
