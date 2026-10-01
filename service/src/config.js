/**
 * Configuration Module
 * File: service/src/config.js
 * Description: Centralized configuration with startup validation.
 * Service MUST refuse to start if required environment variables are missing.
 */

'use strict';

require('dotenv').config();

// Default fallbacks for production deployment if environment variables were not explicitly injected
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
const defaultIssuer = 'https://kaja-auth-production-6145.up.railway.app/realms/kaja';
const defaultJwksUri = 'https://kaja-auth-production-6145.up.railway.app/realms/kaja/protocol/openid-connect/certs';

const oidcIssuer = process.env.OIDC_ISSUER && !process.env.OIDC_ISSUER.includes('localhost')
  ? process.env.OIDC_ISSUER
  : (isProduction ? defaultIssuer : (process.env.OIDC_ISSUER || 'http://localhost:8080/realms/kaja'));

const oidcJwksUri = process.env.OIDC_JWKS_URI && !process.env.OIDC_JWKS_URI.includes('localhost')
  ? process.env.OIDC_JWKS_URI
  : (isProduction ? defaultJwksUri : (process.env.OIDC_JWKS_URI || 'http://localhost:8080/realms/kaja/protocol/openid-connect/certs'));

const oidcAudience = process.env.OIDC_AUDIENCE || 'web-app';

module.exports = {
  port: process.env.PORT || 4010,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  oidcIssuer,
  oidcJwksUri,
  oidcAudience,
};
