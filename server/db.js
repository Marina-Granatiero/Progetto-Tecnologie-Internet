// Pool di connessioni MySQL/MariaDB condiviso da tutta l'applicazione.
const mysql = require('mysql2/promise');
const config = require('./config');

const db = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = db;
