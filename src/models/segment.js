/**
 * Heavily borrowed from https://github.com/SockDrawer/SockRPG
 */

const orm = require('sequelize');

module.exports = (db) => {
    return db.define('segment', {
        id: {
            type: orm.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        // game
        // stage
        start: {
            type: orm.INTEGER,
            allowNull: false
        },
        stop: {
            type: orm.INTEGER,
            allowNull: true
        }
    });
};
