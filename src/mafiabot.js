'use strict';
/**
 * Mafiabot plugin
 *
 * Helps run mafia games, providing features such as vote tracking and listing.
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
	return dao.setCurrentTime(game, dao.gameTime.night)
		.then(() => dao.killPlayer(game, target))
		.then((rosterEntry) => {
			const text = '@' + rosterEntry.player.properName + ' has been lynched! Stay tuned for the flip.'
				+ ' <b>It is now Night.</b>';
			internals.browser.createPost(game, null, text, () => 0);
		})
		.catch((error) => {
			const text = 'Error when lynching player: ' + error.toString();
			internals.browser.createPost(game, null, text, () => 0);
		});
}


function mustBeTrue(check, args, error) {
	return check.apply(null, args).then((result) => {
		if (result) {
			return Promise.resolve();
		} else {
			return Promise.reject(error);
		}
	});
}

function mustBeFalse(check, args, error) {
	return check.apply(null, args).then((result) => {
		if (!result) {
			return Promise.resolve();
		} else {
			return Promise.reject(error);
		}
	});
}

function isDaytime(game) {
	return dao.getCurrentTime(game).then((time) => {
		return time === dao.gameTime.day;
	});
}

function reportError (command, preface, error) {
	internals.browser.createPost(
		command.post.topic_id,
		command.post.post_number,
		'' + preface + error,
		() => 0
	);
}

function respondWithTemplate(templateFile, data, command) {
	return readFile(__dirname + '/' + templateFile)
	.then((buffer) => {
		const source = buffer.toString();
		const template = Handlebars.compile(source);

		const output = template(data);
		internals.browser.createPost(command.post.topic_id, command.post.post_number, output, () => 0);
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

function registerPlayerCommands(events) {
	events.onCommand('for', 'vote for a player to be executed', exports.forHandler, () => 0);
	events.onCommand('join', 'join current mafia game', exports.joinHandler, () => 0);
	events.onCommand('list-all-players', 'list all players, dead and alive', exports.listAllPlayersHandler, () => 0);
	events.onCommand('list-all-votes', 'list all votes from the game\'s start', exports.listAllVotesHandler, () => 0);
	events.onCommand('list-players', 'list all players still alive', exports.listPlayersHandler, () => 0);
	events.onCommand('list-votes', 'list all votes from the day\'s start', exports.listVotesHandler, () => 0);
	events.onCommand('no-lynch', 'vote for noone to be lynched', exports.nolynchHandler, () => 0);
	events.onCommand('nolynch', 'vote for noone to be lynched', exports.nolynchHandler, () => 0);
	events.onCommand('unvote', 'rescind your vote', exports.unvoteHandler, () => 0);
	events.onCommand('vote', 'vote for a player to be executed (alt. form)', exports.voteHandler, () => 0);
}

function registerModCommands(events) {
	events.onCommand('prepare', 'Start a new game', exports.prepHandler, () => 0);
	events.onCommand('start', 'move a game into active play (mod only)', exports.startHandler, () => 0);
	events.onCommand('new-day', 'move on to a new day (mod only)', exports.dayHandler, () => 0);
	events.onCommand('kill', 'kill a player (mod only)', exports.killHandler, () => 0);
	events.onCommand('end', 'end the game (mod only)', exports.finishHandler, () => 0);
	events.onCommand('set', 'set a property on a player (mod only)', exports.setHandler, () => 0);
}

function registerCommands(events) {
	events.onCommand('echo', 'echo a bunch of post info (for diagnostic purposes)', exports.echoHandler, () => 0);
	registerPlayerCommands(events);
	registerModCommands(events);
}

/**
 * Register the mods listed in the configuration.
 *
 * @param {Number} game Thread number for the game.
 * @param {string[]} mods Array of mod names to add to the game.
 */
/*eslint-disable no-console*/
function registerMods(game, mods) {
	return dao.ensureGameExists(game)
		.then(() => Promise.mapSeries(
			mods,
			function(mod) {
				console.log('Mafia: Adding mod: ' + mod);
				return dao.addMod(game, mod)
					.catch((err) => {
						console.log('Mafia: Adding mod: failed to add mod: ' + mod
							+ '\n\tReason: ' + err);
						return Promise.resolve();
					});
			}
		));
}
/*eslint-enable no-console*/

