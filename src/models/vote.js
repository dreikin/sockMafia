/**
 * Heavily borrowed from https://github.com/SockDrawer/SockRPG
 */

const orm = require('sequelize');

module.exports = (db) => {
    return db.define('vote', {
        id: {
            type: orm.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        post: {
            type: orm.INTEGER,
            allowNull: false
        }
    });
};
