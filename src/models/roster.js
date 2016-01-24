/**
 * Heavily borrowed from https://github.com/SockDrawer/SockRPG
 */

const orm = require('sequelize');

module.exports = (db) => {
	return db.define('roster', {
		id: {
			type: orm.INTEGER,
			allowNull: false,
			primaryKey: true,
			autoIncrement: true
		},
		gameId: {
			type: orm.INTEGER,
			allowNull: false
		},
		playerId: {
			type: orm.INTEGER,
			allowNull: false
		},
		playerStatus: {
			type: orm.TEXT,
			allowNull: false
		},
		votes: {
			type: orm.INTEGER,
			allowNull: false,
			defaultValue: 1
		},
		lynchModifier: {
			type: orm.INTEGER,
			allowNull: false,
			defaultValue: 0
		}
	}, {
		indexes: [
			{
				fields: ['gameId', 'playerId', 'playerStatus', 'votes', 'lynchModifier']
			},
			{
				fields: ['gameId', 'playerStatus', 'playerId', 'votes', 'lynchModifier']
			}
		]
	});
};