/**
 * Register the players listed in the configuration.
 *
 * @param {Number} game Thread number for the game.
 * @param {string[]} players Array of player names to add to the game.
 */
/*eslint-disable no-console*/
function registerPlayers(game, players) {
	return dao.ensureGameExists(game)
		.then(() => Promise.mapSeries(
			players,
			function(player) {
				console.log('Mafia: Adding player: ' + player);
				return dao.addPlayerToGame(game, player)
					.catch((err) => {
						console.log('Mafia: Adding player: failed to add player: ' + player
							+ '\n\tReason: ' + err);
						return Promise.resolve();
					});
			}
		));
}
/*eslint-enable no-console*/

// Exported functions and objects

// Mod commands
 
 /**
  * Prepare: A mod function that starts a new game in the Prep phase.
  * Must be used in the game thread. The user becomes the mod.
  * Game rules:
  *  - A new game can only be started in a thread that does not already have a game
  *
  * @example !prepare gameName
  *
  * @param  {commands.command} command The command that was passed in.
  * @returns {Promise}        A promise that will resolve when the game is ready
  */
exports.prepHandler = function (command) {
	const id = command.post.topic_id;
	const player = command.post.username;
	const gameName = command.args[0];

	return dao.getGameStatus(id)
		.then(
			(status) => {
				if (status === dao.gameStatus.auto) {
					return dao.convertAutoToPrep(id, gameName);
				}
				return Promise.reject('Game is in the wrong status. The game is ' + status);
			},
			() => dao.addGame(id, gameName))
		.then(() => dao.addMod(id, player))
		.then(() => {
			internals.browser.createPost(command.post.topic_id,
				command.post.post_number,
				'Game "' + gameName + '" created! The mod is @' + player, () => 0);
		})
		.catch((err) => {
			reportError(command, 'Error when starting game: ', err);
		});
};

 /**
  * Start: A mod function that starts day 1 of a game
  * Must be used in the game thread.
  *
  * Game rules:
  *  - A game can only be started if it is in the prep phase
  *  - A game can only be started by the mod
  *  - When the game starts, it starts on Daytime of Day 1
  *
  * @example !start
  *
  * @param  {commands.command} command The command that was passed in.
  * @returns {Promise}        A promise that will resolve when the game is ready
  */
exports.startHandler = function (command) {
	const game = command.post.topic_id;
	const mod = command.post.username;
	
	return dao.getGameStatus(game)
		.then((status) => {
			if (status === dao.gameStatus.prep) {
				return Promise.resolve();
			}
			if (status === dao.gameStatus.auto) {
				return Promise.reject('Game not in prep phase. Try `!prepare`.');
			}
			return Promise.reject('Game already ' + status);
		})
		.then(() => mustBeTrue(dao.isPlayerMod, [game, mod], 'Poster is not mod'))
		.then(() => dao.setGameStatus(game, dao.gameStatus.running))
		.then(() => dao.incrementDay(game))
		.then(() => dao.setCurrentTime(game, dao.gameTime.day))
		.then(() => {
			return respondWithTemplate('templates/modSuccess.handlebars', {
				command: 'Start game',
				results: 'Game is now ready to play',
				game: game
			}, command);
		})
		.catch((err) => reportError(command, 'Error when starting game: ', err));
};

