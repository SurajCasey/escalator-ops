-- Add cancellation_reason column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- booking_id should already exist; add it if it doesn't
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS booking_id UUID;
