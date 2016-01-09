'use strict';
/**
 * Mafiabot plugin
 *
 * Watches for @vote mentions and replies with a canned response
 *
 * @module mafiabot
 * @author Accalia, Dreikin, Yamikuronue
 * @license MIT
 */

// Requisites

const dao = require('./dao.js');
const Promise = require('bluebird');
const readFile = require('fs-readfile-promise');
const Handlebars = require('handlebars');
Handlebars.registerHelper('voteChart', require('./templates/helpers/voteChart'));
Handlebars.registerHelper('listNames', require('./templates/helpers/listNames'));

// Constants

const unvoteNicks = ['unvote', 'no-lynch', 'nolynch'];

const internals = {
	browser: null,
	configuration: exports.defaultConfig,
	timeouts: {},
	interval: null,
	events: null
};
exports.internals = internals;

// Local extensions

/*eslint-disable no-extend-native*/
Array.prototype.contains = function(element){
    return this.indexOf(element) > -1;
};
/*eslint-enable no-extend-native*/

// Defaults

/**
 * Default plugin configuration
 */
exports.defaultConfig = {
	/**
	 * Required delay before posting another reply in the same topic.
	 *
	 * @default
	 * @type {Number}
	 */
	cooldown: 0 * 1000,
	/**
	 * Messages to select reply from.
	 *
	 * @default
	 * @type {string[]}
	 */
	messages: [
		'Command invalid or no command issued. Try the `help` command.'
	],
	/**
	 * File location for database.
	 *
	 * @default
	 * @type {string}
	 */
	db: './mafiadb'
};

// Helper functions

function lynchPlayer(game, target) {
	return dao.killPlayer(game, target).then(() => {
		return dao.setCurrentTime(game, dao.gameTime.night);
	}).then(() => {
		const text = '@' + target + ' has been lynched! Stay tuned for the flip. <b>It is now Night</b>';
		internals.browser.createPost(game, null, text, () => 0);
	}).catch((error) => {
		const text = 'Error when lynching dead player: ' + error.toString();
		internals.browser.createPost(game, null, text, () => 0);
	});
}


function mustBeTrue(check, args, error) {
	return check.apply(args).then((result) => {
		if (!result) {
			return Promise.reject(error);
		} else {
			return Promise.resolve();
		}
	});
}

function mustBeFalse(check, args, error) {
	return check.apply(args).then((result) => {
		if (result) {
			return Promise.reject(error);
		} else {
			return Promise.resolve();
		}
	});
}

/**
 * Shuffle function using Fisher-Yates algorithm, from SO
 *
 * @param {string[]} array Array of strings
 * @returns {string[]} Shuffled array of strings
 */
function shuffle(array) {
	let currentIndex = array.length, temporaryValue, randomIndex;

	// While there remain elements to shuffle...
	while (0 !== currentIndex) {

		// Pick a remaining element...
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;

		// And swap it with the current element.
		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
	}

	return array;
}

function registerCommands(events) {
	events.onCommand('echo', 'echo a bunch of post info (for diagnostic purposes)', exports.echoHandler, () => 0);
	events.onCommand('for', 'vote for a player to be executed', exports.voteHandler, () => 0);
	events.onCommand('join', 'join current mafia game', exports.joinHandler, () => 0);
	events.onCommand('list-all-players', 'list all players, dead and alive', exports.listAllPlayersHandler, () => 0);
	events.onCommand('list-all-votes', 'list all votes from the game\'s start', exports.listAllVotesHandler, () => 0);
	events.onCommand('list-players', 'list all players still alive', exports.listPlayersHandler, () => 0);
	events.onCommand('list-votes', 'list all votes from the day\'s start', exports.listVotesHandler, () => 0);
	events.onCommand('vote', 'vote for a player to be executed (alt. form)', exports.voteHandler, () => 0);

	/*Mod commands*/
	events.onCommand('start', 'Start a new game', exports.startHandler, () => 0);
	events.onCommand('new-day', 'move on to a new day (mod only)', exports.dayHandler, () => 0);
	events.onCommand('kill', 'kill a player (mod only)', exports.killHandler, () => 0);
}

/**
 * Register the players listed in the configuration.
 *
 * @param {Number} game Thread number for the game.
 * @param {string[]} players Array of player names to add to the game.
 */