exports.setHandler = function (command) {
	const mod = command.post.username;
	const target = command.args[0].replace(/^@?(.*?)[.!?, ]?$/, '$1');
	const property = command.args[1];
	const game = command.args[2];
	
	const validProperties = [
		dao.playerProperty.loved,
		dao.playerProperty.hated,
		dao.playerProperty.doubleVoter,
		dao.playerProperty.vanilla
	];
	
	return dao.getGameStatus(game)
		.then((status) => {
			if (status === dao.gameStatus.finished) {
				return Promise.reject('The game is over!');
			}
			return Promise.resolve();
		})
		.then(() => mustBeTrue(dao.isPlayerMod, [game, mod], 'Poster is not mod'))
		.then(() => mustBeTrue(dao.isPlayerInGame, [game, target], 'Target not valid'))
		.then(() => {
			if (!validProperties.contains(property.toLowerCase())) {
				return Promise.reject('Property not valid.\n Valid properties: ' + validProperties.join(', '));
			}
		})
		.then(() => dao.addPropertyToPlayer(game, target, property.toLowerCase()))
		.then(() => {
			return respondWithTemplate('templates/modSuccess.handlebars', {
				command: 'Set property',
				results: 'Player ' + target + ' is now ' + property,
				game: game
			}, command);
		})
		.catch((err) => reportError(command, 'Error setting player property: ', err));
};

 /**
  * New-day: A mod function that starts a new day
  * Must be used in the game thread.
  *
  * Game rules:
  *  - A game can only advance to day when it is in the night phase
  *  - A game can only be advanced by the mod
  *  - When a new day starts, the vote counts from the previous day are reset
  *  - When a new day starts, the list of players is output for convenience
  *  - When a new day starts, the "to-lynch" count is output for convenience
  *
  * @example !new-day
  *
  * @param  {commands.command} command The command that was passed in.
  * @returns {Promise}        A promise that will resolve when the game is ready
  */
exports.dayHandler = function (command) {
	const game = command.post.topic_id;
	const mod = command.post.username;
	const data = {
		numPlayers: 0,
		toExecute: 0,
		day: 0,
		names: []
	};

	return dao.getGameStatus(game)
		.then((status) => {
			if (status === dao.gameStatus.running) {
				return Promise.resolve();
			}
			return Promise.reject('Game not started. Try `!start`.');
		})
		.then(() => dao.getCurrentTime(game))
		.then((time) => {
			if (time === dao.gameTime.night) {
				return Promise.resolve();
			}
			return Promise.reject('Cannot move to a new day until it is night.');
		})
		.then(() => mustBeTrue(dao.isPlayerMod, [game, mod], 'Poster is not mod'))
		.then(() => dao.incrementDay(game))
		.then(() => dao.getGameById(game))
		.then((gameInstance) => {
			data.day = gameInstance.day;
			const text = 'Incremented day for ' + gameInstance.name;
			internals.browser.createPost(command.post.topic_id, command.post.post_number, text, () => 0);
			return dao.setCurrentTime(game, dao.gameTime.day);
		}).then(() => {
			return Promise.join(
				dao.getNumToLynch(game),
				dao.getLivingPlayers(game),
				readFile(__dirname + '/templates/newDayTemplate.handlebars'),
				(toLynch, livingPlayers, sourceFile) => {
					data.toExecute = toLynch;
					data.numPlayers = livingPlayers.length;
					const source = sourceFile.toString();

					data.names = livingPlayers.map((row) => {
						return row.player.properName;
					});

					const template = Handlebars.compile(source);

					const output = template(data);
					internals.browser.createPost(game, command.post.post_number, output, () => 0);
				}
			);
		})
		.catch((err) => reportError(command, 'Error incrementing day: ', err));
};

 /**
  * Kill: A mod function that modkills or nightkills a player.
  * Must be used in the game thread.
  *
  * Game rules:
  *  - A player can only be killed if they are already in the game.
  *  - A player can only be killed if they are alive.
  *  - A player can only be !killed by the mod.
  *
  * @example !kill playerName
  *
  * @param  {commands.command} command The command that was passed in.
  * @returns {Promise}        A promise that will resolve when the game is ready
  */
