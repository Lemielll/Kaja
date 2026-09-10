/**
 * Common Validation Primitives
 * File: service/src/schemas/common.js
 *
 * Mirrors the shared patterns defined in openapi.yaml.
 * All regex and enum values here MUST match openapi.yaml exactly.
 * Do NOT modify without a formal contract revision and CHANGELOG entry.
 */

'use strict';

// ---------------------------------------------------------------------------
// Patterns — copied verbatim from openapi.yaml components/schemas
// ---------------------------------------------------------------------------

/**
 * Opaque resource ID pattern.
 * openapi.yaml: pattern: '^[a-z]+_[A-Za-z0-9]{6,12}$'
 * Applies to: Equipment.id, Rental.id, Inspection.id,
 *             equipmentId, contractorId, warehouseAdminId, operatorId, rentalId
 */
const OPAQUE_ID_PATTERN = /^[a-z]+_[A-Za-z0-9]{6,12}$/;

/**
 * ISO 4217 currency code pattern.
 * openapi.yaml: pattern: '^[A-Z]{3}$'
 * Applies to: Equipment.currency, Rental.currency, createRental.currency
 */
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/**
 * UUID v4 pattern for Idempotency-Key header.
 * openapi.yaml: format: uuid (applied to Idempotency-Key header)
 * RFC 4122 canonical form.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ISO 8601 date-time pattern (UTC 'Z' suffix or offset).
 * openapi.yaml: format: date-time
 * Applies to: startTime, endTime, inspectedAt, createdAt, updatedAt
 */
const DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate a value against the opaque ID pattern.
 * @param {*} value
 * @returns {boolean}
 */
function isValidOpaqueId(value) {
  return typeof value === 'string' && OPAQUE_ID_PATTERN.test(value);
}

/**
 * Validate a value against the ISO 4217 currency pattern.
 * @param {*} value
 * @returns {boolean}
 */
function isValidCurrency(value) {
  return typeof value === 'string' && CURRENCY_PATTERN.test(value);
}

/**
 * Validate a value against the UUID pattern (for Idempotency-Key).
 * @param {*} value
 * @returns {boolean}
 */
function isValidUUID(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Validate a value as an ISO 8601 date-time string.
 * @param {*} value
 * @returns {boolean}
 */
function isValidDatetime(value) {
  if (typeof value !== 'string') return false;
  if (!DATETIME_PATTERN.test(value)) return false;
  // Also confirm the Date constructor agrees it is a real date
  return !Number.isNaN(Date.parse(value));
}

/**
 * Validate that a value is an integer >= minimum.
 * openapi.yaml: type: integer, minimum: 0  (for depositAmount, hourlyRate)
 * @param {*} value
 * @param {number} [minimum=0]
 * @returns {boolean}
 */
function isValidInteger(value, minimum = 0) {
  return Number.isInteger(value) && value >= minimum;
}

/**
 * Validate a value is one of the allowed enum members.
 * @param {*} value
 * @param {string[]} allowed
 * @returns {boolean}
 */
function isValidEnum(value, allowed) {
  return typeof value === 'string' && allowed.includes(value);
}

/**
 * Build a structured validation error list entry.
 * @param {string} field  - Field name / location (e.g. 'body.equipmentId')
 * @param {string} reason - Human-readable explanation
 * @returns {{ field: string, reason: string }}
 */
function fieldError(field, reason) {
  return { field, reason };
}

module.exports = {
  // Patterns (exported for testing / documentation purposes)
  OPAQUE_ID_PATTERN,
  CURRENCY_PATTERN,
  UUID_PATTERN,
  DATETIME_PATTERN,

  // Helpers
  isValidOpaqueId,
  isValidCurrency,
  isValidUUID,
  isValidDatetime,
  isValidInteger,
  isValidEnum,
  fieldError,
};
