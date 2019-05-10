"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils = require("util");
const program = require("commander");
const logger_1 = require("./logger");
const express = require("express");
let app = express();
app.use(express.json());
function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}
program
    .version('0.1.0')
    .option('-n, --threads <nThread>', 'Number of distinct databases', parseInt)
    .option('-p, --port <portNum>', 'Port Listening Number', parseInt, 2345)
    .option('-v, --verbosity [logLevel]', 'Set log level', logger_1.setLogLevel, 'info')
    .parse(process.argv);
if (!program.threads)
    throw ('Please provide a number of pseudo databases to mimick');
logger_1.logger.info(program.port);
let routeList = [...Array(program.threads).keys()].map((k) => {
    let n = k + 1;
    /*
     app.get(`/db${n}`, function (req, res) {
         let t:number = getRandomInt(5) * 1000;
         logger.info(`Delay is ${t}`);
 
 
 
         setTimeout( function() {
             res.json({"meta": `GET request to the DB ${n} at ${t}`});
         }, t);
     */
    app.post(`/db${n}`, function (req, res) {
        let t = getRandomInt(5) * 1000;
        logger_1.logger.info(`Delay is ${t}`);
        logger_1.logger.info(`${utils.inspect(req.body, { showHidden: false, depth: null })}`);
        setTimeout(function () {
            res.json({ "meta": `POST request to the DB ${n} at ${t}` });
        }, t);
    });
});
/*
for (let iNode of [...Array(program.threads).keys()]){
    logger.info(`${iNode}`);
}
*/
app.listen(program.port, () => {
    logger_1.logger.info(`${program.threads} DB listening  listening on port ${program.port}!`);
});