exports.killHandler = function (command) {
	const game = command.post.topic_id;
	const mod = command.post.username;
	// The following regex strips a preceding @ and captures up to either the end of input or one of [.!?, ].
	// I need to check the rules for names.  The latter part may work just by using `(\w*)` after the `@?`.
	const target = command.args[0].replace(/^@?(.*?)[.!?, ]?$/, '$1');
	
	return dao.getGameStatus(game)
		.then((status) => {
			if (status === dao.gameStatus.running) {
				return Promise.resolve();
			}
			return Promise.reject('Game not started. Try `!start`.');
		})
		.then(() => mustBeTrue(dao.isPlayerMod, [game, mod], 'Poster is not mod'))
		.then(() => mustBeTrue(dao.isPlayerInGame, [game, target], 'Target not in game'))
		.then(() => mustBeTrue(dao.isPlayerAlive, [game, target], 'Target not alive'))
		.then(() => dao.killPlayer(game, target))
		.then(() => dao.getGameById(game))
		.then(() => {
			return respondWithTemplate('templates/modSuccess.handlebars', {
				command: 'Kill',
				results: 'Killed @' + target,
				game: game
			}, command);
		})
		.catch((err) => reportError(command, 'Error killing player: ', err));
};

 /**
  * End: A mod function that ends the game
  * Must be used in the game thread.
  *
  * Game rules:
  *  - A game can only be ended if it is running
  *  - A game can only be ended by the mod
  *  - When the game ends, surviving players are listed for convenience
  *
  * @example !end
  *
  * @param  {commands.command} command The command that was passed in.
  * @returns {Promise}        A promise that will resolve when the game is ready
  */
exports.finishHandler = function (command) {
	const game = command.post.topic_id;
	const mod = command.post.username;

	return dao.getGameStatus(game)
		.then((status) => {
			if (status === dao.gameStatus.running) {
				return Promise.resolve();
			}
			return Promise.reject('Game not started. Try `!start`.');
		})
		.then(() => mustBeTrue(dao.isPlayerMod, [game, mod], 'Poster is not mod'))
		.then(() => dao.incrementDay(game))
		.then(() => dao.setGameStatus(game, dao.gameStatus.finished))
		.then(() => exports.listAllPlayersHandler(command))
		.then(() => {
			return respondWithTemplate('templates/modSuccess.handlebars', {
				command: 'End game',
				results: 'Game now finished.',
				game: game
			}, command);
		})
		.catch((err) => reportError(command, 'Error finalizing game: ', err));
};

// Player commands

/*Voting helpers*/

function verifyPlayerCanVote(game, voter) {
	return mustBeTrue(dao.isPlayerInGame, [game, voter], 'Voter not in game')
		.then(() => mustBeTrue(dao.isPlayerAlive, [game, voter], 'Voter not alive'))
		.then(() => mustBeTrue(isDaytime, [game], 'It is not day'));
}

function revokeCurrentVote(game, voter, post, type) {
	const promiseArray = [];
	return dao.getCurrentActionByPlayer(game, voter, type).then((votes) => {
		if (!votes) {
			return true;
		}
		for (let i = 0; i < votes.length; i++) {
			promiseArray.push(dao.revokeAction(game, votes[i].post, post));
		}
		
		return Promise.all(promiseArray);
	});
}

function revokeCurrentVoteFor(game, voter, target, post) {
	return dao.getCurrentVoteByPlayer(game, voter).then((votes) => {
		for (let i = 0; i < votes.length; i++) {
			if (votes[i].target.name.toLowerCase() === target.toLowerCase()) {
				return dao.revokeAction(game, votes[i].post, post);
			}
		}
		throw new Error('No such vote was found to revoke');
	});
}

function getVotingErrorText(reason, voter, target) {
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
	return Promise.resolve(text);
}

/**
  * nolynch: Vote to not lynch this day
  * Must be used in the game thread.
  *
  * Game rules:
  *  - A vote can only be registered by a player in the game
  *  - A vote can only be registered by a living player
  *  - If a simple majority of players vote for no lynch:
  *    - The game enters the night phase
  *    - No information is revealed
  *
  * @example !nolynch
  *
  * @param  {commands.command} command The command that was passed in.
  * @returns {Promise}        A promise that will resolve when the game is ready
  */
