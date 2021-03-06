/**
 * Heavily borrowed from https://github.com/SockDrawer/SockRPG
 */
'use strict';
const orm = require('sequelize');
const Promise = require('bluebird');
const Models = {};

// Helper functions

function objectExists(object, noun) {
	noun = typeof noun !== 'undefined' ? noun : 'Object';
	if (object) {
		return Promise.resolve(object);
	}
	return Promise.reject(noun + ' does not exist');
}

// Database initialization

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
	player.hasMany(vote, {as: 'voter', foreignKey: 'voterId'});
	player.hasMany(vote, {as: 'target', foreignKey: 'targetId'});
	game.hasMany(vote, {foreignKey: 'gameId'});
	// game.hasMany(segment);
	// |- M:N
	player.belongsToMany(game, {through: roster});
	game.belongsToMany(player, {through: roster});
	roster.belongsTo(game);
	roster.belongsTo(player);
	vote.belongsTo(player, {as: 'voter', foreignKey: 'voterId'});
	vote.belongsTo(player, {as: 'target', foreignKey: 'targetId'});

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
		return db.sync();
	}).then( () => {
		console.log('Mafia: Sync complete. Your database is ready to go.');
	}).catch((err) => {
		console.log('Mafia: ' + err);
		throw err;
	});
}
/*eslint-enable no-console*/

// Exported objects and functions.

