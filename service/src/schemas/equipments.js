/**
 * Equipment Schema Validation
 * File: service/src/schemas/equipments.js
 *
 * Mirrors openapi.yaml → paths./equipments.get.parameters exactly.
 * Validates query parameters for GET /equipments BEFORE the store is touched.
 * Returns HTTP 400 on any violation.
 *
 * CONTRACT RULE: enum values here MUST stay identical to openapi.yaml.
 * Any change requires a formal contract revision by the Contract Owner.
 */

'use strict';

const { isValidEnum, fieldError } = require('./common');
const problem = require('../problem');

// ---------------------------------------------------------------------------
// Enum values — copied verbatim from openapi.yaml
// openapi.yaml: paths./equipments.get.parameters[0].schema.enum
// ---------------------------------------------------------------------------

/**
 * Valid equipment operational status values.
 * openapi.yaml: status enum for GET /equipments
 */
const EQUIPMENT_STATUS_ENUM = [
  'available',
  'reserved',
  'in_progress',
  'maintenance',
  'out_of_service',
];

/**
 * Valid equipment machine class values.
 * openapi.yaml: type enum for GET /equipments
 */
const EQUIPMENT_TYPE_ENUM = [
  'excavator',
  'wheel_loader',
  'bulldozer',
  'crane',
  'compactor',
];

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate query parameters for GET /equipments.
 * Both `status` and `type` are optional (required: false in openapi.yaml).
 * If present, they MUST match the defined enum.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function validateListEquipmentsQuery(req, res, next) {
  const errors = [];
  const { status, type } = req.query;

  // Validate `status` query parameter (optional)
  if (status !== undefined) {
    if (!isValidEnum(status, EQUIPMENT_STATUS_ENUM)) {
      errors.push(
        fieldError(
          'query.status',
          `Must be one of: ${EQUIPMENT_STATUS_ENUM.join(', ')}. Received: "${status}".`,
        ),
      );
    }
  }

  // Validate `type` query parameter (optional)
  if (type !== undefined) {
    if (!isValidEnum(type, EQUIPMENT_TYPE_ENUM)) {
      errors.push(
        fieldError(
          'query.type',
          `Must be one of: ${EQUIPMENT_TYPE_ENUM.join(', ')}. Received: "${type}".`,
        ),
      );
    }
  }

  if (errors.length > 0) {
    return problem.badRequest(
      res,
      `Query parameter validation failed: ${errors.map((e) => `${e.field} — ${e.reason}`).join('; ')}`,
      req.originalUrl,
      { errors },
    );
  }

  return next();
}

module.exports = {
  EQUIPMENT_STATUS_ENUM,
  EQUIPMENT_TYPE_ENUM,
  validateListEquipmentsQuery,
};
