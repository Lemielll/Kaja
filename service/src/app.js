/**
 * Application Assembly Module
 * File: service/src/app.js
 * Description: Main entry point for the backend service.
 * Coordinates configuration validation, health checks, routing assembly, and lifecycle shutdown.
 */

require('dotenv').config();
const express = require('express');
const db = require('./store/db');

const app = express();

// 1. Startup Environment Check (Session 3: A.10)
// Service must refuse to start if a required environment variable is missing.
const requiredEnvs = ['PORT', 'DATABASE_URL'];
const missingEnvs = requiredEnvs.filter((env) => !process.env[env]);

if (missingEnvs.length > 0) {
  console.error(`[FATAL STARTUP] Missing required environment variables: ${missingEnvs.join(', ')}`);
  process.exit(1);
}

app.use(express.json());

// 2. Health Check Endpoint (Session 3: A.10.4)
// MUST return 200 without checking any external dependency or database.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'pass' });
});

// 3. Mount Routes (Separation of concerns: routes are defined in routes/)
try {
  const routes = require('./routes');
  app.use('/', routes);
} catch (err) {
  // If routes module is not yet created or implemented by teammates, log warning gracefully
  if (err.code !== 'MODULE_NOT_FOUND') {
    console.error('[ROUTING ERROR] Error loading routes:', err);
  }
}

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