exports.nolynchHandler = function (command) {
	const game = command.post.topic_id;
	const post = command.post.post_number;
	const voter = command.post.username;
	
	function getVoteAttemptText(success) {
		let text = '@' + command.post.username +  (success ? ' voted for ' : ' tried to vote for ') + 'no-lynch ';

		text = text	+ 'in post #<a href="https://what.thedailywtf.com/t/'
				+ command.post.topic_id + '/' + command.post.post_number + '">'
				+ command.post.post_number + '</a>.\n\n'
				+ 'Vote text:\n[quote]\n' + command.input + '\n[/quote]';
		return text;
	}
	
	/*Validation*/
	return dao.ensureGameExists(game)
		.then( () => dao.getGameStatus(game))
		.then((status) => {
			if (status === dao.gameStatus.running) {
				return Promise.resolve();
			}
			return Promise.reject('Game already ' + status);
		})
		.then(() => verifyPlayerCanVote(game, voter))
		.then(() => revokeCurrentVote(game, voter, post))/* Revoke current vote, now a Controller responsibility */
		.then(() => dao.addActionWithoutTarget(game, post, voter, 'nolynch'))
		.then(() => {
			const text = getVoteAttemptText(true);
			internals.browser.createPost(command.post.topic_id, command.post.post_number, text, () => 0);
			return true;
		})
		.catch((reason) => {
			/*Error handling*/
			return getVotingErrorText(reason, voter)
			.then((text) => {
				text += '\n<hr />\n';
				text += getVoteAttemptText(false);
				internals.browser.createPost(command.post.topic_id, command.post.post_number, text, () => 0);
			});
		});
};

/**
  * unvote: Rescind previous vote without registering a new vote
  * Must be used in the game thread.
  *
  * Game rules:
  *  - An unvote can only occur if a vote has previously occurred
  *
  * @example !unvote
  *
  * @param  {commands.command} command The command that was passed in.
  * @returns {Promise}        A promise that will resolve when the game is ready
  */
exports.unvoteHandler = function (command) {
	const game = command.post.topic_id;
	const post = command.post.post_number;
	const voter = command.post.username;
	let target = undefined;
	
	if (command.args.length > 0) {
		target = command.args[0].replace(/^@?(.*?)[.!?, ]?/, '$1');
	}
	
	function getVoteAttemptText(success) {
		let text = '@' + command.post.username + (success ? ' unvoted ' : ' tried to unvote ');

		text = text	+ 'in post #<a href="https://what.thedailywtf.com/t/'
				+ game + '/' + post + '">'
				+ post + '</a>.\n\n'
				+ 'Vote text:\n[quote]\n' + command.input + '\n[/quote]';
		return text;
	}
	
	/*Validation*/
	return dao.ensureGameExists(game)
		.then( () => dao.getGameStatus(game))
		.then((status) => {
			if (status === dao.gameStatus.running) {
				return Promise.resolve();
			}
			return Promise.reject('Game already ' + status);
		})
		.then(() => verifyPlayerCanVote(game, voter))
		.then(() => {
			if (target) {
				return revokeCurrentVoteFor(game, voter, target, post);
			} else {
				return revokeCurrentVote(game, voter, post);
			}
		})/* Revoke current vote, now a Controller responsibility */
		.then(() => {
			const text = getVoteAttemptText(true);
			internals.browser.createPost(command.post.topic_id, command.post.post_number, text, () => 0);
			return true;
		})
		.catch((reason) => {
			/*Error handling*/
			return getVotingErrorText(reason, voter)
			.then((text) => {
				text += '\n<hr />\n';
				text += getVoteAttemptText(false);
				internals.browser.createPost(command.post.topic_id, command.post.post_number, text, () => 0);
			});
		});
};

/**
  * Vote: Vote to lynch a player
  * Must be used in the game thread. Expects one argument
  *
  * Game rules:
  *  - A vote can only be registered by a player in the game
  *  - A vote can only be registered by a living player
  *  - A vote can only be registered for a player in the game
  *  - A vote cna only be registered for a living player
  *  - If a simple majority of players vote for a single player:
  *    - The game enters the night phase
  *    - That player's information is revealed
  *
  * @example !vote playerName
  * @example !for playerName
  *
  * @param  {commands.command} command The command that was passed in.
  * @returns {Promise}        A promise that will resolve when the game is ready
  */
