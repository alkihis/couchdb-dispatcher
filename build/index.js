"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils = require("util");
const program = require("commander");
const logger_1 = require("./logger");
const express = require("express");
let app = express();
app.use(express.json({ limit: '50mb' }));
program
    .version('0.1.0')
    //.option('-n, --threads <nThread>', 'Number of distinct databases', parseInt)
    .option('-m, --map <dbMapFileConf>', 'Key to DB instance map definitions', jsonfile.readFileSync, undefined)
    .option('-p, --port <portNum>', 'Port Listening Number', parseInt, 2345)
    .option('-s, --size <packetSize>', 'max couch bulk_request size', parseInt, 10)
    .option('-r, --root <couchDbEndpoint>', 'CouchDB service URL', 'http://127.0.0.1:5984')
    .option('-v, --verbosity [logLevel]', 'Set log level', logger_1.setLogLevel, 'info')
    .parse(process.argv);
/* Desired format
[word][organism][reference] = [(coordinate)
*/
//node build/index.js --map data/dvl-db-map.json -v debug
/*
curl --header "Content-Type: application/json" --request POST --data '{"keys": [ "AAAAAAAAAATTTCAATTATAGG", "AAAAAAAATTATGTTCTTGACGG","AAAAAAACGGACATCCTTTATGG", "AAAACTTCATGCAAGTTTTGCGG","AAAACGGGTTGAATAGTCTCTGG","AAAACGACAATTGCCGTTTTCGG"] }' http://localhost:2345/bulk_request
*/
/*

"AAAAAAAAAATTTCAATTATAGG", "AAAAAAAATTATGTTCTTGACGG","AAAAAAACGGACATCCTTTATGG" <== crispr2

"AAAACTTCATGCAAGTTTTGCGG","AAAACGGGTTGAATAGTCTCTGG","AAAACGACAATTGCCGTTTTCGG"  <==crispr
*/
if (!program.map)
    throw ("Please provide a Key to DB instance map definitions file");
