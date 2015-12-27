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
    const segment = require('./segment')(db);
    const roster = require('./roster')(db);
    const vote = require('./vote')(db);

    // Relations
    // |- 1:1
    segment.hasOne(game);
    // |- 1:N
    player.hasMany(vote, {as: 'voter'});
    player.hasMany(vote, {as: 'target'});
    game.hasMany(vote);
    game.hasMany(segment);
    // |- M:N
    player.belongsToMany(game, {through: roster});
    game.belongsToMany(player, {through: roster});


    // Exports
    module.exports.players = player;
    module.exports.games = game;
    module.exports.segments = segment;
    module.exports.roster = roster;
    module.exports.votes = vote;
};

close = () => {

};
