/**
 * Heavily borrowed from https://github.com/SockDrawer/SockRPG
 */
'use strict';
const orm = require('sequelize');
const Models = {};

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
	game.hasMany(vote);
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
		prep: 'prep',
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
	 * - getGameById  Get a game instance by the game's ID.
	 * - getGameByName  Get a game instance by the game's friendly name.
	 * - setGameStatus  Set the status of a game.
	 */
	/*
	 * Derivative functions:
	 * - ensureGameExists  Return whether a game with a given ID exists.
	 */

	addGame: function(id, name, mod) {
		return Models.games.build({
			id: id,
			name: name,
			status: module.gameStatus.prep,
			stage: module.gameTime.day,
			currentDay: 0
			/*TODO: Join to Players for game owner.*/
		}).save();
	},

	ensureGameExists: function(id) {
		return Models.games.findOne({where: {id: id}}).then((result) => {
			if (result) {
				return Promise.resolve();
			} else {
				return Promise.reject('Game does not exist');
			}
		});
	},

	getGameID(gameName) {
		return Models.games.findOne({where: {name: gameName}}).then((result) => {
			return result.id;
		});
	},

	setGameState: function(game, state) {
		return Models.games.findOne({where: {id: game}})
			.then((gameInstance) => {
				gameInstance.status = state;
				return gameInstance.save();
			});
	},

	// Game functions (days and stages)
	/*
	 * Basic functions:
	 * - getCurrentDay  Get the current day of a game.
	 * - getCurrentStage  Get the current stage-of-day of a game.
	 * - setCurrentDay  Set the current day of a game.
	 * - setCurrentStage  Set the current stage of a game.
	 */
	/*
	 * Derivative functions:
	 * - incrementDay  Move the current day of a game to the next day.
	 */

	getCurrentDay: function(game) {
		return Models.games.findOne({where: {id: game}})
			.then((gameInstance) => {
				return gameInstance.currentDay;
			});
	},

	incrementDay: function(game) {
		let newDay;
		return Models.games.findOne({where: {id: game}})
			.then((gameInstance) => {
				newDay = gameInstance.currentDay++;
				gameInstance.stage = module.gameTime.day;
				return gameInstance.save();
			}).then( () => {
				return newDay;
			});
	},

	setDayStage: function(game, stage) {
		return Models.games.findOne({where: {id: game}})
			.then((gameInstance) => {
				gameInstance.stage = stage;
				return gameInstance.save();
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

	// Player functions
	/*
	 * Basic functions:
	 * - addPlayer  Add a game player (or spectator, or mod, or something else).
	 * - getPlayerByID  Get a player by ID.
	 * - getPlayerByName  Get a player by name.
	 */
	/*
	 * Derivative functions:
	 */

	// Roster functions
	/*
	 * Basic functions:
	 * - addMod  Add a moderator to a game's roster.
	 * - addPlayerToGame  Add a player to a game's roster.
	 * - addSpectator  Add a spectator to a game's roster.
	 * - getAllPlayers  Get all players in a game.
	 * - getDeadPlayers  Get all dead players in a game.
	 * - getLivingPlayers  Get all living players in a game.
	 * - getMods  Get all moderators for a game.
	 * - getPlayerStatus  Get the status of a player in a game.
	 * - getSpectators  Get all spectators of a game.
	 * - isPlayerInGame  Return whether a player is in a game.
	 * - setPlayerStatus  Set the status of a player in a game.
	 */
	/*
	 * Derivative functions:
	 * - getNumToLynch  Get the number of votes needed to lynch someone (or no-lynch).
	 * - killPlayer  Set a player's status to dead.
	 */

	addPlayerToGame: function(game, player) {
		let insPlayer;
		return Models.players.findOrCreate({where: {name: '' + player}}).then((playerInstance) => {
			insPlayer = playerInstance[0];
			return Models.roster.findOrCreate({where: {playerId: insPlayer.id, gameId: game, player_status: module.playerStatus.alive}});
		}).then(db.sync());
	},

	getLivingPlayers: function(game) {
		return Models.roster.findAll({
			where: {gameId: game, player_status: module.playerStatus.alive},
			include: [Models.players]
		});
	},

	getNumToLynch: function(game) {
		return module.exports.getLivingPlayers(game).then((players) => {
			let num = Math.ceil((players.length + 1) / 2);
			if (num <= 0) {
				num = 1;
			}
			return num;
		});
	},

	getPlayers: function(game) {
		return Models.roster.findAll({where: {gameId: game}, include: [Models.players]});
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

	isPlayerAlive: function(game, player) {
		return db.query('SELECT gameId FROM `rosters` INNER JOIN players ON players.id = rosters.playerId WHERE players.name="' + player + '" and gameId=' + game + ' and player_status="alive"', {type: db.QueryTypes.SELECT})
			.then(function(rows) {
				return rows.length > 0;
			});
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

	isPlayerMod(player, game) {
		//For testing purposes, and until the above is resolved, everyone is the mod
		return Promise.resolve(true);
	},

	killPlayer: function(game, player) {
		let insPlayer, insRoster;
		return Models.players.findOne({where: {name: '' + player}}).then((playerInstance) => {
			if (!playerInstance) {
				throw new Error('No such player!');
			}
			insPlayer = playerInstance;
			return Models.roster.findOne({where: {playerId: insPlayer.id, gameId: game}});
		}).then((rosterInstance) => {
			rosterInstance.player_status = module.playerStatus.dead;
			return rosterInstance.save();
		});
	},

	// Vote functions
	/*
	 * Basic functions:
	 * - addVote  Add a vote.
	 * - getAllVotes  Get all votes for a game-day.
	 */
	/*
	 * Derivative functions:
	 * - getAllVotesSorted  Get all votes for a game-day, sorted into the arrays:
	 *   - current
	 *   - old
	 * - getCurrentVotes  Get all active votes in a game-day.
	 * - getNotVotingPlayers  Get all players without an active vote in a game-day.
	 */

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
					voterId: voterInstance.id,
					targetId: targetInstance.id,
					gameId: game
				});
				return vote.save({transaction: t});
			});
		});
	},

	getAllVotesForDay: function(game, day) {
		return Models.votes.findAll({
				where: {gameId: game, day: day},
				include: [{model: Models.players, as: 'voter'}, {model: Models.players, as: 'target'}]
			})
			.reduce(
				(votes, vote) => {
					let idx = -1;
					for ( let i = 0; i < votes.current.length; i++) {
						if (votes.current[i].voterId === vote.voterId) {
							idx = i;
							break;
						}
					}
					if (idx === -1) {
						/* no vote by voter yet */
						votes.current.push(vote);
					} else {
						/* need to find latest vote */
						if (votes.current[idx].post > vote.post) {
							/* current vote is latest */
							votes.old.push(vote);
						} else {
							/* new vote is latest */
							votes.old.push(votes.current[idx]);
							votes.current[idx] = vote;
						}
					}

					return votes;
				},
				{old: [], current: []}
			);
	},
	
	getNumVotesForPlayer: function(game, day, player) {
		return Promise.resolve(0);
		/*TODO: This is a stub because I don't understand how Dreikin wants to handle current vs old votes*/
	}
};
