var QSQL = require('q-sqlite3');
var Q = require('q');
const sqlite3 = require('sqlite3');

const internals = {};

module.exports = {
	createDB: function(config) {
		return QSQL.createDatabase(config.db).then(function(db) {
		  internals.db = db;
		  
		  db.run('CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY ASC,	name TEXT NOT NULL UNIQUE ON CONFLICT IGNORE)')
			.then(() => {
				db.run('CREATE TABLE IF NOT EXISTS games (id INTEGER PRIMARY KEY ASC,status INTEGER NOT NULL REFERENCES statuses(id),current_day INTEGER NOT NULL DEFAULT 0,current_stage INTEGER NOT NULL REFERENCES stages(id),name TEXT);')
			}).then(() => {
				db.run('CREATE TABLE IF NOT EXISTS gamesplayers (id INTEGER PRIMARY KEY ASC,game INTEGER NOT NULL REFERENCES games(id),player INTEGER NOT NULL REFERENCES players(id),player_status INTEGER NOT NULL REFERENCES statuses(id),UNIQUE(game, player) ON CONFLICT IGNORE);')
			}).then(() => {
				db.run('CREATE TABLE player_statuses (id INTEGER PRIMARY KEY ASC,status TEXT NOT NULL UNIQUE ON CONFLICT IGNORE);')
			}).then(() => {
				db.all('SELECT * FROM player_statuses')
			}).then((data) => {
				if (!data) {
					return db.run('INSERT INTO player_statuses (id, status) VALUES (0, "alive"), (1,"dead"), (42,"mod")');
				} else {
					return Q(true);
				}
			})
			.then(() => {
				db.run('CREATE TABLE IF NOT EXISTS game_statuses (id INTEGER PRIMARY KEY ASC,status TEXT NOT NULL UNIQUE ON CONFLICT IGNORE);')
			}).then(() => {
				db.all('SELECT * FROM game_statuses')
			}).then((data) => {
				if (!data) {
					return db.run('INSERT INTO game_statuses (id, status) VALUES (0, "active"), (1,"finished")');
				} else {
					return Q(true);
				}
			}).then(() => {
				db.run('CREATE TABLE IF NOT EXISTS stages (id INTEGER PRIMARY KEY ASC, stage TEXT NOT NULL UNIQUE ON CONFLICT IGNORE);')
			}).then(() => {
				db.all('SELECT * FROM stages')
			}).then((data) => {
				if (!data) {
					return db.run('INSERT INTO stages (id, stage) VALUES (0, "day"), (1,"night")');
				} else {
					return Q(true);
				}
			})
			.then(() => {
				return Q(db);
			})
		});
	},
	ensureGameExists: function(id) {
		return internals.db.prepare('SELECT id FROM games WHERE id = ?')
		.then((statement) => {
			return statement.get(id);
		})
		then((row) => {
			if (!row) {
				return internals.db.prepare('INSERT INTO games (id, status, current_day, current_stage) VALUES (?, (SELECT id FROM game_statuses WHERE status="active"),0,(SELECT id FROM stages WHERE stage="night"))')
					.then((statement) => {
						return statement.run(id)
					})
			} else {
				return Q(true);
			}
		});
	},
	
	
	
}