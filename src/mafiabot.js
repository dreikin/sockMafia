'use strict';
/**
 * Mafiabot plugin
 *
 * Watches for @vote mentions and replies with a canned response
 *
 * @module mafiabot
 * @author Accalia, Dreikin
 * @license MIT
 */

const dao = require('./dao.js');

const internals = {
	browser: null,
	configuration: exports.defaultConfig,
	timeouts: {},
	interval: null,
	events: null
};
exports.internals = internals;

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
	db: './mafiadb'
};

/**
 * Respond to @mentions
 *
 * @param {external.notifications.Notification} _ Notification recieved (ignored)
 * @param {external.topics.Topic} topic Topic trigger post belongs to
 * @param {external.posts.CleanedPost} post Post that triggered notification
 */
exports.mentionHandler = function mentionHandler(_, topic, post) {
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

exports.echoHandler = function echoHandler(command) {
	const text = 'topic: ' + command.post.topic_id + '\n'
			   + 'post: ' + command.post.post_number + '\n'
			   + 'input: `' + command.input + '`\n'
			   + 'command: `' + command.command + '`\n'
			   + 'args: `' + command.args + '`\n'
			   + 'mention: `' + command.mention + '`\n'
			   + 'post:\n[quote]\n' + command.post.cleaned + '\n[/quote]';
	internals.browser.createPost(command.post.topic_id, command.post.post_number, text, () => 0);
};

exports.voteHandler = function voteHandler(command) {
	const game = command.post.topic_id;
	const post = command.post.post_number;
	const voter = command.post.username.toLowerCase();
	const target = command.args[0].toLowerCase().replace(/^@?(.*)/, '$1');

	return dao.ensureGameExists(game)
		.then(() => dao.isPlayerInGame(game, voter))
		.then((inGame) => {
			if (!inGame) {return Promise.reject("Voter not in game");}
			return dao.isPlayerAlive(game, voter);
		})
		.then((isAlive) => {
			if (!isAlive) {return Promise.reject("Voter not alive");}
			return dao.isPlayerInGame(game, target);
		})
		.then((inGame) => {
			if (!inGame) {return Promise.reject("Target not in game");}
			return dao.isPlayerAlive(game, target);
		})
		.then((isAlive) => {
			if (!isAlive) {return Promise.reject("Target not alive");}
			return dao.addVote(game, post, voter, target);
		})
		.then((result) => {
			if (!result) {return Promise.reject("Vote failed");}
			let text = '@' + command.post.username + ' voted for @' + command.args[0]
				+ ' in post #<a href="https://what.thedailywtf.com/t/'
				+ command.post.topic_id + '/' + command.post.post_number + '">'
				+ command.post.post_number + '</a>.\n\n'
				+ 'Vote text:\n[quote]\n' + command.input + '\n[/quote]';
			internals.browser.createPost(command.post.topic_id, command.post.post_number, text, () => 0);
			return Promise.resolve();
		})
		.catch((reason) => {
			let text;

			if (reason == "Voter not in game") {
				text = '@' + voter + ': You are not yet a player.\n'
					+ 'Please use `@' + internals.configuration.username + ' join` to join the game.';
			}
			else if (reason == "Voter not alive") {
				text = 'Aaagh! Ghosts!\n'
					+ '(@' + voter + ': You are no longer among the living.)'
			}
			else if (reason == "Target not in game") {
				text = 'Who? I\'m sorry, @' + voter + ' but your princess is in another castle.\n'
					+ '(' + target + ' is not in this game.)';
			}
			else if (reason == "Target not alive") {
				text = '@' + voter + ": You would be wise to not speak ill of the dead.";
			}
			else if (reason == "Vote failed") {
				text = ':wtf:\nSorry, @' + voter + ': your vote failed.  No, I don\'t know why.'
					+ ' You\'ll have to ask @' + internals.configuration.owner + ' about that.';
			}

			text += '\n<hr />\n';
			text += '@' + command.post.username + ' tried to vote for ' + command.args[0]
				+ ' in post #<a href="https://what.thedailywtf.com/t/'
				+ command.post.topic_id + '/' + command.post.post_number + '">'
				+ command.post.post_number + '</a>.\n\n'
				+ 'Vote text:\n[quote="'
				+ command.post.username + ', post:' + command.post.post_number + ', topic:' + command.post.topic_id +'"]\n'
				+ command.input + '\n[/quote]';
			internals.browser.createPost(command.post.topic_id, command.post.post_number, text, () => 0);
			return Promise.resolve();
		});
};

exports.joinHandler = function joinHandler(command) {
	const id = command.post.topic_id;
	const player = command.post.username;
	
	const reportError = (error) => {
		internals.browser.createPost(command.post.topic_id,
									 command.post.post_number,
									 'Error when adding to game: ' + error, () => 0);
	};
	
	return dao.ensureGameExists(id)
	.then(() => dao.isPlayerInGame(id, player.toLowerCase()))
	.then((answer) => {
		if (answer) {
			reportError('You are already in this game, @' + player + '!');
			return Promise.resolve();
		} else {
			return dao.addPlayerToGame(id, player.toLowerCase()).then(() => {
				internals.browser.createPost(command.post.topic_id,
											 command.post.post_number,
											 'Welcome to the game, @' + player, () => 0);
			});
		}
	})
	.catch((err) => {
		reportError(err);
	});
};

exports.killHandler = function killHandler(command) {};
exports.dayHandler = function dayHandler(command) {};
exports.listVotesHandler = function listVotesHandler(command) {};
exports.listAllVotesHandler = function listAllVotesHandler(command) {};

exports.listPlayersHandler = function listPlayersHandler(command) {
	const id = command.post.topic_id;
	const reportError = (error) => {
		internals.browser.createPost(command.post.topic_id,
			command.post.post_number,
			'Error resolving list: ' + error, () => 0);
	};
	return dao.ensureGameExists(id)
		.then(() => dao.getPlayers(id))
		.then( (rows) => {
			const alive = [];

			rows.forEach((row) => {
				if (row.player_status === 'alive') {
					alive.push(row.player.name);
				}
			});

			const numLiving = alive.length;

			let output = '##Player List\n';
			output += '###Living:\n';
			if (numLiving <= 0) {
				output += 'Nobody! Aren\'t you special?\n';
			} else {
				for (let i = 0; i < numLiving; i++) {
					output += '- ' + alive[i] + '\n';
				}
			}

			internals.browser.createPost(command.post.topic_id, command.post.post_number, output, () => 0);
			return Promise.resolve();
		}).catch((err) => {
			reportError(err);
		});
};

exports.listAllPlayersHandler = function listAllPlayersHandler(command) {
	const id = command.post.topic_id;
	const reportError = (error) => {
		internals.browser.createPost(command.post.topic_id,
									 command.post.post_number,
									 'Error resolving list: ' + error, () => 0);
	};
	return dao.ensureGameExists(id)
	.then(() => dao.getPlayers(id))
	.then( (rows) => {
		const alive = [];
		const dead = [];

		rows.forEach((row) => {
			if (row.player_status === 'alive') {
				alive.push(row.player.name);
			} else if (row.player_status === 'dead') {
				dead.push(row.player.name);
			}
		});

		const numLiving = alive.length;
		const numDead = dead.length;

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

		internals.browser.createPost(command.post.topic_id, command.post.post_number, output, () => 0);
		return Promise.resolve();
	}).catch((err) => {
		reportError(err);
	});
};

function registerCommands(events) {
	events.onCommand('echo', 'echo a bunch of post info (for diagnostic purposes)', exports.echoHandler, () => 0);
	events.onCommand('for', 'vote for a player to be executed', exports.voteHandler, () => 0);
	events.onCommand('join', 'join current mafia game', exports.joinHandler, () => 0);
	events.onCommand('kill', 'kill a player (mod only)', exports.killHandler, () => 0);
	events.onCommand('list-all-players', 'list all players, dead and alive', exports.listAllPlayersHandler, () => 0);
	events.onCommand('list-all-votes', 'list all votes from the game\'s start', exports.listAllVotesHandler, () => 0);
	events.onCommand('list-players', 'list all players still alive', exports.listPlayersHandler, () => 0);
	events.onCommand('list-votes', 'list all votes from the day\'s start', exports.listVotesHandler, () => 0);
	events.onCommand('new-day', 'move on to a new day (mod only)', exports.dayHandler, () => 0);
	events.onCommand('vote', 'vote for a player to be executed (alt. form)', exports.voteHandler, () => 0);
}

/**
 * Prepare Plugin prior to login
 *
 * @param {*} plugConfig Plugin specific configuration
 * @param {Config} config Overall Bot Configuration
 * @param {externals.events.SockEvents} events EventEmitter used for the bot
 * @param {Browser} browser Web browser for communicating with discourse
 */
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
	dao.createDB(internals.configuration);
	events.onNotification('mentioned', exports.mentionHandler);
	registerCommands(events);
};

/**
 * Start the plugin after login
 */
exports.start = function start() {};

/**
 * Stop the plugin prior to exit or reload
 */
exports.stop = function stop() {};
