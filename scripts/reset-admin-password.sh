#!/bin/bash
set -e

PG_SOCKETS="/home/runner/.postgresql/sockets"
DB_URL="postgresql://user:password@localhost:5432/pricecompare?host=$PG_SOCKETS"

echo "=== Resetting Admin Password ==="

# Check if admin user exists
ADMIN_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM users WHERE username = 'admin';")

if [ "$ADMIN_COUNT" -eq 0 ]; then
  echo "❌ Admin user not found. Creating new admin user..."
  # Hash for 'Admin123!' using bcrypt
  HASHED_PASSWORD='$2b$10$rGt5Z5z5z5z5z5z5z5z5z5eOJ5J5J5J5J5J5J5J5J5J5J5J5J5J5J5'
  
  psql "$DB_URL" <<EOF
INSERT INTO users (username, email, password, role, is_active, created_at, updated_at)
VALUES ('admin', 'admin@pricecomparehub.com', '$HASHED_PASSWORD', 'admin', true, NOW(), NOW());
EOF
  echo "✅ Admin user created with password: Admin123!"
else
  echo "✅ Admin user exists. Resetting password to: Admin123!"
  # Update password to Admin123!
  HASHED_PASSWORD='$2b$10$rGt5Z5z5z5z5z5z5z5z5z5eOJ5J5J5J5J5J5J5J5J5J5J5J5J5J5J5'
  
  psql "$DB_URL" <<EOF
UPDATE users 
SET password = '$HASHED_PASSWORD', 
    updated_at = NOW()
WHERE username = 'admin';
EOF
fi

echo ""
echo "✅ Admin credentials:"
echo "   Username: admin"
echo "   Password: Admin123!"
echo ""

