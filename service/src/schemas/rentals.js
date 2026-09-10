/**
 * Rental Schema Validation
 * File: service/src/schemas/rentals.js
 *
 * Mirrors openapi.yaml → paths./rentals (GET & POST) and /rentals/{id} (GET)
 * and /rentals/{id}/inspections (POST path + header) exactly.
 *
 * Validates:
 *   - GET  /rentals            → query params
 *   - POST /rentals            → Idempotency-Key header + request body
 *   - GET  /rentals/{id}       → path param
 *   - POST /rentals/{id}/...   → path param + Idempotency-Key header
 *     (body validated separately by inspections.js)
 *
 * Returns HTTP 400 on any schema violation BEFORE the store is touched.
 *
 * CONTRACT RULE: enum values, required fields, and patterns here MUST stay
 * identical to openapi.yaml. Any change requires a formal contract revision
 * by the Contract Owner.
 */

'use strict';

const {
  isValidEnum,
  isValidOpaqueId,
  isValidUUID,
  isValidCurrency,
  isValidDatetime,
  isValidInteger,
  fieldError,
} = require('./common');
const problem = require('../problem');

// ---------------------------------------------------------------------------
// Enum values — copied verbatim from openapi.yaml
// openapi.yaml: paths./rentals.get.parameters[0].schema.enum
// ---------------------------------------------------------------------------

/**
 * Valid rental workflow status values.
 * openapi.yaml: status enum for GET /rentals query + Rental.status schema
 */
const RENTAL_STATUS_ENUM = [
  'draft',
  'approved',
  'in_progress',
  'active',
  'completed',
  'cancelled',
  'rejected',
];

// ---------------------------------------------------------------------------
// Required body fields — copied verbatim from openapi.yaml
// openapi.yaml: paths./rentals.post.requestBody.content
//               .application/json.schema.required
// ---------------------------------------------------------------------------
const CREATE_RENTAL_REQUIRED_FIELDS = [
  'equipmentId',
  'contractorId',
  'warehouseAdminId',
  'startTime',
  'endTime',
  'depositAmount',
  'currency',
];

// ---------------------------------------------------------------------------
// Middleware: GET /rentals — query validation
// ---------------------------------------------------------------------------

