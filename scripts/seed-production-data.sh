#!/bin/bash
# Seed production database with initial data

echo "🌱 Seeding production data..."

echo "📋 Seeding category templates..."
psql "$DATABASE_URL" -f migrations/seed-production-category-templates.sql

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

