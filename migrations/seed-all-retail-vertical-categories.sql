-- Seed category templates for all retail verticals
-- These will be copied to new companies when they sign up with each retail vertical

DO $$
DECLARE
  v_public_safety INTEGER;
  v_medical INTEGER;
  v_furniture INTEGER;
  v_appliances INTEGER;
  v_aftermarket INTEGER;
  v_garden INTEGER;
  v_farm INTEGER;
BEGIN
  -- Get retail vertical IDs (exact match with database names)
  SELECT id INTO v_public_safety FROM retail_verticals WHERE name = 'Public Safety Uniform' LIMIT 1;
  SELECT id INTO v_medical FROM retail_verticals WHERE name = 'Medical Uniform' LIMIT 1;
  SELECT id INTO v_furniture FROM retail_verticals WHERE name = 'Furniture' LIMIT 1;
  SELECT id INTO v_appliances FROM retail_verticals WHERE name = 'Appliance' LIMIT 1;
  SELECT id INTO v_aftermarket FROM retail_verticals WHERE name = 'Auto Parts' LIMIT 1;
  SELECT id INTO v_garden FROM retail_verticals WHERE name = 'Nursery and Garden' LIMIT 1;
  SELECT id INTO v_farm FROM retail_verticals WHERE name = 'Feed and Farm' LIMIT 1;
  
  -- Public Safety Uniforms
  IF v_public_safety IS NOT NULL THEN
    INSERT INTO category_templates (retail_vertical_id, name, slug, display_name, description, is_active, sort_order)
    VALUES
      (v_public_safety, 'Uniforms', 'uniforms', 'Uniforms', 'Public safety uniforms and apparel', TRUE, 1),
      (v_public_safety, 'Accessories', 'accessories', 'Accessories', 'Uniform accessories and equipment', TRUE, 2)
    ON CONFLICT (retail_vertical_id, slug) DO NOTHING;
    RAISE NOTICE 'Seeded categories for Public Safety Uniform';
  END IF;

  -- Medical Uniform
  IF v_medical IS NOT NULL THEN
    INSERT INTO category_templates (retail_vertical_id, name, slug, display_name, description, is_active, sort_order)
    VALUES
      (v_medical, 'Uniforms', 'uniforms', 'Uniforms', 'Medical scrubs and uniforms', TRUE, 1),
      (v_medical, 'Accessories', 'accessories', 'Accessories', 'Medical uniform accessories', TRUE, 2)
    ON CONFLICT (retail_vertical_id, slug) DO NOTHING;
    RAISE NOTICE 'Seeded categories for Medical Uniform';
  END IF;

  -- Furniture
  IF v_furniture IS NOT NULL THEN
    INSERT INTO category_templates (retail_vertical_id, name, slug, display_name, description, is_active, sort_order)
    VALUES
      (v_furniture, 'Furniture', 'furniture', 'Furniture', 'Furniture and home furnishings', TRUE, 1),
      (v_furniture, 'Rugs', 'rugs', 'Rugs', 'Area rugs and floor coverings', TRUE, 2),
      (v_furniture, 'Accessories', 'accessories', 'Accessories', 'Home decor and furniture accessories', TRUE, 3)
    ON CONFLICT (retail_vertical_id, slug) DO NOTHING;
    RAISE NOTICE 'Seeded categories for Furniture';
  END IF;

  -- Appliance
  IF v_appliances IS NOT NULL THEN
    INSERT INTO category_templates (retail_vertical_id, name, slug, display_name, description, is_active, sort_order)
    VALUES
      (v_appliances, 'Refrigerators', 'refrigerators', 'Refrigerators', 'Refrigerators and freezers', TRUE, 1),
      (v_appliances, 'Ranges', 'ranges', 'Ranges', 'Ranges, stoves, and ovens', TRUE, 2),
      (v_appliances, 'Dishwashers', 'dishwashers', 'Dishwashers', 'Dishwashers and accessories', TRUE, 3)
    ON CONFLICT (retail_vertical_id, slug) DO NOTHING;
    RAISE NOTICE 'Seeded categories for Appliance';
  END IF;

  -- Auto Parts
  IF v_aftermarket IS NOT NULL THEN
    INSERT INTO category_templates (retail_vertical_id, name, slug, display_name, description, is_active, sort_order)
    VALUES
      (v_aftermarket, 'Parts', 'parts', 'Parts', 'Auto parts and components', TRUE, 1),
      (v_aftermarket, 'Accessories', 'accessories', 'Accessories', 'Auto accessories', TRUE, 2)
    ON CONFLICT (retail_vertical_id, slug) DO NOTHING;
    RAISE NOTICE 'Seeded categories for Auto Parts';
  END IF;

  -- Nursery and Garden
  IF v_garden IS NOT NULL THEN
    INSERT INTO category_templates (retail_vertical_id, name, slug, display_name, description, is_active, sort_order)
    VALUES
      (v_garden, 'Plants', 'plants', 'Plants', 'Garden plants and flowers', TRUE, 1),
      (v_garden, 'Trees', 'trees', 'Trees', 'Trees and shrubs', TRUE, 2),
      (v_garden, 'Soil', 'soil', 'Soil', 'Soil, mulch, and growing media', TRUE, 3)
    ON CONFLICT (retail_vertical_id, slug) DO NOTHING;
    RAISE NOTICE 'Seeded categories for Nursery and Garden';
  END IF;

  -- Feed and Farm
  IF v_farm IS NOT NULL THEN
    INSERT INTO category_templates (retail_vertical_id, name, slug, display_name, description, is_active, sort_order)
    VALUES
      (v_farm, 'Feed', 'feed', 'Feed', 'Animal feed and nutrition', TRUE, 1),
      (v_farm, 'Tools and Hardware', 'tools-hardware', 'Tools and Hardware', 'Farm tools and hardware supplies', TRUE, 2)
    ON CONFLICT (retail_vertical_id, slug) DO NOTHING;
    RAISE NOTICE 'Seeded categories for Feed and Farm';
  END IF;

END $$;

-- Display summary of all seeded category templates
SELECT 
  rv.name AS retail_vertical,
  COUNT(ct.id) AS category_count,
  STRING_AGG(ct.name, ', ' ORDER BY ct.sort_order) AS categories
FROM retail_verticals rv
LEFT JOIN category_templates ct ON ct.retail_vertical_id = rv.id
GROUP BY rv.id, rv.name
ORDER BY rv.name;
