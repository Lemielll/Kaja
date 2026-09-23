'use strict';

/**
 * Wrapper untuk contract_check.js yang menyuntikkan token autentikasi.
 *
 * Tugas Integration Owner – Sesi 4 Step 11b:
 * Memastikan suite contract check dapat berjalan terhadap service yang
 * sudah dilindungi autentikasi (authenticate + requireScope middleware),
 * TANPA memerlukan PostgreSQL eksternal (menggunakan mock in-memory DB).
 *
 * Alur:
 *  1. Set env vars untuk OIDC dan port unik sebelum memuat modul.
 *  2. Start mock JWKS server lokal di port 9999.
 *  3. Mock db.query dengan data seed in-memory.
 *  4. Load dan start Express app di port 4099.
 *  5. Mint token RS256 dengan scope lengkap.
 *  6. Spawn contract_check.js dengan BASE_URL + TEST_AUTH_TOKEN terisi.
 *  7. Tutup server, JWKS, dan propagate exit code.
 */

// ── 0. Set env SEBELUM require apapun dari src/ ────────────────────────────
//    Urutan ini kritis: config.js dibaca saat require('./src/app') pertama kali.
const CONTRACT_PORT = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : 4099; // port unik agar tidak konflik dengan service yang mungkin berjalan

if (!process.env.BASE_URL) {
  // Hanya jalankan in-memory service jika BASE_URL tidak diset dari luar
  // (misalnya di CI, BASE_URL sudah mengarah ke service nyata dengan DB)
  process.env.PORT = String(CONTRACT_PORT);
  process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock';
  process.env.OIDC_ISSUER = process.env.OIDC_ISSUER || 'https://test.local/';
  process.env.OIDC_JWKS_URI = process.env.OIDC_JWKS_URI || 'http://127.0.0.1:9999/jwks.json';
  process.env.OIDC_AUDIENCE = process.env.OIDC_AUDIENCE || 'kaja-api';
  process.env.NODE_ENV = 'test';
}

const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { setupKeyServer, closeKeyServer, tokenFor } = require('../helpers/tokens');

const JWKS_PORT = 9999;
const JWKS_HOST = '127.0.0.1';

