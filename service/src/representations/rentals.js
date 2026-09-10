'use strict';

/**
 * Convert a rental database row into the public Rental representation.
 * Only fields defined by openapi.yaml are exposed.
 *
 * @param {object} row
 * @returns {object}
 */
function rowToRental(row) {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    contractorId: row.contractor_id,
    warehouseAdminId: row.warehouse_admin_id,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
    depositAmount: row.deposit_amount,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  rowToRental,
};