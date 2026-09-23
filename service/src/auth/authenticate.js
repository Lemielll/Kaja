/**
 * Authentication Middleware (Layer 1)
 * File: service/src/auth/authenticate.js
 * Description: Verifies access token and attaches principal to request.
 * 
 * If token is present and valid → req.principal is set
 * If token is present and invalid → 401 Unauthorized
 * If token is absent → req.principal = null (route decides if anonymous access allowed)
 */

'use strict';

const { verifyAccessToken } = require('./verify');
const { principalFrom } = require('./principal');
const { unauthorized } = require('../problem');
const logger = require('../logger');

/**
 * Middleware that authenticates requests based on Bearer token.
 * 
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization ?? '';
  
  // No token provided - set principal to null and let route decide
  if (!header.startsWith('Bearer ')) {
    req.principal = null;
    return next();
  }

  try {
    // Extract token (remove "Bearer " prefix)
    const token = header.slice(7);
    
    // Verify and construct principal
    const claims = await verifyAccessToken(token);
    req.principal = principalFrom(claims);
    
    return next();
  } catch (err) {
    // Log rejection reason but NOT the token itself
    // Logger automatically redacts authorization headers
    logger.warn({ reason: err.code ?? err.name }, 'token rejected');
    
    return unauthorized(res, 'invalid_token');
  }
}

module.exports = { authenticate };
