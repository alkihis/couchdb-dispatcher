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


