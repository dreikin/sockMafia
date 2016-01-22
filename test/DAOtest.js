'use strict';
/*globals describe, it*/

const chai = require('chai'),
	sinon = require('sinon');
	
//promise library plugins
require('sinon-as-promised');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

chai.should();
const expect = chai.expect;

const mafia = require('../src/mafiabot');
const mafiaDAO = require('../src/dao.js');

describe('DAO', () => {

	let sandbox, notificationSpy, commandSpy;
	beforeEach(() => {
		sandbox = sinon.sandbox.create();
	});
	afterEach(() => {
		sandbox.restore();
	});

	describe('isPlayerAlive()', () => {	
		it('Should return true for living players', () => {
			sandbox.stub(mafiaDAO, 'getPlayerStatus').resolves(mafiaDAO.playerStatus.alive);
			mafiaDAO.isPlayerAlive('123', 'yamikuronue').should.eventually.be.true;
		});

		it('Should return false for dead players', () => {
			sandbox.stub(mafiaDAO, 'getPlayerStatus').resolves(mafiaDAO.playerStatus.dead);
			mafiaDAO.isPlayerAlive('123', 'yamikuronue').should.eventually.be.false;
		});

		it('Should reject for nonexistant players', () => {
			sandbox.stub(mafiaDAO, 'getPlayerStatus').rejects('No such player');
			mafiaDAO.isPlayerAlive('123', 'yamikuronue').should.be.rejected;
		});
	});

	describe('isPlayerInGame()', () => {	
		it('Should return true for players', () => {
			sandbox.stub(mafiaDAO, 'getPlayerInGame').resolves(true);
			mafiaDAO.isPlayerInGame('123', 'yamikuronue').should.eventually.be.true;
		});

		it('Should return false nonexistant players', () => {
			sandbox.stub(mafiaDAO, 'getPlayerInGame').resolves(false);
			mafiaDAO.isPlayerInGame('123', 'yamikuronue').should.eventually.be.true;
		});
	});

	describe('isPlayerMod()', () => {	
		it('Should return true for mods', () => {
			sandbox.stub(mafiaDAO, 'getPlayerStatus').resolves(mafiaDAO.playerStatus.mod);
			mafiaDAO.isPlayerMod('123', 'yamikuronue').should.eventually.be.true;
		});

		it('Should return false for living players', () => {
			sandbox.stub(mafiaDAO, 'getPlayerStatus').resolves(mafiaDAO.playerStatus.alive);
			mafiaDAO.isPlayerMod('123', 'yamikuronue').should.eventually.be.false;
		});

		it('Should return false for dead players', () => {
			sandbox.stub(mafiaDAO, 'getPlayerStatus').resolves(mafiaDAO.playerStatus.dead);
			mafiaDAO.isPlayerMod('123', 'yamikuronue').should.eventually.be.false;
		});

		it('Should reject for nonexistant people', () => {
			sandbox.stub(mafiaDAO, 'getPlayerStatus').rejects('No such player');
			mafiaDAO.isPlayerMod('123', 'yamikuronue').should.be.rejected;
		});
	});
});
