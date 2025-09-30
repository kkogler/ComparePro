-- Create integration_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS integration_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    webhook_url TEXT,
    api_key TEXT,
    swipe_simple_tax TEXT DEFAULT 'TRUE',
    swipe_simple_track_inventory TEXT DEFAULT 'TRUE',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE(company_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_integration_settings_company_id ON integration_settings(company_id);
