/**
 * Heavily borrowed from https://github.com/SockDrawer/SockRPG
 */

const orm = require('sequelize');

let db;

module.exports = {
    initialise: initialise,
    close: close
};

initialise = (config) => {
    const err = checkConfig(config);
    if (err) {
        return Promise.reject(err);
    }

    db = new orm('mafiabot', null, null, {
        host: 'localhost',
        dialect: 'sqlite',
        logging: undefined,
        storage: config.db,
        timestamps: true,
        paranoid: true
    });

    createModel();

    return db.sync();
};

checkConfig = (config) => {
    if (!config) {
        return new Error('Configuration information must be supplied.');
    }

    if (!config.db) {
        return new Error('Database location must be defined.');
    }

    if (typeof config.db !== 'string') {
        return new Error('Database location must be a string.');
    }
};

createModel = () => {
    // Tables
    const player = require('./player')(db);
    const game = require('./game')(db);
    const vote = require('./vote')(db);
    const segment = require('./segment')(db);

    // Relations

};

close = () => {

};
