'use strict';

/**
 * Service Store & Route Logic Unit Test
 * File: service/tests/contract/service_store_unit.js
 *
 * Verifies store queries, prepared statement parameters, opaque ID generation,
 * and representations without requiring an active database server.
 */

const assert = require('node:assert/strict');
const db = require('../../src/store/db');
const inspectionStore = require('../../src/store/inspections');
const representations = require('../../src/representations');

async function testInspectionStore() {
  console.log('[UNIT TEST] Testing Inspection Store & Opaque ID Generation...');

  // 1. Test generateOpaqueId format
  const id1 = inspectionStore.generateOpaqueId('ins');
  const id2 = inspectionStore.generateOpaqueId('ins');
  assert.match(id1, /^ins_[A-Za-z0-9]{6,12}$/, 'Generated ID must match OpenAPI pattern');
  assert.match(id2, /^ins_[A-Za-z0-9]{6,12}$/, 'Generated ID must match OpenAPI pattern');
  assert.notEqual(id1, id2, 'Generated IDs must be unique');

  // 2. Mock db.query for prepared statement validation
  const originalQuery = db.query;
  const queryCalls = [];

  db.query = async (text, params) => {
    queryCalls.push({ text, params });
    // Return a simulated row
    return {
      rows: [
        {
          id: params[0] || 'ins_9Hk2pQ',
          rental_id: params[1] || 'rnt_3MnB7xP',
          equipment_id: params[2] || 'eqp_8X2kAB',
          operator_id: params[3] || 'opr_84Qm1a',
          status: params[4] || 'pass',
          inspected_at: params[5] || '2026-09-17T10:45:00Z',
          notes: params[6] || 'Test note',
          defect_summary: params[7] || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      rowCount: 1,
    };
  };

  try {
    // Test insertInspection
    const inserted = await inspectionStore.insertInspection({
      rentalId: 'rnt_3MnB7xP',
      equipmentId: 'eqp_8X2kAB',
      operatorId: 'opr_84Qm1a',
      status: 'pass',
      inspectedAt: '2026-09-17T10:45:00Z',
      notes: 'All controls nominal.',
      defectSummary: 'None',
    });

    assert.equal(inserted.rental_id, 'rnt_3MnB7xP');
    assert.equal(inserted.equipment_id, 'eqp_8X2kAB');
    assert.equal(inserted.operator_id, 'opr_84Qm1a');
    assert.equal(inserted.status, 'pass');
    assert.equal(queryCalls.length, 1);
    assert.match(queryCalls[0].text, /INSERT INTO inspections/i);
    assert.equal(queryCalls[0].params[1], 'rnt_3MnB7xP');
    assert.equal(queryCalls[0].params[2], 'eqp_8X2kAB');
    assert.equal(queryCalls[0].params[6], 'All controls nominal.');
    assert.equal(queryCalls[0].params[7], 'None');

    // Test getInspectionById
    const fetched = await inspectionStore.getInspectionById('ins_9Hk2pQ');
    assert.ok(fetched);
    assert.match(queryCalls[1].text, /SELECT[\s\S]*FROM\s+inspections\s+WHERE\s+id\s*=\s*\$1/i);
    assert.deepEqual(queryCalls[1].params, ['ins_9Hk2pQ']);

    // Test getInspectionsByRentalId
    const rentalInspections = await inspectionStore.getInspectionsByRentalId('rnt_3MnB7xP');
    assert.equal(rentalInspections.length, 1);
    assert.match(queryCalls[2].text, /SELECT[\s\S]*FROM\s+inspections\s+WHERE\s+rental_id\s*=\s*\$1/i);
    assert.deepEqual(queryCalls[2].params, ['rnt_3MnB7xP']);

    // Test findDuplicateInspection
    const dup = await inspectionStore.findDuplicateInspection('rnt_3MnB7xP', '2026-09-17T10:45:00Z');
    assert.ok(dup);
    assert.match(queryCalls[3].text, /WHERE\s+rental_id\s*=\s*\$1\s+AND\s+inspected_at\s*=\s*\$2/i);
    assert.deepEqual(queryCalls[3].params, ['rnt_3MnB7xP', '2026-09-17T10:45:00Z']);



    // Test representation transformation
    const representation = representations.rowToInspection(inserted);
    assert.deepEqual(Object.keys(representation), [
      'id',
      'rentalId',
      'equipmentId',
      'operatorId',
      'status',
      'inspectedAt',
      'notes',
      'defectSummary',
    ]);
    assert.equal(representation.rentalId, 'rnt_3MnB7xP');
    assert.equal(representation.equipmentId, 'eqp_8X2kAB');

    console.log('PASS: Inspection store unit tests verified SQL parameterization, prepared statements, and DTO representation.');
  } finally {
    db.query = originalQuery;
  }
}

testInspectionStore().catch((err) => {
  console.error('FAIL:', err);
  process.exitCode = 1;
});
