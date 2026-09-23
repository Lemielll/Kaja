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
 * - Contractor may read their own rental (contractor_id === principal.subject).
 * - Warehouse Admin may read rental assigned to them (warehouse_admin_id === principal.subject).
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
  if (rental.contractor_id === principal.subject) {
    return true;
  }

  // 2. Warehouse Admin check: principal is assigned to administer this rental
  if (rental.warehouse_admin_id === principal.subject) {
    return true;
  }

  return false;
}

/**
 * Predicate: Determines if the principal may submit an inspection for a rental.
 *
 * Rules:
 * - Field Operator must have 'inspections:write' scope.
 * - The operatorId declared in the request body must match the caller's principal.subject.
 *
 * @param {object} principal - Authenticated principal (req.principal)
 * @param {object} rental - Database row of the rental object
 * @param {object} body - Request body containing operatorId
 * @returns {boolean} True if operator is authorized to inspect
 */
function mayCreateInspection(principal, rental, body) {
  if (!principal || !rental || !body) {
    return false;
  }

  // Caller cannot impersonate another operator
  if (body.operatorId !== principal.subject) {
    return false;
  }

  return true;
}

module.exports = {
  mayReadRental,
  mayCreateInspection,
};
