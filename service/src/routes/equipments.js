'use strict';

const express = require('express');
const schemas = require('../schemas');
const representations = require('../representations');
const problem = require('../problem');
const equipmentStore = require('../store/equipments');

const router = express.Router();

router.get(
  '/equipments',
  schemas.validateListEquipmentsQuery,
  async (req, res) => {
    try {
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.type) filters.type = req.query.type;

      const rows = await equipmentStore.getAllEquipments(filters);
      return res.status(200).json(rows.map(representations.rowToEquipment));
    } catch (err) {
      console.error('[ROUTE EQUIPMENTS] GET /equipments error:', err.message);
      return problem.internalError(res, req.originalUrl);
    }
  },
);

module.exports = router;