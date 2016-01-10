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
			sandbox.stub(mafiaDAO, 'createDB').resolves();
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			
			mafia.prepare(null, fakeConfig, events, undefined);
			notificationSpy.calledWith('mentioned', mafia.mentionHandler).should.be.true;
		});
		
		it('Should register commands', () => {
			const events = {
				onCommand: commandSpy,
				onNotification: notificationSpy
			};
			sandbox.stub(mafiaDAO, 'createDB').resolves();
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			
			mafia.prepare(null, fakeConfig, events, undefined);
			commandSpy.calledWith('echo').should.be.true;
			commandSpy.calledWith('for').should.be.true;
			commandSpy.calledWith('join').should.be.true;
			commandSpy.calledWith('list-all-players').should.be.true;
		});
	});

	describe('echo()', () => {

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
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(false);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addVote').resolves(true);

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('You are not yet a player.');
			});
		});
		
		it('should reject votes for non-players', () => {
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
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'isPlayerInGame').onFirstCall().resolves(true).onSecondCall().resolves(false);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addVote').resolves(true);

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('your princess is in another castle.');
			});
		});
		
		it('should reject votes from the dead', () => {
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
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').onFirstCall().resolves(true).onSecondCall().resolves(false);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addVote').resolves(true);

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('You would be wise to not speak ill of the dead.');
			});
		});

		it('should reject votes for the dead', () => {
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
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(false);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addVote').resolves(true);

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('Aaagh! Ghosts!');
			});
		});
		
		it('should reject votes at night', () => {
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
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.night);
			sandbox.stub(mafiaDAO, 'addVote').resolves(true);

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('It is not day');
			});
		});

		it('should announce voting failures', () => {
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
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'addVote').resolves(false);

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include(':wtf:\nSorry, @tehNinja: your vote failed.  No, I don\'t know why.');
			});
		});
		
		it('should echo when you rescind your vote', () => {
			const browser = {
				createPost: sinon.spy()
			};
			const command = {
				post: {
					username: 'tehNinja',
					'topic_id': 12345,
					'post_number': 98765
				},
				args: ['@noLynch'],
				input: '!for @noLynch'
			};

			mafia.internals.browser = browser;
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(100);
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(1);
			sandbox.stub(mafiaDAO, 'getNumVotesForPlayer').resolves(1);
			sandbox.stub(mafiaDAO, 'addVote').resolves(true);

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('@tehNinja rescinded their vote in post ' +
					'#<a href="https://what.thedailywtf.com/t/12345/98765">98765</a>.');
			});
		});
		
		it('should echo your vote when successful', () => {
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
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(100);
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(1);
			sandbox.stub(mafiaDAO, 'getNumVotesForPlayer').resolves(1);
			sandbox.stub(mafiaDAO, 'addVote').resolves(true);

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;

				const output = browser.createPost.getCall(0).args[2];
				output.should.include('@tehNinja voted for @noLunch in post ' +
					'#<a href="https://what.thedailywtf.com/t/12345/98765">98765</a>.');
			});
		});
		
		it('should auto-lynch at the threshold', () => {
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
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'isPlayerInGame').resolves(true);
			sandbox.stub(mafiaDAO, 'isPlayerAlive').resolves(true);
			sandbox.stub(mafiaDAO, 'getCurrentTime').resolves(mafiaDAO.gameTime.day);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(3);
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(1);
			sandbox.stub(mafiaDAO, 'getNumVotesForPlayer').resolves(4);
			sandbox.stub(mafiaDAO, 'addVote').resolves(true);
			
			sandbox.stub(mafiaDAO, 'killPlayer').resolves();
			sandbox.stub(mafiaDAO, 'setCurrentTime').resolves();

			return mafia.voteHandler(command).then(() => {
				browser.createPost.calledWith(command.post.topic_id, command.post.post_number).should.be.true;
				mafiaDAO.killPlayer.called.should.be.true;
				mafiaDAO.setCurrentTime.calledWith(12345, mafiaDAO.gameTime.night).should.be.true;

				const output = browser.createPost.getCall(1).args[2];
				output.should.include('@noLunch has been lynched! Stay tuned for the flip. <b>It is now Night</b>');
			});
		});

	});

	describe('join()', () => {
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
				{player: {'name': 'yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia'}, 'playerStatus': 'dead'}
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
				output.should.include('yamikuronue');
				output.should.include('accalia');
				output.should.include('dreikin');
			});
		});
		
		it('should report when no living players exist', () => {
			//TODO: Probably a 'game over' message?
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
				{player: {'name': 'yamikuronue'}, 'playerStatus': 'dead'},
				{player: {'name': 'accalia'}, 'playerStatus': 'dead'}
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
				{player: {'name': 'yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia'}, 'playerStatus': 'alive'}
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
				{player: {'name': 'yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia'}, 'playerStatus': 'dead'}
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
				{player: {'name': 'yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia'}, 'playerStatus': 'dead'}
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
				output.should.include('yamikuronue');
				output.should.not.include('accalia');
				output.should.include('dreikin');
			});
		});
		
		it('should report lack of living players', () => {
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
				{player: {'name': 'yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia'}, 'playerStatus': 'alive'}
			];

			
			const votes = {
				old: [], 
				current: [
					{
						target: {
							name: 'accalia'
						},
						voter: {
							name: 'yamikuronue'
						},
						post: 123
					}
				]
			};
			
			
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(42);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(69);
			sandbox.stub(mafiaDAO, 'getAllVotesForDaySorted').resolves(votes);
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
				
				dataSent.numPlayers.should.equal(2);
				dataSent.notVoting.should.include('accalia');
				dataSent.notVoting.should.not.include('yamikuronue');
				dataSent.numNotVoting.should.equal(1);
				dataSent.votes.accalia.names.length.should.equal(1);
				dataSent.votes.accalia.names.should.include({
						voter: 'yamikuronue',
						retracted: false,
						post: 123,
						game: 12345
				});
			});
		});
		
		it('should output outdated votes', () => {
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
				{player: {'name': 'yamikuronue'}, 'playerStatus': 'alive'},
				{player: {'name': 'accalia'}, 'playerStatus': 'alive'}
			];

			
			const votes = {
				old: [
					{
						target: {
							name: 'tehNinja'
						},
						voter: {
							name: 'yamikuronue'
						},
						post: 121
					}
				], 
				current: [
					{
						target: {
							name: 'accalia'
						},
						voter: {
							name: 'yamikuronue'
						},
						post: 123
					}
				]
			};
			
			
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(42);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(69);
			sandbox.stub(mafiaDAO, 'getAllVotesForDaySorted').resolves(votes);
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
						voter: 'yamikuronue',
						retracted: false,
						post: 123,
						game: 12345
				});
				dataSent.votes.tehNinja.names.length.should.equal(1);
				dataSent.votes.tehNinja.names.should.include({
						voter: 'yamikuronue',
						retracted: true,
						post: 121,
						game: 12345
				});
			});
		});
		
		it('should not output the unvote hack', () => {
			const browser = {
				createPost: sinon.stub().yields()
			};
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

			
			const votes = {
				old: [
					{
						target: {
							name: 'tehNinja'
						},
						voter: {
							name: 'yamikuronue'
						},
						post: 121
					},
					{
						target: {
							name: 'unvote'
						},
						voter: {
							name: 'yamikuronue'
						},
						post: 122
					}
				], 
				current: [
					{
						target: {
							name: 'accalia'
						},
						voter: {
							name: 'yamikuronue'
						},
						post: 123
					},
					{
						target: {
							name: 'noLynch'
						},
						voter: {
							name: 'accalia'
						},
						post: 125
					}
				]
			};
			
			
			sandbox.stub(mafiaDAO, 'ensureGameExists').resolves();
			sandbox.stub(mafiaDAO, 'getCurrentDay').resolves(42);
			sandbox.stub(mafiaDAO, 'getNumToLynch').resolves(69);
			sandbox.stub(mafiaDAO, 'getAllVotesForDaySorted').resolves(votes);
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
						voter: 'yamikuronue',
						retracted: false,
						post: 123,
						game: 12345
				});
				dataSent.votes.tehNinja.names.length.should.equal(1);
				dataSent.votes.tehNinja.names.should.include({
						voter: 'yamikuronue',
						retracted: true,
						post: 121,
						game: 12345
				});
			});
		});
	});
});
