'use strict';

/**
 * Convert an equipment database row into the public Equipment representation.
 * Only fields defined by openapi.yaml are exposed.
 *
 * @param {object} row
 * @returns {object}
 */
function rowToEquipment(row) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    hourlyRate: row.hourly_rate,
    currency: row.currency,
    location: row.location,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  rowToEquipment,
};