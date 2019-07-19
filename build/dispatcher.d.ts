import express from 'express';
/**
 * Endpoint accepter: Function that accept an ID / Key and produce a true / false value if key should be accepted or not.
 * If Function produce a non-empty string, given string will be used as key (useful for trimming an prefix / suffix)
 */
export declare type EndpointAccepter = ((key: string) => boolean | string) | RegExp;
export declare type EndpointAccepters = {
    [endpoint: string]: EndpointAccepter;
};
export declare type DatabaseResponse = {
    [id: string]: {
        [databaseKeys: string]: any;
    };
};
declare type Queues = {
    [endpoint: string]: Queue;
};
/**
 * Massive ID getter for multiple CouchDB documents
 *
 * @export
 * @class Dispatcher
 */
export default class Dispatcher {
    protected url: string;
    protected pool: Queues;
    protected private_pool: Queues;
    protected packet_size_per_queue: number;
    /**
     * Creates an instance of Dispatcher.
     * @param {string} database_link URL to the database
     * @param {EndpointAccepters} accept_functions Document name => function that return true if key is accepted in the document
     * @param {number} [packet_size=64] Max number of queries sended to the database in one time
     * @memberof Dispatcher
     */
    constructor(database_link: string, accept_functions?: EndpointAccepters, packet_size?: number);
    /**
     * Load ids into queues (Massive ID getter)
     *
     * @param {string[]} ids
     * @returns {number} Numeric ID to flush with
     * @memberof Dispatcher
     */
    load(ids: string[], custom?: string): number;
    /**
     * Flush all queues.
     *
     * @returns Promise<any>
     * @memberof Dispatcher
     */
    flush(id: number): Promise<any>;
    /**
     * Flush all queues using a parallel method.
     *
     * @returns
     * @memberof Dispatcher
     */
    pFlush(id: number): Promise<DatabaseResponse>;
    protected flattenList(data: any[][]): Promise<any>;
    /**
     * Remove an endpoint
     * @param endpoint
     */
    remove(endpoint: string): void;
    /**
     * Set an endpoint
     * @param endpoint Name
     * @param accept_function Accepter function
     * @param packet_size Number of packets max
     * @param hidden Hidden endpoint or not
     */
    set(endpoint: string, accept_function: EndpointAccepter, packet_size?: number, hidden?: boolean): void;
}
declare class Queue {
    protected pool: string[];
    protected pool_by_id: {
        [poolId: string]: string[];
    };
    protected endpoint: string;
    hidden: boolean;
    protected max_packet: number;
    accept_fn: EndpointAccepter;
    constructor(endpoint: string, accept_function: EndpointAccepter, max_packet?: number);
    push(key: string, unique_id: number): boolean;
    readonly length: number;
    readonly url: string;
    packet_size: number;
    protected wrapBulk(ids: string[]): {
        docs: {
            id: string;
        }[];
    };
    flush(id: number): Promise<any[]>;
}
export declare class Routes {
    protected app: import("express-serve-static-core").Express;
    protected dispatcher: Dispatcher;
    constructor(accepters?: EndpointAccepters, database_url?: string, json_limit?: number);
    /**
     * Set a route
     * @param options Route options
     */
    set(options: Route): void;
    listen(port?: number, callback?: Function): void;
    setEndpoint(endpoint: string, fn: EndpointAccepter): void;
}
export interface Route {
    /** HTTP method for route */
    method: string;
    /** Route URL. If array, will be set for all given routes */
    route: string | string[];
    /** Document used into database. If not used, endpoint will be determined by EndpointAccepters */
    endpoint?: string | ((req: express.Request) => string);
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
export {};
