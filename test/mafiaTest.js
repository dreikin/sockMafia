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

const fakeConfig = {
	mergeObjects: sinon.stub().returns({
		db: './mafiadbTesting'
	})
};

describe('mafia', () => {

	let sandbox, notificationSpy, commandSpy;
	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		mafia.createDB = sandbox.stub();
		notificationSpy = sinon.spy();
		commandSpy = sinon.spy();
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
		it('should register notification listener for `mentioned`', () => {
			const events = {
				onCommand: commandSpy,
				onNotification: notificationSpy
			};
			mafia.prepare(null, fakeConfig, events, undefined);
			notificationSpy.calledWith('mentioned', mafia.mentionHandler).should.be.true;
		});
	});

	describe('echo()', () => {
		it('should be a registered command', () => {
			const events = {
				onCommand: commandSpy,
				onNotification: notificationSpy
			};
			mafia.prepare(null, fakeConfig, events, undefined);
			commandSpy.calledWith('echo').should.be.true;
		});

		it('should echo what is passed in', () => {
			const browser = {
				createPost: sinon.spy()
			};
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

			mafia.echoHandler(command);
			browser.createPost.calledWith(command.post.topic_id, command.post.post_number,
				'topic: ' + command.post.topic_id + '\n' + 'post: ' + command.post.post_number + '\n' + 'input: `' +
				command.input + '`\n' + 'command: `' + command.command + '`\n' + 'args: `' + command.args + '`\n' +
				'mention: `' + command.mention + '`\n' + 'post:\n[quote]\n' + command.post.cleaned +
				'\n[/quote]').should.be.true;
		});
	});

	describe('for()', () => {
		it('should be a registered command', () => {
			const events = {
				onCommand: commandSpy,
				onNotification: notificationSpy
			};
			mafia.prepare(null, fakeConfig, events, undefined);
			commandSpy.calledWith('for').should.be.true;
		});

		it('should echo your vote', () => {
			const browser = {
				createPost: sinon.spy()
			};
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

			mafia.voteHandler(command);
			browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

			const output = browser.createPost.getCall(0).args[2];
			output.should.include('@tehNinja voted for @noLunch in post ' +
				'#<a href="https://what.thedailywtf.com/t/12345/98765">98765</a>.');
		});
	});

	describe('join()', () => {
		it('should be a registered command', () => {
			const events = {
				onCommand: commandSpy,
				onNotification: notificationSpy
			};
			mafia.prepare(null, fakeConfig, events, undefined);
			commandSpy.calledWith('join').should.be.true;
		});

		it('should not allow duplicates', () => {
			const browser = {
				createPost: sinon.stub()
			};
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};

			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
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
			const browser = {
				createPost: sinon.stub()
			};
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};

			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(false);
			sandbox.stub(mafiaDAO, 'addPlayerToGame').rejects('I AM ERROR');
			
			mafia.internals.browser = browser;

			return mafia.joinHandler(command).then( () => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Error when adding to game:');
			});

		});

		it('should facilitate joining', () => {
			const browser = {
				createPost: sinon.stub()
			};
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
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
		it('should be a registered command', () => {
			const events = {
				onCommand: commandSpy,
				onNotification: notificationSpy
			};
			mafia.prepare(null, fakeConfig, events, undefined);
			commandSpy.calledWith('list-all-players').should.be.true;
		});
		
		it('should report players', () => {
			const browser = {
				createPost: sinon.stub()
			};
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				}
			};
			
			const players = [
				{'name': 'yamikuronue', 'status': 'alive'},
				{'name': 'accalia', 'status': 'dead'}
			];


			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getPlayers').resolves(players);
			
			mafia.internals.browser = browser;

			return mafia.listAllPlayersHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				
				const output = browser.createPost.getCall(0).args[2];
				output.should.include('yamikuronue');
				output.should.include('accalia');
			});
		});
	});
});
