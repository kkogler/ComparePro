-- Seed vendor-to-retail-vertical mappings
-- This links supported vendors to retail verticals so they appear in the correct stores
-- This script is idempotent (safe to run multiple times)

-- Link all enabled supported vendors to Firearms retail vertical (ID 1)
-- This ensures vendors show up for Firearms stores
-- Priority is set to match each vendor's global product_record_priority
INSERT INTO supported_vendor_retail_verticals (supported_vendor_id, retail_vertical_id, priority)
SELECT sv.id, 1, sv.product_record_priority
FROM supported_vendors sv
WHERE sv.is_enabled = true
  AND NOT EXISTS (
    -- Don't insert if mapping already exists
    SELECT 1 
    FROM supported_vendor_retail_verticals svrv 
    WHERE svrv.supported_vendor_id = sv.id 
      AND svrv.retail_vertical_id = 1
  );

-- Verify the mappings
SELECT 
  sv.id AS vendor_id,
  sv.name AS vendor_name,
  sv.slug AS vendor_slug,
  rv.name AS retail_vertical,
  svrv.created_at
FROM supported_vendor_retail_verticals svrv
JOIN supported_vendors sv ON svrv.supported_vendor_id = sv.id
JOIN retail_verticals rv ON svrv.retail_vertical_id = rv.id
WHERE rv.id = 1
ORDER BY sv.name;

-- Show summary
SELECT 
  COUNT(*) as total_mappings,
  COUNT(DISTINCT supported_vendor_id) as vendors_mapped,
  COUNT(DISTINCT retail_vertical_id) as verticals_mapped
FROM supported_vendor_retail_verticals;

