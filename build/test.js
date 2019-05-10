"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const dispatcher_1 = require("./dispatcher");
const app = express();
app.use(express.json({ limit: 50 * 1024 * 1024 }));
const ENDPOINTS = {
    'id_map': (key) => true,
    'interactors': (key) => true
};
const DB = "http://localhost:5984";
const dispatcher = new dispatcher_1.default(DB, ENDPOINTS);
app.get('/handshake', (_, res) => {
    res.json({ handshake: true });
});
app.post('/bulk', (req, res) => {
    if (req.body.keys) {
        const id = dispatcher.load(req.body.keys);
        dispatcher.pFlush(id)
            .then(data => {
            res.json({ request: data });
        })
            .catch(error => {
            console.error("Error:", error);
            res.status(500).json({ error: "Database error" });
        });
    }
    else {
        res.status(400).json({ error: "Unwell-formed requst" });
    }
});
app.listen(3280, () => {
    console.log("App listening on port 3280.");
});
