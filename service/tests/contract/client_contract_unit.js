'use strict';

const assert = require('node:assert/strict');
const representations = require('../../src/representations');
const problem = require('../../src/problem');

function createResponseDouble() {
  return {
    statusCode: null,
    contentType: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    type(value) {
      this.contentType = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

const rental = representations.rowToRental({
  id: 'rnt_3MnB7xP',
  equipment_id: 'eqp_8X2kAB',
  contractor_id: 'ctr_72Xp9C',
  warehouse_admin_id: 'adm_19Lq2f',
  status: 'approved',
  start_time: '2026-09-15T08:00:00Z',
  end_time: '2026-09-18T17:00:00Z',
  deposit_amount: 150000,
  currency: 'USD',
  created_at: '2026-09-10T15:00:00Z',
  updated_at: '2026-09-11T09:30:00Z',
  deleted_at: 'must-not-leak',
});

assert.deepEqual(Object.keys(rental), [
  'id',
  'equipmentId',
  'contractorId',
  'warehouseAdminId',
  'status',
  'startTime',
  'endTime',
  'depositAmount',
  'currency',
  'createdAt',
  'updatedAt',
]);
assert.equal(rental.equipmentId, 'eqp_8X2kAB');
assert.equal(rental.deleted_at, undefined);

const equipment = representations.rowToEquipment({
  id: 'eqp_8X2kAB',
  type: 'excavator',
  status: 'available',
  hourly_rate: 2500,
  currency: 'USD',
  location: 'Warehouse B - Bay 4',
  created_at: '2026-08-01T09:00:00Z',
  updated_at: '2026-09-03T08:42:00Z',
  soft_deleted: true,
});

assert.equal(equipment.hourlyRate, 2500);
assert.equal(equipment.soft_deleted, undefined);

const response = createResponseDouble();
problem.notFound(response, 'Resource does not exist.', '/missing');
assert.equal(response.statusCode, 404);
assert.equal(response.contentType, 'application/problem+json');
assert.deepEqual(Object.keys(response.body), [
  'type',
  'title',
  'status',
  'detail',
  'instance',
]);
assert.equal(response.body.status, 404);

console.log('PASS: client representation and Problem Details checks');