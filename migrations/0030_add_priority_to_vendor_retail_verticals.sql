-- Migration: Add priority to supported_vendor_retail_verticals junction table
-- This allows each vendor to have a different priority per retail vertical
-- Priority range: 1-25 (1 = highest priority)

-- Add priority column to junction table
ALTER TABLE supported_vendor_retail_verticals
ADD COLUMN priority integer;

-- Set default priorities based on existing vendor priorities (for migration)
-- This gives all vendors their current global priority for each retail vertical they're in
UPDATE supported_vendor_retail_verticals svv
SET priority = sv.product_record_priority
FROM supported_vendors sv
WHERE svv.supported_vendor_id = sv.id;

-- Make priority not null after setting defaults
ALTER TABLE supported_vendor_retail_verticals
ALTER COLUMN priority SET NOT NULL;

-- Add unique constraint: no two vendors in the same retail vertical can have the same priority
ALTER TABLE supported_vendor_retail_verticals
ADD CONSTRAINT unique_priority_per_vertical UNIQUE (retail_vertical_id, priority);

-- Add check constraint: priority must be between 1 and 25
ALTER TABLE supported_vendor_retail_verticals
ADD CONSTRAINT priority_range CHECK (priority >= 1 AND priority <= 25);

-- Add comment for documentation
COMMENT ON COLUMN supported_vendor_retail_verticals.priority IS 'Priority for product data quality within this retail vertical (1-25, where 1 = highest priority). Each retail vertical has its own independent priority ranking.';
