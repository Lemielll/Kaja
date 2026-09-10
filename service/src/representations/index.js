'use strict';

const rentals = require('./rentals');
const equipments = require('./equipments');
const inspections = require('./inspections');

module.exports = {
  rowToRental: rentals.rowToRental,
  rowToEquipment: equipments.rowToEquipment,
  rowToInspection: inspections.rowToInspection,
};