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
        // Game status (prep, active, finished, etc.)
        status: {
            type: orm.TEXT,
            allowNull: false
        },
        // The current stage of the game (morning, day, night, etc.)
        stage: {
            type: orm.TEXT,
            allowNull: false
        },
		//
		currentDay: {
            type: orm.INTEGER,
            allowNull: false
        },
        // Human-friendly game name
        name: {
            type: orm.TEXT,
            allowNull: true
        }
    });
};
