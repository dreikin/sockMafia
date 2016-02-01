'use strict';
/*globals describe, it*/

const chai = require('chai'),
	sinon = require('sinon');
	
//promise library plugins
require('sinon-as-promised');
require('chai-as-promised');

chai.should();
const expect = chai.expect;

const mafia = require('../src/mafiabot');
const mafiaDAO = require('../src/dao.js');
const Handlebars = require('handlebars');

const fakeConfig = {
	mergeObjects: sinon.stub().returns({
		db: './mafiadbTesting'
	}),
	core: {
		owner: 'tehNinja',
		username: 'votebot'
	}
};

const browser = {
	createPost: sinon.stub().yields()
};

describe('mafia', () => {

	let sandbox, notificationSpy, commandSpy;
	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		mafia.createDB = sandbox.stub();
		notificationSpy = sinon.spy();
		commandSpy = sinon.spy();
		browser.createPost.reset();
	});
	afterEach(() => {
		sandbox.restore();
	});

	it('should export prepare()', () => {
		expect(mafia.prepare).to.be.a('function');
	});
	it('should export start()', () => {
		expect(mafia.start).to.be.a('function');
	});
	it('should export stop()', () => {
		expect(mafia.stop).to.be.a('function');
	});
	it('should have start() as a stub function', () => {
		expect(mafia.start).to.not.throw();
	});
	it('should have stop() as a stub function', () => {
		expect(mafia.stop).to.not.throw();
	});

	describe('prepare()', () => {
		it('Should register commands', () => {
			const events = {
				onCommand: commandSpy,
				onNotification: notificationSpy
			};
			sandbox.stub(mafiaDAO, 'createDB').resolves();
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();

			mafia.prepare(null, fakeConfig, events, undefined).then(() => {
				commandSpy.calledWith('for').should.be.true;
				commandSpy.calledWith('join').should.be.true;
				commandSpy.calledWith('list-all-players').should.be.true;
				commandSpy.calledWith('list-players').should.be.true;
				commandSpy.calledWith('list-votes').should.be.true;
				commandSpy.calledWith('kill').should.be.true;
				commandSpy.calledWith('new-day').should.be.true;
				commandSpy.calledWith('set').should.be.true;
			});
		});
	});

	describe('echo()', () => {

		it('should echo what is passed in', () => {
			const command = {
				post: {
					'topic_id': 12345,
					'post_number': 98765,
					input: 'this is input',
					command: 'a command',
					args: 'a b c',
					mention: 'mention',
					post: {
						cleaned: 'squeaky!'
					}
				}
			};

			mafia.internals.browser = browser;

			return mafia.echoHandler(command).then( () => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number,
				'topic: ' + command.post.topic_id + '\n' + 'post: ' + command.post.post_number + '\n' + 'input: `' +
				command.input + '`\n' + 'command: `' + command.command + '`\n' + 'args: `' + command.args + '`\n' +
				'mention: `' + command.mention + '`\n' + 'post:\n[quote]\n' + command.post.cleaned +
				'\n[/quote]').should.be.true;
			});
		});
	});

	describe('for()', () => {
		it('should reject votes from non-players', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLunch'],
				input: '!for @noLunch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(false);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('You are not yet a player.');
			});
		});
		
		it('should reject votes for non-players', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLunch'],
				input: '!for @noLunch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').onFirstCall().resolves(true).onSecondCall().resolves(false);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('your princess is in another castle.');
			});
		});
		
		it('should reject votes from the dead', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLunch'],
				input: '!for @noLunch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').onFirstCall().resolves(true).onSecondCall().resolves(false);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('You would be wise to not speak ill of the dead.');
			});
		});

		it('should reject votes for the dead', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLunch'],
				input: '!for @noLunch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(false);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Aaagh! Ghosts!');
			});
		});
		
		it('should reject votes at night', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLunch'],
				input: '!for @noLunch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.night);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('It is not day');
			});
		});
		
		it('should rescind old votes', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLunch'],
				input: '!for @noLunch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves([{
				id: 1,
				name: 'charlie'
			}]);
			sandbox.stub(mafiaDAO, 'revokeAction').resolves();
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');

			return mafia.voteHandler(command).then(() => {
				mafiaDAO.getCurrentActionByPlayer.called.should.be.true;
				mafiaDAO.revokeAction.called.should.be.true;
			});
		});
		
		it('should not revoke nonexistant votes', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLunch'],
				input: '!for @noLunch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);
			sandbox.stub(mafiaDAO, 'revokeAction').resolves();
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');

			return mafia.voteHandler(command).then(() => {
				mafiaDAO.revokeAction.called.should.be.false;
			});
		});
		
		it('should announce voting failures', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLunch'],
				input: '!for @noLunch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(false);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include(':wtf:\nSorry, @tehNinja: your vote failed.  No, I don\'t know why.');
			});
		});
		
		it('should echo your vote when successful', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLunch'],
				input: '!for @noLunch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(100);
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(1);
			sandbox.stub(mafiaDAO, 'getNumVotesForPlayer').resolves(1);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('@tehNinja voted for @noLunch in post ' +
					'#<a href="https://what.thedailywtf.com/t/12345/98765">98765</a>.');
			});
		});
		
		it('should auto-lynch at the threshold', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLunch'],
				input: '!for @noLunch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(3);
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(1);
			sandbox.stub(mafiaDAO, 'getNumVotesForPlayer').resolves(3);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			
			sandbox.stub(mafiaDAO, 'killPlayer').resolves({player: {properName: 'noLunch'}});
			sandbox.stub(mafiaDAO, 'setCurrentTime').resolves();
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				mafiaDAO.killPlayer.called.should.be.true;
				mafiaDAO.setCurrentTime.calledWith(12345, mafiaDAO.gameTime.night).should.be.true;

				const output = browser.createPost.getCall(1).args[2];
				output.should.include('@noLunch has been lynched! Stay tuned for the flip. <b>It is now Night.</b>');
			});
		});
	
		it('should not auto-lynch loved players at the lynch count', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLunch'],
				input: '!for @noLunch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(3);
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(1);
			sandbox.stub(mafiaDAO, 'getNumVotesForPlayer').resolves(3);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('loved');
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			
			sandbox.stub(mafiaDAO, 'killPlayer').resolves({player: {properName: 'noLunch'}});
			sandbox.stub(mafiaDAO, 'setCurrentTime').resolves();
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);


			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				mafiaDAO.killPlayer.called.should.be.false;
			});
		});
		
		it('should auto-lynch at num+1 for loved players', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLunch'],
				input: '!for @noLunch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(3);
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(1);
			sandbox.stub(mafiaDAO, 'getNumVotesForPlayer').resolves(4);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('loved');
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			
			sandbox.stub(mafiaDAO, 'killPlayer').resolves({player: {properName: 'noLunch'}});
			sandbox.stub(mafiaDAO, 'setCurrentTime').resolves();
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);


			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				mafiaDAO.killPlayer.called.should.be.true;
				mafiaDAO.setCurrentTime.calledWith(12345, mafiaDAO.gameTime.night).should.be.true;

				const output = browser.createPost.getCall(1).args[2];
				output.should.include('@noLunch has been lynched! Stay tuned for the flip. <b>It is now Night.</b>');
			});
		});
		
		it('should not auto-lynch vanilla players at the lynch-1', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLunch'],
				input: '!for @noLunch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(3);
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(1);
			sandbox.stub(mafiaDAO, 'getNumVotesForPlayer').resolves(2);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			
			sandbox.stub(mafiaDAO, 'killPlayer').resolves({player: {properName: 'noLunch'}});
			sandbox.stub(mafiaDAO, 'setCurrentTime').resolves();
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);


			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				mafiaDAO.killPlayer.called.should.be.false;
			});
		});
		
		it('should auto-lynch at num+1 for loved players', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLunch'],
				input: '!for @noLunch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(3);
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(1);
			sandbox.stub(mafiaDAO, 'getNumVotesForPlayer').resolves(2);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('hated');
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			
			sandbox.stub(mafiaDAO, 'killPlayer').resolves({player: {properName: 'noLunch'}});
			sandbox.stub(mafiaDAO, 'setCurrentTime').resolves();
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);


			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				mafiaDAO.killPlayer.called.should.be.true;
				mafiaDAO.setCurrentTime.calledWith(12345, mafiaDAO.gameTime.night).should.be.true;

				const output = browser.createPost.getCall(1).args[2];
				output.should.include('@noLunch has been lynched! Stay tuned for the flip. <b>It is now Night.</b>');
			});
		});
	});
	
	describe('for()', () => {
		it('should register a double vote action if you are a doublevoter', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLunch'],
				input: '!for @noLunch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(100);
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(1);
			sandbox.stub(mafiaDAO, 'getNumVotesForPlayer').resolves(1);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('doublevoter');
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);

			return mafia.forHandler(command).then(() => {
				mafiaDAO.addActionWithTarget.calledWith(12345, 98765, 'tehNinja', 'dblVote', 'noLunch');
			});
		});
		
		
		it('should register a single vote action if you are not a doublevoter', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLunch'],
				input: '!for @noLunch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(100);
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(1);
			sandbox.stub(mafiaDAO, 'getNumVotesForPlayer').resolves(1);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);

			return mafia.forHandler(command).then(() => {
				mafiaDAO.addActionWithTarget.calledWith(12345, 98765, 'tehNinja', 'vote', 'noLunch');
			});
		});
	});
	
	describe('unvote()', () => {
		it('should reject unvotes from non-players', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [''],
				input: '!unvote'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(false);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'revokeAction').resolves();

			return mafia.unvoteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('You are not yet a player.');
			});
		});
		
		it('should reject unvotes from the dead', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [],
				input: '!unvote'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(false);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);

			return mafia.unvoteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('You are no longer among the living.');
			});
		});
		
		it('should reject unvotes at night', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [],
				input: '!unvote'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.night);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);

			return mafia.unvoteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('It is not day');
			});
		});
		
		it('should not revoke nonexistant votes', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [],
				input: '!unvote'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves(undefined);
			sandbox.stub(mafiaDAO, 'revokeAction').resolves();
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');

			return mafia.unvoteHandler(command).then(() => {
				mafiaDAO.revokeAction.called.should.be.false;
			});
		});
		
		it('should not revoke nonexistant votes for the wrong player', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['Yamikuronue'],
				input: '!unvote'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentVoteByPlayer').resolves([{
				target: {
					name: 'Jack frost'
				}
			}]);
			sandbox.stub(mafiaDAO, 'revokeAction').resolves();
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');

			return mafia.unvoteHandler(command).then(() => {
				mafiaDAO.revokeAction.called.should.be.false;
			});
		});
		
		it('should rescind your vote', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [],
				input: '!unvote'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves([{
				id: 1,
				post: 98556,
				name: 'charlie'
			}]);
			sandbox.stub(mafiaDAO, 'revokeAction').resolves();
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');

			return mafia.unvoteHandler(command).then(() => {
				mafiaDAO.getCurrentActionByPlayer.called.should.be.true;
				mafiaDAO.revokeAction.called.should.be.true;
				mafiaDAO.revokeAction.getCall(0).args[0].should.equal(12345);
				mafiaDAO.revokeAction.getCall(0).args[1].should.equal(98556);
				mafiaDAO.revokeAction.getCall(0).args[2].should.equal(98765);
				
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('@tehNinja unvoted in post ');
			});
		});
		
		it('should rescind both votes for a doublevoter', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [],
				input: '!unvote'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves([{
				target: {
					name: 'Yamikuronue'
				},
				post: 123
			},
			{
				target: {
					name: 'accalia'
				},
				post: 456
			}]);
			sandbox.stub(mafiaDAO, 'revokeAction').resolves();
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');

			return mafia.unvoteHandler(command).then(() => {
				mafiaDAO.revokeAction.calledWith(12345, 123, 98765).should.be.true;
				mafiaDAO.revokeAction.calledWith(12345, 456, 98765).should.be.true;
			});
		});
		
		it('should rescind your vote', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [],
				input: '!unvote'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves([{
				id: 1,
				post: 98556,
				name: 'charlie'
			}]);
			sandbox.stub(mafiaDAO, 'revokeAction').resolves();
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');

			return mafia.unvoteHandler(command).then(() => {
				mafiaDAO.getCurrentActionByPlayer.called.should.be.true;
				mafiaDAO.revokeAction.called.should.be.true;
				mafiaDAO.revokeAction.getCall(0).args[0].should.equal(12345);
				mafiaDAO.revokeAction.getCall(0).args[1].should.equal(98556);
				mafiaDAO.revokeAction.getCall(0).args[2].should.equal(98765);
				
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('@tehNinja unvoted in post ');
			});
		});
	});
	
	describe('noLynch()', () => {
		it('should reject votes from non-players', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [],
				input: '!unvote'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(false);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentVoteByPlayer').resolves(undefined);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'addActionWithoutTarget').resolves();

			return mafia.nolynchHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('You are not yet a player.');
			});
		});
		
		it('should reject votes from the dead', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [''],
				input: '!unvote'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(false);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithoutTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'getCurrentVoteByPlayer').resolves(undefined);

			return mafia.nolynchHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('You are no longer among the living.');
			});
		});
		
		it('should reject votes at night', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [''],
				input: '!unvote'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.night);
			sandbox.stub(mafiaDAO, 'addActionWithoutTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'getCurrentVoteByPlayer').resolves(undefined);

			return mafia.nolynchHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('It is not day');
			});
		});
		
		it('should not revoke nonexistant votes', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [''],
				input: '!unvote'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithoutTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentVoteByPlayer').resolves(undefined);
			sandbox.stub(mafiaDAO, 'revokeAction').resolves();
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');

			return mafia.nolynchHandler(command).then(() => {
				mafiaDAO.revokeAction.called.should.be.false;
			});
		});
		
		it('should rescind your vote', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [],
				input: '!unvote'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithoutTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves([{
				id: 1,
				name: 'charlie'
			}]);
			sandbox.stub(mafiaDAO, 'revokeAction').resolves();
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');

			return mafia.nolynchHandler(command).then(() => {
				mafiaDAO.getCurrentActionByPlayer.called.should.be.true;
				mafiaDAO.revokeAction.called.should.be.true;
			});
		});
		
		it('should register a vote to no-lynch', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [''],
				input: '!unvote'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addActionWithoutTarget').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentActionByPlayer').resolves({
				id: 1,
				name: 'charlie'
			});
			sandbox.stub(mafiaDAO, 'revokeAction').resolves();
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');

			return mafia.nolynchHandler(command).then(() => {
				mafiaDAO.addActionWithoutTarget.called.should.be.true;
				
				const output = browser.createPost.getCall(0).args[2];
				output.should.include('@tehNinja voted for no-lynch in post ');
			});
		});
	});
	
	describe('join()', () => {
		it('should not allow duplicates', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};

			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.prep);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'addPlayerToGame').resolves();
			mafia.internals.browser = browser;

			return mafia.joinHandler(command).then( () => {
				mafiaDAO.addPlayerToGame.called.should.be.false;
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				
				const output = browser.createPost.getCall(0).args[2];
				output.should.include('You are already in this game, @tehNinja!');
			});
		});

		it('should report errors', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};

			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.prep);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(false);
			sandbox.stub(mafiaDAO, 'addPlayerToGame').rejects('I AM ERROR');
			
			mafia.internals.browser = browser;

			return mafia.joinHandler(command).then( () => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Error when adding to game:');
			});

		});

		it('should not allow joining a game already in progress', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(false);
			sandbox.stub(mafiaDAO, 'addPlayerToGame').resolves();

			mafia.internals.browser = browser;

			return mafia.joinHandler(command).then( () => {
				mafiaDAO.addPlayerToGame.called.should.be.false;
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				
				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Cannot join game in progress.');
			});
		});

		it('should facilitate joining', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.prep);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(false);
			sandbox.stub(mafiaDAO, 'addPlayerToGame').resolves();

			mafia.internals.browser = browser;

			return mafia.joinHandler(command).then( () => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Welcome to the game, @tehNinja');
			});
		});
	});
	

	
	describe('list-all-players()', () => {
		it('should report players', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			
			const players = [
				{player: {'name': 'yamikuronue', properName: 'Yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia', properName: 'accalia'}, 'playerStatus': 'dead'}
			];


			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getAllPlayers').resolves(players);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin']
			};

			return mafia.listAllPlayersHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				
				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Yamikuronue');
				output.should.include('accalia');
				output.should.include('dreikin');
			});
		});
		
		it('should report when no living players exist', () => {
			//TODO: Probably a 'game over' message?
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			
			const players = [
				{player: {'name': 'yamikuronue', properName: 'Yamikuronue'}, 'playerStatus': 'dead'},
				{player: {'name': 'accalia', properName: 'accalia'}, 'playerStatus': 'dead'}
			];


			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getAllPlayers').resolves(players);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin']
			};

			return mafia.listAllPlayersHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				
				const output = browser.createPost.getCall(0).args[2];
				output.should.include('###Living:\nNobody! Aren\'t you special?\n');
			});
		});
		
		it('should report when no dead players exist', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			
			const players = [
				{player: {'name': 'yamikuronue', properName: 'Yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia', properName: 'accalia'}, 'playerStatus': 'alive'}
			];


			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getAllPlayers').resolves(players);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin']
			};

			return mafia.listAllPlayersHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				
				const output = browser.createPost.getCall(0).args[2];
				output.should.include('###Dead:\nNobody! Aren\'t you special?\n');
			});
		});
		
		it('should report when there are no mods', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			
			const players = [
				{player: {'name': 'yamikuronue', properName: 'Yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia', properName: 'accalia'}, 'playerStatus': 'dead'}
			];


			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getAllPlayers').resolves(players);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: []
			};

			return mafia.listAllPlayersHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				
				const output = browser.createPost.getCall(0).args[2];
				output.should.include('###Mod(s):\nNone. Weird.');
			});
		});
	});
	
	describe('list-players()', () => {
		it('should report only living players', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			
			const players = [
				{player: {'name': 'yamikuronue', properName: 'Yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia', properName: 'accalia'}, 'playerStatus': 'dead'}
			];


			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getAllPlayers').resolves(players);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin']
			};

			return mafia.listPlayersHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				
				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Yamikuronue');
				output.should.not.include('accalia');
				output.should.include('dreikin');
			});
		});
		
		it('should report lack of living players', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			
			const players = [
				{player: {'name': 'yamikuronue'}, 'playerStatus': 'dead'},
				{player: {'name': 'accalia'}, 'playerStatus': 'dead'}
			];


			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getAllPlayers').resolves(players);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: []
			};

			return mafia.listPlayersHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				
				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Nobody! Aren\'t you special?\n');
				output.should.not.include('accalia');
				output.should.not.include('yamikuronue');
				output.should.include('None. Weird.');
			});
		});
	});
	
	describe('list-votes()', () => {
		it('should output votes', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			
			const players = [
				{player: {'name': 'yamikuronue', properName: 'Yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia', properName: 'accalia'}, 'playerStatus': 'alive'}
			];

			
			const votes = [
				{
					target: {
						name: 'accalia',
						properName: 'accalia'
					},
					player: {
						name: 'yamikuronue',
						properName: 'Yamikuronue'
					},
					post: 123,
					isCurrent: true,
					retractedInPost: null
				}
			];
			
			
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(42);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(69);
			sandbox.stub(mafiaDAO, 'getAllVotesForDaySorted').resolves(votes);
			sandbox.stub(mafiaDAO, 'getLivingPlayers').resolves(players);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			const fakeTemplate = sandbox.stub().returns('Some string output');
			sandbox.stub(Handlebars, 'compile').returns(fakeTemplate);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin']
			};
			
			return mafia.listVotesHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				
				fakeTemplate.called.should.be.true;
				const dataSent = fakeTemplate.getCall(0).args[0];
				
				dataSent.numPlayers.should.equal(2);
				dataSent.notVoting.should.include('accalia');
				dataSent.notVoting.should.not.include('Yamikuronue');
				dataSent.numNotVoting.should.equal(1);
				dataSent.votes.accalia.names.length.should.equal(1);
				dataSent.votes.accalia.names.should.include({
						voter: 'Yamikuronue',
						retracted: false,
						retractedAt: null,
						post: 123,
						game: 12345
				});
			});
		});
		
		it('should output outdated votes', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			
			const players = [
				{player: {'name': 'yamikuronue', properName: 'Yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia', properName: 'accalia'}, 'playerStatus': 'alive'}
			];

			
			const votes = [
				{
					target: {
						name: 'tehninja',
						properName: 'tehNinja'
					},
					player: {
						name: 'yamikuronue',
						properName: 'Yamikuronue'
					},
					post: 121,
					isCurrent: false,
					retractedInPost: 123
				},
				{
					target: {
						name: 'accalia',
						properName: 'accalia'
					},
					player: {
						name: 'yamikuronue',
						properName: 'Yamikuronue'
					},
					post: 123,
					isCurrent: true,
					retractedInPost: null
				}
			];
			
			
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(42);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(69);
			sandbox.stub(mafiaDAO, 'getAllVotesForDaySorted').resolves(votes);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'getLivingPlayers').resolves(players);
			const fakeTemplate = sandbox.stub().returns('Some string output');
			sandbox.stub(Handlebars, 'compile').returns(fakeTemplate);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin']
			};
			
			return mafia.listVotesHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				
				fakeTemplate.called.should.be.true;
				const dataSent = fakeTemplate.getCall(0).args[0];

				dataSent.votes.accalia.names.length.should.equal(1);
				dataSent.votes.accalia.names.should.include({
						voter: 'Yamikuronue',
						retracted: false,
						retractedAt: null,
						post: 123,
						game: 12345
				});
				dataSent.votes.tehNinja.names.length.should.equal(1);
				dataSent.votes.tehNinja.names.should.include({
						voter: 'Yamikuronue',
						retracted: true,
						retractedAt: 123,
						post: 121,
						game: 12345
				});
			});
		});
		
		it('should not output the unvote hack', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			
			const players = [
				{player: {'name': 'yamikuronue', properName: 'Yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia', properName: 'accalia'}, 'playerStatus': 'alive'}
			];

			
			const votes = [
				{
					target: {
						name: 'tehninja',
						properName: 'tehNinja'
					},
					player: {
						name: 'yamikuronue',
						properName: 'Yamikuronue'
					},
					post: 121,
					isCurrent: false,
					retractedInPost: 122
				},
				{
					target: {
						name: 'unvote',
						properName: 'unvote'
					},
					player: {
						name: 'yamikuronue',
						properName: 'Yamikuronue'
					},
					post: 122,
					isCurrent: false,
					retractedInPost: 123
				},
				{
					target: {
						name: 'accalia',
						properName: 'accalia'
					},
					player: {
						name: 'yamikuronue',
						properName: 'Yamikuronue'
					},
					post: 123,
					isCurrent: true,
					retractedInPost: null
				},
				{
					target: {
						name: 'nolynch',
						properName: 'noLynch'
					},
					player: {
						name: 'accalia',
						properName: 'accalia'
					},
					post: 125,
					isCurrent: true,
					retractedInPost: null
				}
			];
			
			
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(42);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(69);
			sandbox.stub(mafiaDAO, 'getAllVotesForDaySorted').resolves(votes);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			sandbox.stub(mafiaDAO, 'getLivingPlayers').resolves(players);
			const fakeTemplate = sandbox.stub().returns('Some string output');
			sandbox.stub(Handlebars, 'compile').returns(fakeTemplate);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin']
			};
			
			return mafia.listVotesHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				
				fakeTemplate.called.should.be.true;
				const dataSent = fakeTemplate.getCall(0).args[0];

				dataSent.votes.accalia.names.length.should.equal(1);
				dataSent.votes.accalia.names.should.include({
						voter: 'Yamikuronue',
						retracted: false,
						retractedAt: null,
						post: 123,
						game: 12345
				});
				dataSent.votes.tehNinja.names.length.should.equal(1);
				dataSent.votes.tehNinja.names.should.include({
						voter: 'Yamikuronue',
						retracted: true,
						retractedAt: 122,
						post: 121,
						game: 12345
				});
			});
		});
		
		it('should output mod of 0 for vanilla', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			
			const players = [
				{player: {'name': 'yamikuronue', properName: 'Yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia', properName: 'accalia'}, 'playerStatus': 'alive'}
			];

			
			const votes = [
				{
					target: {
						name: 'accalia',
						properName: 'accalia'
					},
					player: {
						name: 'yamikuronue',
						properName: 'Yamikuronue'
					},
					post: 123,
					isCurrent: true,
					retractedInPost: null
				}
			];
			
			
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(42);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(69);
			sandbox.stub(mafiaDAO, 'getAllVotesForDaySorted').resolves(votes);
			sandbox.stub(mafiaDAO, 'getLivingPlayers').resolves(players);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('vanilla');
			const fakeTemplate = sandbox.stub().returns('Some string output');
			sandbox.stub(Handlebars, 'compile').returns(fakeTemplate);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin']
			};
			
			return mafia.listVotesHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				
				fakeTemplate.called.should.be.true;
				const dataSent = fakeTemplate.getCall(0).args[0];
				
				dataSent.votes.accalia.mod.should.equal(0);
			});
		});
		
		it('should output mod of +1 for loved', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			
			const players = [
				{player: {'name': 'yamikuronue', properName: 'Yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia', properName: 'accalia'}, 'playerStatus': 'alive'}
			];

			
			const votes = [
				{
					target: {
						name: 'accalia',
						properName: 'accalia'
					},
					player: {
						name: 'yamikuronue',
						properName: 'Yamikuronue'
					},
					post: 123,
					isCurrent: true,
					retractedInPost: null
				}
			];
			
			
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(42);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(69);
			sandbox.stub(mafiaDAO, 'getAllVotesForDaySorted').resolves(votes);
			sandbox.stub(mafiaDAO, 'getLivingPlayers').resolves(players);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('loved');
			const fakeTemplate = sandbox.stub().returns('Some string output');
			sandbox.stub(Handlebars, 'compile').returns(fakeTemplate);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin']
			};
			
			return mafia.listVotesHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				
				fakeTemplate.called.should.be.true;
				const dataSent = fakeTemplate.getCall(0).args[0];
				
				dataSent.votes.accalia.mod.should.equal(1);
			});
		});
		
		it('should output mod of -1 for hated', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			
			const players = [
				{player: {'name': 'yamikuronue', properName: 'Yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia', properName: 'accalia'}, 'playerStatus': 'alive'}
			];

			
			const votes = [
				{
					target: {
						name: 'accalia',
						properName: 'accalia'
					},
					player: {
						name: 'yamikuronue',
						properName: 'Yamikuronue'
					},
					post: 123,
					isCurrent: true,
					retractedInPost: null
				}
			];
			
			
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(42);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(69);
			sandbox.stub(mafiaDAO, 'getAllVotesForDaySorted').resolves(votes);
			sandbox.stub(mafiaDAO, 'getLivingPlayers').resolves(players);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('hated');
			const fakeTemplate = sandbox.stub().returns('Some string output');
			sandbox.stub(Handlebars, 'compile').returns(fakeTemplate);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin']
			};
			
			return mafia.listVotesHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				
				fakeTemplate.called.should.be.true;
				const dataSent = fakeTemplate.getCall(0).args[0];
				
				dataSent.votes.accalia.mod.should.equal(-1);
			});
		});
		
		it('should always output nolynch', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			
			const players = [
				{player: {'name': 'yamikuronue', properName: 'Yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia', properName: 'accalia'}, 'playerStatus': 'alive'}
			];

			
			const votes = [
				{
					target: {
						name: 'accalia',
						properName: 'accalia'
					},
					player: {
						name: 'yamikuronue',
						properName: 'Yamikuronue'
					},
					post: 123,
					isCurrent: true,
					retractedInPost: null
				}
			];
			
			
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(42);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(69);
			sandbox.stub(mafiaDAO, 'getAllVotesForDaySorted').resolves(votes);
			sandbox.stub(mafiaDAO, 'getLivingPlayers').resolves(players);
			sandbox.stub(mafiaDAO, 'getPlayerProperty').resolves('hated');
			const fakeTemplate = sandbox.stub().returns('Some string output');
			sandbox.stub(Handlebars, 'compile').returns(fakeTemplate);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin']
			};
			
			return mafia.listVotesHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				
				fakeTemplate.called.should.be.true;
				const dataSent = fakeTemplate.getCall(0).args[0];
				
				dataSent.votes['No lynch'].mod.should.equal(0);
				dataSent.votes['No lynch'].num.should.equal(0);
			});
		});
	});
	
	describe('kill()', () => {
		it('Should reject non-mods', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [
					'yamikuronue'
				]
			};

			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerMod').resolves(false);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'killPlayer').resolves();
			sandbox.stub(mafiaDAO, 'getGameById').resolves({
				name: 'testMafia'
			});
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin'],
				name: 'testMafia'
			};
			
			return mafia.killHandler(command).then( () => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Error killing player: Poster is not mod');
			});
		});
		
		it('Should not kill dead players', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [
					'accalia'
				]
			};

			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerMod').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(false);
			sandbox.stub(mafiaDAO, 'killPlayer').resolves();
			sandbox.stub(mafiaDAO, 'getGameById').resolves({
				name: 'testMafia'
			});
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin'],
				name: 'testMafia'
			};
			
			return mafia.killHandler(command).then( () => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				mafiaDAO.killPlayer.called.should.be.false;
				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Error killing player: Target not alive');
			});
		});
		
		it('Should not kill players not in the game', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [
					'RaceProUK'
				]
			};

			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerMod').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(false);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'killPlayer').resolves();
			sandbox.stub(mafiaDAO, 'getGameById').resolves({
				name: 'testMafia'
			});
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin'],
				name: 'testMafia'
			};
			
			return mafia.killHandler(command).then( () => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				mafiaDAO.killPlayer.called.should.be.false;
				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Error killing player: Target not in game');
			});
		});
		
		it('Should report errors', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [
					'yamikuronue'
				]
			};

			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerMod').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'killPlayer').rejects('an error occurred');
			sandbox.stub(mafiaDAO, 'getGameById').resolves({
				name: 'testMafia'
			});
			
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin'],
				name: 'testMafia'
			};
			
			return mafia.killHandler(command).then( () => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				mafiaDAO.killPlayer.called.should.be.true;
				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Error killing player: Error: an error occurred');
			});
		});
		
		it('Should kill players', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [
					'yamikuronue'
				]
			};

			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerMod').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'killPlayer').resolves();
			sandbox.stub(mafiaDAO, 'getGameById').resolves({
				name: 'testMafia'
			});
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin'],
				name: 'testMafia'
			};
			
			return mafia.killHandler(command).then( () => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				mafiaDAO.killPlayer.called.should.be.true;
				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Command Kill executed successfully in game 12345: Killed @yamikuronue');
			});
		});
	});
	
	describe('new-day()', () => {
		it('Should reject non-mods', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			const players = [
				{player: {'name': 'yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia'}, 'playerStatus': 'alive'}
			];


			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.night);
			sandbox.stub(mafiaDAO, 'getGameId').resolves(1);
			sandbox.stub(mafiaDAO, 'isPlayerMod').resolves(false);
			sandbox.stub(mafiaDAO, 'incrementDay').resolves(2);
			sandbox.stub(mafiaDAO, 'setCurrentTime').resolves();
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(54);
			sandbox.stub(mafiaDAO, 'getLivingPlayers').resolves(players);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin'],
				name: 'testMafia'
			};
			
			return mafia.dayHandler(command).then( () => {
				//Game actions
				mafiaDAO.incrementDay.called.should.not.be.true;
				mafiaDAO.setCurrentTime.called.should.not.be.true;
				
				//Output back to mod
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				const modOutput = browser.createPost.getCall(0).args[2];
				modOutput.should.include('Error incrementing day: Poster is not mod');
				
				//Output to game
				browser.createPost.calledWith(1, command.post.post_number).should.not.be.true;

			});
		});
		
		it('Should reject non-existant game', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			const players = [
				{player: {'name': 'yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia'}, 'playerStatus': 'alive'}
			];


			sandbox.stub(mafiaDAO, 'getGameStatus').rejects('Game does not exist');
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.night);
			sandbox.stub(mafiaDAO, 'getGameId').rejects('No such game');
			sandbox.stub(mafiaDAO, 'isPlayerMod').resolves(true);
			sandbox.stub(mafiaDAO, 'incrementDay').resolves(2);
			sandbox.stub(mafiaDAO, 'setCurrentTime').resolves();
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(54);
			sandbox.stub(mafiaDAO, 'getLivingPlayers').resolves(players);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin'],
				name: 'testMafia'
			};
			
			return mafia.dayHandler(command).then( () => {
				//Game actions
				mafiaDAO.incrementDay.called.should.not.be.true;
				mafiaDAO.setCurrentTime.called.should.not.be.true;
				
				//Output back to mod
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				const modOutput = browser.createPost.getCall(0).args[2];
				modOutput.should.include('Error incrementing day: Error: Game does not exist');
				
				//Output to game
				browser.createPost.calledWith(1, command.post.post_number).should.not.be.true;

			});
		});

		it('Should reject non-nighttime', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			const players = [
				{player: {'name': 'yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia'}, 'playerStatus': 'alive'}
			];


			sandbox.stub(mafiaDAO, 'getGameStatus').rejects('Game does not exist');
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'getGameId').rejects('No such game');
			sandbox.stub(mafiaDAO, 'isPlayerMod').resolves(true);
			sandbox.stub(mafiaDAO, 'incrementDay').resolves(2);
			sandbox.stub(mafiaDAO, 'setCurrentTime').resolves();
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(54);
			sandbox.stub(mafiaDAO, 'getLivingPlayers').resolves(players);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin'],
				name: 'testMafia'
			};
			
			return mafia.dayHandler(command).then( () => {
				//Game actions
				mafiaDAO.incrementDay.called.should.not.be.true;
				mafiaDAO.setCurrentTime.called.should.not.be.true;
				
				//Output back to mod
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				const modOutput = browser.createPost.getCall(0).args[2];
				modOutput.should.include('Error incrementing day: Error: Game does not exist');
				
				//Output to game
				browser.createPost.calledWith(1, command.post.post_number).should.not.be.true;

			});
		});
		
		it('Should move the day along', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			const players = [
				{player: {'name': 'yamikuronue', properName: 'yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia', properName: 'accalia'}, 'playerStatus': 'alive'}
			];

			const game = {
				day: 2,
				name: 'testMafia'
			};


			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.night);
			sandbox.stub(mafiaDAO, 'getGameById').resolves(game);
			sandbox.stub(mafiaDAO, 'isPlayerMod').resolves(true);
			sandbox.stub(mafiaDAO, 'incrementDay').resolves(2);
			sandbox.stub(mafiaDAO, 'setCurrentTime').resolves();
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(54);
			sandbox.stub(mafiaDAO, 'getLivingPlayers').resolves(players);
			const fakeTemplate = sandbox.stub().returns('Some string output');
			sandbox.stub(Handlebars, 'compile').returns(fakeTemplate);
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin'],
				name: 'testMafia'
			};
			
			return mafia.dayHandler(command).then( () => {
				//Actions
				mafiaDAO.incrementDay.called.should.be.true;
				mafiaDAO.setCurrentTime.called.should.be.true;
				
				//Output back to mod
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				const modOutput = browser.createPost.getCall(0).args[2];
				modOutput.should.include('Incremented day for testMafia');
				
				//Output to game
				browser.createPost.calledWith(12345, command.post.post_number).should.be.true;
				browser.createPost.getCall(1).args[2].should.include('Some string output');
				
				fakeTemplate.called.should.be.true;
				const gameOutputData = fakeTemplate.getCall(0).args[0];
				gameOutputData.toExecute.should.equal(54);
				gameOutputData.numPlayers.should.equal(2);
				gameOutputData.names.should.include('accalia');
				gameOutputData.names.should.include('yamikuronue');
				gameOutputData.names.length.should.equal(2);
			});
		});
	});
	
	describe('set()', () => {
		it('Should reject non-mods', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [
					'yamikuronue',
					'loved'
				]
			};

			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerMod').resolves(false);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'addPropertyToPlayer').resolves();
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin'],
				name: 'testMafia'
			};
			
			return mafia.setHandler(command).then( () => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Error setting player property: Poster is not mod');
			});
		});

		it('Should reject non-players', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [
					'yamikuronue',
					'loved'
				]
			};

			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerMod').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(false);
			sandbox.stub(mafiaDAO, 'addPropertyToPlayer').resolves();
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin'],
				name: 'testMafia'
			};
			
			return mafia.setHandler(command).then( () => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Error setting player property: Target not valid');
			});
		});
		
		it('Should allow loved', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [
					'yamikuronue',
					'loved'
				]
			};

			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerMod').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'addPropertyToPlayer').resolves();
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin'],
				name: 'testMafia'
			};
			
			return mafia.setHandler(command).then( () => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Player yamikuronue is now loved');
			});
		});
		
		it('Should allow hated', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [
					'yamikuronue',
					'hated'
				]
			};

			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerMod').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'addPropertyToPlayer').resolves();
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin'],
				name: 'testMafia'
			};
			
			return mafia.setHandler(command).then( () => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Player yamikuronue is now hated');
			});
		});
		
		it('Should allow doublevoter', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [
					'yamikuronue',
					'doublevoter'
				]
			};

			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerMod').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'addPropertyToPlayer').resolves();
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin'],
				name: 'testMafia'
			};
			
			return mafia.setHandler(command).then( () => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Player yamikuronue is now doublevoter');
			});
		});
		
		it('Should reject doodoohead', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [
					'yamikuronue',
					'doodoohead'
				]
			};

			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerMod').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'addPropertyToPlayer').resolves();
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin'],
				name: 'testMafia'
			};
			
			return mafia.setHandler(command).then( () => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Error setting player property: Property not valid');
				output.should.include('Valid properties: loved, hated, doublevote');
			});
		});
		
		it('Should report errors from the DAO', () => {
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: [
					'yamikuronue',
					'doublevoter'
				]
			};

			sandbox.stub(mafiaDAO, 'getGameStatus').resolves(mafiaDAO.gameStatus.running);
			sandbox.stub(mafiaDAO, 'isPlayerMod').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'addPropertyToPlayer').rejects('Error in DAO');
			
			mafia.internals.browser = browser;
			mafia.internals.configuration = {
				mods: ['dreikin'],
				name: 'testMafia'
			};
			
			return mafia.setHandler(command).then( () => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Error setting player property');
				output.should.include('Error in DAO');
			});
		});
	});
});
