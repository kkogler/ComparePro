-- Create category_templates table for retail vertical-specific category templates
-- These are admin-managed templates that get copied to new companies based on their retail vertical

CREATE TABLE IF NOT EXISTS category_templates (
  id SERIAL PRIMARY KEY,
  retail_vertical_id INTEGER NOT NULL REFERENCES retail_verticals(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Ensure unique categories per retail vertical
  CONSTRAINT retail_vertical_category_slug_unique UNIQUE (retail_vertical_id, slug),
  CONSTRAINT retail_vertical_category_name_unique UNIQUE (retail_vertical_id, name)
);

-- Create index for faster lookups by retail vertical
CREATE INDEX IF NOT EXISTS category_templates_retail_vertical_idx ON category_templates(retail_vertical_id);

-- Seed Firearms category templates (retail_vertical_id = 1 for Firearms)
-- First, verify the Firearms retail vertical exists
DO $$
DECLARE
  firearms_vertical_id INTEGER;
BEGIN
  -- Get the Firearms retail vertical ID
  SELECT id INTO firearms_vertical_id FROM retail_verticals WHERE name = 'Firearms' LIMIT 1;
  
  IF firearms_vertical_id IS NOT NULL THEN
    -- Insert Firearms category templates
    INSERT INTO category_templates (retail_vertical_id, name, slug, display_name, description, sort_order) VALUES
      (firearms_vertical_id, 'Firearms', 'firearms', 'Firearms', 'Handguns, Rifles, Shotguns, and other firearms', 1),
      (firearms_vertical_id, 'Ammunition', 'ammunition', 'Ammunition', 'Ammunition for all calibers and gauges', 2),
      (firearms_vertical_id, 'Scopes', 'scopes', 'Scopes', 'Rifle scopes and magnification optics', 3),
      (firearms_vertical_id, 'Accessories', 'accessories', 'Accessories', 'General firearm accessories', 4),
      (firearms_vertical_id, 'Optics', 'optics', 'Optics', 'Red dots, holographic sights, and other optics', 5),
      (firearms_vertical_id, 'Parts', 'parts', 'Parts', 'OEM and replacement parts', 6),
      (firearms_vertical_id, 'Aftermarket Parts', 'aftermarket-parts', 'Aftermarket Parts', 'Third-party and aftermarket parts', 7),
      (firearms_vertical_id, 'Nursery and Garden', 'nursery-and-garden', 'Nursery and Garden', 'Outdoor and garden supplies', 8)
    ON CONFLICT (retail_vertical_id, slug) DO NOTHING;
    
    RAISE NOTICE 'Seeded % category templates for Firearms vertical', 8;
  ELSE
    RAISE NOTICE 'Firearms retail vertical not found, skipping category template seeding';
  END IF;
END $$;

-- Verify the seeded data
SELECT 
  ct.id,
  rv.name AS retail_vertical,
  ct.name AS category_name,
  ct.slug,
  ct.sort_order
FROM category_templates ct
JOIN retail_verticals rv ON ct.retail_vertical_id = rv.id
WHERE rv.name = 'Firearms'
ORDER BY ct.sort_order;