/*eslint-disable no-console*/
function registerPlayers(game, players) {
	return dao.ensureGameExists(game)
		.then(() => {
			return Promise.mapSeries(players, function(player) {
				console.log('Mafia: Adding player: ' + player);
				return dao.isPlayerInGame(game, player.toLowerCase())
					.then((answer) => {
						if (answer) {
							return Promise.resolve();
						} else {
							return dao.addPlayerToGame(game, player.toLowerCase());
						}
					})
					.catch((err) => {
						console.log('Mafia: Adding player: failed to add player: ' + player
							+ '\n\tReason: ' + err);
						return Promise.resolve();
					});
			});
		});
}
/*eslint-enable no-console*/

// Exported functions and objects

//Mod commands
/**
 * Move to the next day
 */
 
 exports.startHandler = function (command) {
	const id = command.post.topic_id;
	const player = command.post.username;
	const gameName = command.args[0];

	const reportError = (error) => {
		internals.browser.createPost(command.post.topic_id,
			command.post.post_number,
			'Error when starting game: ' + error, () => 0);
	};

	return dao.addGame(id, gameName, player)
		.then(() => {
			internals.browser.createPost(command.post.topic_id,
				command.post.post_number,
				'Game ' + gameName + 'created! The  mod is @' + player, () => 0);
		})
		.catch((err) => {
			reportError(err);
		});
};

exports.activateHandler = function (command) {
	const gameName = command.args[0];
	let game;
	const mod = command.post.username;
	
	return dao.getGameId(gameName).then((id) => {
		if (!id) {
			return Promise.reject('No such game');
		}
		game = id;
	})
	.then(() => mustBeTrue(dao.isPlayerMod, [game, mod], 'Poster is not mod'))
	.then(() => dao.setGameStatus(game, 'active'))
	.then(() => dao.incrementDay(game));
};

exports.dayHandler = function (command) {
	const gameName = internals.configuration.name;
	const mod = command.post.username.toLowerCase();
	let game;
	const data = {
		numPlayers: 0,
		toExecute: 0,
		day: 0,
		names: []
	};

	return dao.getGameId(gameName).then((id) => {
		if (!id) {
			return Promise.reject('No such game');
		}
		game = id;
	})
	.then(mustBeTrue(dao.isPlayerMod, [game, mod], 'Poster is not mod'))
	.then(dao.incrementDay(game))
	.then( (newDay) => {
		data.day = newDay;
		const text = 'Incremented day for ' + gameName;
		internals.browser.createPost(command.post.topic_id, command.post.post_number, text, () => 0);
		return dao.setCurrentTime(game, dao.gameTime.night);
	}).then(() => {
		Promise.all([
			dao.getNumToLynch(game),
			dao.getLivingPlayers(game),
			readFile(__dirname + '/templates/newDayTemplate.handlebars')
		]).then((results) => {
			data.toExecute = results[0];
			data.numPlayers = results[1].length;
			const source = results[2].toString();
			
			data.names = results[1].map((row) => {
				return row.player.name;
			});
			
			const template = Handlebars.compile(source);

			const output = template(data);
			internals.browser.createPost(game, command.post.post_number, output, () => 0);
		
		});
		return ;
		return ;
	});
};

exports.killHandler = function (command) {
	const gameName = internals.configuration.name;
	const target = command.args[0].toLowerCase().replace(/^@?(.*)/, '$1');
	const mod = command.post.username.toLowerCase();
	let game;
	
	return dao.getGameId(gameName)
		.then((id) => {
			game = id;
		})
		.then(() => {
			return Promise.all([
				mustBeTrue(dao.isPlayerMod, [game, mod], 'Poster is not mod'),
				mustBeTrue(dao.isPlayerInGame, [game, target], 'Target not in game'),
				mustBeTrue(dao.isPlayerAlive, [game, target], 'Target not alive')
			]);
		})
		.then(dao.killPlayer(game, target))
		.then(() => {
			const text = 'Killed @' + target + ' in game ' + gameName;
			internals.browser.createPost(command.post.topic_id, command.post.post_number, text, () => 0);
		})
		.catch((err) => {
			internals.browser.createPost(command.post.topic_id,
			command.post.post_number,
			'Error killing player: ' + err, () => 0);
		});
};

