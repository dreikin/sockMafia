/**
 * Heavily borrowed from https://github.com/SockDrawer/SockRPG
 */
'use strict';
const orm = require('sequelize');
const Models = {};

let initialised = false;
let db;

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
}

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
	const player = require('./models/player')(db);
	const game = require('./models/game')(db);
	const segment = require('./models/segment')(db);
	const roster = require('./models/roster')(db);
	const vote = require('./models/vote')(db);

	// Relations
	// |- 1:1
	//segment.hasOne(game);
	// |- 1:N
	player.hasMany(vote, {as: 'voter', foreignKey: 'voter'});
	player.hasMany(vote, {as: 'target', foreignKey: 'target'});
	game.hasMany(vote);
	// game.hasMany(segment);
	// |- M:N
	player.belongsToMany(game, {through: roster});
	game.belongsToMany(player, {through: roster});
	roster.belongsTo(game);
	roster.belongsTo(player);

	// model handles
	Models.players = player;
	Models.games = game;
	Models.segments = segment;
	Models.roster = roster;
	Models.votes = vote;

	initialised = true;
}

/*eslint-disable no-console*/
function initialise(config) {
	return new Promise((resolve) => {
		console.log('Mafia: Checking configuration');
		checkConfig(config);
		console.log('Mafia: Configuration valid');
		resolve();
	}).then(() => {
		console.log('Mafia: Creating database');
		createModel(config);
		console.log('Mafia: Database created');
	}).then(() => {
		console.log('Mafia: Synching database');
		db.sync({force: true});
	}).then( () => {
		console.log('Mafia: Sync complete. Your database is ready to go.');
	}).catch((err) => {
		console.log('Mafia: ' + err);
		throw err;
	});
}
/*eslint-enable no-console*/

module.exports = {
	createDB: function(config) {
		if (!initialised) {
			return initialise(config);
		} else {
			return Promise.resolve();
		}
	},

	// This needs to be split into "createGame" (mod only) and "findGame"
	ensureGameExists: function(id) {
		return Models.games.findOrCreate({where: {id: '' + id}, defaults: {status: 'prep', currentDay: 0, stage: 'night'}});
	},

	isPlayerInGame: function(game, player) {
		return Models.players.findOne({where: {name: player}})
			.then((playerInstance) => {
				if (playerInstance) {
					return Models.roster.findOne({where: {playerId: playerInstance.id, gameId: game}});
				}
				return null;
			})
			.then(function(instance) {
				return instance !== null;
			});
	},

	isPlayerAlive: function(game, player) {
		return db.query('SELECT gameId FROM `rosters` INNER JOIN players ON players.id = rosters.playerId WHERE players.name="' + player + '" and gameId=' + game + ' and player_status="alive"', {type: db.QueryTypes.SELECT})
			.then(function(rows) {
				return rows.length > 0;
			});
	},

	hasPlayerVotedToday: function(game, player) {
		db.query('SELECT id FROM `votes` INNER JOIN players ON players.id = votes.playerId WHERE players.name="' + player + '" and gameId=' + game, {type: db.QueryTypes.SELECT})
		.then(function(rows) {
			return rows.length > 0;
		});
		/*return Models.roster.findOne({where: {playerId: player, gameID: game}}).then((playerInstance) => {
			return playerInstance !== null;
		});*/
	},

	addPlayerToGame: function(game, player) {
		let insPlayer;
		return Models.players.findOrCreate({where: {name: '' + player}}).then((playerInstance) => {
			insPlayer = playerInstance[0];
			return Models.roster.findOrCreate({where: {playerId: insPlayer.id, gameId: game, player_status: 'alive'}});
		}).then(db.sync());		
	},

	addVote: function(game, post, voter, target) {
		let voterInstance, targetInstance;

		return db.transaction(function (t) {
			//Get player id
			return Models.players.findOne({
				where: {
					name: voter
				}
			})
			.then((result) => {
				voterInstance = result;
				//Get target ID
				return Models.players.findOne({
					where: {
						name: target
					}
				});
			})
			.then((result) => {
				targetInstance = result;
				//Get game day (simplified)
				return Models.games.findOne({
					where: {
						id: game
					}
				});
			})
			.then((result) => {
				//Add vote
				const vote = Models.votes.build({
					post: post,
					day: result.currentDay,
					voter: voterInstance.id,
					target: targetInstance.id,
					gameId: game
				});
				return vote.save({transaction: t});
			});
		});
	},

	getPlayers: function(game) {
		return Models.roster.findAll({where: {gameId: game}, include: [Models.players]});
	}
};
