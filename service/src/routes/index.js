'use strict';

const express = require('express');
const rentalRoutes = require('./rentals');

const router = express.Router();

router.use(rentalRoutes);

module.exports = router;