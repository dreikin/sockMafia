'use strict';

const chai = require('chai');
const sinon = require('sinon');
const del = require('del');
	
//promise library plugins
require('sinon-as-promised');
require('chai-as-promised');

chai.should();
const expect = chai.expect;

/*SETUP*/
const mafiaBot = require('../src/mafiabot');
const browser = require('../node_modules/sockbot/lib/browser')();
const config = require('../node_modules/sockbot/lib/config');
const command = require('../node_modules/sockbot/lib/commands');
const Handlebars = require('handlebars');

/*Set up fake event emitter*/
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const fakeEmitter = new EventEmitter();

//Functionality we're not testing
fakeEmitter.onNotification = sinon.stub().yields();
fakeEmitter.onMessage = sinon.stub().yields();

//Functionality we are testing
command.prepare(fakeEmitter, () => 0);

const threadID = 12345;
let postCounter = 1;

const pluginConfig = {
	db: './intTesting.db'
};

/*TESTS*/
describe('mafia: basic functionality', function() {
	let sandbox;
	this.timeout(5000);

	before(() => {
		sandbox = sinon.sandbox.create();		
		return del(['intTesting.db']).then(() => {
			return mafiaBot.prepare(pluginConfig, config, fakeEmitter, browser);
		});
	});
	
	beforeEach(() => {
		//sandbox.stub(browser, "createPost").yields();
	});

	afterEach(() => {
		sandbox.restore();
	});

	it('Should prepare a game when asked', (done) => {
		const input = {
			input: '!prepare testMafia',
			command: 'prepare',
			args: ['testMafia'],
			mention: 'mention',
			post: {
				'topic_id': threadID,
				'post_number': postCounter++,
				username: 'G0|)',			
				cleaned: '@mafiaBot prepare testMafia'
			}
		};
		
		sandbox.stub(browser, 'createPost', (topic, post, output, callback) => {
			output.should.equal('Game "testMafia" created! The mod is @G0|)');
			done();
		});
		
		const handled = fakeEmitter.emit('command#prepare', input);
		handled.should.be.true;		
	});
	
	it('Should let player 1 join', (done) => {
		const input = {
			post: {
				'topic_id': threadID,
				'post_number': postCounter++,
				username: 'accalia',
				input: '!join',
				command: 'join',
				args: ['testMafia'],
				mention: 'mention',
				post: {
					cleaned: '@mafiaBot join'
				}
			}
		};
		
		sandbox.stub(browser, 'createPost', (topic, post, output, callback) => {
			output.should.equal('Welcome to the game, @accalia');
			done();
		});
		
		const handled = fakeEmitter.emit('command#join', input);
		handled.should.be.true;
	});
	
	it('Should let player 2 join', (done) => {
		const input = {
			post: {
				'topic_id': threadID,
				'post_number': postCounter++,
				username: 'yamikuronue',
				input: '!join',
				command: 'join',
				args: ['testMafia'],
				mention: 'mention',
				post: {
					cleaned: '@mafiaBot join'
				}
			}
		};
		sandbox.stub(browser, 'createPost', (topic, post, output, callback) => {
			output.should.equal('Welcome to the game, @yamikuronue');
			done();
		});
		
		const handled = fakeEmitter.emit('command#join', input);
		handled.should.be.true;
	});
	
	it('Should let player 3 join', (done) => {
		const input = {
			post: {
				'topic_id': threadID,
				'post_number': postCounter++,
				username: 'dreikin',
				input: '!join',
				command: 'join',
				args: ['testMafia'],
				mention: 'mention',
				post: {
					cleaned: '@mafiaBot join'
				}
			}
		};

		sandbox.stub(browser, 'createPost', (topic, post, output, callback) => {
			output.should.equal('Welcome to the game, @dreikin');
			done();
		});
		
		const handled = fakeEmitter.emit('command#join', input);
		handled.should.be.true;
	});
	
	it('Should start the game when asked', (done) => {
		const input = {
			input: '!start testMafia',
			command: 'start',
			args: [''],
			mention: 'mention',
			post: {
				'topic_id': threadID,
				'post_number': postCounter++,
				username: 'G0|)',			
				cleaned: '@mafiaBot start'
			}
		};
		
		sandbox.stub(browser, 'createPost', (topic, post, output, callback) => {
			output.should.equal('Game begin!');
			done();
		});
		
		const handled = fakeEmitter.emit('command#start', input);
		handled.should.be.true;
	});
	
	it('Should not start with any votes', (done) => {
		const input = {
			post: {
				'topic_id': threadID,
				'post_number': postCounter++,
				username: 'dreikin',
				input: '!list-votes',
				command: 'list-votes',
				args: [''],
				mention: 'mention',
				post: {
					cleaned: '@mafiaBot list-votes'
				}
			}
		};
		let templateCalled = false;
		
		const templateMock = (data) => {
			Handlebars.compile.called.should.be.true;
			data.numPlayers.should.equal(3);
			data.notVoting.should.include('accalia');
			data.notVoting.should.include('yamikuronue');
			data.notVoting.should.include('dreikin');
			data.numNotVoting.should.equal(3);
			data.votes.should.be.empty;
			templateCalled = true;
		};
		
		sandbox.stub(browser, 'createPost', () => {
			templateCalled.should.be.true;
			done();
		});
		sandbox.stub(Handlebars, 'compile').returns(templateMock);
		
		const handled = fakeEmitter.emit('command#list-votes', input);
		handled.should.be.true;
	});
	
	it('Should allow voting', (done) => {
		const input = {
			post: {
				'topic_id': threadID,
				'post_number': postCounter++,
				username: 'yamikuronue',
				input: '!for @accalia',
				command: 'for',
				args: ['@accalia'],
				mention: 'mention',
				post: {
					cleaned: '@mafiaBot for @accalia'
				}
			}
		};
		sandbox.stub(browser, 'createPost', (topic, post, output, callback) => {
			output.should.include('@yamikuronue voted for @accalia in post <a href="https://what.thedailywtf.com/t/' + threadID + '/' + postCounter - 1 + '</a>.');
			output.should.include('Vote text:');
			output.should.include('[quote]\n!for @accalia\n[/quote]');
			done();
		});
		
		const handled = fakeEmitter.emit('command#for', input);
		handled.should.be.true;
	});
	
	it('Should register 1 vote', (done) => {
		const input = {
			post: {
				'topic_id': threadID,
				'post_number': postCounter++,
				username: 'dreikin',
				input: '!list-votes',
				command: 'list-votes',
				args: [''],
				mention: 'mention',
				post: {
					cleaned: '@mafiaBot list-votes'
				}
			}
		};
		let templateCalled = false;
		
		const templateMock = (data) => {
			Handlebars.compile.called.should.be.true;
			data.numPlayers.should.equal(3);
			data.notVoting.should.include('accalia');
			data.notVoting.should.not.include('yamikuronue');
			data.notVoting.should.include('dreikin');
			data.numNotVoting.should.equal(2);
			data.votes.should.include({
				voter: 'yamikuronue',
				retracted: false,
				post: postCounter - 1,
				game: threadID
			});
			templateCalled = true;
		};
		
		sandbox.stub(browser, 'createPost', () => {
			templateCalled.should.be.true;
			done();
		});
		sandbox.stub(Handlebars, 'compile').returns(templateMock);
		
		const handled = fakeEmitter.emit('command#list-votes', input);
		handled.should.be.true;
	});
});