/*  Check database range */
logger_1.logger.debug(`Using the following queue mapping rules:\n${utils.inspect(program.map, { showHidden: false, depth: null })}`);
//logger.debug(`${utils.inspect(program.root, {showHidden: false, depth: null})}`);
function startupCheck(url) {
    return new Promise((resolve, reject) => {
        request(url, function (err, resp, body) {
            if (err) {
                reject(err);
                return;
            }
            body = JSON.parse(body);
            /*
                    //console.log('error:', err); // Print the error if one occurred
                    console.log('statusCode:', resp && resp.statusCode); // Print the response status code if a response was received
                    console.log('body:', body); // Print the HTML for the Google homepage.
            */
            if ("couchdb" in body) {
                resolve();
                return;
            }
            reject(body);
        });
    });
}
class queue {
    constructor(regExp, endPoint, batchSize) {
        this.pool = [];
        this.batchSize = batchSize;
        this.regExp = new RegExp(regExp);
        this.endPoint = endPoint;
    }
    mayPush(key) {
        if (this.regExp.test(key)) {
            this.pool.push(key);
            return true;
        }
        return false;
    }
    /*
{
    "docs": [
        {
            "id": "foo"
            "rev": "4-753875d51501a6b1883a9d62b4d33f91",
        },
        {
            "id": "foo"
            "rev": "1-4a7e4ae49c4366eaed8edeaea8f784ad",
        },
        {
            "id": "bar",
        }
    ]
}
    */
    _bulkGetWrap(ids) {
        return { "docs": ids.map((id) => { return { "id": id }; }) };
    }
    qFlush() {
        let readyPackets = [];
        for (let index = 0; index < this.pool.length; index += this.batchSize) {
            readyPackets.push(this.pool.slice(index, index + this.batchSize));
        }
        logger_1.logger.silly(`qFlushing this:\n${utils.inspect(readyPackets, { showHidden: false, depth: null })}`);
        logger_1.logger.debug(`${this.endPoint} bSize : ${this.batchSize} -> led to slices key set of ${readyPackets.length} batch`);
        let promisePackets = readyPackets.map((packet) => {
            let couchRequestData = {
                method: 'POST',
                json: this._bulkGetWrap(packet),
                //json: true,
                url: this.endPoint + '/_bulk_get'
            };
            return new Promise((resolve, reject) => {
                request(couchRequestData, function (error, response, body) {
                    logger_1.logger.debug(`Couch REQ => ${utils.inspect(couchRequestData, { showHidden: false, depth: null })}`);
                    logger_1.logger.debug(`Couch REQ ANS => ${utils.inspect(body, { showHidden: false, depth: null })}`);
                    if (error) {
                        reject(error);
                        return;
                    }
                    let data = body;
                    if ("results" in data) {
                        let results = data["results"].map((ansPacket) => {
                            let data = ansPacket.docs[0];
                            if ("error" in data) {
                                return data.error;
                            }
                            let res = Object.keys(data.ok).reduce((o, k) => {
                                if (!k.startsWith('_'))
                                    o[k] = data.ok[k];
                                return o;
                            }, { "id": ansPacket.id });
                            return res;
                        });
                        logger_1.logger.debug(`One packet results resolved:\n${utils.inspect(results, { showHidden: false, depth: null })}`);
                        resolve(results);
                        return;
                    }
                    logger_1.logger.error(`${utils.inspect(data, { showHidden: false, depth: null })}`);
                    reject("No results in data");
                    /*
                    console.log('error:', error); // Print the error if one occurred
                    console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
                    console.log('body:', body); // Print the HTML for the Google homepage.
                    */
                });
            });
        });
        let reducedPromise = new Promise((resolve, reject) => {
            Promise.all(promisePackets).then((data) => {
                logger_1.logger.debug(`${this.endPoint} ${promisePackets.length} promises done`);
                resolve(data.reduce((arr, d) => arr.concat(d), []));
            });
        });
        //return Promise.all(promisePackets)
        return reducedPromise;
        /*
        return new Promise( (resolve, reject)=> {
            setTimeout( ()=> {
                logger.debug(`qFlushing this:\n${utils.inspect(readyPackets, {showHidden: false, depth: null})}`);
                resolve( readyPackets.map( (arr:string[])=> arr.map((e:string)=> { return {"key" : e, "status" : "ok"}; } )) );
            }, 1000);
        });*/
    }
}
class dbRequest {
    constructor(mapDef, endPoint, bSize = 10) {
        this.mainEndpoint = endPoint;
        this.batchSize = bSize;
        this.queuePool = Object.keys(mapDef).map((e) => new queue(e, this.mainEndpoint + '/' + mapDef[e], bSize));
        logger_1.logger.debug(`${utils.inspect(this.queuePool, { showHidden: false, depth: null })}`);
    }
    load(keys) {
        let c = 0;
        let ok;
        keys.forEach((k) => {
            ok = false;
            for (let q of this.queuePool) {
                ok = q.mayPush(k);
                if (ok) {
                    c++;
                    break;
                }
            }
            if (!ok) {
                logger_1.logger.error(`request "${k}" could not be mapped to any queue!`);
            }
        });
        return c;
    }
    flushSequential() {
        return __awaiter(this, void 0, void 0, function* () {
            let data = [];
            for (let q of this.queuePool) {
                data.push(yield q.qFlush());
            }
            logger_1.logger.debug(`flushSequential content:\n${utils.inspect(data, { showHidden: false, depth: null })}`);
            return this.pullFlattenLitt(data);
        });
    }
    flushParallel() {
        return __awaiter(this, void 0, void 0, function* () {
            let data = yield Promise.all(this.queuePool.map(q => q.qFlush()));
            logger_1.logger.debug(`flushParallel content:\n${utils.inspect(data, { showHidden: false, depth: null })}`);
            return this.pullFlattenLitt(data);
        });
    }
    pullFlattenArr(data) {
        /*for (let e of data.entries()) {
            logger.debug(`### Single queue Flush in flatten [${this.queuePool[ e[0] ].endPoint}]`);
            logger.debug(`### ==>\n${utils.inspect(e[1], {showHidden: false, depth: null})}`);
        }*/
        //synchronous reduction
        //return data.reduce( (arr:any[], curr:any[]) => arr.concat(curr), [] );
        // We reduce to a list using promise to avoid main event loop overload
        let _f = function (a, b) {
            return new Promise((resolve, reject) => {
                setTimeout(() => resolve(a.concat(b)), 5);
            });
        };
        return data.reduce((previousPromise, nextDatum) => __awaiter(this, void 0, void 0, function* () {
            let arr = yield previousPromise;
            return _f(arr, nextDatum);
        }), Promise.resolve([]));
    }
    pullFlattenLitt(data) {
        for (let e of data.entries()) {
            logger_1.logger.debug(`### Single queue Flush in flatten [${this.queuePool[e[0]].endPoint}]`);
            logger_1.logger.debug(`### ==>\n${utils.inspect(e[1], { showHidden: false, depth: null })}`);
        }
        // We reduce to a litteral using promise to avoid main event loop overload
        let _f = function (a, b) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    for (let e of b) {
                        if ('error' in e)
                            continue;
                        if (!('id' in e))
                            throw (`No "id" in ${utils.inspect(e, { showHidden: false, depth: null })}`);
                        if (e['id'] in a)
                            throw (`Common "id\" in accumulator:\n${utils.inspect(a, { showHidden: false, depth: null })}\n
                            and curr datum\n${utils.inspect(e, { showHidden: false, depth: null })}`);
                        a[e['id']] = {};
                        for (let k in e) {
                            if (k === 'id')
                                continue;
                            a[e['id']][k] = e[k];
                        }
                    }
                    resolve(a);
                }, 5);
            });
        };
        return data.reduce((previousPromise, nextDatum) => __awaiter(this, void 0, void 0, function* () {
            let arr = yield previousPromise;
            return _f(arr, nextDatum);
        }), Promise.resolve({}));
    }
}
app.get(`/handshake`, (req, res) => {
    res.json({ "sucess": "handshake" });
});
app.post(`/bulk_request`, (req, res) => {
    if (!req.body.hasOwnProperty('keys')) {
        logger_1.logger.error(`Malformed request:\n${utils.inspect(req.body, { showHidden: false, depth: null })}`);
        res.json({ "error": "Malformed request" });
        return;
    }
    logger_1.logger.info(`Receiving request of ${req.body.keys.length} elements`);
    /*
     res.json({"request" : "222"});
     return;
     */
    logger_1.logger.debug(`${utils.inspect(req.body, { showHidden: false, depth: null })}`);
    let busDB = new dbRequest(program.map, program.root, program.size);
    busDB.load(req.body.keys);
    busDB.flushSequential().then((data) => {
        // logger.info(`FLUSH RESULTS`);
        //logger.info(`${utils.inspect(data, {showHidden: false, depth: null})}`);
        logger_1.logger.debug(`Returning a bulk_request of ${Object.keys(data).length} elements`);
        res.json({ "request": data });
    })
        .catch((err) => {
        logger_1.logger.error(`${err}`);
        res.json({ "error": "Database error" });
    });
    //res.json({"status": "ok" });
});
startupCheck(program.root).then(() => {
    app.listen(program.port, () => {
        logger_1.logger.info(`couchDB responded at ${program.root} broker listening on port ${program.port}!`);
    });
}).catch((err) => {
    logger_1.logger.error(`No response from couchDB at ${program.root}, exiting`);
    logger_1.logger.error(`->${utils.inspect(err, { showHidden: false, depth: null })}<-`);
});
/*async function () {

}

*/ 
