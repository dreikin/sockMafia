/**
 * Heavily borrowed from https://github.com/SockDrawer/SockRPG
 */

const orm = require('sequelize');

module.exports = (db) => {
	return db.define('game', {
		// Primary key
		id: {
			type: orm.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		// Game status (preparing, running, paused, abandoned, finished)
		status: {
			type: orm.TEXT,
			allowNull: false
		},
		// The current time of the game (morning, day, night, etc.)
		time: {
			type: orm.TEXT,
			allowNull: false
		},
		//
		day: {
			type: orm.INTEGER,
			allowNull: false
		},
		// Human-friendly game name
		name: {
			type: orm.TEXT,
			allowNull: true,
			unique: true
		}
	}, {
		indexes: [
			{
				fields: ['name']
			}
		]
	});
};
