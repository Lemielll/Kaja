/**
 * Equipment Store Module
 * File: service/src/store/equipments.js
 * Description: Data access layer for equipment resource.
 * The only place SQL queries for equipments are written (Session 3: A.1 & A.7).
 */

const db = require('./db');

/**
 * Retrieve all equipments matching optional filter criteria.
 * @param {Object} [filters] - Filter options
 * @param {string} [filters.status] - Filter by operational status
 * @param {string} [filters.type] - Filter by equipment machine class
 * @returns {Promise<Array<Object>>} Array of raw database rows
 */
async function getAllEquipments(filters = {}) {
  try {
    const conditions = [];
    const params = [];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }

    if (filters.type) {
      params.push(filters.type);
      conditions.push(`type = $${params.length}`);
    }

    let sql = `
      SELECT id, type, status, hourly_rate, currency, location, created_at, updated_at
      FROM equipments
    `;

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await db.query(sql, params);
    return result.rows;
  } catch (err) {
    console.error(`[STORE EQUIPMENTS] Failed to retrieve equipments: ${err.message}`);
    throw err;
  }
}

const crypto = require('crypto');

function generateEquipmentId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = crypto.randomBytes(6);
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return `eqp_${result}`;
}

/**
 * Retrieve a single equipment by its unique identifier.
 * @param {string} id - Equipment identifier (e.g. eqp_8X2kAB)
 * @returns {Promise<Object|null>} Equipment database row or null if not found
 */
async function getEquipmentById(id) {
  if (!id) {
    throw new Error('Equipment ID must be provided');
  }

  try {
    const sql = `
      SELECT id, type, status, hourly_rate, currency, location, created_at, updated_at
      FROM equipments
      WHERE id = $1
      LIMIT 1
    `;
    const result = await db.query(sql, [id]);
    return result.rows[0] || null;
  } catch (err) {
    console.error(`[STORE EQUIPMENTS] Failed to retrieve equipment by ID (${id}): ${err.message}`);
    throw err;
  }
}

/**
 * Insert a new equipment unit into the database.
 * @param {Object} data
 * @returns {Promise<Object>} The inserted equipment row
 */
async function insertEquipment(data) {
  const id = data.id || generateEquipmentId();
  const status = data.status || 'available';
  const currency = data.currency || 'USD';

  try {
    const sql = `
      INSERT INTO equipments (id, type, status, hourly_rate, currency, location, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, type, status, hourly_rate, currency, location, created_at, updated_at
    `;
    const params = [id, data.type, status, data.hourlyRate, currency, data.location];
    const result = await db.query(sql, params);
    return result.rows[0];
  } catch (err) {
    console.error(`[STORE EQUIPMENTS] Failed to insert equipment: ${err.message}`);
    throw err;
  }
}

/**
 * Update the status of an equipment unit.
 * @param {string} id - Equipment ID
 * @param {string} status - New status
 * @returns {Promise<Object|null>} The updated equipment row
 */
async function updateEquipmentStatus(id, status) {
  try {
    const sql = `
      UPDATE equipments
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, type, status, hourly_rate, currency, location, created_at, updated_at
    `;
    const result = await db.query(sql, [status, id]);
    return result.rows[0] || null;
  } catch (err) {
    console.error(`[STORE EQUIPMENTS] Failed to update equipment status: ${err.message}`);
    throw err;
  }
}

/**
 * Delete an equipment unit by ID (or set to out_of_service if historical records exist).
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function deleteEquipment(id) {
  try {
    const res = await db.query('DELETE FROM equipments WHERE id = $1', [id]);
    return res.rowCount > 0;
  } catch (err) {
    if (err.code === '23503') {
      // Historical references exist - mark as out_of_service
      await db.query("UPDATE equipments SET status = 'out_of_service', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
      return true;
    }
    console.error(`[STORE EQUIPMENTS] Failed to delete equipment: ${err.message}`);
    throw err;
  }
}

module.exports = {
  getAllEquipments,
  getEquipmentById,
  insertEquipment,
  updateEquipmentStatus,
  deleteEquipment,
  generateEquipmentId,
};
