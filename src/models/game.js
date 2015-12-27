/**
 * Heavily borrowed from https://github.com/SockDrawer/SockRPG
 */

const orm = require('sequelize');

module.exports = (db) => {
    return db.define('game', {
        id: {
            type: orm.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        status: {
            type: orm.TEXT,
            allowNull: false
        },
        day: {
            type: orm.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        stage: {
            type: orm.TEXT,
            allowNull: false
        },
        name: {
            type: orm.TEXT,
            allowNull: true
        }
    });
};
