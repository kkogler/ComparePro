-- Seed category templates for Firearms retail vertical
-- This script is idempotent (safe to run multiple times)

-- Insert category templates for Firearms (retail_vertical_id = 1)
INSERT INTO category_templates (retail_vertical_id, name, slug, display_name, description, is_active, sort_order)
VALUES
  (1, 'Firearms', 'firearms', 'Firearms', 'Firearms, handguns, rifles, shotguns', true, 1),
  (1, 'Ammunition', 'ammunition', 'Ammunition', 'Ammunition and reloading supplies', true, 2),
  (1, 'Scopes & Optics', 'scopes-optics', 'Scopes & Optics', 'Scopes, red dots, optics, and sights', true, 3),
  (1, 'Accessories', 'accessories', 'Accessories', 'Firearm accessories and parts', true, 4),
  (1, 'Knives & Tools', 'knives-tools', 'Knives & Tools', 'Knives, multi-tools, and field gear', true, 5),
  (1, 'Apparel', 'apparel', 'Apparel', 'Clothing, hats, and tactical apparel', true, 6),
  (1, 'Cleaning & Maintenance', 'cleaning-maintenance', 'Cleaning & Maintenance', 'Cleaning supplies and maintenance products', true, 7),
  (1, 'Safety & Hearing Protection', 'safety-hearing', 'Safety & Hearing Protection', 'Eye and ear protection, safety equipment', true, 8)
ON CONFLICT (retail_vertical_id, slug) DO NOTHING;

-- Verify the seeded data
SELECT 
  ct.id,
  rv.name AS retail_vertical,
  ct.name AS category_name,
  ct.slug,
  ct.sort_order,
  ct.is_active
FROM category_templates ct
JOIN retail_verticals rv ON ct.retail_vertical_id = rv.id
WHERE rv.id = 1
ORDER BY ct.sort_order;

