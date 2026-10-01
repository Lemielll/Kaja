/**
 * Database Initialization Script
 * File: service/db/init.js
 * Description: Reads and executes schema.sql and seed.sql against DATABASE_URL.
 * Safe to run on every startup (uses IF NOT EXISTS and ON CONFLICT DO NOTHING).
 */

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/store/db');

async function initDb() {
  console.log('[DB INIT] Connecting to PostgreSQL database...');
  const client = await pool.connect();
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');

    console.log('[DB INIT] Applying database schema (tables, constraints, indexes)...');
    await client.query(schemaSql);

    console.log('[DB INIT] Applying demonstration seed data...');
    await client.query(seedSql);

    console.log('[DB INIT] Database initialization completed successfully.');
  } catch (err) {
    console.error('[DB INIT ERROR] Failed to initialize database:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  initDb();
}

module.exports = { initDb };
