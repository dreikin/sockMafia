/**
 * Heavily borrowed from https://github.com/SockDrawer/SockRPG
 */

const orm = require('sequelize');

module.exports = (db) => {
	return db.define('action', {
		// Primary key
		id: {
			type: orm.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		gameId: {
			type: orm.INTEGER,
			allowNull: false,
			unique: 'vote_game_post_player_action_target'
		},
		// Post number of the vote
		post: {
			type: orm.INTEGER,
			allowNull: false,
			unique: 'vote_game_post_player_action_target'
		},
		day: {
			type: orm.INTEGER,
			allowNull: false
		},
		playerId: {
			type: orm.INTEGER,
			allowNull: false,
			unique: 'vote_game_post_player_action_target'
		},
		action: {
			type: orm.TEXT,
			allowNull: false,
			unique: 'vote_game_post_player_action_target'
		},
		targetId: {
			type: orm.INTEGER,
			allowNull: true,
			unique: 'vote_game_post_player_action_target'
		},
		retractedInPost: {
			type:orm.INTEGER,
			allowNull: true
		}
	}, {
		indexes: [
			{
				fields: ['gameId', 'day', 'action', 'post', 'playerId', 'targetId', 'retractedInPost']
			}
		]
	});
};
