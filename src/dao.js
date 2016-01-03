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

module.exports = {
	createDB: function(config) {
		if (!initialised) {
			return initialise(config);
		} else {
			return Promise.resolve();
		}
	},
	
	getGameID(gameName) {
		return Models.games.findOne({where: {name: gameName}}).then((result) => {
			return result.id;
		});
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
	
	createGame: function(id, name, mod) {
		return Models.games.build({
				id: id,
				name: name,
				status: 'prep',
				stage: 'day',
				currentDay: 0
				/*TODO: Join to Players for game owner.*/
		}).save();
	},
	
	isPlayerMod(player, game) {
		//For testing purposes, and until the above is resolved, everyone is the mod
		return Promise.resolve(true);
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
	
	killPlayer: function(game, player) {
		let insPlayer, insRoster;
		return Models.players.findOne({where: {name: '' + player}}).then((playerInstance) => {
			if (!playerInstance) {
				throw new Error('No such player!');
			}
			insPlayer = playerInstance;
			return Models.roster.findOne({where: {playerId: insPlayer.id, gameId: game}});
		}).then((rosterInstance) => {
			insRoster = rosterInstance[0];
			insRoster.player_status = 'dead';
			return db.sync();
		});
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
					voterId: voterInstance.id,
					targetId: targetInstance.id,
					gameId: game
				});
				return vote.save({transaction: t});
			});
		});
	},

	getPlayers: function(game) {
		return Models.roster.findAll({where: {gameId: game}, include: [Models.players]});
	},
	
	getLivingPlayers: function(game) {
		return Models.roster.findAll({where: {gameId: game, player_status: 'alive'}, include: [Models.players]});
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
	
	getNumVotesForPlayer: function(game, day, player) {
		return Promise.resolve(0);
		/*TODO: This is a stub because I don't understand how Dreikin wants to handle current vs old votes*/
	},
	
	getCurrentDay: function(game) {
		/*TODO: this is a stub */
		return Models.games.findOne({where: {id: game}})
		.then((gameInstance) => {
			return gameInstance.currentDay;
		});
	},
	
	fakeGetAllVotesForDay: function(game, day) {
		/*TODO: This is a stub. Expected format for return is an array of instances*/
		const fakeData = [
			{
				'id': 1,
				'post': 620,
				'day': 0,
				'createdAt': '2016-01-03T00:08:10.822Z',
				'updatedAt': '2016-01-03T00:08:10.822Z',
				'voterId': 1,
				'targetId': 2,
				'gameId': 52778,
				'voter': {
					'id': 1,
					'name': 'dreikin',
					'createdAt': '2016-01-03T00:50:33.808Z',
					'updatedAt': '2016-01-03T00:50:33.808Z'
				},
				'target': {
					'id': 2,
					'name': 'yamikuronue',
					'createdAt': '2016-01-03T00:50:34.848Z',
					'updatedAt': '2016-01-03T00:50:34.848Z'
				}
			}
		];
		
		return Promise.resolve(fakeData);
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
	
	setDayState: function(game, state) {
		/*TODO: This is a stub*/
		return Promise.resolve();
	},
	
	incrementDay: function(game, state) {
		/*TODO: This is a stub*/
		return Promise.resolve(2); //will be the new day number
	}
};
