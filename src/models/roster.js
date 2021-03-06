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
		playerStatus: {
			type: orm.TEXT,
			allowNull: false
		}
	});
};
