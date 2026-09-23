/**
 * Application Assembly Module
 * File: service/src/app.js
 * Description: Main entry point for the backend service.
 * Coordinates configuration validation, health checks, routing assembly, and lifecycle shutdown.
 */

const express = require('express');
const config = require('./config'); // Config validates env vars on load
const db = require('./store/db');
const problem = require('./problem');
const { authenticate } = require('./auth/authenticate');
const logger = require('./logger');

const app = express();

// Invalid JSON is an input error, not an internal server error.  Keeping this
// middleware before every route also guarantees the contract error media type.
app.use(express.json());

// 2. Health Check Endpoint (Session 3: A.10.4)
// MUST return 200 without checking any external dependency or database.
// Health endpoint is public and does NOT require authentication.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'pass' });
});

// 3. Authentication Middleware (Session 4: Layer 1)
// Apply authentication to all routes except /health.
// If token is valid → req.principal is set
// If token is invalid → 401 response
// If no token → req.principal = null (route decides if anonymous allowed)
app.use(authenticate);

// 4. Mount Routes (Separation of concerns: routes are defined in routes/)
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
  // CRITICAL: Only log method, path, and error message - NOT headers or full request
  logger.error({ method: req.method, path: req.originalUrl, error: err.message }, 'unhandled error');
  return problem.internalError(res, req.originalUrl);
});

// 5. Server Lifecycle & Graceful Shutdown
const PORT = config.port;

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
