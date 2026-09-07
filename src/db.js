const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'ecorecolecta_db',
    password: 'Taker2010**',
    port: 5432,
});

module.exports = pool;