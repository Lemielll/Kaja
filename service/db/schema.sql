-- =============================================================================
-- Heavy Equipment Rental System - Database Schema (PostgreSQL)
-- File: service/db/schema.sql
-- Description: DDL runnable from an empty database in a single command (Session 3: A.7)
-- =============================================================================

-- 1. Table: equipments
CREATE TABLE IF NOT EXISTS equipments (
    id VARCHAR(32) PRIMARY KEY,
    type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'available',
    hourly_rate INTEGER NOT NULL CHECK (hourly_rate >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    location VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_equipment_status CHECK (
        status IN ('available', 'reserved', 'in_progress', 'maintenance', 'out_of_service')
    ),
    CONSTRAINT chk_equipment_type CHECK (
        type IN ('excavator', 'wheel_loader', 'bulldozer', 'crane', 'compactor')
    )
);

CREATE INDEX IF NOT EXISTS idx_equipments_status ON equipments(status);
CREATE INDEX IF NOT EXISTS idx_equipments_type ON equipments(type);

-- 2. Table: rentals
CREATE TABLE IF NOT EXISTS rentals (
    id VARCHAR(32) PRIMARY KEY,
    equipment_id VARCHAR(32) NOT NULL REFERENCES equipments(id) ON DELETE RESTRICT,
    contractor_id VARCHAR(32) NOT NULL,
    warehouse_admin_id VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'approved',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    deposit_amount INTEGER NOT NULL CHECK (deposit_amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_rental_status CHECK (
        status IN ('draft', 'approved', 'in_progress', 'active', 'completed', 'cancelled', 'rejected')
    ),
    CONSTRAINT chk_rental_time CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_rentals_equipment_id ON rentals(equipment_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON rentals(status);

-- 3. Table: idempotency_keys (Session 3: A.8 Server-side idempotency)
-- Must be stored in a database table to survive process restarts
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(64) PRIMARY KEY,
    request_hash VARCHAR(64) NOT NULL,
    response_status INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_idempotency_created_at ON idempotency_keys(created_at);
