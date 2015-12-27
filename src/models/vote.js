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
            allowNull: false
        }
    });
};
