/**
 * Rental & Inspection Routes
 * File: service/src/routes/rentals.js
 *
 * Mounts schema validation middleware BEFORE any store/database call.
 * Schema validators (Contract Owner) guard the contract.
 * Store functions (Service Owner) handle persistence.
 *
 * Endpoints covered:
 *   GET  /rentals
 *   POST /rentals
 *   GET  /rentals/:id
 *   POST /rentals/:id/inspections
 */

'use strict';

const express = require('express');
const schemas = require('../schemas');
const problem = require('../problem');
const representations = require('../representations');
const rentalStore = require('../store/rentals');
const idempotencyStore = require('../store/idempotency');
const inspectionStore = require('../store/inspections');
const { requireScope } = require('../auth/require-scope');
const ownership = require('../auth/ownership');
const conditional = require('../middleware/conditional');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /rentals
// openapi.yaml: operationId listRentals
// Responses: 200 (array of Rental), 400 (BadRequest)
// ---------------------------------------------------------------------------
router.get(
  '/rentals',
  requireScope('rentals:read'),
  schemas.validateListRentalsQuery,   // ← Contract Owner guard (400 on bad query)
  async (req, res) => {
    try {
      const filters = {};
      if (req.query.status) filters.status = req.query.status;

      // Constrain query to principal's ownership context (Session 4: Step 8d)
      if (req.principal?.subject?.startsWith('adm_') || req.principal?.subject?.includes('admin')) {
        filters.warehouseAdminId = req.principal.subject;
      } else if (req.principal?.subject) {
        filters.contractorId = req.principal.subject;
      }

      const rows = await rentalStore.getAllRentals(filters);
      const body = rows.map(representations.rowToRental);

      // Session 5 Step 8: ETag and conditional read (304)
      const etag = conditional.etagOf(body);
      res.set('ETag', etag);
      res.set('Cache-Control', 'private, no-cache');

      // If-None-Match matches → 304 (no body, but ETag + CORS headers still present)
      if (conditional.check304(req, res, etag)) return;

      return res.status(200).json(body);
    } catch (err) {
      console.error('[ROUTE RENTALS] GET /rentals error:', err.message);
      return problem.internalError(res, req.originalUrl);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /rentals
// openapi.yaml: operationId createRental
// Responses: 201 (Rental), 400, 409, 422
// ---------------------------------------------------------------------------
router.post(
  '/rentals',
  requireScope('rentals:write'),
  schemas.validateIdempotencyKeyHeader, // ← Contract Owner guard: header required + uuid
  schemas.validateCreateRentalBody,     // ← Contract Owner guard: body required fields + format
  async (req, res) => {
    const idempotencyKey = req.headers['idempotency-key'];
    const body = req.body;

    try {
      // --- Idempotency check ---
      const existing = await idempotencyStore.getIdempotencyRecord(idempotencyKey);

      if (existing) {
        const incomingHash = idempotencyStore.computeBodyHash(body);

        if (existing.request_hash !== incomingHash) {
          // Same key, different body → 409 idempotency-key-reuse
          return problem.conflict(
            res,
            'idempotency-key-reuse',
            'Idempotency key was reused for a different request',
            'The supplied key is already associated with another request body.',
            req.originalUrl,
          );
        }

        // Same key + same body → replay stored response
        const storedBody = typeof existing.response_body === 'string'
          ? JSON.parse(existing.response_body)
          : existing.response_body;

        if (existing.response_status === 201 && storedBody.id) {
          res.location(`/rentals/${storedBody.id}`);
        }

        return res
          .status(existing.response_status)
          .json(storedBody);
      }

      // --- Create rental ---
      const row = await rentalStore.insertRental({
        equipmentId: body.equipmentId,
        contractorId: body.contractorId,
        warehouseAdminId: body.warehouseAdminId,
        startTime: body.startTime,
        endTime: body.endTime,
        depositAmount: body.depositAmount,
        currency: body.currency,
      });

      const rental = representations.rowToRental(row);

      // --- Persist idempotency record ---
      await idempotencyStore.saveIdempotencyRecord({
        key: idempotencyKey,
        requestHash: idempotencyStore.computeBodyHash(body),
        responseStatus: 201,
        responseBody: rental,
      });

      return res
        .location(`/rentals/${rental.id}`)
        .status(201)
        .json(rental);
    } catch (err) {
      console.error('[ROUTE RENTALS] POST /rentals error:', err.message);
      return problem.internalError(res, req.originalUrl);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /rentals/:id
// openapi.yaml: operationId getRentalById
// Responses: 200 (Rental), 404
// ---------------------------------------------------------------------------
router.get(
  '/rentals/:id',
  requireScope('rentals:read'),
  schemas.validateRentalIdParam,   // ← Contract Owner guard: path param pattern
  async (req, res) => {
    try {
      const row = await rentalStore.getRentalById(req.params.id);

      if (!row) {
        return problem.notFound(
          res,
          `Rental ${req.params.id} does not exist.`,
          req.originalUrl,
        );
      }

      // Layer 3: Object ownership check (Session 4: Step 8c)
      // Must return identical 404 to prevent ID enumeration
      if (!ownership.mayReadRental(req.principal, row)) {
        return problem.notFound(
          res,
          `Rental ${req.params.id} does not exist.`,
          req.originalUrl,
        );
      }

      const body = representations.rowToRental(row);

      // Session 5 Step 8: ETag from version for single entity
      const etag = conditional.etagFromVersion(row);
      res.set('ETag', etag);
      res.set('Cache-Control', 'private, no-cache');

      // If-None-Match matches → 304
      if (conditional.check304(req, res, etag)) return;

      return res.status(200).json(body);
    } catch (err) {
      console.error(`[ROUTE RENTALS] GET /rentals/${req.params.id} error:`, err.message);
      return problem.internalError(res, req.originalUrl);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /rentals/:id/inspections
// openapi.yaml: operationId createInspection
// Responses: 201 (Inspection), 400, 404, 409, 422
// ---------------------------------------------------------------------------
router.post(
  '/rentals/:id/inspections',
  requireScope('inspections:write'),
  schemas.validateRentalIdParam,          // ← Contract Owner guard: path param
  schemas.validateIdempotencyKeyHeader,   // ← Contract Owner guard: header required + uuid
  schemas.validateCreateInspectionBody,   // ← Contract Owner guard: body fields + format
  async (req, res) => {
    const rentalId = req.params.id;
    const idempotencyKey = req.headers['idempotency-key'];
    const body = req.body;

    try {
      // --- Idempotency check ---
      const existing = await idempotencyStore.getIdempotencyRecord(idempotencyKey);

      if (existing) {
        const incomingHash = idempotencyStore.computeBodyHash(body);

        if (existing.request_hash !== incomingHash) {
          return problem.conflict(
            res,
            'idempotency-key-reuse',
            'Idempotency key was reused for a different request',
            'The supplied key is already associated with another request body.',
            req.originalUrl,
          );
        }

        const storedBody = typeof existing.response_body === 'string'
          ? JSON.parse(existing.response_body)
          : existing.response_body;

        if (existing.response_status === 201 && storedBody.id) {
          res.location(`/rentals/${rentalId}/inspections/${storedBody.id}`);
        }

        return res.status(existing.response_status).json(storedBody);
      }

      // --- Verify rental exists ---
      const rental = await rentalStore.getRentalById(rentalId);
      if (!rental) {
        return problem.notFound(
          res,
          `Rental ${rentalId} does not exist.`,
          req.originalUrl,
        );
      }

      // --- Layer 3: Object ownership & operator check BEFORE any change ---
      if (!ownership.mayCreateInspection(req.principal, rental, body)) {
        return problem.notFound(
          res,
          `Rental ${rentalId} does not exist.`,
          req.originalUrl,
        );
      }

      // --- Session 5 Step 9: If-Match check for conditional write ---
      // Check rental version to prevent race conditions (rental cancelled while inspection submitted)
      const ifMatch = req.get('If-Match');
      const currentETag = conditional.etagFromVersion(rental);

      // Optional: require If-Match (needs Contract Owner coordination for 428 in openapi.yaml)
      // Uncomment if 428 is added to contract:
      // if (!ifMatch) {
      //   return problem.preconditionRequired(
      //     res,
      //     'If-Match header is required for this operation.',
      //     req.originalUrl,
      //   );
      // }

      // If If-Match provided, check it matches current version
      if (ifMatch && !conditional.matchHits(ifMatch, currentETag)) {
        return problem.preconditionFailed(
          res,
          'The rental state has changed since you last retrieved it. Please refresh and try again.',
          req.originalUrl,
          currentETag,
        );
      }

      // --- Business Rule Check: Equipment association ---
      if (body.equipmentId !== rental.equipment_id) {
        return problem.unprocessable(
          res,
          'inspection-rule-violation',
          'Inspection cannot be processed',
          `Equipment '${body.equipmentId}' does not match equipment '${rental.equipment_id}' associated with rental '${rentalId}'.`,
          req.originalUrl,
        );
      }

      // --- Business Rule Check: Rental status viability ---
      if (rental.status === 'cancelled' || rental.status === 'rejected') {
        return problem.unprocessable(
          res,
          'inspection-rule-violation',
          'Inspection cannot be processed',
          `Cannot record inspection for a rental in '${rental.status}' status.`,
          req.originalUrl,
        );
      }

      // --- Conflict Check: Duplicate inspection for same event/time ---
      const duplicate = await inspectionStore.findDuplicateInspection(rentalId, body.inspectedAt);
      if (duplicate) {
        return problem.conflict(
          res,
          'inspection-conflict',
          'Inspection conflicts with the current equipment state',
          'An inspection for this equipment and event has already been recorded.',
          req.originalUrl,
          { conflictingRentalId: rentalId },
        );
      }

      // --- Insert Inspection into persistent store ---
      const row = await inspectionStore.insertInspection({
        rentalId,
        equipmentId: body.equipmentId,
        operatorId: body.operatorId,
        status: body.status,
        inspectedAt: body.inspectedAt,
        notes: body.notes,
        defectSummary: body.defectSummary,
      });

      const inspection = representations.rowToInspection(row);

      // --- Persist idempotency record ---
      await idempotencyStore.saveIdempotencyRecord({
        key: idempotencyKey,
        requestHash: idempotencyStore.computeBodyHash(body),
        responseStatus: 201,
        responseBody: inspection,
      });

      return res
        .location(`/rentals/${rentalId}/inspections/${inspection.id}`)
        .status(201)
        .json(inspection);
    } catch (err) {
      console.error(`[ROUTE RENTALS] POST /rentals/${rentalId}/inspections error:`, err.message);
      return problem.internalError(res, req.originalUrl);
    }
  },
);

module.exports = router;
