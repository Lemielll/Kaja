-- =============================================================================
-- Heavy Equipment Rental System - Sample Demonstration Data
-- File: service/db/seed.sql
-- Description: Sample data for demonstration of read & write operations (Session 3: A.1)
-- =============================================================================

-- Seed equipments
INSERT INTO equipments (id, type, status, hourly_rate, currency, location, created_at, updated_at)
VALUES
    (
        'eqp_8X2kAB',
        'excavator',
        'available',
        2500,
        'USD',
        'Warehouse B - Bay 4',
        '2026-08-01T09:00:00Z',
        '2026-09-03T08:42:00Z'
    ),
    (
        'eqp_9Y3lBC',
        'wheel_loader',
        'reserved',
        3200,
        'USD',
        'Warehouse A - Bay 1',
        '2026-08-05T10:00:00Z',
        '2026-09-04T11:15:00Z'
    ),
    (
        'eqp_1Z4mCD',
        'bulldozer',
        'available',
        4000,
        'USD',
        'Warehouse C - Yard 2',
        '2026-08-10T07:30:00Z',
        '2026-09-05T14:20:00Z'
    ),
    (
        'eqp_2A5nDE',
        'crane',
        'maintenance',
        6500,
        'USD',
        'Maintenance Depot 1',
        '2026-08-15T13:00:00Z',
        '2026-09-06T16:00:00Z'
    )
ON CONFLICT (id) DO NOTHING;

-- Seed rentals
INSERT INTO rentals (id, equipment_id, contractor_id, warehouse_admin_id, status, start_time, end_time, deposit_amount, currency, created_at, updated_at)
VALUES
    (
        'rnt_3MnB7xP',
        'eqp_8X2kAB',
        'ctr_72Xp9C',
        'adm_19Lq2f',
        'approved',
        '2026-09-15T08:00:00Z',
        '2026-09-18T17:00:00Z',
        150000,
        'USD',
        '2026-09-10T15:00:00Z',
        '2026-09-11T09:30:00Z'
    )
ON CONFLICT (id) DO NOTHING;