//Player commands
exports.voteHandler = function (command) {
	const game = command.post.topic_id;
	const post = command.post.post_number;
	const voter = command.post.username.toLowerCase();
	const target = command.args[0].toLowerCase().replace(/^@?(.*)/, '$1');
	
	return dao.ensureGameExists(game)
		.then(() => {
			return Promise.all([
				mustBeTrue(dao.isPlayerInGame, [game, voter], 'Voter not in game'),
				mustBeTrue(dao.isPlayerAlive, [game, voter], 'Voter not alive'),
				mustBeTrue(dao.isPlayerInGame, [game, target], 'Target not in game'),
				mustBeTrue(dao.isPlayerAlive, [game, target], 'Target not alive')
			]);
		})
		.then(dao.addVote(game, post, voter, target))
		.then((result) => {
			if (!result) {
				return Promise.reject('Vote failed');
			}
			let text;

			if (unvoteNicks.contains(target)) {
				text = '@' + command.post.username + ' rescinded their vote';
			} else {
				text = '@' + command.post.username + ' voted for @' + target;
			}

			text = text	+ ' in post #<a href="https://what.thedailywtf.com/t/'
				+ command.post.topic_id + '/' + command.post.post_number + '">'
				+ command.post.post_number + '</a>.\n\n'
				+ 'Vote text:\n[quote]\n' + command.input + '\n[/quote]';
			internals.browser.createPost(command.post.topic_id, command.post.post_number, text, () => 0);
		})
		.then(() => {
			Promise.all([
				dao.getNumToLynch(game),
				dao.getCurrentDay(game).then((day) => dao.getNumVotesForPlayer(game, day, target))
			]).then((results) => {
				const numToLynch = results[0];
				const numReceived = results[1];
			
				if (numToLynch >= numReceived) {
					return lynchPlayer(game, target);
					return Promise.resolve();
				} else {
					return Promise.resolve();
				}
			});
		}).catch((reason) => {
			let text = ':wtf:';

			if (reason === 'Voter not in game') {
				text = '@' + voter + ': You are not yet a player.\n'
					+ 'Please use `@' + internals.configuration.username + ' join` to join the game.';
			} else if (reason === 'Voter not alive') {
				text = 'Aaagh! Ghosts!\n'
					+ '(@' + voter + ': You are no longer among the living.)';
			} else if (reason === 'Target not in game') {
				text = 'Who? I\'m sorry, @' + voter + ' but your princess is in another castle.\n'
					+ '(' + target + ' is not in this game.)';
			} else if (reason === 'Target not alive') {
				text = '@' + voter + ': You would be wise to not speak ill of the dead.';
			} else if (reason === 'Vote failed') {
				text = ':wtf:\nSorry, @' + voter + ': your vote failed.  No, I don\'t know why.'
					+ ' You\'ll have to ask @' + internals.configuration.owner + ' about that.';
			} else {
				text += '\n' + reason;
			}

			text += '\n<hr />\n';
			text += '@' + command.post.username + ' tried to vote for ' + target
				+ ' in post #<a href="https://what.thedailywtf.com/t/'
				+ command.post.topic_id + '/' + command.post.post_number + '">'
				+ command.post.post_number + '</a>.\n\n'
				+ 'Vote text:\n[quote="' + command.post.username
				+ ', post:' + command.post.post_number
				+ ', topic:' + command.post.topic_id + '"]\n'
				+ command.input + '\n[/quote]';
			internals.browser.createPost(command.post.topic_id, command.post.post_number, text, () => 0);
		});
};

//Open commands
exports.echoHandler = function (command) {
	const text = 'topic: ' + command.post.topic_id + '\n'
		+ 'post: ' + command.post.post_number + '\n'
		+ 'input: `' + command.input + '`\n'
		+ 'command: `' + command.command + '`\n'
		+ 'args: `' + command.args + '`\n'
		+ 'mention: `' + command.mention + '`\n'
		+ 'post:\n[quote]\n' + command.post.cleaned + '\n[/quote]';
	internals.browser.createPost(command.post.topic_id, command.post.post_number, text, () => 0);
};

