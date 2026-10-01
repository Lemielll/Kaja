'use strict';

const express = require('express');
const schemas = require('../schemas');
const problem = require('../problem');
const representations = require('../representations');
const equipmentStore = require('../store/equipments');
const { requireScope } = require('../auth/require-scope');
const conditional = require('../middleware/conditional');

const router = express.Router();

router.get(
  '/equipments',
  requireScope('equipment:read'),
  schemas.validateListEquipmentsQuery,
  async (req, res) => {
    try {
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.type) filters.type = req.query.type;

      const rows = await equipmentStore.getAllEquipments(filters);
      const body = rows.map(representations.rowToEquipment);

      // Session 5 Step 8: ETag and conditional read (304)
      const etag = conditional.etagOf(body);
      res.set('ETag', etag);
      res.set('Cache-Control', 'private, no-cache');

      // If-None-Match matches → 304 (no body, but ETag + CORS headers still present)
      if (conditional.check304(req, res, etag)) return;

      return res.status(200).json(body);
    } catch (err) {
      console.error('[ROUTE EQUIPMENTS] GET /equipments error:', err.message);
      return problem.internalError(res, req.originalUrl);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /equipments
// Create equipment unit (Warehouse Admin)
// ---------------------------------------------------------------------------
router.post(
  '/equipments',
  requireScope('equipment:read'),
  async (req, res) => {
    try {
      const { type, hourlyRate, currency = 'USD', location, status = 'available' } = req.body || {};
      const validTypes = ['excavator', 'wheel_loader', 'bulldozer', 'crane', 'compactor'];
      const validStatuses = ['available', 'reserved', 'in_progress', 'maintenance', 'out_of_service'];

      if (!type || !validTypes.includes(type)) {
        return problem.badRequest(res, `Tipe alat '${type}' tidak valid. Pilihan: ${validTypes.join(', ')}`, req.originalUrl);
      }
      if (!location || typeof location !== 'string' || !location.trim()) {
        return problem.badRequest(res, 'Lokasi gudang wajib diisi.', req.originalUrl);
      }
      if (typeof hourlyRate !== 'number' || hourlyRate < 0) {
        return problem.badRequest(res, 'Tarif sewa per jam harus berupa angka non-negatif.', req.originalUrl);
      }
      if (!validStatuses.includes(status)) {
        return problem.badRequest(res, `Status '${status}' tidak valid. Pilihan: ${validStatuses.join(', ')}`, req.originalUrl);
      }

      const row = await equipmentStore.insertEquipment({
        type,
        hourlyRate: Math.round(hourlyRate),
        currency: currency.toUpperCase(),
        location: location.trim(),
        status,
      });

      const body = representations.rowToEquipment(row);
      return res.status(201).json(body);
    } catch (err) {
      console.error('[ROUTE EQUIPMENTS] POST /equipments error:', err.message);
      return problem.internalError(res, req.originalUrl);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /equipments/:id/status (and PATCH /equipments/:id)
// Update equipment status (Warehouse Admin)
// ---------------------------------------------------------------------------
async function handleUpdateEquipmentStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const validStatuses = ['available', 'reserved', 'in_progress', 'maintenance', 'out_of_service'];

    if (!status || !validStatuses.includes(status)) {
      return problem.badRequest(res, `Status '${status}' tidak valid. Pilihan: ${validStatuses.join(', ')}`, req.originalUrl);
    }

    const existing = await equipmentStore.getEquipmentById(id);
    if (!existing) {
      return problem.notFound(res, `Unit armada ${id} tidak ditemukan.`, req.originalUrl);
    }

    const updated = await equipmentStore.updateEquipmentStatus(id, status);
    const body = representations.rowToEquipment(updated);
    return res.status(200).json(body);
  } catch (err) {
    console.error(`[ROUTE EQUIPMENTS] PATCH status error for ${req.params.id}:`, err.message);
    return problem.internalError(res, req.originalUrl);
  }
}

router.patch('/equipments/:id/status', requireScope('equipment:read'), handleUpdateEquipmentStatus);
router.patch('/equipments/:id', requireScope('equipment:read'), handleUpdateEquipmentStatus);

// ---------------------------------------------------------------------------
// DELETE /equipments/:id
// Delete equipment unit (Warehouse Admin)
// ---------------------------------------------------------------------------
router.delete(
  '/equipments/:id',
  requireScope('equipment:read'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await equipmentStore.getEquipmentById(id);
      if (!existing) {
        return problem.notFound(res, `Unit armada ${id} tidak ditemukan.`, req.originalUrl);
      }

      await equipmentStore.deleteEquipment(id);
      return res.status(204).send();
    } catch (err) {
      console.error(`[ROUTE EQUIPMENTS] DELETE error for ${req.params.id}:`, err.message);
      return problem.internalError(res, req.originalUrl);
    }
  },
);

module.exports = router;