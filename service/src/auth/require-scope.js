/**
 * Scope Authorization Middleware (Layer 2)
 * File: service/src/auth/require-scope.js
 * Description: Enforces scope-based authorization.
 * 
 * NOTE: This file is a placeholder. Full implementation will be completed by
 * Hafidz/Dhafin in Step 7 after scope vocabulary is finalized.
 */

'use strict';

const { unauthorized, forbidden } = require('../problem');

/**
 * Middleware factory that enforces Layer 2 scope-based authorization.
 *
 * Verifies that the authenticated principal possesses all of the required scopes
 * declared for the operation in openapi.yaml.
 *
 * Responses:
 * - 401 Unauthorized if req.principal is missing or null
 * - 403 Forbidden with WWW-Authenticate if principal lacks any required scope
 * - next() if all scopes are present
 *
 * @param {...string} needed - One or more scopes required for the operation
 * @returns {import('express').RequestHandler} Express middleware
 */
function requireScope(...needed) {
  return function (req, res, next) {
    const principal = req.principal;

    if (!principal) {
      return unauthorized(res, 'invalid_token');
    }

    const hasAllScopes = needed.every((scope) => principal.scopes && principal.scopes.includes(scope));
    if (!hasAllScopes) {
      return forbidden(res, needed);
    }

    return next();
  };
}

module.exports = { requireScope };

