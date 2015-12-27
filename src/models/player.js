/**
 * Heavily borrowed from https://github.com/SockDrawer/SockRPG
 */

const orm = require('sequelize');

module.exports = (db) => {
    return db.define('player', {
        // Primary key
        id: {
            type: orm.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        // Player name
        name: {
            type: orm.TEXT,
            allowNull: false,
            unique: true
        }
    });
};
