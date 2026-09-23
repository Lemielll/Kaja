/**
 * Principal Construction Module
 * File: service/src/auth/principal.js
 * Description: Transforms JWT claims into a principal object for authorization decisions.
 */

'use strict';

/**
 * Constructs a principal object from verified JWT claims.
 * 
 * @param {object} claims - The verified JWT payload
 * @returns {object} Principal object with subject, kind, scopes, and tokenId
 */
function principalFrom(claims) {
  // Determine if this is a service account token or user token
  // Service account: sub === azp (token issued for client credentials flow)
  // User token: sub !== azp (token issued for a user via authorization code flow)
  const kind = claims.sub === claims.azp ? 'service' : 'user';
  
  // Parse scopes from space-separated string
  const scopes = String(claims.scope ?? '').split(' ').filter(Boolean);

  return {
    subject: claims.sub,
    kind,
    scopes,
    tokenId: claims.jti,
  };
}

module.exports = { principalFrom };
