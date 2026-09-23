/**
 * Configuration Module
 * File: service/src/config.js
 * Description: Centralized configuration with startup validation.
 * Service MUST refuse to start if required environment variables are missing.
 */

'use strict';

require('dotenv').config();

// Required environment variables for service operation
const required = [
  'PORT',
  'DATABASE_URL',
  'OIDC_ISSUER',
  'OIDC_JWKS_URI',
  'OIDC_AUDIENCE',
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`[FATAL STARTUP] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

module.exports = {
  port: process.env.PORT || 4010,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  oidcIssuer: process.env.OIDC_ISSUER,
  oidcJwksUri: process.env.OIDC_JWKS_URI,
  oidcAudience: process.env.OIDC_AUDIENCE,
};
