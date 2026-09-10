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

module.exports = {
  getAllEquipments,
  getEquipmentById,
};
