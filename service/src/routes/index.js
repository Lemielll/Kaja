'use strict';

const express = require('express');
const equipmentRoutes = require('./equipments');
const rentalRoutes = require('./rentals');

const router = express.Router();

router.use(equipmentRoutes);
router.use(rentalRoutes);

module.exports = router;