'use strict';

const rentals = require('./rentals');
const equipments = require('./equipments');

module.exports = {
  rowToRental: rentals.rowToRental,
  rowToEquipment: equipments.rowToEquipment,
};