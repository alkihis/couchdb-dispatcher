import express from 'express';

/**
 * Endpoint accepter: Function that accept an ID / Key and produce a true / false value if key should be accepted or not.
 * If Function produce a non-empty string, given string will be used as key (useful for trimming an prefix / suffix)
 */
export type EndpointAccepter = ((key: string) => boolean | string) | RegExp;
export type EndpointAccepters = { [endpoint: string]: EndpointAccepter };
export type DatabaseResponse = { [id: string]: {[databaseKeys: string]: any} };
type Queues = { [endpoint: string]: Queue };

if (typeof window === "undefined" || !window.fetch) {
    var fetch = require('node-fetch') as GlobalFetch["fetch"];
}

/**
 * Massive ID getter for multiple CouchDB documents
 *
 * @export
 * @class Dispatcher
 */
export default class Dispatcher {
    protected url: string;
    protected pool: Queues = {};
    protected private_pool: Queues = {};
    protected packet_size_per_queue: number;

    /**
     * Creates an instance of Dispatcher.
     * @param {string} database_link URL to the database
     * @param {EndpointAccepters} accept_functions Document name => function that return true if key is accepted in the document
     * @param {number} [packet_size=64] Max number of queries sended to the database in one time
     * @memberof Dispatcher
     */
    constructor(database_link: string, accept_functions: EndpointAccepters = {}, packet_size = 64) {
        this.url = database_link;
        this.packet_size_per_queue = packet_size;

        for (const [endpoint, func] of Object.entries(accept_functions)) {
            this.set(endpoint, func);
        }
    }

    /**
     * Load ids into queues (Massive ID getter)
     *
     * @param {string[]} ids
     * @returns {number} Numeric ID to flush with
     * @memberof Dispatcher
     */
    public load(ids: string[], custom?: string) : number {
        let ok: boolean;

        const uniq_id = Math.random();

        for (const k of ids) {
            ok = false;
            if (custom) {
                if (!(custom in this.pool)) {
                    this.set(custom, () => true, undefined, true);
                }

                this.pool[custom].push(k, uniq_id);
                continue;
            }

            for (const q of Object.values(this.pool).filter(p => !p.hidden)) {
                ok = q.push(k, uniq_id);

                if (ok) {
                    break;
                }
            }

            if (!ok) {
                console.error("Could not assign " + k + " in any request");
            }
        }

        return uniq_id;
    }

    /**
     * Flush all queues.
     *
     * @returns Promise<any>
     * @memberof Dispatcher
     */
    public async flush(id: number) {
        const data: any[][] = [];
        for (const q of Object.values(this.pool)) {
            data.push(await q.flush(id));
        }

        return this.flattenList(data);
    }

    /**
     * Flush all queues using a parallel method.
     *
     * @returns
     * @memberof Dispatcher
     */
    public async pFlush(id: number) : Promise<DatabaseResponse> {
        return this.flattenList(await Promise.all(Object.values(this.pool).map(q => q.flush(id))));
    }

    protected flattenList(data: any[][]) {
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        const f = async (a, b) => {
            await sleep(5);

            for (const e of b) {
                if ('error' in e)
                    continue;
                if (! ('id' in e))                    
                    throw (`No "id" in ${e}`);
                if (e['id'] in a)
                    throw (`Common "id\" in accumulator:\n${e}\nand curr datum\n${e}`);

                a[e['id']] = {};

                for (let k in e) {
                    if (k === 'id')
                        continue;

                    a[e['id']][k] = e[k];
                }
            }

            return a;
        };

        return data.reduce(async (previous, next) => {
            return f(await previous, next);
        }, Promise.resolve({}));
    }

    /**
     * Remove an endpoint
     * @param endpoint 
     */
    public remove(endpoint: string) {
        if (endpoint in this.pool) {
            delete this.pool[endpoint];
        }
        else {
            console.warn('Corresponding endpoint queue not found');
        }
    }

    /**
     * Set an endpoint
     * @param endpoint Name
     * @param accept_function Accepter function
     * @param packet_size Number of packets max
     * @param hidden Hidden endpoint or not
     */
    public set(endpoint: string, accept_function: EndpointAccepter, packet_size = this.packet_size_per_queue, hidden = false) {
        if (endpoint in this.pool) {
            // Mise à jour de l'ancienne Queue
            if (accept_function)
                this.pool[endpoint].accept_fn = accept_function;
            if (packet_size > 0)
                this.pool[endpoint].packet_size = packet_size;

            this.pool[endpoint].hidden = hidden;
        }
        else {
            // Nouvelle Queue
            this.pool[endpoint] = new Queue(this.url + "/" + endpoint, accept_function, packet_size);
            this.pool[endpoint].hidden = hidden;
        }
    }
}

class Queue {
    protected pool: string[] = [];
    protected pool_by_id: { [poolId: string]: string[] } = {};
    protected endpoint: string;
    public hidden = false;
    protected max_packet: number;
    public accept_fn: EndpointAccepter;

    constructor(endpoint: string, accept_function: EndpointAccepter, max_packet = 64) {
        this.endpoint = endpoint;
        this.max_packet = max_packet;
        this.accept_fn = accept_function;
    }

