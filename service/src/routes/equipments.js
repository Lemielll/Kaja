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

module.exports = router;