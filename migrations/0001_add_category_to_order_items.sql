-- Add category column to order_items table
-- This stores the manually selected category from Add to Order modal (NOT from Master Product Catalog)
-- This category comes from Store > Settings > Product Categories

ALTER TABLE "order_items" ADD COLUMN "category" varchar(100);

COMMENT ON COLUMN "order_items"."category" IS 'User-selected category from Add to Order modal (Store > Settings > Product Categories)';