/**
 * Validate query parameters for GET /rentals.
 * `status` is optional; if present it MUST match the rental status enum.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function validateListRentalsQuery(req, res, next) {
  const { status } = req.query;

  if (status !== undefined) {
    if (!isValidEnum(status, RENTAL_STATUS_ENUM)) {
      const err = fieldError(
        'query.status',
        `Must be one of: ${RENTAL_STATUS_ENUM.join(', ')}. Received: "${status}".`,
      );
      return problem.badRequest(
        res,
        `Query parameter validation failed: ${err.field} — ${err.reason}`,
        req.originalUrl,
        { errors: [err] },
      );
    }
  }

  return next();
}

// ---------------------------------------------------------------------------
// Middleware: POST /rentals — Idempotency-Key header validation
// ---------------------------------------------------------------------------

/**
 * Validate the Idempotency-Key header for POST /rentals.
 * openapi.yaml: Idempotency-Key — required: true, format: uuid
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function validateIdempotencyKeyHeader(req, res, next) {
  // Header names are case-insensitive; Express lowercases them automatically
  const key = req.headers['idempotency-key'];

  if (!key) {
    return problem.badRequest(
      res,
      'Idempotency-Key header is required for this operation.',
      req.originalUrl,
      { errors: [fieldError('header.Idempotency-Key', 'Field is required.')] },
    );
  }

  if (!isValidUUID(key)) {
    return problem.badRequest(
      res,
      'Idempotency-Key must be a valid UUID (RFC 4122).',
      req.originalUrl,
      {
        errors: [
          fieldError(
            'header.Idempotency-Key',
            `Received "${key}". Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.`,
          ),
        ],
      },
    );
  }

  return next();
}

// ---------------------------------------------------------------------------
// Middleware: POST /rentals — request body validation
// ---------------------------------------------------------------------------

/**
 * Validate request body for POST /rentals.
 * All 7 required fields must be present with correct type/format/pattern.
 *
 * openapi.yaml: paths./rentals.post.requestBody.content.application/json.schema
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function validateCreateRentalBody(req, res, next) {
  const errors = [];
  const body = req.body;

  // Guard: body must be a JSON object
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return problem.badRequest(
      res,
      'Request body must be a JSON object.',
      req.originalUrl,
    );
  }

  // --- Required fields presence check ---
  for (const field of CREATE_RENTAL_REQUIRED_FIELDS) {
    if (body[field] === undefined || body[field] === null) {
      errors.push(fieldError(`body.${field}`, 'Field is required.'));
    }
  }

  if (errors.length > 0) {
    return problem.badRequest(
      res,
      `Request body validation failed: ${errors.map((e) => `${e.field} — ${e.reason}`).join('; ')}`,
      req.originalUrl,
      { errors },
    );
  }

  // --- Per-field type/format/pattern validation ---

  // equipmentId: string, pattern '^[a-z]+_[A-Za-z0-9]{6,12}$'
  if (!isValidOpaqueId(body.equipmentId)) {
    errors.push(
      fieldError(
        'body.equipmentId',
        "Must match pattern '^[a-z]+_[A-Za-z0-9]{6,12}$' (e.g. eqp_8X2kAB).",
      ),
    );
  }

  // contractorId: string, pattern '^[a-z]+_[A-Za-z0-9]{6,12}$'
  if (!isValidOpaqueId(body.contractorId)) {
    errors.push(
      fieldError(
        'body.contractorId',
        "Must match pattern '^[a-z]+_[A-Za-z0-9]{6,12}$' (e.g. ctr_72Xp9C).",
      ),
    );
  }

  // warehouseAdminId: string, pattern '^[a-z]+_[A-Za-z0-9]{6,12}$'
  if (!isValidOpaqueId(body.warehouseAdminId)) {
    errors.push(
      fieldError(
        'body.warehouseAdminId',
        "Must match pattern '^[a-z]+_[A-Za-z0-9]{6,12}$' (e.g. adm_19Lq2f).",
      ),
    );
  }

  // startTime: string, format date-time
  if (!isValidDatetime(body.startTime)) {
    errors.push(
      fieldError(
        'body.startTime',
        "Must be a valid ISO 8601 date-time string (e.g. '2026-09-15T08:00:00Z').",
      ),
    );
  }

  // endTime: string, format date-time
  if (!isValidDatetime(body.endTime)) {
    errors.push(
      fieldError(
        'body.endTime',
        "Must be a valid ISO 8601 date-time string (e.g. '2026-09-18T17:00:00Z').",
      ),
    );
  }

  // depositAmount: integer, minimum: 0
  if (!isValidInteger(body.depositAmount, 0)) {
    errors.push(
      fieldError(
        'body.depositAmount',
        'Must be a non-negative integer (minimum: 0).',
      ),
    );
  }

  // currency: string, pattern '^[A-Z]{3}$'
  if (!isValidCurrency(body.currency)) {
    errors.push(
      fieldError(
        'body.currency',
        "Must be a 3-letter ISO 4217 currency code (e.g. 'USD'). Pattern: '^[A-Z]{3}$'.",
      ),
    );
  }

  if (errors.length > 0) {
    return problem.badRequest(
      res,
      `Request body validation failed: ${errors.map((e) => `${e.field} — ${e.reason}`).join('; ')}`,
      req.originalUrl,
      { errors },
    );
  }

  return next();
}

// ---------------------------------------------------------------------------
// Middleware: /rentals/{id} — path parameter validation
// ---------------------------------------------------------------------------

/**
 * Validate the `id` path parameter for /rentals/{id} routes.
 * openapi.yaml: path param id — pattern: '^[a-z]+_[A-Za-z0-9]{6,12}$'
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function validateRentalIdParam(req, res, next) {
  const { id } = req.params;

  if (!isValidOpaqueId(id)) {
    return problem.badRequest(
      res,
      `Path parameter 'id' must match pattern '^[a-z]+_[A-Za-z0-9]{6,12}$'. Received: "${id}".`,
      req.originalUrl,
      {
        errors: [
          fieldError(
            'path.id',
            "Must match pattern '^[a-z]+_[A-Za-z0-9]{6,12}$' (e.g. rnt_3MnB7xP).",
          ),
        ],
      },
    );
  }

  return next();
}

module.exports = {
  RENTAL_STATUS_ENUM,
  CREATE_RENTAL_REQUIRED_FIELDS,
  validateListRentalsQuery,
  validateIdempotencyKeyHeader,
  validateCreateRentalBody,
  validateRentalIdParam,
};
