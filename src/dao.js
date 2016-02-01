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
	const action = require('./models/action')(db);

	// Relations
	// |- 1:1
	//segment.hasOne(game);
	// |- 1:N
	player.hasMany(action, {as: 'player', foreignKey: 'playerId'});
	player.hasMany(action, {as: 'target', foreignKey: 'targetId'});
	game.hasMany(action, {foreignKey: 'gameId'});
	// game.hasMany(segment);
	// |- M:N
	player.belongsToMany(game, {through: roster, foreignKey: 'playerId'});
	game.belongsToMany(player, {through: roster, foreignKey: 'gameId'});
	roster.belongsTo(game);
	roster.belongsTo(player);
	action.belongsTo(player, {as: 'player', foreignKey: 'playerId'});
	action.belongsTo(player, {as: 'target', foreignKey: 'targetId'});

	// model handles
	Models.players = player;
	Models.games = game;
	Models.segments = segment;
	Models.roster = roster;
	Models.actions = action;

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

	action: {
		vote: 'vote',
		dblVote: 'dblvote',
		nolynch: 'nolynch',
		kill: 'kill',
		visit: 'visit',
		guard: 'guard'
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

	lynchModifier: {
		loved: 1,
		vanilla: 0,
		hated: -1
	},

	playerProperty: {
		doubleVoter: 'doublevoter',
		loved: 'loved',
		hated: 'hated',
		vanilla: 'vanilla'
	},

	playerStatus: {
		alive: 'alive',
		dead: 'dead',
		undead: 'undead',
		stump: 'stump',
		mod: 'mod',
		spectator: 'spectator',
		other: 'other'
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
			.catch(() => {
				if (createGame) {
					return module.exports.addGame(id);
				}
				return Promise.reject('Game does not exist');
			});
	},

	getGameId(name) {
		return module.exports.getGameByName(name)
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
			.then((gameInstance) => {
				return gameInstance.day;
			});
	},

	getCurrentTime: function(game) {
		return module.exports.getGameById(game)
			.then((gameInstance) => {
				return gameInstance.time;
			});
	},

	getGameStatus: function(game) {
		return module.exports.getGameById(game)
			.then((gameInstance) => {
				return gameInstance.status;
			});
	},

	incrementDay: function(game) {
		return module.exports.getGameById(game)
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

	setGameStatus: function(game, status) {
		return Models.games.update({
			status: status
		}, {
			where: {
				id: game
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
	 * - addPropertyToPlayer  Add a property to a player.
	 * - addSpectator  Add a spectator to a game's roster.
	 * - getNumToLynch  Get the number of votes needed to lynch someone (or no-lynch).
	 * - getPlayerProperty Get the property currently set on a player.
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
		return module.exports.addPlayer(player)
			.then((playerInstance) => {
				return Models.roster.findOrCreate({
					where: {
						gameId: game,
						playerId: playerInstance.id,
						playerStatus: status
					}
				});
			});
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
		return module.exports.getPlayerByName(player)
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

	addPropertyToPlayer: function(game, player, property) {
		return module.exports.getPlayerInGame(game, player)
			.then((rosterEntry) => {
				switch (property) {
					case module.exports.playerProperty.vanilla:
						return rosterEntry.update({votes: 1, lynchModifier: module.exports.lynchModifier.vanilla});
					case module.exports.playerProperty.doubleVoter:
						return rosterEntry.update({votes: 2, lynchModifier: module.exports.lynchModifier.vanilla});
					case module.exports.playerProperty.loved:
						return rosterEntry.update({votes: 1, lynchModifier: module.exports.lynchModifier.loved});
					case module.exports.playerProperty.hated:
						return rosterEntry.update({votes: 1, lynchModifier: module.exports.lynchModifier.hated});
					default:
						return Promise.reject('Not a valid property');
				}
			});
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

	getPlayerProperty: function(game, player) {
		// Expected return: Resolve to 'loved','hated','doubleVoter', or 'vanilla',
		// or reject if the player is not in the game.
		return module.exports.getPlayerInGame(game, player)
			.then((rosterEntry) => {
				if (rosterEntry.votes === 2) {
					return module.exports.playerProperty.doubleVoter;
				} else if (rosterEntry.lynchModifier === module.exports.lynchModifier.loved) {
					return module.exports.playerProperty.loved;
				} else if (rosterEntry.lynchModifier === module.exports.lynchModifier.hated) {
					return module.exports.playerProperty.hated;
				} else if (rosterEntry.lynchModifier === module.exports.lynchModifier.vanilla) {
					return module.exports.playerProperty.vanilla;
				}
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
				return (status === module.exports.playerStatus.alive);
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

	// Action functions
	/*
	 * Basic functions:
	 * - addAction  Add an action by a player.
	 * - getCurrentActionByPlayer  Get a player's current action of a specified type.
	 * - getCurrentActions  Get all current actions.
	 * - revokeAction  Revoke an action by a player.
	 */
	/*
	 * Derivative functions:
	 * - addActionWithoutTarget  Add an action by a player that has no target.
	 * - addActionWithTarget  Add an action by a player that has a target.
	 */

	addAction: function(game, post, day, playerId, action, targetId) {
		return Models.actions.create({
			gameId: game,
			post: post,
			day: day,
			playerId: playerId,
			action: action,
			targetId: targetId
		});
	},

	getCurrentActionByPlayer(game, player, action) {
		return Promise.join(
			module.exports.getGameById(game),
			module.exports.getPlayerByName(player),
			(gameInstance, playerInstance) => {
				return Models.actions.findAll({
					where: {
						gameId: game,
						day: gameInstance.day,
						action: action,
						playerId: playerInstance.id,
						retractedInPost: null
					}
				});
			}
		);
	},

	getCurrentActions(game) {
		return module.exports.getGameById(game)
			.then((gameInstance) => {
				return Models.actions.findAll({
					where: {
						gameId: game,
						day: gameInstance.day,
						retractedInPost: null
					}
				});
			});
	},

	revokeAction: function(game, id, revokedInId) {
		return Models.actions.findOne({
			where: {
				post: id
			}
		}).then((action) => {
			if (!action) {
				return Promise.reject('No action found for post ' + id);
			}
			action.retractedInPost = revokedInId;
			return action.save();
		});
	},

	addActionWithoutTarget: function(game, post, player, action) {
		return Promise.join(
			module.exports.getPlayerInGame(game, player),
			module.exports.getGameById(game),
			(playerInstance, gameInstance) => {
				return module.exports.addAction(game, post, gameInstance.day, playerInstance.id, action, null);
			}
		);
	},

	addActionWithTarget: function(game, post, player, action, target) {
		return Promise.join(
			module.exports.getPlayerInGame(game, player),
			module.exports.getPlayerInGame(game, target),
			module.exports.getGameById(game),
			(playerInstance, targetInstance, gameInstance) => {
				return module.exports.addAction(game, post, gameInstance.day, playerInstance.id, action, targetInstance.id);
			}
		);
	},

	// Vote functions
	/*
	 * Basic functions:
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

	getAllVotesForDay: function(game, day) {
		return Models.actions.findAll({
			where: {
				gameId: game,
				day: day,
				action: [
					module.exports.action.vote,
					module.exports.action.dblVote,
					module.exports.action.nolynch
				]
			},
			include: [
				{model: Models.players, as: 'player'},
				{model: Models.players, as: 'target'}
			]
		});
	},

	getAllVotesForDaySorted: function(game, day) {
		return module.exports.getAllVotesForDay(game, day)
			.then((votes) => {
				return votes.sort((a, b) => a.post - b.post); // latest last
			})
			.map((vote) => {
				vote.isCurrent = !(vote.retractedInPost);
				if (vote.action === module.exports.action.dblVote) {
					vote.action = module.exports.action.vote;
				}
				return vote;
			});
	},

	getCurrentVotes: function(game, day) {
		return module.exports.getAllVotesForDaySorted(game, day)
			.filter((vote) => vote.isCurrent === true);
	},
	
	getCurrentVoteByPlayer: function(game, player) {
		return Promise.join(
			module.exports.getPlayerByName(player),
			module.exports.getCurrentDay(game),
			(playerInstance, day) => {
				return module.exports.getCurrentVotes(game, day)
					.filter((vote) => vote.player.id === playerInstance.id);
			});
	},

	getPlayersWithoutActiveVotes: function(game, day) {
		return module.exports.getCurrentVotes(game, day)
			.map((vote) => vote.player.id)
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
				return Models.actions.findOne({
					where: {
						gameId: game,
						playerId: playerInstance.id,
						day: gameInstance.day,
						action: [
							module.exports.action.vote,
							module.exports.action.dblVote,
							module.exports.action.nolynch
						]
					}
				});
			})
			.then((vote) => vote !== null)
			.catch(() => false);
	}
};
