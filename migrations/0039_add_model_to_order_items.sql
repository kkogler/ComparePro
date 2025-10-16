-- Migration: Add model column to order_items table
-- This allows storing user-editable model field from Add to Order modal
-- The model value is specific to each order item and does NOT update Master Product Catalog

ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS model VARCHAR(100);

-- Add comment explaining the column
COMMENT ON COLUMN order_items.model IS 'User-editable model field from Add to Order modal. Used in CSV exports and webhooks. Does NOT update Master Product Catalog.';

