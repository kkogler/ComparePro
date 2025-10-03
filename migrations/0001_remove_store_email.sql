-- Migration: Remove email column from stores table
-- Reason: Emails are managed at the user level, not store level
-- Date: 2025-10-03

-- Drop the email column from stores table
ALTER TABLE stores DROP COLUMN IF EXISTS email;


