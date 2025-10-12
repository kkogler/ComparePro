-- Migration: Fix billing_events.billing_provider column
-- Ensures billing_provider column exists and is properly populated for existing records

-- Step 1: Add billing_provider column if it doesn't exist (with default)
ALTER TABLE billing_events 
ADD COLUMN IF NOT EXISTS billing_provider TEXT;

-- Step 2: Update any existing records that have NULL billing_provider
-- Default to 'zoho' since that's our primary provider
UPDATE billing_events 
SET billing_provider = 'zoho' 
WHERE billing_provider IS NULL;

-- Step 3: Now make it NOT NULL (after all rows have values)
ALTER TABLE billing_events 
ALTER COLUMN billing_provider SET NOT NULL;

-- Step 4: Add index for better query performance on deduplication queries
CREATE INDEX IF NOT EXISTS idx_billing_events_external_provider 
ON billing_events(external_id, billing_provider);