exports.voteHandler = function (command) {
	const game = command.post.topic_id;
	const post = command.post.post_number;
	const voter = command.post.username;
	// The following regex strips a preceding @ and captures up to either the end of input or one of [.!?, ].
	// I need to check the rules for names.  The latter part may work just by using `(\w*)` after the `@?`.
	const target = command.args[0].replace(/^@?(.*?)[.!?, ]?/, '$1');
	
	return dao.getPlayerProperty(game, voter).then((property) => {
		if (property === dao.playerProperty.doubleVoter) {
			return doVote(game, post, voter, target, command.input, 2);
		} else {
			return doVote(game, post, voter, target, command.input, 1);
		}
	});
};

exports.forHandler = function (command) {
	const game = command.post.topic_id;
	const post = command.post.post_number;
	const voter = command.post.username;
	// The following regex strips a preceding @ and captures up to either the end of input or one of [.!?, ].
	// I need to check the rules for names.  The latter part may work just by using `(\w*)` after the `@?`.
	const target = command.args[0].replace(/^@?(.*?)[.!?, ]?/, '$1');
	
	return dao.getPlayerProperty(game, voter).then((property) => {
		return doVote(game, post, voter, target, command.input, 1);
	});
};

function doVote(game, post, voter, target, input, voteNum) {
	let action;
	if (voteNum === 2) {
		action = dao.action.dblVote;
	} else {
		action = dao.action.vote;
	}
			
	function getVoteAttemptText(success) {
		let text = '@' + voter + (success ? ' voted for ' : ' tried to vote for ') + '@' + target;

		text = text	+ ' in post #<a href="https://what.thedailywtf.com/t/'
				+ game + '/' + post + '">'
				+ post + '</a>.\n\n'
				+ 'Vote text:\n[quote]\n' + input + '\n[/quote]';
		return text;
	}
	
	return dao.ensureGameExists(game) /*Validation*/
		.then( () => dao.getGameStatus(game))
		.then((status) => {
			if (status === dao.gameStatus.running) {
				return Promise.resolve();
			}
			return Promise.reject('Game already ' + status);
		})
		.then(() => verifyPlayerCanVote(game, voter))
		.then(() => {
			return Promise.all([
				mustBeTrue(dao.isPlayerInGame, [game, target], 'Target not in game'),
				mustBeTrue(dao.isPlayerAlive, [game, target], 'Target not alive')
			]);
		})     /* Revoke current vote, now a Controller responsibility */
		.then(() => revokeCurrentVote(game, voter, post, action))  /* Add new vote */
		.then(() => dao.addActionWithTarget(game, post, voter, action, target))
		.then((result) => {
			if (!result) {
				return Promise.reject('Vote failed');
			}
			
			const text = getVoteAttemptText(true);
			internals.browser.createPost(game, post, text, () => 0);
			return true;
		})
		.then(() => dao.getCurrentDay(game))   /*Check for auto-lynch*/
		.then((day) => {
			return Promise.join(
				dao.getNumToLynch(game),
				dao.getNumVotesForPlayer(game, day, target),
				dao.getPlayerProperty(game, target),
				function (numToLynch, numReceived, property) {
					if (property === 'loved') {
						numToLynch += 1;
					}
					if (property === 'hated') {
						numToLynch -= 1;
					}

					if (numToLynch <= numReceived) {
						return lynchPlayer(game, target);
					} else {
						return Promise.resolve();
					}
				}
			);
		})
		.catch((reason) => {
			/*Error handling*/
			return getVotingErrorText(reason, voter, target)
			.then((text) => {
				text += '\n<hr />\n';
				text += getVoteAttemptText(false);
				internals.browser.createPost(game, post, text, () => 0);
			});
		});
};

// Open commands

/**
  * Echo: Echo diagnostic information
  * @example !echo
  *
  * @param  {commands.command} command The command that was passed in.
  * @returns {Promise}        A promise that will resolve when the game is ready
  */
