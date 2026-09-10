/**
 * Schema Validation Index
 * File: service/src/schemas/index.js
 *
 * Central export point for all validation middleware.
 * Routes MUST import from this file rather than individual schema files directly
 * to maintain a single, auditable contract surface.
 *
 * Schema modules mirror openapi.yaml 1:1.
 * Contract Owner (Contract Owner role) owns all files in this directory.
 */

'use strict';

const common      = require('./common');
const equipments  = require('./equipments');
const rentals     = require('./rentals');
const inspections = require('./inspections');

module.exports = {
  // -------------------------------------------------------------------------
  // Shared primitives (patterns, helpers)
  // -------------------------------------------------------------------------
  common,

  // -------------------------------------------------------------------------
  // GET /equipments
  // -------------------------------------------------------------------------
  /** Validate query params: status, type */
  validateListEquipmentsQuery: equipments.validateListEquipmentsQuery,

  // -------------------------------------------------------------------------
  // GET /rentals
  // -------------------------------------------------------------------------
  /** Validate query param: status */
  validateListRentalsQuery: rentals.validateListRentalsQuery,

  // -------------------------------------------------------------------------
  // POST /rentals
  // -------------------------------------------------------------------------
  /** Validate Idempotency-Key header (required, uuid format) */
  validateIdempotencyKeyHeader: rentals.validateIdempotencyKeyHeader,

  /** Validate request body (all 7 required fields + format/pattern checks) */
  validateCreateRentalBody: rentals.validateCreateRentalBody,

  // -------------------------------------------------------------------------
  // GET /rentals/{id}  &  POST /rentals/{id}/inspections (shared path param)
  // -------------------------------------------------------------------------
  /** Validate :id path param against opaque ID pattern */
  validateRentalIdParam: rentals.validateRentalIdParam,

  // -------------------------------------------------------------------------
  // POST /rentals/{id}/inspections
  // -------------------------------------------------------------------------
  /** Validate request body for inspection creation */
  validateCreateInspectionBody: inspections.validateCreateInspectionBody,

  // -------------------------------------------------------------------------
  // Enum constants (useful for tests and route handlers)
  // -------------------------------------------------------------------------
  EQUIPMENT_STATUS_ENUM:  equipments.EQUIPMENT_STATUS_ENUM,
  EQUIPMENT_TYPE_ENUM:    equipments.EQUIPMENT_TYPE_ENUM,
  RENTAL_STATUS_ENUM:     rentals.RENTAL_STATUS_ENUM,
  INSPECTION_STATUS_ENUM: inspections.INSPECTION_STATUS_ENUM,
};
