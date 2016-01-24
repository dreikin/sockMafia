'use strict';
/*globals describe, it, before, beforeEach, afterEach*/

const chai = require('chai'),
	sinon = require('sinon');
	
//promise library plugins
require('sinon-as-promised');
require('chai-as-promised');

chai.should();
const expect = chai.expect;
const sqlite3 = require('sqlite3');

const mafiaDAO = require('../src/dao.js');

const fakeConfig = {
	db: './mafiadbTesting.db'
};

describe('The Database', () => {

	let sandbox, notificationSpy, commandSpy;
	before((done) => {
		return mafiaDAO.createDB(fakeConfig).then(() => {
			done();
		});
	});
	beforeEach(() => {
		sandbox = sinon.sandbox.create();
	});
	afterEach(() => {
		sandbox.restore();
	});
	
	it('should exist', () => {
		const db = new sqlite3.Database(fakeConfig.db);
		expect(db).to.be.a('object');
	});

	describe('Players table', () => {
		it('should be a table', (done) => {
			const db = new sqlite3.Database(fakeConfig.db);
			db.all('SELECT name FROM sqlite_master WHERE type="table" AND name="players";', (err, rows) => {
				expect(err).to.be.null;
				expect(rows.length).to.equal(1);
				db.close(() => {
					done();
				});
			});
		});
		
		it('Should have a name column', (done) => {
			const db = new sqlite3.Database(fakeConfig.db);
			db.all('SELECT name FROM players', (err, rows) => {
				expect(err).to.be.null;
				db.close(() => {
					done();
				});
			});		
		});
	});
	
	describe('Games table', () => {
		it('should be a table', (done) => {
			const db = new sqlite3.Database(fakeConfig.db);
			db.all('SELECT name FROM sqlite_master WHERE type="table" AND name="games";', (err, rows) => {
				expect(err).to.be.null;
				expect(rows.length).to.equal(1);
				db.close(() => {
					done();
				});
			});
		});
	});
	
	describe('Roster table', () => {
		it('should be a table', (done) => {
			const db = new sqlite3.Database(fakeConfig.db);
			db.all('SELECT name FROM sqlite_master WHERE type="table" AND name="rosters";', (err, rows) => {
				expect(err).to.be.null;
				expect(rows.length).to.equal(1);
				db.close(() => {
					done();
				});
			});
		});
	});
	
	describe('Votes table', () => {
		it('should be a table', (done) => {
			const db = new sqlite3.Database(fakeConfig.db);
			db.all('SELECT name FROM sqlite_master WHERE type="table" AND name="actions";', (err, rows) => {
				expect(err).to.be.null;
				expect(rows.length).to.equal(1);
				db.close(() => {
					done();
				});
			});
		});
	});
});
describe('The DAO', () => {

	let sandbox, notificationSpy, commandSpy;
	before((done) => {
		return mafiaDAO.createDB(fakeConfig).then(() => {
			done();
		});
	});
	beforeEach(() => {
		sandbox = sinon.sandbox.create();
	});
	afterEach(() => {
		sandbox.restore();
	});
	
	describe('ensureGameExists', () => {
		it('should insert when no game exists', () => {
			return mafiaDAO.ensureGameExists(1234).then(() => {
				const db = new sqlite3.Database(fakeConfig.db);
				db.all('SELECT id FROM games WHERE id=1234;', (err, rows) => {
					expect(err).to.be.null;
					expect(rows.length).to.equal(1);
					db.close();
				});
			});
		});
		
		it('should not reinsert when the game already exists', () => {
			return mafiaDAO.ensureGameExists(1234).then(() => {
				const db = new sqlite3.Database(fakeConfig.db);
				db.all('SELECT id FROM games WHERE id=1234;', (err, rows) => {
					expect(err).to.be.null;
					expect(rows.length).to.equal(1);
					db.close();
				});
			});
		});
	});
});