exports.echoHandler = function (command) {
	const text = 'topic: ' + command.post.topic_id + '\n'
		+ 'post: ' + command.post.post_number + '\n'
		+ 'input: `' + command.input + '`\n'
		+ 'command: `' + command.command + '`\n'
		+ 'args: `' + command.args + '`\n'
		+ 'mention: `' + command.mention + '`\n'
		+ 'post:\n[quote]\n' + command.post.cleaned + '\n[/quote]';
	internals.browser.createPost(command.post.topic_id, command.post.post_number, text, () => 0);
	return Promise.resolve();
};

/**
  * Join: Join a game
  * Must be used in the game thread.
  *
  * Game rules:
  *  - A player can only join a game that is in the Prep phase
  *  - A player can only join a game they are not already playing
  *
  * @example !join
  *
  * @param  {commands.command} command The command that was passed in.
  * @returns {Promise}        A promise that will resolve when the game is ready
  */
exports.joinHandler = function (command) {
	const id = command.post.topic_id;
	const post = command.post.post_number;
	const player = command.post.username;
	
	return dao.ensureGameExists(id)
		.then(() => dao.getGameStatus(id))
		.then((status) => {
			if (status === dao.gameStatus.prep) {
				return Promise.resolve();
			}
			return Promise.reject('Cannot join game in progress.');
		})
		.then(() => mustBeFalse(dao.isPlayerInGame, [id, player], 'You are already in this game, @' + player + '!'))
		.then(() => dao.addPlayerToGame(id, player))
		.then(() => internals.browser.createPost(id, post, 'Welcome to the game, @' + player, () => 0))
		.catch((err) => reportError(command, 'Error when adding to game: ', err));
};

/**
  * List-players: List living players in the game
  * Must be used in the game thread.
  *
  * Game rules:
  *  - Only living players are included in this list
  *
  * @example !list-players
  *
  * @param  {commands.command} command The command that was passed in.
  * @returns {Promise}        A promise that will resolve when the game is ready
  */
