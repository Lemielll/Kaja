-- Track the domain operator assigned to each rental for server-side inspection authorization.
ALTER TABLE rentals
ADD COLUMN IF NOT EXISTS assigned_operator_id VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_rentals_assigned_operator_id
ON rentals(assigned_operator_id);