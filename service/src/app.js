/**
 * Application Assembly Module
 * File: service/src/app.js
 * Description: Main entry point for the backend service.
 * Coordinates configuration validation, health checks, routing assembly, and lifecycle shutdown.
 */

require('dotenv').config();
const express = require('express');
const db = require('./store/db');
const problem = require('./problem');

const app = express();

// 1. Startup Environment Check (Session 3: A.10)
// Service must refuse to start if a required environment variable is missing.
const requiredEnvs = ['PORT', 'DATABASE_URL'];
const missingEnvs = requiredEnvs.filter((env) => !process.env[env]);

if (missingEnvs.length > 0) {
  console.error(`[FATAL STARTUP] Missing required environment variables: ${missingEnvs.join(', ')}`);
  process.exit(1);
}

// Invalid JSON is an input error, not an internal server error.  Keeping this
// middleware before every route also guarantees the contract error media type.
app.use(express.json());

// 2. Health Check Endpoint (Session 3: A.10.4)
// MUST return 200 without checking any external dependency or database.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'pass' });
});

// 3. Mount Routes (Separation of concerns: routes are defined in routes/)
try {
  const routes = require('./routes');
  app.use('/v1', routes);
  app.use('/', routes);
} catch (err) {
  // If routes module is not yet created or implemented by teammates, log warning gracefully
  if (err.code !== 'MODULE_NOT_FOUND') {
    console.error('[ROUTING ERROR] Error loading routes:', err);
  }
}

// Keep unknown endpoints in the same client-readable error format as the
// resource handlers instead of returning Express's default HTML response.
app.use((req, res) => problem.notFound(
  res,
  `Route ${req.method} ${req.originalUrl} does not exist.`,
  req.originalUrl,
));

// This must be registered after all routes. Route handlers may pass an error
// with `next(error)` and Express will deliver parser errors here as well.
// Never serialize `err`, its stack trace, or database error details to clients.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return problem.badRequest(
      res,
      'Request body contains invalid JSON.',
      req.originalUrl,
    );
  }

  // Logging the error is useful to operators, but the public response remains
  // the stable RFC 9457 representation defined by `problem.internalError`.
  console.error(`[UNHANDLED ERROR] ${req.method} ${req.originalUrl}: ${err.message}`);
  return problem.internalError(res, req.originalUrl);
});

// 4. Server Lifecycle & Graceful Shutdown
const PORT = process.env.PORT || 4010;

let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`[SERVICE READY] Heavy Equipment Rental Service running on port ${PORT}`);
  });

  const shutdown = async (signal) => {
    console.log(`[SHUTDOWN] Received ${signal}. Closing HTTP server and database pool...`);
    if (server) {
      server.close(() => {
        console.log('[SHUTDOWN] HTTP server closed.');
      });
    }
    await db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = app;
