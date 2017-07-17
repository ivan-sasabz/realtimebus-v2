'use strict';

require('express-group-routes');
require("./util/utils");

const bodyParser = require('body-parser');
const database = require("./database/database");
const express = require('express');
const fs = require('fs');
const logger = require("./util/logger");
const config = require("./config");

const v1Realtime = require("./endpoint/v1/realtime");
const v1Receiver = require("./endpoint/v1/receiver");
const v1Stops = require("./endpoint/v1/stops");
const v1Vdv = require("./endpoint/root/vdv");

const v2Realtime = require("./endpoint/v2/realtime");

const appRealtime = require("./endpoint/app/realtime");

const ExtrapolatePositions = require("./operations/ExtrapolatePositions");
const DropOldPositions = require("./operations/DropOldPositions");

function logRequests(req, res, next) {
    logger.warn(`${req.method} ${req.url}`);
    next();
}

function checkForRunningImport(req, res, next) {
    if (config.vdv_import_running) {
        logger.info(`Import is running, skipping request '${req.url}'`);
        res.status(503).json({success: false, error: "VDV import is running. Please wait for it to complete."});

        return;
    }

    next();
}

process.on('uncaughtException', function (err) {
    logger.error('Caught exception: ');
    console.log(err);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at: Promise', promise, 'reason:', reason);
});

const app = express();

app.use(logRequests);
app.use(checkForRunningImport);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(bodyParser.raw({
    limit: '10mb'
}));

app.set('jsonp callback name', 'jsonp');

database.connect()
    .then(client => {
        logger.warn("Connected to database");

        // TODO: Start extrapolation
        // new ExtrapolatePositions().run();

        let dropPositions = new DropOldPositions();

        setInterval(function () {
            dropPositions.run();
        }, 1000 * 60);

        startServer()
    });

function startServer() {
    app.post("/vdv", function (req, res) {
        v1Vdv.upload(req, res)
    });

    app.group("/v1", (router) => {

        router.get("/positions", v1Realtime.positions);
        router.get("/positions/lines/:lines", v1Realtime.positions);
        router.get("/positions/vehicle/:vehicle", v1Realtime.positions);

        router.post("/receiver", function (req, res) {
            v1Receiver.updatePositions(req, res)
        });

        router.get("/:stop/buses", function (req, res) {
            v1Stops.nextBusesAtStop(req, res)
        });

        router.get("/stops", function (req, res) {
            v1Stops.stops(req, res)
        });

        router.get("/:tripId/stops", function (req, res) {
            v1Stops.stopsForTrip(req, res)
        });
    });

    app.group("/app", (router) => {

        router.get("/realtime", appRealtime.positions);
        router.get("/realtime/lines/:lines", appRealtime.positions);
        router.get("/realtime/vehicle/:vehicle", appRealtime.positions);
    });

    app.group("/v2", (router) => {

        router.get("/positions", function (req, res) {
            v2Realtime.positions(req, res)
        });
    });

    let listener = app.listen(80, function () {
        logger.warn(`Server started on port ${listener.address().port}`)
    })
}