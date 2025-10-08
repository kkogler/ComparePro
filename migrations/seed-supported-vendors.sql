-- Seed Supported Vendors with Correct Credential Fields
-- This file should be run during initial database setup

INSERT INTO supported_vendors (id, name, vendor_short_code, api_type, description, credential_fields, features, product_record_priority, is_enabled)
VALUES
  (1, 'GunBroker.com LLC', 'gunbroker', 'rest', 'GunBroker marketplace integration', 
   '[{"name": "devKey", "type": "password", "label": "Developer Key", "required": true}, {"name": "apiKey", "type": "password", "label": "API Key", "required": true}]'::json,
   '{"inventorySync":true,"productCatalog":true,"realTimePricing":true,"electronicOrdering":false}'::json,
   5, true),
  
  (2, 'Sports South', 'sports-south', 'rest', 'Sports South wholesale distributor',
   '[
     {"name": "userName", "type": "text", "label": "Username", "required": true, "placeholder": "Your Sports South username"},
     {"name": "customerNumber", "type": "text", "label": "Customer Number", "required": true, "placeholder": "Your Sports South customer number"},
     {"name": "password", "type": "password", "label": "Password", "required": true, "placeholder": "Your Sports South password"},
     {"name": "source", "type": "text", "label": "Source/Reference", "required": true, "placeholder": "Your Sports South source reference code"}
   ]'::json,
   '{"inventorySync":true,"productCatalog":true,"realTimePricing":true,"electronicOrdering":true}'::json,
   1, true),
  
  (3, 'Bill Hicks & Co.', 'bill-hicks', 'ftp', 'Bill Hicks wholesale distributor',
   '[
     {"name": "ftpServer", "type": "text", "label": "FTP Server", "required": true, "placeholder": "billhicksco.hostedftp.com"},
     {"name": "ftpUsername", "type": "text", "label": "FTP Username", "required": true, "placeholder": "enter username for Bill Hicks FTP server"},
     {"name": "ftpPassword", "type": "password", "label": "FTP Password", "required": true, "placeholder": "enter password for Bill Hicks FTP server"},
     {"name": "ftpPort", "type": "number", "label": "FTP Port", "default": "21", "required": false, "placeholder": "usually port 21"},
     {"name": "ftpBasePath", "type": "text", "label": "FTP Base Path", "default": "/MicroBiz/Feeds", "required": false, "placeholder": "usually /MicroBiz/Feeds"}
   ]'::json,
   '{"inventorySync":true,"productCatalog":true,"realTimePricing":true,"electronicOrdering":true}'::json,
   3, true),
  
  (4, 'Lipsey''s Inc.', 'lipseys', 'rest', 'Lipsey''s wholesale distributor',
   '[{"name": "email", "type": "email", "label": "Email", "required": true}, {"name": "password", "type": "password", "label": "Password", "required": true}, {"name": "token", "type": "password", "label": "API Token", "required": false}]'::json,
   '{"inventorySync":true,"productCatalog":true,"realTimePricing":true,"electronicOrdering":true}'::json,
   4, true),
  
  (5, 'Chattanooga Shooting Supplies Inc.', 'chattanooga', 'rest', 'Chattanooga wholesale distributor',
   '[
     {"name": "sid", "type": "text", "label": "API SID", "required": true, "placeholder": "Your Chattanooga API SID for authentication (REQUIRED)"},
     {"name": "token", "type": "password", "label": "API Token", "required": true, "placeholder": "Your Chattanooga API Token for authentication (REQUIRED)"},
     {"name": "accountNumber", "type": "text", "label": "Account Number", "required": false, "placeholder": "Your Chattanooga account number (optional, used in some API headers)"},
     {"name": "username", "type": "text", "label": "Portal Username", "required": false, "placeholder": "Your Chattanooga dealer portal username (optional)"},
     {"name": "password", "type": "password", "label": "Portal Password", "required": false, "placeholder": "Your Chattanooga dealer portal password (optional)"}
   ]'::json,
   '{"inventorySync":true,"productCatalog":true,"realTimePricing":true,"electronicOrdering":true}'::json,
   2, true)
ON CONFLICT (id) DO UPDATE SET
  credential_fields = EXCLUDED.credential_fields,
  features = EXCLUDED.features,
  description = EXCLUDED.description;