module.exports = {
	// Enums

	playerStatus: {
		alive: 'alive',
		dead: 'dead',
		undead: 'undead',
		unvote: 'unvote',
		nolynch: 'nolynch',
		mod: 'mod',
		spectator: 'spectator',
		other: 'other'
	},

	gameTime: {
		morning: 'morning',
		day: 'day',
		evening: 'evening',
		night: 'night'
	},

	gameStatus: {
		auto: 'automatic',
		prep: 'preparing',
		running: 'running',
		paused: 'paused',
		abandoned: 'abandoned',
		finished: 'finished'
	},

	// Database functions
	/*
	 * Basic functions:
	 * - createDB  Create and/or initialize database.
	 */

	createDB: function(config) {
		if (!initialised) {
			return initialise(config);
		} else {
			return Promise.resolve();
		}
	},

	// Game functions (general)
	/*
	 * Basic functions:
	 * - addGame  Add a game to the database.
	 * - archiveAutoGame  Archive an automatic game in preparation for a normal one.
	 * - getGameById  Get a game instance by the game's ID.
	 * - getGameByName  Get a game instance by the game's friendly name.
	 * - setGameName  Set the human-friendly name of a game.
	 */
	/*
	 * Derivative functions:
	 * - convertAutoToPrep  Convert an automatic game to a proper game in the prep phase.
	 * - ensureGameExists  Return whether a game with a given ID exists.
	 */
	/*
	 * Other functions:
	 * - getGameId  Get the ID of a game, given its name.
	 */

	addGame: function(id, name) {
		name = typeof name !== 'undefined' ? name : id;
		return Models.games.create({
			id: id,
			name: '' + name,
			status: module.exports.gameStatus.prep,
			time: module.exports.gameTime.day,
			day: 0
		});
	},

	archiveAutoGame: function(id) {
		// Hopefully this cascades to roster, votes, and segments.
		return db.transaction((t) => {
			return Models.games.update({
				id: 0 - id
			}, {
				where: {
					id: id
				},
				transaction: t
			});
		});
	},

	getGameById: function(id) {
		return Models.games.findOne({where: {id: id}})
			.then((game) => objectExists(game, 'Game'));
	},

	getGameByName: function(name) {
		return Models.games.findOne({where: {name: name}})
			.then((game) => objectExists(game, 'Game'));
	},

	setGameName(id, name) {
		return Models.games.update({
			name: name
		}, {
			where: {
				id: id
			}
		});
	},

	convertAutoToPrep: function(id, name) {
		return module.exports.archiveAutoGame(id)
			.then(() => module.exports.addGame(id, name));
	},

	ensureGameExists: function(id, createGame) {
		createGame = typeof createGame !== 'undefined' ? createGame : true;
		return module.exports.getGameById(id)
			.then((game) => {
				if (game) {
					return Promise.resolve();
				} else {
					if (createGame) {
						return module.exports.addGame(id);
					}
					return Promise.reject('Game does not exist');
				}
		});
	},

	getGameId(name) {
		return module.exports.getGameByName(name)
			.then((game) => objectExists(game, 'Game'))
			.then((game) => game.id);
	},

	// Game functions (day, time, and status)
	/*
	 * Basic functions:
	 * - getCurrentDay  Get the current day of a game.
	 * - getCurrentTime  Get the current time-of-day of a game.
	 * - getGameStatus  Get the status of a game.
	 * - incrementDay  Move the current day of a game to the next day.
	 * - setCurrentDay  Set the current day of a game.
	 * - setCurrentTime  Set the current time of a game.
	 * - setGameStatus  Set the status of a game.
	 */
	/*
	 * Derivative functions:
	 */

	getCurrentDay: function(game) {
		return module.exports.getGameById(game)
			.then((gameInstance) => objectExists(gameInstance, 'Game'))
			.then((gameInstance) => {
				return gameInstance.day;
			});
	},

	getCurrentTime: function(game) {
		return module.exports.getGameById(game)
			.then((gameInstance) => objectExists(gameInstance, 'Game'))
			.then((gameInstance) => {
				return gameInstance.time;
			});
	},

	getGameStatus: function(game) {
		return module.exports.getGameById(game)
			.then((gameInstance) => objectExists(gameInstance, 'Game'))
			.then((gameInstance) => {
				return gameInstance.status;
			});
	},

	incrementDay: function(game) {
		return Models.games.findOne({where: {id: game}})
			.then((gameInstance) => objectExists(gameInstance, 'Game'))
			.then((gameInstance) => {
				gameInstance.increment('day', {by: 1});
				gameInstance.time = module.exports.gameTime.morning;
				return gameInstance.save();
			}).then((gameInstance) => {
				return gameInstance.day;
			});
	},

	setCurrentDay: function(game, day) {
		return Models.games.update({
			day: day
		}, {
			where: {
				id: game
			}
		});
	},

	setCurrentTime: function(game, time) {
		return Models.games.update({
			time: time
		}, {
			where: {
				id: game
			}
		});
	},

	setGameStatus: function(id, status) {
		return Models.games.update({
			status: status
		}, {
			where: {
				id: id
			}
		});
	},

	// Game functions (segments)
	/*
	 * Basic functions:
	 * - addSegment  Add a new game segment.
	 */
	/*
	 * Derivative functions:
	 */

	addSegment: function() {},

	// Player functions
	/*
	 * Basic functions:
	 * - addPlayer  Add a game player (or spectator, or mod, or something else).
	 * - getPlayerById  Get a player by ID.
	 * - getPlayerByName  Get a player by name.
	 * - setPlayerProperName  Set the proper name for a player.
	 */
	/*
	 * Derivative functions:
	 */

	addPlayer: function(name) {
		return Models.players.findOrCreate({
			where: {
				name: name.toLowerCase()
			},
			defaults: {
				properName: '' + name
			}
		}).spread((player, created) => objectExists(player, 'Player'));
		/* The docs are less than helpful on whether 'created' is required,
		 * so it's left in there until further testing is done.
		 */
	},

	getPlayerById: function(id) {
		return Models.players.findOne({where: {id: id}})
			.then((player) => objectExists(player, 'Player'));
	},

	getPlayerByName: function(name) {
		return Models.players.findOne({
			where: {
				name: name.toLowerCase()
			}
		}).then((player) => objectExists(player, 'Player'));
	},

	setPlayerProperName: function(name) {
		return Models.players.update({
			properName: '' + name
		}, {
			where: {
				name: name.toLowerCase()
			}
		});
	},

	// Roster functions
	/*
	 * Basic functions:
	 * - addPlayerToGame  Add a player to a game's roster.  Defaults to a living player.
	 * - getAllPlayers  Get all players in a game.  Includes spectators and moderators.
	 * - getDeadPlayers  Get all dead players in a game.
	 * - getLivingPlayers  Get all living players in a game.
	 * - getMods  Get all moderators for a game.
	 * - getPlayerInGame  Get a player in a game.
	 * - getSpectators  Get all spectators of a game.
	 */
	/*
	 * Derivative functions:
	 * - addMod  Add a moderator to a game's roster.
	 * - addSpectator  Add a spectator to a game's roster.
	 * - getNumToLynch  Get the number of votes needed to lynch someone (or no-lynch).
	 * - getPlayerStatus  Get the status of a player in a game.
	 * - isPlayerInGame  Return whether a player is in a game.
	 * - killPlayer  Set a player's status to dead.
	 * - setPlayerStatus  Set the status of a player in a game.
	 */
	/*
	 * Other functions:
	 * - isPlayerAlive  Check whether a player is alive in a game.
	 * - isPlayerMod  Check whether a player is a moderator in a game.
	 */

	addPlayerToGame: function(game, player, status) {
		status = typeof status !== 'undefined' ? status : module.exports.playerStatus.alive;
		const lcPlayer = player.toLowerCase();
		if (lcPlayer === 'unvote') {
			status = module.exports.playerStatus.unvote;
		}
		if (lcPlayer === 'no-lynch' || lcPlayer === 'nolynch') {
			status = module.exports.playerStatus.nolynch;
		}

		return module.exports.getGameById(game)
			.then(() => module.exports.addPlayer(player))
			.then((playerInstance) => {
				return Models.roster.findOrCreate({
					where: {
						playerId: playerInstance.id,
						gameId: game,
						playerStatus: status
					}
				});
			});
	},
	
	addPropertyToPlayer: function(game, player, property) {
		return Promise.reject('Not yet implemented');
	},

	getAllPlayers: function(game) {
		return Models.roster.findAll({where: {gameId: game}, include: [Models.players]});
	},

	getDeadPlayers: function(game) {
		return Models.roster.findAll({
			where: {
				gameId: game,
				playerStatus: module.exports.playerStatus.dead
			},
			include: [Models.players]
		});
	},

	getLivingPlayers: function(game) {
		return Models.roster.findAll({
			where: {
				gameId: game,
				playerStatus: module.exports.playerStatus.alive
			},
			include: [Models.players]
		});
	},

	getMods: function(game) {
		return Models.roster.findAll({
			where: {
				gameId: game,
				playerStatus: module.exports.playerStatus.mod
			},
			include: [Models.players]
		});
	},

	getPlayerInGame: function(game, player) {
		return module.exports.getGameById(game)
			.then(() => module.exports.getPlayerByName(player))
			.then((playerInstance) => {
				return Models.roster.findOne({
					where: {
						gameId: game,
						playerId: playerInstance.id
					},
					include: [Models.players]
				});
			})
			.then((rosterInstance) => objectExists(rosterInstance, 'Roster entry for player'));
	},

	getPlayerStatus: function(game, player) {
		return module.exports.getPlayerInGame(game, player)
			.then((rosterInstance) => rosterInstance.playerStatus);
	},
	getPlayerProperty: function(game, player) {
		//Expected return: Resolve to 'loved','hated','doublevoted', or 'vanilla', or reject if the player is not in the game.
		return Promise.reject('Not yet implemented');
	},

	getSpectators: function(game) {
		return Models.roster.findAll({
			where: {
				gameId: game,
				playerStatus: module.exports.playerStatus.spectator
			},
			include: [Models.players]
		});
	},

	setPlayerStatus: function(game, player, status) {
		return module.exports.getPlayerInGame(game, player)
			.then((playerInstance) => playerInstance.update({playerStatus: status}));
	},

	addMod: function(game, mod) {
		return module.exports.addPlayerToGame(game, mod, module.exports.playerStatus.mod);
	},

	addSpectator: function(game, spectator) {
		return module.exports.addPlayerToGame(game, spectator, module.exports.playerStatus.spectator);
	},

	getNumToLynch: function(game) {
		return module.exports.getLivingPlayers(game)
			.then((players) => {
				return Math.ceil((players.length + 1) / 2);
			});
	},

	killPlayer: function(game, player) {
		return module.exports.getPlayerInGame(game, player)
			.then((rosterInstance) => {
				if (rosterInstance.playerStatus !== module.exports.playerStatus.alive) {
					return Promise.reject(rosterInstance.player.properName + ' is not killable.');
				}
				return rosterInstance.update({playerStatus: module.exports.playerStatus.dead});
			});
	},

	isPlayerAlive: function(game, player) {
		return module.exports.getPlayerStatus(game, player)
			.then((status) => {
				return (status === module.exports.playerStatus.alive
					|| status === module.exports.playerStatus.unvote
					|| status === module.exports.playerStatus.nolynch);
			});
	},

	isPlayerMod: function(game, player) {
		return module.exports.getPlayerStatus(game, player)
			.then((status) => status === module.exports.playerStatus.mod)
			.catch(() => false);
	},

	
	isPlayerInGame: function(game, player) {
		return module.exports.getPlayerInGame(game, player)
			.then((instance) => instance !== null)
			.catch(() => false);
	},

	// Vote functions
	/*
	 * Basic functions:
	 * - addVote  Add a vote.
	 * - getAllVotesForDay  Get all votes for a game-day.
	 */
	/*
	 * Derivative functions:
	 * - getAllVotesForDaySorted  Get all votes for a game-day, sorted into the arrays:
	 *   - current
	 *   - old
	 * - getCurrentVotes  Get all active votes in a game-day.
	 * - getNotVotingPlayers  Get all players without an active vote in a game-day.
	 */
	/*
	 * Other functions:
	 * - getNumVotesForPlayer:  Get the number of active votes for a player.
	 * - hasPlayerVotedToday  Check whether a player has voted in the current game-day.
	 */

	addVote: function(game, post, voter, target) {
		return Promise.join(
			module.exports.getPlayerInGame(game, voter),
			module.exports.getPlayerInGame(game, target),
			module.exports.getGameById(game),
			(voterInstance, targetInstance, gameInstance) => {
				return Models.votes.create({
					post: post,
					day: gameInstance.day,
					voterId: voterInstance.playerId,
					targetId: targetInstance.playerId,
					gameId: game
				});
		});
	},

	getAllVotesForDay: function(game, day) {
		return Models.votes.findAll({
			where: {
				gameId: game,
				day: day
			},
			include: [
				{model: Models.players, as: 'voter'},
				{model: Models.players, as: 'target'}
			]
		});
	},

	getAllVotesForDaySorted: function(game, day) {
		const seen = new Map();

		return module.exports.getAllVotesForDay(game, day)
			.then((votes) => {
				return votes.sort((a, b) => b.post - a.post); // latest first
			})
			.mapSeries((vote) => {
				if (seen.has(vote.voter.name)) {
					vote.isCurrent = false;
					vote.rescindedAt = seen.get(vote.voter.name);
					seen.set(vote.voter.name, vote.post);
				} else {
					vote.isCurrent = true;
					vote.rescindedAt = null;
					seen.set(vote.voter.name, vote.post);
				}

				return vote;
			})
			.filter((vote) => vote.target.name !== module.exports.playerStatus.unvote)
			.then((votes) => votes.reverse());
	},

	getCurrentVotes: function(game, day) {
		return module.exports.getAllVotesForDaySorted(game, day)
			.filter((vote) => vote.isCurrent === true);
	},

	getPlayersWithoutActiveVotes: function(game, day) {
		return module.exports.getCurrentVotes(game, day)
			.map((vote) => vote.voter.id)
			.then((votes) => {
				return module.exports.getLivingPlayers(game)
					.filter((entry) => votes.indexOf(entry.player.id) < 0);
			});
	},
	
	getNumVotesForPlayer: function(game, day, player) {
		return module.exports.getPlayerByName(player)
			.then((playerInstance) => {
				return module.exports.getCurrentVotes(game, day)
					.filter((vote) => vote.target.id === playerInstance.id)
					.then((votes) => votes.length);
			});
	},

	hasPlayerVotedToday: function(game, player) {
		return Promise.join(
			module.exports.getPlayerInGame(game, player),
			module.exports.getGameById(game),
			(playerInstance, gameInstance) => {
				return Models.votes.findOne({
					where: {
						gameId: game,
						playerId: playerInstance.id,
						day: gameInstance.day
					}
				});
			})
			.then((vote) => vote !== null)
			.catch(() => false);
	}
};
