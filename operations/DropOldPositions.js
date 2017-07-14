'use strict';

const database = require("../database/database");
const logger = require("../util/logger");
const config = require("../config");

module.exports = class DropOldPositions {

    constructor() {
        this.age = config.realtime_bus_timeout_minutes;
    }

    run() {
        logger.warn("Dropping old bus positions");

        return database.connect()
            .then(client => {
                return Promise.resolve()
                    .then(() => client.query(`DELETE FROM data.vehicle_position_act WHERE gps_date < NOW() - interval '${this.age} minute' RETURNING *`))
                    .then(result => {
                        logger.warn(`Dropped ${result.rowCount} old bus positions`);
                    })
                    .catch(error => {
                        logger.error(`Drop error: ${error}`)
                    })
            })
            .catch(error => {
                logger.error(`Error acquiring drop client: ${error}`);
            });
    }
};