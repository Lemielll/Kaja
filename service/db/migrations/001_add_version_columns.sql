-- Migration 001: Add version columns for optimistic locking
-- File: service/db/migrations/001_add_version_columns.sql
-- Date: 2026-09-30
-- Session 5 - Step 8 & 9: ETag and If-Match support
-- 
-- Purpose: Add `version` column to tables that need conditional read/write:
-- - equipments: for ETag in GET /equipments
-- - rentals: for ETag in GET /rentals and GET /rentals/:id
-- - inspections: for If-Match in POST /rentals/:id/inspections (conflict detection)
--
-- Safe to run multiple times (uses IF NOT EXISTS).
-- Version starts at 1 and increments on every UPDATE.

-- Add version to equipments table
ALTER TABLE equipments 
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Add version to rentals table
ALTER TABLE rentals 
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Add version to inspections table
ALTER TABLE inspections 
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Create indexes for version columns (helps with conditional updates)
CREATE INDEX IF NOT EXISTS idx_equipments_version ON equipments(version);
CREATE INDEX IF NOT EXISTS idx_rentals_version ON rentals(version);
CREATE INDEX IF NOT EXISTS idx_inspections_version ON inspections(version);
