/**
 * Heavily borrowed from https://github.com/SockDrawer/SockRPG
 */
'use strict';
const orm = require('sequelize');
const Models = {};

let initialised = false;
let db;

function initialise(config) {
	return new Promise(checkConfig(config))
	.then(createModel)
	.then(db.sync());
};

function checkConfig(config) {
    if (!config) {
        throw new Error('Configuration information must be supplied.');
    }

    if (!config.db) {
        throw new Error('Database location must be defined.');
    }

    if (typeof config.db !== 'string') {
        throw new Error('Database location must be a string.');
    }
};

function createModel(config) {
	//Database
	db = new orm('mafiabot', null, null, {
			host: 'localhost',
			dialect: 'sqlite',
			logging: undefined,
			storage: config.db,
			timestamps: true,
			paranoid: true
		});
		
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


    // model handles
    Models.players = player;
    Models.games = game;
    Models.segments = segment;
    Models.roster = roster;
    Models.votes = vote;
	
	initialised = true;
};


module.exports = {
	createDB: function(config) {
		if (!initialised) {
			return initialise(config);
		} else {
			return Promise.resolve();
		}
	},
	
	ensureGameExists: function(id) {
		return Models.games.findOrCreate({where: {id: id}, defaults: {status: 'active', currentDay: 0, stage: 'night'}});
	},
	
	isPlayerInGame: function(game, player) {
		return Models.games.findOne({where: {player: player}}).then((playerInstance) => {
			return playerInstance !== null;
		});
	},
	
	addPlayerToGame: function(game, player) {
		let insPlayer;
		return Models.players.findOrCreate({where: {name: player}}).then((playerInstance) => {
			insPlayer = playerInstance;
			return Models.games.findById(game, {include: {model: Models.roster, as: 'Roster'}});
		}).then( (gameInstance) => {
			return gameInstance.addAssociation(insPlayer, {player_status: 'alive'});
		}).then(db.sync());		
	},
	
	getPlayers: function(game) {
		return Models.games.findById(game, {include: {model: Models.players, as: 'Roster'}}).then((gameInstance) => {
			return gameInstance.Roster;
		});
	}
};
