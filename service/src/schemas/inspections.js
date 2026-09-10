/**
 * Inspection Schema Validation
 * File: service/src/schemas/inspections.js
 *
 * Mirrors openapi.yaml → paths./rentals/{id}/inspections.post.requestBody exactly.
 * Validates request body for POST /rentals/{id}/inspections BEFORE the store is touched.
 * Returns HTTP 400 on any schema violation.
 *
 * CONTRACT RULE: enum values and required fields here MUST stay identical to openapi.yaml.
 * Any change requires a formal contract revision by the Contract Owner.
 */

'use strict';

const {
  isValidOpaqueId,
  isValidEnum,
  isValidDatetime,
  fieldError,
} = require('./common');
const problem = require('../problem');

// ---------------------------------------------------------------------------
// Enum values — copied verbatim from openapi.yaml
// openapi.yaml: paths./rentals/{id}/inspections.post.requestBody.content
//               .application/json.schema.properties.status.enum
// ---------------------------------------------------------------------------

/**
 * Valid inspection status values.
 * openapi.yaml: status enum for POST /rentals/{id}/inspections body
 */
const INSPECTION_STATUS_ENUM = [
  'pending_review',
  'in_progress',
  'pass',
  'fail',
];

// ---------------------------------------------------------------------------
// Required fields — copied verbatim from openapi.yaml
// openapi.yaml: paths./rentals/{id}/inspections.post.requestBody
//               .content.application/json.schema.required
// ---------------------------------------------------------------------------
const INSPECTION_REQUIRED_FIELDS = [
  'equipmentId',
  'operatorId',
  'status',
  'inspectedAt',
  'notes',
];

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate request body for POST /rentals/{id}/inspections.
 * Required fields: equipmentId, operatorId, status, inspectedAt, notes.
 * Optional fields: defectSummary.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function validateCreateInspectionBody(req, res, next) {
  const errors = [];
  const body = req.body;

  // Guard: body must be a JSON object (express.json() already parsed it)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return problem.badRequest(
      res,
      'Request body must be a JSON object.',
      req.originalUrl,
    );
  }

  // --- Required fields presence check ---
  for (const field of INSPECTION_REQUIRED_FIELDS) {
    if (body[field] === undefined || body[field] === null) {
      errors.push(fieldError(`body.${field}`, 'Field is required.'));
    }
  }

  // Return early so per-field validators below don't produce redundant errors
  if (errors.length > 0) {
    return problem.badRequest(
      res,
      `Request body validation failed: ${errors.map((e) => `${e.field} — ${e.reason}`).join('; ')}`,
      req.originalUrl,
      { errors },
    );
  }

  // --- Per-field type/format validation ---

  // equipmentId: string, pattern '^[a-z]+_[A-Za-z0-9]{6,12}$'
  if (!isValidOpaqueId(body.equipmentId)) {
    errors.push(
      fieldError(
        'body.equipmentId',
        "Must be a string matching pattern '^[a-z]+_[A-Za-z0-9]{6,12}$' (e.g. eqp_8X2kAB).",
      ),
    );
  }

  // operatorId: string, pattern '^[a-z]+_[A-Za-z0-9]{6,12}$'
  if (!isValidOpaqueId(body.operatorId)) {
    errors.push(
      fieldError(
        'body.operatorId',
        "Must be a string matching pattern '^[a-z]+_[A-Za-z0-9]{6,12}$' (e.g. opr_84Qm1a).",
      ),
    );
  }

  // status: string, enum
  if (!isValidEnum(body.status, INSPECTION_STATUS_ENUM)) {
    errors.push(
      fieldError(
        'body.status',
        `Must be one of: ${INSPECTION_STATUS_ENUM.join(', ')}. Received: "${body.status}".`,
      ),
    );
  }

  // inspectedAt: string, format date-time
  if (!isValidDatetime(body.inspectedAt)) {
    errors.push(
      fieldError(
        'body.inspectedAt',
        "Must be a valid ISO 8601 date-time string (e.g. '2026-09-17T10:45:00Z').",
      ),
    );
  }

  // notes: string (required, no further format constraint in openapi.yaml)
  if (typeof body.notes !== 'string' || body.notes.length === 0) {
    errors.push(fieldError('body.notes', 'Must be a non-empty string.'));
  }

  // defectSummary: string (optional)
  if (body.defectSummary !== undefined && typeof body.defectSummary !== 'string') {
    errors.push(fieldError('body.defectSummary', 'Must be a string when provided.'));
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

module.exports = {
  INSPECTION_STATUS_ENUM,
  INSPECTION_REQUIRED_FIELDS,
  validateCreateInspectionBody,
};