exports.listPlayersHandler = function (command) {
	const id = command.post.topic_id;

	return dao.ensureGameExists(id)
		.then(() => dao.getAllPlayers(id))
		.then( (rows) => {
			let alive = [];

			rows.forEach((row) => {
				if (row.playerStatus === dao.playerStatus.alive) {
					alive.push(row.player.properName);
				}
			});

			alive = alive.filter((name) => {
				return unvoteNicks.contains(name.toLowerCase()) ? false : true;
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
				output += 'None. Weird.';
			} else {
				internals.configuration.mods.forEach((mod) => {
					output += '- ' + mod + '\n';
				});
			}

			internals.browser.createPost(command.post.topic_id, command.post.post_number, output, () => 0);
			return Promise.resolve();
		}).catch((err) => reportError(command, 'Error resolving list: ', err));
};

/**
  * List-all-players: List all players in the game
  * Must be used in the game thread.
  *
  * Game rules:
  *  - All players are included in this list
  *  - Player status must be indicated
  *
  * @example !list-all-players
  *
  * @param  {commands.command} command The command that was passed in.
  * @returns {Promise}        A promise that will resolve when the game is ready
  */
exports.listAllPlayersHandler = function (command) {
	const id = command.post.topic_id;

	return dao.ensureGameExists(id)
	.then(() => dao.getAllPlayers(id))
	.then( (rows) => {
		let alive = [];
		let dead = [];

		rows.forEach((row) => {
			if (row.playerStatus === dao.playerStatus.alive) {
				alive.push(row.player.properName);
			} else if (row.playerStatus === dao.playerStatus.dead) {
				dead.push(row.player.properName);
			}
		});

		alive = alive.filter((name) => {
			return unvoteNicks.contains(name.toLowerCase()) ? false : true;
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
			output += 'None. Weird.';
		} else {
			internals.configuration.mods.forEach((mod) => {
				output += '- ' + mod + '\n';
			});
		}

		internals.browser.createPost(command.post.topic_id, command.post.post_number, output, () => 0);
		return Promise.resolve();
	}).catch((err) => reportError(command, 'Error resolving list: ', err));
};

/**
  * List-votes: List votes for the current day
  * Must be used in the game thread.
  *
  * Game rules:
  *  - All votes must be included in this list, including rescinded votes
  *  - Rescinded votes must be indicated as such with a strikethrough
  *  - The post in which a vote was registered must be linked
  *  - The post in which a rescinded vote was rescinded must be linked
  *  - Votes must include the name of the voter
  *  - Only votes for the current day number shall be listed
  *
  * @example !list-votes
  *
  * @param  {commands.command} command The command that was passed in.
  * @returns {Promise}        A promise that will resolve when the game is ready
  */
exports.listVotesHandler = function (command) {
	const noLynchDisplayName = 'No lynch';
	const data = {
		day: 0,
		votes: {},
		numNotVoting: 0,
		notVoting: [],
		toExecute: 0
	};
	
	//Sample format:
	data.votes[noLynchDisplayName] =  {
				names: [],
				num: 0,
				target: noLynchDisplayName,
				percent: 0,
				mod: 0
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
		}).then((rows) => {
			rows.forEach((row) => {
				const voter = row.player.properName;
				const votee = (row.action === dao.action.nolynch ? noLynchDisplayName : row.target.properName);

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
					currentlyVoting.push(voter);
				}

				data.votes[votee].names.push({
					voter: voter,
					retracted: !row.isCurrent,
					retractedAt: row.retractedInPost,
					post: row.post,
					game: id
				});
			});
			
			return dao.getLivingPlayers(id);
		}).then((rows) => {
			const players = rows.map((row) => {
				return row.player.properName;
			});
			data.numPlayers = players.length;
			data.notVoting = players.filter((element) => {
				return currentlyVoting.indexOf(element) < 0;
			});
			data.notVoting = shuffle(data.notVoting);
			data.numNotVoting = data.notVoting.length;
			
			//Add modifiers
			const pendingLookups = [];
			let currLookup;
			players.forEach((target) => {
				if (data.votes.hasOwnProperty(target)) {
					currLookup = dao.getPlayerProperty(id, target).then((property) => {
						let mod;
						if (property === dao.playerProperty.loved) {
							mod = dao.lynchModifier.loved;
						} else if (property === dao.playerProperty.hated) {
							mod = dao.lynchModifier.hated;
						} else {
							mod = dao.lynchModifier.vanilla;
						}
						
						data.votes[target].mod = mod;
					});
					pendingLookups.push(currLookup);
				}
			});
						
			return Promise.all(pendingLookups).then(() => readFile(__dirname + '/templates/voteTemplate.handlebars'));
		}).then((buffer) => {
			const source = buffer.toString();
			const template = Handlebars.compile(source);

			const output = template(data);
			internals.browser.createPost(command.post.topic_id, command.post.post_number, output, () => 0);
		});
};

/**
  * List-all-votes: List votes since the beginning of the thread
  * Must be used in the game thread.
  *
  * Game rules:
  *  - All votes must be included in this list, including rescinded votes
  *  - Rescinded votes must be indicated as such with a strikethrough
  *  - The post in which a vote was registered must be linked
  *  - The post in which a rescinded vote was rescinded must be linked
  *  - Votes must include the name of the voter
  *  - Votes must be segregated by day
  *
  * @example !list-all-votes
  *
  * @param  {commands.command} command The command that was passed in.
  * @returns {Promise}        A promise that will resolve when the game is ready
  */
exports.listAllVotesHandler = function (command) {
	return Promise.resolve();
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
	if (plugConfig.players) {
		plugConfig.players.concat(unvoteNicks);
	}
	internals.events = events;
	internals.browser = browser;
	internals.owner = config.core.owner;
	internals.username = config.core.username;
	internals.configuration = config.mergeObjects(true, exports.defaultConfig, plugConfig);
	return dao.createDB(internals.configuration)
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
		.then(() => {
			if (plugConfig.players) {
				return registerPlayers(plugConfig.thread, plugConfig.players);
			} else {
				return Promise.resolve();
			}
		})
		.then(() => {
			if (plugConfig.mods) {
				return registerMods(plugConfig.thread, plugConfig.mods);
			} else {
				return Promise.resolve();
			}
		})
		.then(() => {
			registerCommands(events);
		})
		.catch((err) => {
			console.log('ERROR! ' + err);
		});
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