// ── Data seed in-memory ────────────────────────────────────────────────────
const SEED_EQUIPMENTS = [
  {
    id: 'eqp_8X2kAB',
    type: 'excavator',
    status: 'available',
    hourly_rate: 150,
    currency: 'USD',
    location: 'Warehouse A',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'eqp_9Y3lBC',
    type: 'bulldozer',
    status: 'rented',
    hourly_rate: 200,
    currency: 'USD',
    location: 'Warehouse B',
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
];

const SEED_RENTALS = [
  {
    id: 'rnt_3MnB7xP',
    equipment_id: 'eqp_8X2kAB',
    contractor_id: 'ctr_72Xp9C',
    warehouse_admin_id: 'adm_19Lq2f',
    status: 'approved',
    start_time: '2027-01-15T08:00:00Z',
    end_time: '2027-01-18T17:00:00Z',
    deposit_amount: 150000,
    currency: 'USD',
    created_at: '2026-09-10T15:00:00Z',
    updated_at: '2026-09-11T09:30:00Z',
  },
];

/**
 * Intercept db.query dengan implementasi in-memory.
 * Hanya query yang diperlukan oleh contract_check.js yang perlu di-mock.
 */
function mockDatabase() {
  const db = require('../../src/store/db');
  const idempotency = new Map();

  db.query = async (text, params = []) => {
    const q = text.trim();

    // SELECT equipments
    if (/SELECT\s[\s\S]*FROM\s+equipments/i.test(q)) {
      let rows = [...SEED_EQUIPMENTS];
      if (params[0]) rows = rows.filter((r) => r.status === params[0]);
      return { rows, rowCount: rows.length };
    }

    // SELECT FROM rentals WHERE id = $1
    if (/SELECT[\s\S]*FROM\s+rentals\s+WHERE\s+id\s*=\s*\$1/i.test(q)) {
      const row = SEED_RENTALS.find((r) => r.id === params[0]);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }

    // SELECT FROM rentals (list)
    if (/SELECT[\s\S]*FROM\s+rentals/i.test(q)) {
      return { rows: SEED_RENTALS, rowCount: SEED_RENTALS.length };
    }

    // Idempotency key check
    if (/SELECT[\s\S]*idempotency_keys/i.test(q)) {
      const key = params[0];
      if (idempotency.has(key)) return { rows: [idempotency.get(key)], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }

    // INSERT idempotency key (store it)
    if (/INSERT[\s\S]*idempotency_keys/i.test(q)) {
      idempotency.set(params[0], { key: params[0], response_status: 400, response_body: '{}' });
      return { rows: [], rowCount: 1 };
    }

    // INSERT inspection (contract only checks 400/422 for missing key, so won't reach here)
    if (/INSERT[\s\S]*inspections/i.test(q)) {
      return { rows: [{ id: 'ins_mock_test' }], rowCount: 1 };
    }

    // Default: empty result
    return { rows: [], rowCount: 0 };
  };

  db.close = async () => {};
}

/**
 * Tunggu sampai server HTTP lokal siap menerima koneksi.
 */
async function waitForServer(port, host = '127.0.0.1', tries = 20, delay = 150) {
  for (let i = 0; i < tries; i++) {
    const ok = await new Promise((resolve) => {
      const req = http.get({ host, port, path: '/health', timeout: 300 }, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, delay));
  }
  return false;
}

async function main() {
  const useInMemory = !process.env.BASE_URL;
  let appServer = null;

  // ── 1. Start JWKS server ──────────────────────────────────────────────────
  const { server: jwksServerHandle } = await setupKeyServer(JWKS_PORT, JWKS_HOST);
  console.log(
    `[contract:auth] JWKS server ${jwksServerHandle ? 'started' : 'already running'} ` +
    `at http://${JWKS_HOST}:${JWKS_PORT}/`,
  );

  if (useInMemory) {
    // ── 2. Mock DB dan load Express app ────────────────────────────────────
    mockDatabase();
    const app = require('../../src/app');

    appServer = await new Promise((resolve, reject) => {
      const s = app.listen(CONTRACT_PORT, '127.0.0.1', () => resolve(s));
      s.on('error', reject);
    });
    console.log(`[contract:auth] In-memory service started on port ${CONTRACT_PORT}`);

    // ── 3. Tunggu sampai /health 200 ──────────────────────────────────────
    const ready = await waitForServer(CONTRACT_PORT);
    if (!ready) {
      console.error('[contract:auth] GAGAL: In-memory service tidak merespons /health.');
      process.exitCode = 1;
      return;
    }
    console.log('[contract:auth] Service siap.');
  }

  // ── 4. Mint token ─────────────────────────────────────────────────────────
  //   GET /equipments               → equipment:read
  //   GET/POST /rentals             → rentals:read + rentals:write
  //   POST /rentals/:id/inspections → inspections:write
  const token = await tokenFor('svc_contract_check', [
    'equipment:read',    // GET /equipments
    'rentals:read',      // GET /rentals, GET /rentals/:id/inspections
    'rentals:write',     // POST /rentals
    'inspections:write', // POST /rentals/:id/inspections
  ]);
  console.log('[contract:auth] Token RS256 diterbitkan (subject: svc_contract_check).');

  // ── 5. Resolve BASE_URL ───────────────────────────────────────────────────
  const baseUrl = useInMemory
    ? `http://127.0.0.1:${CONTRACT_PORT}/v1`
    : (process.env.BASE_URL || `http://127.0.0.1:${CONTRACT_PORT}/v1`).replace(/\/+$/, '');

  // ── 6. Spawn contract_check.js ────────────────────────────────────────────
  const contractScript = path.resolve(__dirname, 'contract_check.js');
  const child = spawn(
    process.execPath,
    [contractScript],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        BASE_URL: baseUrl,
        TEST_AUTH_TOKEN: token,
        OIDC_JWKS_URI: `http://${JWKS_HOST}:${JWKS_PORT}/`,
        OIDC_ISSUER: process.env.OIDC_ISSUER || 'https://test.local/',
        OIDC_AUDIENCE: process.env.OIDC_AUDIENCE || 'kaja-api',
      },
    },
  );

  // ── 7. Propagate exit code & cleanup ─────────────────────────────────────
  const exitCode = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code ?? 0));
    child.on('error', (err) => {
      console.error(`[contract:auth] Gagal spawn contract_check: ${err.message}`);
      resolve(1);
    });
  });

  if (appServer) {
    await new Promise((resolve) => appServer.close(resolve));
    console.log('[contract:auth] In-memory service ditutup.');
  }
  await closeKeyServer();
  process.exitCode = exitCode;
}

main().catch((err) => {
  console.error(`[contract:auth] Fatal error: ${err.message}`);
  process.exitCode = 1;
});
