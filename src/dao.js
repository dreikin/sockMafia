/**
 * Heavily borrowed from https://github.com/SockDrawer/SockRPG
 */

const db = require('./models/db');

let initialised = false;

function initialise(config) {
    return initialised
        ? Promise.resolve()
        : db.initialise(config).then(() => {
            initialised = true;
        });
}
