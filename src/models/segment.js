/**
 * Heavily borrowed from https://github.com/SockDrawer/SockRPG
 */

const orm = require('sequelize');

module.exports = (db) => {
	return db.define('segment', {
		// Primary key
		id: {
			type: orm.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		// Day the segment belongs to
		day: {
			type: orm.INTEGER,
			allowNull: false
		},
		// Stage of the segment
		stage: {
			type: orm.TEXT,
			allowNull: false
		},
		// Post that starts the segment
		start: {
			type: orm.INTEGER,
			allowNull: false
		},
		// Post that ends the segment
		// This post is NOT included in the segment,
		// and will often be the start of the next.
		stop: {
			type: orm.INTEGER,
			allowNull: true
		}
	});
};
