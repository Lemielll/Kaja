'use strict';

/**
 * Wrapper untuk contract_check.js yang menyuntikkan token autentikasi.
 *
 * Tugas Integration Owner – Sesi 4 Step 11b:
 * Memastikan suite contract check dapat berjalan terhadap service yang
 * sudah dilindungi autentikasi (authenticate + requireScope middleware).
 *
 * Alur:
 *  1. Start mock JWKS server lokal di port 9999 (sama dengan OIDC_JWKS_URI di CI).
 *  2. Terbitkan token RS256 dengan scope yang sesuai untuk semua endpoint.
 *  3. Jalankan contract_check.js sebagai child process dengan TEST_AUTH_TOKEN
 *     disisipkan ke env sehingga helper `request()` menambahkan header Authorization.
 *  4. Tutup JWKS server setelah child process selesai dan teruskan exit code.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');
const { setupKeyServer, closeKeyServer, tokenFor } = require('../helpers/tokens');

const JWKS_PORT = 9999;
const JWKS_HOST = '127.0.0.1';

async function main() {
  // ── 1. Start JWKS server ──────────────────────────────────────────────────
  const { server } = await setupKeyServer(JWKS_PORT, JWKS_HOST);

  console.log(`[contract:auth] JWKS server ${server ? 'started' : 'already running'} at http://${JWKS_HOST}:${JWKS_PORT}/`);

  // ── 2. Mint token dengan semua scope yang diperlukan ─────────────────────
  //   GET /equipments          → rentals.read
  //   GET/POST /rentals        → rentals.read + rentals.write
  //   POST /rentals/:id/inspections → inspections.write
  const token = await tokenFor('svc_contract_check', [
    'rentals.read',
    'rentals.write',
    'inspections.write',
  ]);

  console.log('[contract:auth] Test token minted (subject: svc_contract_check)');

  // ── 3. Jalankan contract_check.js sebagai child process ──────────────────
  const contractScript = path.resolve(__dirname, 'contract_check.js');
  const child = spawn(
    process.execPath,
    [contractScript],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        TEST_AUTH_TOKEN: token,
        // Pastikan OIDC_JWKS_URI mengarah ke server lokal kita jika belum diset
        OIDC_JWKS_URI: process.env.OIDC_JWKS_URI || `http://${JWKS_HOST}:${JWKS_PORT}/`,
      },
    },
  );

  // ── 4. Tutup JWKS server & propagate exit code ────────────────────────────
  const exitCode = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code ?? 0));
    child.on('error', (err) => {
      console.error(`[contract:auth] Failed to spawn contract_check: ${err.message}`);
      resolve(1);
    });
  });

  await closeKeyServer();
  process.exitCode = exitCode;
}

main().catch((err) => {
  console.error(`[contract:auth] Fatal error: ${err.message}`);
  process.exitCode = 1;
});