exports.joinHandler = function (command) {
	const id = command.post.topic_id;
	const post = command.post.post_number;
	const player = command.post.username;
	
	const reportError = (error) => {
		internals.browser.createPost(id, post, 'Error when adding to game: ' + error, () => 0);
	};
	
	return dao.ensureGameExists(id)
		.then(() => mustBeFalse(dao.isPlayerInGame, [id, player], 'You are already in this game, @' + player + '!'))
		.then(() => dao.addPlayerToGame(id, player.toLowerCase()))
		.then(() => internals.browser.createPost(id, post, 'Welcome to the game, @' + player, () => 0))
		.catch(reportError);
};

exports.listPlayersHandler = function (command) {
	const id = command.post.topic_id;
	const reportError = (error) => {
		internals.browser.createPost(command.post.topic_id,
			command.post.post_number,
			'Error resolving list: ' + error, () => 0);
	};
	return dao.ensureGameExists(id)
		.then(() => dao.getAllPlayers(id))
		.then( (rows) => {
			let alive = [];

			rows.forEach((row) => {
				if (row.playerStatus === dao.playerStatus.alive) {
					alive.push(row.player.name);
				}
			});

			const numLiving = alive.length;
			alive = shuffle(alive);

			let output = '##Player List\n';
			output += '###Living:\n';
			if (numLiving <= 0) {
				output += 'Nobody! Aren\'t you special?\n';
			} else {
				for (let i = 0; i < numLiving; i++) {
					output += '- ' + alive[i] + '\n';
				}
			}

			output += '###Mod(s):\n';
			if (internals.configuration.mods.length <= 0) {
				output += 'None.  Weird.';
			} else {
				internals.configuration.mods.forEach((mod) => {
					output += '- ' + mod + '\n';
				});
			}

			internals.browser.createPost(command.post.topic_id, command.post.post_number, output, () => 0);
			return Promise.resolve();
		}).catch((err) => {
			reportError(err);
		});
};

exports.listAllPlayersHandler = function (command) {
	const id = command.post.topic_id;
	const reportError = (error) => {
		internals.browser.createPost(command.post.topic_id,
									command.post.post_number,
									'Error resolving list: ' + error, () => 0);
	};
	return dao.ensureGameExists(id)
	.then(() => dao.getAllPlayers(id))
	.then( (rows) => {
		let alive = [];
		let dead = [];

		rows.forEach((row) => {
			if (row.playerStatus === dao.playerStatus.alive) {
				alive.push(row.player.name);
			} else if (row.playerStatus === dao.playerStatus.dead) {
				dead.push(row.player.name);
			}
		});

		const numLiving = alive.length;
		const numDead = dead.length;
		
		alive = shuffle(alive);
		dead = shuffle(dead);

		let output = '##Player List\n';
		output += '###Living:\n';
		if (numLiving <= 0) {
			output += 'Nobody! Aren\'t you special?\n';
		} else {
			for (let i = 0; i < numLiving; i++) {
				output += '- ' + alive[i] + '\n';
			}
		}

		output += '\n###Dead:\n';
		if (numDead <= 0) {
			output += 'Nobody! Aren\'t you special?\n';
		} else {
			for (let i = 0; i < numDead; i++) {
				output += '- ' + dead[i] + '\n';
			}
		}

		output += '###Mod(s):\n';
		if (internals.configuration.mods.length <= 0) {
			output += 'None.  Weird.';
		} else {
			internals.configuration.mods.forEach((mod) => {
				output += '- ' + mod + '\n';
			});
		}

		internals.browser.createPost(command.post.topic_id, command.post.post_number, output, () => 0);
		return Promise.resolve();
	}).catch((err) => {
		reportError(err);
	});
};

