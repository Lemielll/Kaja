/**
 * Principal Construction Module
 * File: service/src/auth/principal.js
 * Description: Transforms JWT claims into a principal object for authorization decisions.
 */

'use strict';

const USERNAME_ACTOR_MAP = {
  'contractor-a': 'ctr_72Xp9C',
  'contractor-b': 'ctr_contractorB',
  'warehouse-admin-a': 'adm_19Lq2f',
  'warehouse-admin-b': 'adm_warehouseB',
  'field-operator-a': 'opr_84Qm1a',
  'field-operator-b': 'opr_operatorB',
};

const ROLE_SCOPES_MAP = {
  contractor: ['equipment:read', 'rentals:read', 'rentals:write'],
  'warehouse-admin': ['equipment:read', 'rentals:read', 'rentals:write'],
  'field-operator': ['equipment:read', 'rentals:read', 'inspections:write'],
};

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
  const tokenScopes = String(claims.scope ?? '').split(' ').filter(Boolean);

  // If token includes realm roles from Keycloak, complement with mapped domain scopes
  const roleScopes = [];
  if (claims.realm_access?.roles && Array.isArray(claims.realm_access.roles)) {
    for (const role of claims.realm_access.roles) {
      if (ROLE_SCOPES_MAP[role]) {
        roleScopes.push(...ROLE_SCOPES_MAP[role]);
      }
    }
  }

  const scopes = Array.from(new Set([...tokenScopes, ...roleScopes]));

  // Resolve actorId: prioritize explicit claim, fallback to known username mapping
  const actorId = claims.actor_id || (claims.preferred_username ? USERNAME_ACTOR_MAP[claims.preferred_username] : undefined);

  return {
    subject: claims.sub,
    actorId,
    kind,
    scopes,
    tokenId: claims.jti,
  };
}

module.exports = { principalFrom };

