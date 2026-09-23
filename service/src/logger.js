/**
 * Logger Module
 * File: service/src/logger.js
 * Description: Structured logging with automatic PII redaction.
 * 
 * CRITICAL: Tokens (access tokens, refresh tokens) MUST NOT appear in logs.
 * This module redacts sensitive headers automatically.
 */

'use strict';

const pino = require('pino');
const config = require('./config');

const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  redact: {
    // Redact all authentication credentials from logs
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'headers.authorization',
      'headers.cookie',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      path: req.path,
      // DO NOT log headers - they may contain tokens
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
});

module.exports = logger;
