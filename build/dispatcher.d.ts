import { Request, Response } from 'express-serve-static-core';
/**
 * Endpoint accepter: Function that accept an ID / Key and produce a true / false value if key should be accepted or not.
 * If Function produce a non-empty string, given string will be used as key (useful for trimming an prefix / suffix)
 */
export declare type EndpointAccepter = (key: string) => boolean | string;
export declare type EndpointAccepters = {
    [endpoint: string]: EndpointAccepter;
};
export declare type DatabaseResponse = {
    id: string;
    [databaseKeys: string]: any;
}[];
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
    remove(endpoint: string): void;
    set(endpoint: string, accept_function: EndpointAccepter, packet_size?: number): void;
}
declare class Queue {
    protected pool: string[];
    protected pool_by_id: {
        [poolId: string]: string[];
    };
    protected endpoint: string;
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
    set(method: string, route: string, callback_keys: (req: Request, res: Response, variable_container: any) => string[] | void, callback_data: (req: Request, res: Response, data: DatabaseResponse, variable_container: any) => void, callback_error?: (req: Request, res: Response, error: any, variable_container: any) => void, force_endpoint?: string): void;
    listen(port?: number, callback?: Function): void;
    setEndpoint(endpoint: string, fn: EndpointAccepter): void;
}
export {};
