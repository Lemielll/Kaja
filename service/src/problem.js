/**
 * RFC 9457 Problem Details Helper
 * File: service/src/problem.js
 *
 * Builds problem+json responses that match openapi.yaml components/schemas/Problem exactly.
 * Required fields: type, title, status, detail, instance.
 * Optional extension fields: unavailableDates, conflictingRentalId.
 *
 * Contract: Do NOT change field names or remove required fields without a formal
 * openapi.yaml revision and CHANGELOG entry by the Contract Owner.
 */

'use strict';

const BASE_PROBLEM_URI = 'https://api.heavyrental.co/problems';

/**
 * Internal factory for a Problem Details object.
 * @param {object} opts
 * @param {string}   opts.type     - Problem type URI (stable, bookmarkable)
 * @param {string}   opts.title    - Short, human-readable summary (same for all occurrences)
 * @param {number}   opts.status   - HTTP status code (100–599)
 * @param {string}   opts.detail   - Specific explanation for this occurrence
 * @param {string}   opts.instance - URI identifying this specific occurrence
 * @param {object}  [opts.extra]   - Optional extension fields (e.g. conflictingRentalId)
 * @returns {object} RFC 9457-compliant problem body
 */
function buildProblem({ type, title, status, detail, instance, extra = {} }) {
  return {
    type,
    title,
    status,
    detail,
    instance,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// 400 Bad Request
// openapi.yaml: components/responses/BadRequest
// ---------------------------------------------------------------------------

/**
 * Sends a 400 Bad Request problem response.
 * Use when the client supplied invalid / malformed input (query, path, header, body schema).
 *
 * @param {import('express').Response} res
 * @param {string} detail   - Specific reason for rejection
 * @param {string} instance - Request URI (e.g. '/v1/rentals')
 * @param {object} [extra]  - Optional extension fields
 */
function badRequest(res, detail, instance, extra = {}) {
  const body = buildProblem({
    type: `${BASE_PROBLEM_URI}/invalid-request`,
    title: 'Invalid request',
    status: 400,
    detail,
    instance,
    extra,
  });
  return res.status(400).type('application/problem+json').json(body);
}

// ---------------------------------------------------------------------------
// 404 Not Found
// openapi.yaml: components/responses/NotFound
// ---------------------------------------------------------------------------

/**
 * Sends a 404 Not Found problem response.
 * Use when the specified resource does not exist.
 *
 * @param {import('express').Response} res
 * @param {string} detail   - Which resource was not found
 * @param {string} instance - Request URI
 */
function notFound(res, detail, instance) {
  const body = buildProblem({
    type: `${BASE_PROBLEM_URI}/resource-not-found`,
    title: 'Resource not found',
    status: 404,
    detail,
    instance,
  });
  return res.status(404).type('application/problem+json').json(body);
}

// ---------------------------------------------------------------------------
// 409 Conflict
// openapi.yaml: components/responses/Conflict
// ---------------------------------------------------------------------------

/**
 * Sends a 409 Conflict problem response.
 * Use for schedule conflicts, idempotency-key reuse, or request-in-progress.
 *
 * @param {import('express').Response} res
 * @param {'rental-schedule-conflict'|'idempotency-key-reuse'|'idempotency-request-in-progress'|'inspection-conflict'} subtype
 * @param {string} title    - Short summary of the conflict
 * @param {string} detail   - Specific explanation
 * @param {string} instance - Request URI
 * @param {object} [extra]  - Optional: conflictingRentalId, unavailableDates
 * @param {import('express').Response} [headers] - Optional headers (e.g. Retry-After)
 */
function conflict(res, subtype, title, detail, instance, extra = {}, retryAfter = null) {
  if (retryAfter !== null) {
    res.setHeader('Retry-After', String(retryAfter));
  }
  const body = buildProblem({
    type: `${BASE_PROBLEM_URI}/${subtype}`,
    title,
    status: 409,
    detail,
    instance,
    extra,
  });
  return res.status(409).type('application/problem+json').json(body);
}

// ---------------------------------------------------------------------------
// 422 Unprocessable Entity
// openapi.yaml: components/responses/UnprocessableEntity
// ---------------------------------------------------------------------------

/**
 * Sends a 422 Unprocessable Entity problem response.
 * Use when the request is well-formed but violates a business rule.
 *
 * @param {import('express').Response} res
 * @param {'request-validation-failed'|'rental-rule-violation'|'inspection-rule-violation'} subtype
 * @param {string} title    - Short summary
 * @param {string} detail   - Business rule that was violated
 * @param {string} instance - Request URI
 * @param {object} [extra]  - Optional extension fields
 */
function unprocessable(res, subtype, title, detail, instance, extra = {}) {
  const body = buildProblem({
    type: `${BASE_PROBLEM_URI}/${subtype}`,
    title,
    status: 422,
    detail,
    instance,
    extra,
  });
  return res.status(422).type('application/problem+json').json(body);
}

// ---------------------------------------------------------------------------
// 401 Unauthorized
// Session 4: Authentication Layer
// ---------------------------------------------------------------------------

/**
 * Sends a 401 Unauthorized problem response.
 * Use when the access token is missing, invalid, or expired.
 *
 * @param {import('express').Response} res
 * @param {string} error - OAuth 2.0 error code (e.g., 'invalid_token')
 */
function unauthorized(res, error = 'invalid_token') {
  res.set('WWW-Authenticate', `Bearer error="${error}"`);
  const body = buildProblem({
    type: `${BASE_PROBLEM_URI}/unauthenticated`,
    title: 'Unauthenticated',
    status: 401,
    detail: 'Valid authentication credentials are required.',
    instance: res.req?.originalUrl ?? '/',
  });
  return res.status(401).type('application/problem+json').json(body);
}

// ---------------------------------------------------------------------------
// 403 Forbidden
// Session 4: Authorization Layer
// ---------------------------------------------------------------------------

/**
 * Sends a 403 Forbidden problem response.
 * Use when the token is valid but lacks required scopes or permissions.
 *
 * @param {import('express').Response} res
 * @param {string[]} needed - Array of scopes that would grant access
 */
function forbidden(res, needed = []) {
  const scopeList = needed.join(' ');
  res.set('WWW-Authenticate', `Bearer error="insufficient_scope", scope="${scopeList}"`);
  const body = buildProblem({
    type: `${BASE_PROBLEM_URI}/insufficient-scope`,
    title: 'Insufficient scope',
    status: 403,
    detail: `This operation requires one or more of the following scopes: ${scopeList}`,
    instance: res.req?.originalUrl ?? '/',
  });
  return res.status(403).type('application/problem+json').json(body);
}

// ---------------------------------------------------------------------------
// 500 Internal Server Error (safety net — not in openapi.yaml contract)
// ---------------------------------------------------------------------------

/**
 * Sends a 500 Internal Server Error problem response.
 * Should only be used by the global error handler; not part of the public contract.
 *
 * @param {import('express').Response} res
 * @param {string} instance - Request URI
 */
function internalError(res, instance) {
  const body = buildProblem({
    type: `${BASE_PROBLEM_URI}/internal-error`,
    title: 'Internal server error',
    status: 500,
    detail: 'An unexpected error occurred. Please try again later.',
    instance,
  });
  return res.status(500).type('application/problem+json').json(body);
}

module.exports = {
  buildProblem,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
  internalError,
};
