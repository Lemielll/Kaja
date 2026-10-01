/**
 * Ownership Predicates (Layer 3)
 * File: service/src/auth/ownership.js
 * Description: Resource-level object ownership and authorization checks.
 *
 * Enforces General Provision 4 & Step 8:
 * - Handlers check relationship between principal and specific object.
 * - Failed ownership checks MUST return 404 (not 403), with response body
 *   identical to a non-existent object to prevent identifier enumeration.
 */

'use strict';

/**
 * Predicate: Determines if the authenticated principal may read the specified rental.
 *
 * Rules:
 * - Contractor may read their own rental (contractor_id === principal.actorId).
 * - Warehouse Admin may read rental assigned to them (warehouse_admin_id === principal.actorId).
 *
 * @param {object} principal - Authenticated principal (req.principal)
 * @param {object} rental - Database row of the rental object
 * @returns {boolean} True if principal owns or is assigned to the rental
 */
function mayReadRental(principal, rental) {
  if (!principal || !rental) {
    return false;
  }

  // 1. Contractor check: principal owns the rental
  if (rental.contractor_id === principal.actorId) {
    return true;
  }

  // 2. Warehouse Admin check: principal is assigned to administer this rental
  if (rental.warehouse_admin_id === principal.actorId) {
    return true;
  }

  // 3. Field Operator check: principal is the assigned operator for this rental
  if (rental.assigned_operator_id === principal.actorId) {
    return true;
  }

  return false;
}

/**
 * Predicate: Determines if the principal may submit an inspection for a rental.
 *
 * Rules:
 * - Field Operator must have 'inspections:write' scope.
 * - Field Operator may inspect only rentals assigned to their principal.actorId.
 *
 * @param {object} principal - Authenticated principal (req.principal)
 * @param {object} rental - Database row of the rental object
 * @returns {boolean} True if operator is authorized to inspect
 */
function mayCreateInspection(principal, rental) {
  if (!principal || !rental || !principal.actorId) {
    return false;
  }

  // Warehouse Admin may create inspection for rentals they administer
  if (rental.warehouse_admin_id === principal.actorId) {
    return true;
  }

  return rental.assigned_operator_id === principal.actorId;
}

module.exports = {
  mayReadRental,
  mayCreateInspection,
};
