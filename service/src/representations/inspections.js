'use strict';

/**
 * Inspection Representation Module
 * File: service/src/representations/inspections.js
 *
 * Converts an inspection database row into the public Inspection representation.
 * Only fields defined by openapi.yaml are exposed.
 *
 * @param {object} row - Raw database row from inspections table
 * @returns {object} Public Inspection representation conforming to openapi.yaml
 */
function rowToInspection(row) {
  if (!row) {
    return null;
  }

  const inspectedAt = row.inspected_at instanceof Date
    ? row.inspected_at.toISOString()
    : row.inspected_at;

  const inspection = {
    id: row.id,
    rentalId: row.rental_id,
    equipmentId: row.equipment_id,
    operatorId: row.operator_id,
    status: row.status,
    inspectedAt,
    notes: row.notes,
  };

  if (row.defect_summary !== undefined && row.defect_summary !== null) {
    inspection.defectSummary = row.defect_summary;
  }

  return inspection;
}

module.exports = {
  rowToInspection,
};
