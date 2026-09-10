/**
 * Inspection Store Module
 * File: service/src/store/inspections.js
 * Description: Data access layer for equipment inspection resource.
 * The only place SQL queries for inspections are written (Session 3: A.1 & A.7).
 * All queries use prepared statements with parameterized inputs.
 */

'use strict';

const crypto = require('crypto');
const db = require('./db');

/**
 * Helper to generate an opaque identifier matching OpenAPI pattern: ^[a-z]+_[A-Za-z0-9]{6,12}$
 * @param {string} prefix - Resource prefix (default 'ins')
 * @returns {string} Generated opaque identifier (e.g. 'ins_9Hk2pQ')
 */
function generateOpaqueId(prefix = 'ins') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = crypto.randomBytes(8);
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return `${prefix}_${result}`;
}

/**
 * Insert a new inspection record into the database.
 * @param {Object} data - Inspection attributes
 * @param {string} [data.id] - Optional custom opaque ID
 * @param {string} data.rentalId - Associated rental identifier
 * @param {string} data.equipmentId - Associated equipment identifier
 * @param {string} data.operatorId - Field operator identifier
 * @param {string} data.status - Inspection status (pending_review, in_progress, pass, fail)
 * @param {string} data.inspectedAt - ISO 8601 timestamp of inspection
 * @param {string} data.notes - Field observation notes
 * @param {string} [data.defectSummary] - Summary of defects found if any
 * @returns {Promise<Object>} The newly created inspection database row
 */
async function insertInspection(data) {
  const inspectionId = data.id || generateOpaqueId('ins');
  const defectSummary = data.defectSummary || null;

  try {
    const sql = `
      INSERT INTO inspections (
        id, rental_id, equipment_id, operator_id, status,
        inspected_at, notes, defect_summary, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, rental_id, equipment_id, operator_id, status,
                inspected_at, notes, defect_summary, created_at, updated_at
    `;

    const params = [
      inspectionId,
      data.rentalId,
      data.equipmentId,
      data.operatorId,
      data.status,
      data.inspectedAt,
      data.notes,
      defectSummary,
    ];

    const result = await db.query(sql, params);
    console.log(`[STORE INSPECTIONS] Created new inspection record with ID: ${inspectionId} for rental: ${data.rentalId}`);
    return result.rows[0];
  } catch (err) {
    console.error(`[STORE INSPECTIONS] Failed to insert inspection: ${err.message}`);
    throw err;
  }
}

/**
 * Retrieve an inspection by its unique identifier.
 * @param {string} id - Inspection identifier (e.g. ins_9Hk2pQ)
 * @returns {Promise<Object|null>} Inspection row or null if not found
 */
async function getInspectionById(id) {
  if (!id) {
    throw new Error('Inspection ID must be provided');
  }

  try {
    const sql = `
      SELECT id, rental_id, equipment_id, operator_id, status,
             inspected_at, notes, defect_summary, created_at, updated_at
      FROM inspections
      WHERE id = $1
      LIMIT 1
    `;
    const result = await db.query(sql, [id]);
    return result.rows[0] || null;
  } catch (err) {
    console.error(`[STORE INSPECTIONS] Failed to retrieve inspection by ID (${id}): ${err.message}`);
    throw err;
  }
}

/**
 * Retrieve all inspection records associated with a specific rental contract.
 * @param {string} rentalId - Rental identifier (e.g. rnt_3MnB7xP)
 * @returns {Promise<Array<Object>>} Array of inspection database rows
 */
async function getInspectionsByRentalId(rentalId) {
  if (!rentalId) {
    throw new Error('Rental ID must be provided');
  }

  try {
    const sql = `
      SELECT id, rental_id, equipment_id, operator_id, status,
             inspected_at, notes, defect_summary, created_at, updated_at
      FROM inspections
      WHERE rental_id = $1
      ORDER BY inspected_at DESC
    `;
    const result = await db.query(sql, [rentalId]);
    return result.rows;
  } catch (err) {
    console.error(`[STORE INSPECTIONS] Failed to retrieve inspections for rental (${rentalId}): ${err.message}`);
    throw err;
  }
}

/**
 * Check whether a duplicate or conflicting inspection already exists for a rental at the exact timestamp.
 * Used to enforce RFC 9457 inspection-conflict detection.
 * @param {string} rentalId - Rental identifier
 * @param {string} inspectedAt - ISO timestamp of inspection
 * @returns {Promise<Object|null>} Existing conflicting inspection or null
 */
async function findDuplicateInspection(rentalId, inspectedAt) {
  if (!rentalId || !inspectedAt) {
    return null;
  }

  try {
    const sql = `
      SELECT id, rental_id, equipment_id, operator_id, status,
             inspected_at, notes, defect_summary, created_at, updated_at
      FROM inspections
      WHERE rental_id = $1 AND inspected_at = $2
      LIMIT 1
    `;
    const result = await db.query(sql, [rentalId, inspectedAt]);
    return result.rows[0] || null;
  } catch (err) {
    console.error(`[STORE INSPECTIONS] Error checking duplicate inspection: ${err.message}`);
    throw err;
  }
}

module.exports = {
  generateOpaqueId,
  insertInspection,
  getInspectionById,
  getInspectionsByRentalId,
  findDuplicateInspection,
};
