/**
 * Rental Store Module
 * File: service/src/store/rentals.js
 * Description: Data access layer for rental contract resource.
 * The only place SQL queries for rentals are written (Session 3: A.1 & A.7).
 */

const crypto = require('crypto');
const db = require('./db');

/**
 * Helper to generate an opaque identifier matching OpenAPI pattern: ^[a-z]+_[A-Za-z0-9]{6,12}$
 * @param {string} prefix - Resource prefix (e.g. 'rnt')
 * @returns {string} Generated opaque identifier
 */
function generateOpaqueId(prefix = 'rnt') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = crypto.randomBytes(8);
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return `${prefix}_${result}`;
}

/**
 * Retrieve all rentals matching optional filter criteria.
 * @param {Object} [filters] - Filter options
 * @param {string} [filters.status] - Filter by rental workflow status
 * @returns {Promise<Array<Object>>} Array of raw database rows
 */
async function getAllRentals(filters = {}) {
  try {
    const conditions = [];
    const params = [];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }

    let sql = `
      SELECT id, equipment_id, contractor_id, warehouse_admin_id, status,
             start_time, end_time, deposit_amount, currency, created_at, updated_at
      FROM rentals
    `;

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await db.query(sql, params);
    return result.rows;
  } catch (err) {
    console.error(`[STORE RENTALS] Failed to retrieve rentals: ${err.message}`);
    throw err;
  }
}

/**
 * Retrieve a single rental by its unique identifier.
 * @param {string} id - Rental identifier (e.g. rnt_3MnB7xP)
 * @returns {Promise<Object|null>} Rental database row or null if not found
 */
async function getRentalById(id) {
  if (!id) {
    throw new Error('Rental ID must be provided');
  }

  try {
    const sql = `
      SELECT id, equipment_id, contractor_id, warehouse_admin_id, status,
             start_time, end_time, deposit_amount, currency, created_at, updated_at
      FROM rentals
      WHERE id = $1
      LIMIT 1
    `;
    const result = await db.query(sql, [id]);
    return result.rows[0] || null;
  } catch (err) {
    console.error(`[STORE RENTALS] Failed to retrieve rental by ID (${id}): ${err.message}`);
    throw err;
  }
}

/**
 * Insert a new rental contract record into the database.
 * @param {Object} data - Rental data
 * @param {string} data.equipmentId
 * @param {string} data.contractorId
 * @param {string} data.warehouseAdminId
 * @param {string} data.startTime
 * @param {string} data.endTime
 * @param {number} data.depositAmount
 * @param {string} data.currency
 * @param {string} [data.status='approved']
 * @returns {Promise<Object>} The newly created rental database row
 */
async function insertRental(data) {
  const rentalId = data.id || generateOpaqueId('rnt');
  const status = data.status || 'approved';
  const currency = data.currency || 'USD';

  try {
    const sql = `
      INSERT INTO rentals (
        id, equipment_id, contractor_id, warehouse_admin_id, status,
        start_time, end_time, deposit_amount, currency, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, equipment_id, contractor_id, warehouse_admin_id, status,
                start_time, end_time, deposit_amount, currency, created_at, updated_at
    `;

    const params = [
      rentalId,
      data.equipmentId,
      data.contractorId,
      data.warehouseAdminId,
      status,
      data.startTime,
      data.endTime,
      data.depositAmount,
      currency,
    ];

    const result = await db.query(sql, params);
    console.log(`[STORE RENTALS] Created new rental contract with ID: ${rentalId}`);
    return result.rows[0];
  } catch (err) {
    console.error(`[STORE RENTALS] Failed to insert rental contract: ${err.message}`);
    throw err;
  }
}

module.exports = {
  getAllRentals,
  getRentalById,
  insertRental,
  generateOpaqueId,
};
