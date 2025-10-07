#!/bin/bash
# Seed production database with initial data

echo "🌱 Seeding production data..."

echo "📋 Seeding retail verticals..."
psql "$DATABASE_URL" <<'EOF'
INSERT INTO retail_verticals (id, name, slug, description, is_active, sort_order, color)
VALUES
  (1, 'Firearms', 'firearms', 'Firearms and related equipment', true, 1, '#DC2626'),
  (2, 'Public Safety Uniform', 'public-safety-uniform', 'Law enforcement and first responder uniforms', true, 2, '#2563EB'),
  (3, 'Medical Uniform', 'medical-uniform', 'Medical and healthcare uniforms', true, 3, '#059669'),
  (4, 'Appliance', 'appliance', 'Home and commercial appliances', true, 4, '#7C3AED'),
  (5, 'Furniture', 'furniture', 'Furniture and home furnishings', true, 5, '#D97706'),
  (6, 'Feed and Farm', 'feed-and-farm', 'Agricultural and farming supplies', true, 6, '#65A30D'),
  (7, 'Auto Parts', 'auto-parts', 'Automotive parts and accessories', true, 7, '#0891B2'),
  (8, 'Nursery and Garden', 'nursery-and-garden', 'Plants, gardening supplies', true, 8, '#10B981')
ON CONFLICT (id) DO NOTHING;
EOF

echo "📋 Seeding category templates..."
psql "$DATABASE_URL" -f migrations/seed-production-category-templates.sql

echo "🏢 Seeding supported vendors..."
psql "$DATABASE_URL" -f migrations/seed-supported-vendors.sql

echo "🔗 Seeding vendor mappings..."
psql "$DATABASE_URL" -f migrations/seed-production-vendor-mappings.sql

echo ""
echo "✅ Production database seeded successfully!"
echo ""
echo "📊 Verification:"
psql "$DATABASE_URL" <<EOF
SELECT COUNT(*) as category_templates FROM category_templates;
SELECT COUNT(*) as vendor_mappings FROM supported_vendor_retail_verticals;
SELECT COUNT(*) as companies FROM companies;
SELECT COUNT(*) as users FROM users;
EOF

