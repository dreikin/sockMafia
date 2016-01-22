/**
 * Heavily borrowed from https://github.com/SockDrawer/SockRPG
 */

const orm = require('sequelize');

module.exports = (db) => {
	return db.define('vote', {
		// Primary key
		id: {
			type: orm.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		// Post number of the vote
		post: {
			type: orm.INTEGER,
			allowNull: false,
			unique: 'vote_post_voter_target_game'
		},
		day: {
			type: orm.INTEGER,
			allowNull: false
		},
		voterId: {
			type: orm.INTEGER,
			allowNull: false,
			unique: 'vote_post_voter_target_game'
		},
		targetId: {
			type: orm.INTEGER,
			allowNull: false,
			unique: 'vote_post_voter_target_game'
		},
		gameId: {
			type: orm.INTEGER,
			allowNull: false,
			unique: 'vote_post_voter_target_game'
		}
	});
};