exports.listVotesHandler = function (command) {
	const data = {
		day: 0,
		votes: {},
		numNotVoting: 0,
		notVoting: {},
		toExecute: 0
	};

	const currentlyVoting = [];

	const id = command.post.topic_id;
	return dao.ensureGameExists(id)
		.then(() => dao.getCurrentDay(id))
		.then((day) => {
			data.day = day;
			return dao.getNumToLynch(id);
		}).then((num) => {
			data.toExecute = num;
			return dao.getAllVotesForDaySorted(id, data.day);
		}).then((votes) => {
			const rows = [];
			votes.old.forEach((vote) => {
				vote.isCurrent = false;
				rows.push(vote);
			});

			votes.current.forEach((vote) => {
				vote.isCurrent = true;
				rows.push(vote);
			});

			return rows;
		}).then((rows) => {
			rows.forEach((row) => {
				const votee = row.target.name;
				const voter = row.voter.name;

				if (unvoteNicks.contains(votee)) {
					return; //Never count votes for NoLynch, that's an attempt to unvote
				}

				if (!data.votes.hasOwnProperty(votee)) {
					data.votes[votee] = {
						target: votee,
						num: 0,
						percent: 0,
						names: []
					};
				}

				if (row.isCurrent) {
					data.votes[votee].num++;
					data.votes[votee].percent = (data.votes[votee].num / data.toExecute) * 100;
					currentlyVoting.push(voter);
				}

				data.votes[votee].names.push({
					voter: voter,
					retracted: !row.isCurrent,
					post: row.post,
					game: id
				});
			});

			return dao.getLivingPlayers(id);
		}).then((rows) => {
			const players = rows.map((row) => {
				return row.player.name;
			});
			data.numPlayers = players.length;
			data.notVoting = players.filter((element) => {
				return currentlyVoting.indexOf(element) < 0;
			});
			data.notVoting = shuffle(data.notVoting);
			data.numNotVoting = data.notVoting.length;
			return readFile(__dirname + '/templates/voteTemplate.handlebars');
		}).then((buffer) => {
			const source = buffer.toString();
			const template = Handlebars.compile(source);

			const output = template(data);
			internals.browser.createPost(command.post.topic_id, command.post.post_number, output, () => 0);
		});
};

exports.listAllVotesHandler = function (command) {};

/**
 * Respond to @mentions
 *
 * @param {external.notifications.Notification} _ Notification received (ignored)
 * @param {external.topics.Topic} topic Topic trigger post belongs to
 * @param {external.posts.CleanedPost} post Post that triggered notification
 */
exports.mentionHandler = function (_, topic, post) {
	const index = Math.floor(Math.random() * internals.configuration.messages.length),
		reply = internals.configuration.messages[index].replace(/%(\w+)%/g, (__, key) => {
			let value = post[key] || '%' + key + '%';
			if (typeof value !== 'string') {
				value = JSON.stringify(value);
			}
			return value;
		}).replace(/(^|\W)@(\w+)\b/g, '$1<a class="mention">@&zwj;$2</a>');
	internals.browser.createPost(topic.id, post.post_number, reply, () => 0);
};


// Required exports

/**
 * Prepare Plugin prior to login
 *
 * @param {*} plugConfig Plugin specific configuration
 * @param {Config} config Overall Bot Configuration
 * @param {externals.events.SockEvents} events EventEmitter used for the bot
 * @param {Browser} browser Web browser for communicating with discourse
 */
/*eslint-disable no-console*/
exports.prepare = function prepare(plugConfig, config, events, browser) {
	if (Array.isArray(plugConfig)) {
		plugConfig = {
			messages: plugConfig
		};
	}
	if (plugConfig === null || typeof plugConfig !== 'object') {
		plugConfig = {};
	}
	internals.events = events;
	internals.browser = browser;
	internals.configuration = config.mergeObjects(true, exports.defaultConfig, plugConfig);
	dao.createDB(internals.configuration)
		.then(() => dao.ensureGameExists(plugConfig.thread))
		.catch((reason) => {
			if (reason === 'Game does not exist') {
				return dao.addGame(plugConfig.thread, plugConfig.name);
			} else {
				console.log('Mafia: Error: Game not added to database.\n'
					+ '\tReason: ' + reason);
				return Promise.reject('Game not created');
			}
		})
		.then(() => registerPlayers(plugConfig.thread, plugConfig.players.concat(unvoteNicks)));
	events.onNotification('mentioned', exports.mentionHandler);
	registerCommands(events);
};
/*eslint-enable no-console*/

/**
 * Start the plugin after login
 */
exports.start = function start() {};

/**
 * Stop the plugin prior to exit or reload
 */
exports.stop = function stop() {};