    public push(key: string, unique_id: number) {
        const val = typeof this.accept_fn === 'function' ? this.accept_fn(key) : this.accept_fn.test(key);
        
        if (val) {
            if (typeof val === 'string') {
                // On ajoute la valeur modifiée plutôt que key
                key = val;
            }

            if (unique_id in this.pool_by_id) {
                this.pool_by_id[unique_id].push(key);
            }
            else {
                this.pool_by_id[unique_id] = [key];
            }

            return true;
        }

        return false;
    }

    get length() {
        return this.pool.length;
    }

    get url() {
        return this.endpoint;
    }
    
    get packet_size() {
        return this.max_packet;
    }

    set packet_size(v: number) {
        this.max_packet = v;
    }

    protected wrapBulk(ids: string[]) {
        return {
            docs: ids.map(id => { return { id } })
        };
    }

    public async flush(id: number) {
        if (!(id in this.pool_by_id)) {
            return [];
        }

        const packets_ready: string[][] = [];

        for (let index = 0; index < this.pool_by_id[id].length; index += this.packet_size) {
            packets_ready.push(this.pool_by_id[id].slice(index, index + this.packet_size));
        }

        const packets_promises = packets_ready.map(packet => {
            return fetch(this.endpoint + '/_bulk_get', {
                method: 'POST',
                body: JSON.stringify(this.wrapBulk(packet)),
                headers: { "Content-Type": "application/json" }
            })
                .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
                .then(body => {
                    if ("results" in body) {
                        const results = body.results as { docs: any[], id: string }[];
                        return Promise.resolve(results.map(p => {
                            const data = p.docs[0];

                            if ("error" in data) {
                                return data.error;
                            }

                            // On filtre les clés qui commençent par _
                            return Object.keys(data.ok).reduce((o, k) => {
                                if (!k.startsWith('_')) {
                                    o[k] = data.ok[k];
                                }
                                return o;
                            }, { id: p.id });
                        }));
                    }

                    // No result
                    return Promise.reject("No result in data");
                });
        });

        return Promise.all(packets_promises)
            .then(data => [].concat(...data));
    }
}

export class Routes {
    protected app = express();
    protected dispatcher: Dispatcher;

    constructor(
        accepters?: EndpointAccepters,
        database_url = "http://localhost:5984",
        json_limit = 50
    ) {
        this.app.use(express.json({ limit: json_limit * 1024 * 1024 }));
        this.dispatcher = new Dispatcher(database_url, accepters);
    }
    
    /**
     * Set a route
     * @param options Route options
     */
    set(options: Route) {
        const {
            endpoint: force_endpoint,
            method,
            get_keys: callback_keys,
            post_data: callback_data,
            on_error: callback_error,
            route
        } = options;

        // Building function used as express callback
        const express_callback = (req: express.Request, res: express.Response) => {
            const container = {};

            // Gettings keys
            const keys = callback_keys(req, res, container);

            // If keys returned
            if (keys) {
                let endpoint = force_endpoint;
                // If the collection is a function, get the real collection
                if (typeof endpoint === 'function') {
                    endpoint = endpoint(req);
                }

                // Load all ids into dispatcher for endpoint
                const id = this.dispatcher.load(keys, endpoint);

                // Parallel flush
                this.dispatcher.pFlush(id)
                    // Final callback, for data
                    .then(data => {
                        callback_data(req, res, data, container);
                    })
                    // Otherwise, if flush error
                    .catch(error => {
                        if (callback_error)
                            callback_error(req, res, error, container);
                    })
            }
        };

        if (method === 'GET') {
            this.app.get(route, express_callback);
        }
        else if (method === "POST") {
            this.app.post(route, express_callback);
        }
        else if (method === "PUT") {
            this.app.put(route, express_callback);
        }
        else if (method === "DELETE") {
            this.app.delete(route, express_callback);
        }
        else {
            throw new Error("Unsupported method");
        }
    }

    listen(port = 3030, callback?: Function) {
        this.app.listen(port, callback);
    }

    setEndpoint(endpoint: string, fn: EndpointAccepter) {
        this.dispatcher.set(endpoint, fn);
    }
}

export interface Route {
    /** HTTP method for route */
    method: string;
    /** Route URL */
    route: string;
    /** Document used into database. If not used, endpoint will be determined by EndpointAccepters */
    endpoint?: string | ((req: express.Request) => string);
    /** 
     * Key getter.
     * Called to get keys stored in request data. If void returned, stop the execution of the function.
     * If void, take care of responding something with res ! 
     * 
     * You can store things used between get_keys and post_data within the variable container, who is an object.
     * Do NOT reassign his reference ! 
     */
    get_keys: (req: express.Request, res: express.Response, variable_container: any) => string[] | void;
    /**
     * Post data to client using the res parameter and data DatabaseReponse.
     */
    post_data: (req: express.Request, res: express.Response, data: DatabaseResponse, variable_container: any) => void;
    /**
     * Callback called if database fetch has failed.
     */
    on_error?: (req: express.Request, res: express.Response, error: any, variable_container: any) => void;
}
