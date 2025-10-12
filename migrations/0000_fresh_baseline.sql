CREATE TABLE "admin_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"sendgrid_api_key" text,
	"smtp2go_api_key" text,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_user" text,
	"smtp_password" text,
	"system_email" text DEFAULT 'noreply@pricecompare.com',
	"system_time_zone" text DEFAULT 'America/New_York',
	"maintenance_mode" boolean DEFAULT false,
	"registration_enabled" boolean DEFAULT true,
	"max_organizations" integer DEFAULT 1000,
	"support_email" text DEFAULT 'support@pricecompare.com',
	"company_name" text DEFAULT 'Retail Management Platform',
	"brand_name" text DEFAULT 'PriceCompare Pro',
	"support_domain" text DEFAULT 'pricecompare.com',
	"logo_url" text,
	"zoho_billing_client_id" text,
	"zoho_billing_client_secret" text,
	"zoho_billing_refresh_token" text,
	"zoho_billing_org_id" text,
	"zoho_billing_base_url" text,
	"default_pricing_strategy" text DEFAULT 'msrp',
	"default_pricing_markup_percentage" numeric(5, 2),
	"default_pricing_margin_percentage" numeric(5, 2),
	"default_pricing_premium_amount" numeric(10, 2),
	"default_pricing_discount_percentage" numeric(5, 2),
	"default_pricing_rounding_rule" text DEFAULT 'none',
	"default_pricing_fallback_strategy" text DEFAULT 'map',
	"default_pricing_fallback_markup_percentage" numeric(5, 2),
	"default_pricing_use_cross_vendor_fallback" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asn_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"asn_id" integer NOT NULL,
	"order_item_id" integer NOT NULL,
	"quantity_shipped" integer NOT NULL,
	"quantity_backordered" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asns" (
	"id" serial PRIMARY KEY NOT NULL,
	"asn_number" text NOT NULL,
	"order_id" integer NOT NULL,
	"vendor_id" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"ship_date" timestamp,
	"tracking_number" text,
	"items_shipped" integer DEFAULT 0,
	"items_total" integer DEFAULT 0,
	"shipping_cost" numeric(10, 2) DEFAULT '0',
	"notes" text,
	"raw_data" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asns_asn_number_unique" UNIQUE("asn_number")
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"amount" numeric(10, 2),
	"currency" text DEFAULT 'USD',
	"billing_provider" text NOT NULL,
	"external_id" text,
	"metadata" json,
	"processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_category_slug_unique" UNIQUE("company_id","slug"),
	CONSTRAINT "company_category_name_unique" UNIQUE("company_id","name")
);
--> statement-breakpoint
CREATE TABLE "category_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"retail_vertical_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "retail_vertical_category_slug_unique" UNIQUE("retail_vertical_id","slug"),
	CONSTRAINT "retail_vertical_category_name_unique" UNIQUE("retail_vertical_id","name")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"email" text,
	"phone" text,
	"logo_url" text,
	"billing_provider" text,
	"billing_customer_id" text,
	"billing_subscription_id" text,
	"billing_subscription_number" text,
	"trial_status" text,
	"trial_started_at" timestamp,
	"trial_ends_at" timestamp,
	"trial_extensions" integer DEFAULT 0,
	"max_users" integer DEFAULT 10,
	"max_vendors" integer DEFAULT 5,
	"max_orders" integer DEFAULT 500,
	"features" json,
	"settings" json,
	"retail_vertical_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "company_vendor_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"supported_vendor_id" integer NOT NULL,
	"ftp_server" text,
	"ftp_port" integer DEFAULT 21,
	"ftp_username" text,
	"ftp_password" text,
	"ftp_base_path" text DEFAULT '/',
	"user_name" text,
	"password" text,
	"source" text,
	"customer_number" text,
	"api_key" text,
	"api_secret" text,
	"sid" text,
	"token" text,
	"credentials" json,
	"catalog_sync_enabled" boolean DEFAULT true,
	"catalog_sync_schedule" text DEFAULT '0 4 * * *',
	"inventory_sync_enabled" boolean DEFAULT true,
	"inventory_sync_schedule" text DEFAULT '0 */6 * * *',
	"last_catalog_sync" timestamp,
	"catalog_sync_status" text DEFAULT 'never_synced',
	"catalog_sync_error" text,
	"last_catalog_records_created" integer DEFAULT 0,
	"last_catalog_records_updated" integer DEFAULT 0,
	"last_catalog_records_deactivated" integer DEFAULT 0,
	"last_catalog_records_skipped" integer DEFAULT 0,
	"last_catalog_records_failed" integer DEFAULT 0,
	"last_catalog_records_processed" integer DEFAULT 0,
	"last_inventory_sync" timestamp,
	"inventory_sync_status" text DEFAULT 'never_synced',
	"inventory_sync_error" text,
	"last_inventory_records_updated" integer DEFAULT 0,
	"last_inventory_skus_processed" integer DEFAULT 0,
	"connection_status" text DEFAULT 'not_tested',
	"last_connection_test" timestamp,
	"connection_error" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_vendor_credentials_unique" UNIQUE("company_id","supported_vendor_id")
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" integer,
	"filename" text NOT NULL,
	"total_rows" integer NOT NULL,
	"processed_rows" integer DEFAULT 0,
	"successful_rows" integer DEFAULT 0,
	"error_rows" integer DEFAULT 0,
	"skipped_rows" integer DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"settings" json NOT NULL,
	"errors" json DEFAULT '[]'::json,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp,
	"created_by" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"webhook_url" text,
	"api_key" text,
	"swipe_simple_tax" text DEFAULT 'TRUE',
	"swipe_simple_track_inventory" text DEFAULT 'TRUE',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_settings_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(10, 2) NOT NULL,
	"total_cost" numeric(10, 2) NOT NULL,
	"vendor_sku" text,
	"vendor_msrp" numeric(10, 2),
	"vendor_map_price" numeric(10, 2),
	"retail_price" numeric(10, 2),
	"pricing_strategy" varchar(50),
	"category" varchar(100),
	"customer_reference" text,
	"vendor_product_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"order_number" text NOT NULL,
	"vendor_id" integer NOT NULL,
	"created_by" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"order_date" timestamp DEFAULT now() NOT NULL,
	"expected_date" timestamp,
	"total_amount" numeric(10, 2) DEFAULT '0',
	"item_count" integer DEFAULT 0,
	"shipping_cost" numeric(10, 2) DEFAULT '0',
	"external_order_number" text,
	"notes" text,
	"vendor_invoice_number" text,
	"ship_to_name" text,
	"ship_to_line_1" text,
	"ship_to_line_2" text,
	"ship_to_city" text,
	"ship_to_state_code" text,
	"ship_to_zip" text,
	"drop_ship_flag" boolean DEFAULT false,
	"customer" text,
	"delivery_option" text,
	"insurance_flag" boolean DEFAULT false,
	"adult_signature_flag" boolean DEFAULT false,
	"ffl_number" text,
	"order_type" text DEFAULT 'standard',
	"warehouse" text,
	"customer_phone" text,
	"delay_shipping" boolean DEFAULT false,
	"overnight" boolean DEFAULT false,
	"message_for_sales_exec" text,
	"billing_name" text,
	"billing_line_1" text,
	"billing_line_2" text,
	"billing_city" text,
	"billing_state_code" text,
	"billing_zip" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_company_id_order_number_unique" UNIQUE("company_id","order_number")
);
--> statement-breakpoint
CREATE TABLE "org_domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"domain" text NOT NULL,
	"subdomain" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_primary" boolean DEFAULT false,
	"ssl_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_domains_domain_unique" UNIQUE("domain"),
	CONSTRAINT "org_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "organization_status_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"previous_status" text NOT NULL,
	"new_status" text NOT NULL,
	"reason" text,
	"changed_by" text NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"plan_name" text NOT NULL,
	"trial_length_days" integer,
	"plan_length_days" integer,
	"max_vendors" integer,
	"max_orders" integer,
	"online_ordering" boolean DEFAULT false,
	"asn_processing" boolean DEFAULT false,
	"webhook_export" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_settings_plan_id_unique" UNIQUE("plan_id")
);
--> statement-breakpoint
CREATE TABLE "po_sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "po_sequences_store_id_unique" UNIQUE("store_id")
);
--> statement-breakpoint
CREATE TABLE "pricing_configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"strategy" text NOT NULL,
	"markup_percentage" numeric(5, 2),
	"margin_percentage" numeric(5, 2),
	"premium_amount" numeric(10, 2),
	"discount_percentage" numeric(5, 2),
	"rounding_rule" text DEFAULT 'none' NOT NULL,
	"rounding_amount" numeric(3, 2),
	"fallback_strategy" text,
	"fallback_markup_percentage" numeric(5, 2),
	"use_cross_vendor_fallback" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_default_unique" UNIQUE("company_id","is_default")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"upc" text NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"model" text,
	"manufacturer_part_number" text,
	"alt_id_1" text,
	"alt_id_2" text,
	"caliber" text,
	"category" text,
	"subcategory1" text,
	"subcategory2" text,
	"subcategory3" text,
	"description" text,
	"barrel_length" varchar,
	"image_url" text,
	"image_source" text,
	"source" text,
	"source_locked" boolean DEFAULT true,
	"source_locked_at" timestamp DEFAULT now(),
	"source_locked_by" varchar,
	"last_quality_score" integer,
	"serialized" boolean DEFAULT false,
	"allocated" boolean DEFAULT false,
	"specifications" json,
	"priority_score" integer,
	"priority_source" text,
	"priority_calculated_at" timestamp,
	"data_hash" text,
	"custom_properties" json,
	"status" text DEFAULT 'active' NOT NULL,
	"retail_vertical_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_upc_unique" UNIQUE("upc")
);
--> statement-breakpoint
CREATE TABLE "retail_verticals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"sort_order" integer,
	"color" varchar(7),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "retail_verticals_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "search_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"search_query" text NOT NULL,
	"search_type" text NOT NULL,
	"product_name" text,
	"product_upc" text,
	"product_part_number" text,
	"searched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"platform_account_number" text NOT NULL,
	"store_address1" text NOT NULL,
	"store_address2" text,
	"store_city" text NOT NULL,
	"store_state" text NOT NULL,
	"store_zip_code" text NOT NULL,
	"microbiz_endpoint" text,
	"microbiz_api_key" text,
	"microbiz_enabled" boolean DEFAULT false,
	"show_vendor_costs" boolean DEFAULT true,
	"auto_refresh_results" boolean DEFAULT false,
	"include_unmatched_upcs" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settings_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"short_name" text NOT NULL,
	"store_number" text NOT NULL,
	"address1" text,
	"address2" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"country" text DEFAULT 'US',
	"phone" text,
	"ffl_number" text,
	"is_active" boolean DEFAULT true,
	"status" text DEFAULT 'active',
	"timezone" text DEFAULT 'America/New_York',
	"currency" text DEFAULT 'USD',
	"settings" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_store_slug_unique" UNIQUE("company_id","slug"),
	CONSTRAINT "company_store_number_unique" UNIQUE("company_id","store_number")
);
--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD',
	"status" text NOT NULL,
	"payment_method" text,
	"external_payment_id" text,
	"external_invoice_id" text,
	"external_invoice_number" text,
	"paid_at" timestamp,
	"due_date" timestamp,
	"failure_reason" text,
	"retry_count" integer DEFAULT 0,
	"next_retry_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plan_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"from_plan_id" text,
	"to_plan_id" text NOT NULL,
	"change_type" text NOT NULL,
	"change_reason" text,
	"prorated_amount" numeric(10, 2),
	"effective_date" timestamp NOT NULL,
	"external_event_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"subscription_id" integer NOT NULL,
	"current_vendors" integer DEFAULT 0,
	"current_users" integer DEFAULT 0,
	"current_orders" integer DEFAULT 0,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"orders_this_month" integer DEFAULT 0,
	"asns_processed_this_month" integer DEFAULT 0,
	"vendor_limit_exceeded" boolean DEFAULT false,
	"user_limit_exceeded" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_month_year_unique" UNIQUE("company_id","month","year")
);
--> statement-breakpoint
CREATE TABLE "subscription_webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"subscription_id" integer,
	"event_type" text NOT NULL,
	"source" text DEFAULT 'zoho' NOT NULL,
	"external_event_id" text,
	"event_data" json,
	"processed_data" json,
	"status" text DEFAULT 'pending',
	"processed_at" timestamp,
	"failure_reason" text,
	"retry_count" integer DEFAULT 0,
	"response_status" integer,
	"response_body" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"plan_id" text NOT NULL,
	"status" text NOT NULL,
	"billing_provider" text DEFAULT 'zoho' NOT NULL,
	"external_subscription_id" text,
	"external_customer_id" text,
	"external_subscription_number" text,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"amount" numeric(10, 2),
	"currency" text DEFAULT 'USD',
	"billing_cycle" text,
	"next_billing_date" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supported_vendor_retail_verticals" (
	"id" serial PRIMARY KEY NOT NULL,
	"supported_vendor_id" integer NOT NULL,
	"retail_vertical_id" integer NOT NULL,
	"priority" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_vertical_unique" UNIQUE("supported_vendor_id","retail_vertical_id"),
	CONSTRAINT "unique_priority_per_vertical" UNIQUE("retail_vertical_id","priority")
);
--> statement-breakpoint
CREATE TABLE "supported_vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"vendor_short_code" text,
	"description" text NOT NULL,
	"api_type" text NOT NULL,
	"logo_url" text,
	"website_url" text,
	"documentation_url" text,
	"credential_fields" json NOT NULL,
	"features" json NOT NULL,
	"admin_credentials" json,
	"admin_connection_status" text DEFAULT 'not_configured',
	"last_catalog_sync" timestamp,
	"catalog_sync_status" text,
	"catalog_sync_error" text,
	"last_sync_new_records" integer DEFAULT 0,
	"sports_south_schedule_enabled" boolean DEFAULT false,
	"sports_south_schedule_time" text DEFAULT '14:00',
	"sports_south_schedule_frequency" text DEFAULT 'daily',
	"last_sync_records_updated" integer DEFAULT 0,
	"last_sync_records_skipped" integer DEFAULT 0,
	"last_sync_images_added" integer DEFAULT 0,
	"last_sync_images_updated" integer DEFAULT 0,
	"chattanooga_schedule_enabled" boolean DEFAULT false,
	"chattanooga_schedule_time" text DEFAULT '15:00',
	"chattanooga_schedule_frequency" text DEFAULT 'daily',
	"chattanooga_last_csv_download" timestamp,
	"chattanooga_csv_sync_status" text DEFAULT 'never_synced',
	"chattanooga_csv_sync_error" text,
	"chattanooga_last_csv_size" integer DEFAULT 0,
	"chattanooga_last_csv_hash" text,
	"chattanooga_records_added" integer DEFAULT 0,
	"chattanooga_records_updated" integer DEFAULT 0,
	"chattanooga_records_skipped" integer DEFAULT 0,
	"chattanooga_records_failed" integer DEFAULT 0,
	"chattanooga_total_records" integer DEFAULT 0,
	"bill_hicks_inventory_sync_enabled" boolean DEFAULT true,
	"bill_hicks_inventory_sync_time" text DEFAULT '03:00',
	"bill_hicks_last_inventory_sync" timestamp,
	"bill_hicks_inventory_sync_status" text DEFAULT 'never_synced',
	"bill_hicks_inventory_sync_error" text,
	"bill_hicks_last_sync_records_updated" integer DEFAULT 0,
	"bill_hicks_last_sync_records_skipped" integer DEFAULT 0,
	"bill_hicks_last_sync_records_failed" integer DEFAULT 0,
	"bill_hicks_inventory_records_added" integer DEFAULT 0,
	"bill_hicks_inventory_records_failed" integer DEFAULT 0,
	"bill_hicks_inventory_total_records" integer DEFAULT 0,
	"bill_hicks_last_sync_records_added" integer DEFAULT 0,
	"bill_hicks_last_sync_records_removed" integer DEFAULT 0,
	"bill_hicks_last_sync_records_unchanged" integer DEFAULT 0,
	"bill_hicks_last_sync_total_records" integer DEFAULT 0,
	"bill_hicks_master_catalog_sync_enabled" boolean DEFAULT true,
	"bill_hicks_master_catalog_sync_time" varchar(5) DEFAULT '02:00',
	"bill_hicks_master_catalog_sync_status" varchar(20) DEFAULT 'not_configured',
	"bill_hicks_master_catalog_last_sync" timestamp,
	"bill_hicks_master_catalog_sync_error" text,
	"bill_hicks_master_catalog_records_added" integer DEFAULT 0,
	"bill_hicks_master_catalog_records_updated" integer DEFAULT 0,
	"bill_hicks_master_catalog_records_failed" integer DEFAULT 0,
	"bill_hicks_master_catalog_records_skipped" integer DEFAULT 0,
	"bill_hicks_master_catalog_total_records" integer DEFAULT 0,
	"lipseys_catalog_sync_enabled" boolean DEFAULT false,
	"lipseys_catalog_sync_time" varchar(5) DEFAULT '08:00',
	"lipseys_catalog_sync_frequency" text DEFAULT 'daily',
	"lipseys_catalog_sync_status" varchar(20) DEFAULT 'not_configured',
	"lipseys_last_catalog_sync" timestamp,
	"lipseys_catalog_sync_error" text,
	"lipseys_records_added" integer DEFAULT 0,
	"lipseys_records_updated" integer DEFAULT 0,
	"lipseys_records_skipped" integer DEFAULT 0,
	"lipseys_records_failed" integer DEFAULT 0,
	"lipseys_total_records" integer DEFAULT 0,
	"lipseys_images_added" integer DEFAULT 0,
	"lipseys_images_updated" integer DEFAULT 0,
	"vendor_type" text DEFAULT 'vendor',
	"name_aliases" text[],
	"is_enabled" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"product_record_priority" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "supported_vendors_name_unique" UNIQUE("name"),
	CONSTRAINT "supported_vendors_product_record_priority_unique" UNIQUE("product_record_priority")
);
--> statement-breakpoint
CREATE TABLE "usage_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"metric" text NOT NULL,
	"value" integer NOT NULL,
	"period" text NOT NULL,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usage_metrics_company_id_metric_period_date_unique" UNIQUE("company_id","metric","period","date")
);
--> statement-breakpoint
CREATE TABLE "user_stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"role" text DEFAULT 'employee' NOT NULL,
	"permissions" json,
	"is_active" boolean DEFAULT true,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_store_unique" UNIQUE("user_id","store_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text,
	"role" text DEFAULT 'user' NOT NULL,
	"first_name" text,
	"last_name" text,
	"display_name" text,
	"default_store_id" integer,
	"is_admin" boolean DEFAULT false,
	"status" text DEFAULT 'pending_activation' NOT NULL,
	"activation_token" text,
	"activation_token_expires" timestamp,
	"password_reset_token" text,
	"password_reset_token_expires" timestamp,
	"is_active" boolean DEFAULT true,
	"last_login" timestamp,
	"email_verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_company_unique" UNIQUE("username","company_id")
);
--> statement-breakpoint
CREATE TABLE "vendor_field_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_source" text NOT NULL,
	"mapping_name" text DEFAULT 'Default' NOT NULL,
	"column_mappings" json NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_at" timestamp,
	"approved_by" text,
	"last_used" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_mapping_unique" UNIQUE("vendor_source","mapping_name")
);
--> statement-breakpoint
CREATE TABLE "vendor_inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"supported_vendor_id" integer NOT NULL,
	"vendor_sku" text NOT NULL,
	"quantity_available" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_inventory_sku_unique" UNIQUE("supported_vendor_id","vendor_sku")
);
--> statement-breakpoint
CREATE TABLE "vendor_product_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"supported_vendor_id" integer NOT NULL,
	"company_id" integer,
	"vendor_sku" text NOT NULL,
	"vendor_cost" numeric(10, 2),
	"map_price" numeric(10, 2),
	"msrp_price" numeric(10, 2),
	"last_price_update" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_vendor_company_unique" UNIQUE("product_id","supported_vendor_id","company_id")
);
--> statement-breakpoint
CREATE TABLE "vendor_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"vendor_sku" text NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"supported_vendor_id" integer,
	"name" text NOT NULL,
	"vendor_short_code" text,
	"slug" text NOT NULL,
	"status" text DEFAULT 'offline' NOT NULL,
	"is_archived" boolean DEFAULT false,
	"integration_type" text NOT NULL,
	"api_endpoint" text,
	"last_sync_date" timestamp,
	"sync_status" text,
	"sync_error" text,
	"credentials" json,
	"logo_url" text,
	"enabled_for_price_comparison" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asn_items" ADD CONSTRAINT "asn_items_asn_id_asns_id_fk" FOREIGN KEY ("asn_id") REFERENCES "public"."asns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asn_items" ADD CONSTRAINT "asn_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asns" ADD CONSTRAINT "asns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asns" ADD CONSTRAINT "asns_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_templates" ADD CONSTRAINT "category_templates_retail_vertical_id_retail_verticals_id_fk" FOREIGN KEY ("retail_vertical_id") REFERENCES "public"."retail_verticals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_retail_vertical_id_retail_verticals_id_fk" FOREIGN KEY ("retail_vertical_id") REFERENCES "public"."retail_verticals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_vendor_credentials" ADD CONSTRAINT "company_vendor_credentials_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_vendor_credentials" ADD CONSTRAINT "company_vendor_credentials_supported_vendor_id_supported_vendors_id_fk" FOREIGN KEY ("supported_vendor_id") REFERENCES "public"."supported_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_organization_id_companies_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_vendor_product_id_vendor_products_id_fk" FOREIGN KEY ("vendor_product_id") REFERENCES "public"."vendor_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_domains" ADD CONSTRAINT "org_domains_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_status_audit_log" ADD CONSTRAINT "organization_status_audit_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_sequences" ADD CONSTRAINT "po_sequences_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_configurations" ADD CONSTRAINT "pricing_configurations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_retail_vertical_id_retail_verticals_id_fk" FOREIGN KEY ("retail_vertical_id") REFERENCES "public"."retail_verticals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plan_changes" ADD CONSTRAINT "subscription_plan_changes_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plan_changes" ADD CONSTRAINT "subscription_plan_changes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_usage" ADD CONSTRAINT "subscription_usage_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_usage" ADD CONSTRAINT "subscription_usage_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_webhook_events" ADD CONSTRAINT "subscription_webhook_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_webhook_events" ADD CONSTRAINT "subscription_webhook_events_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supported_vendor_retail_verticals" ADD CONSTRAINT "supported_vendor_retail_verticals_supported_vendor_id_supported_vendors_id_fk" FOREIGN KEY ("supported_vendor_id") REFERENCES "public"."supported_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supported_vendor_retail_verticals" ADD CONSTRAINT "supported_vendor_retail_verticals_retail_vertical_id_retail_verticals_id_fk" FOREIGN KEY ("retail_vertical_id") REFERENCES "public"."retail_verticals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_metrics" ADD CONSTRAINT "usage_metrics_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_default_store_id_stores_id_fk" FOREIGN KEY ("default_store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_inventory" ADD CONSTRAINT "vendor_inventory_supported_vendor_id_supported_vendors_id_fk" FOREIGN KEY ("supported_vendor_id") REFERENCES "public"."supported_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_product_mappings" ADD CONSTRAINT "vendor_product_mappings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_product_mappings" ADD CONSTRAINT "vendor_product_mappings_supported_vendor_id_supported_vendors_id_fk" FOREIGN KEY ("supported_vendor_id") REFERENCES "public"."supported_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_product_mappings" ADD CONSTRAINT "vendor_product_mappings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_products" ADD CONSTRAINT "vendor_products_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_products" ADD CONSTRAINT "vendor_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_supported_vendor_id_supported_vendors_id_fk" FOREIGN KEY ("supported_vendor_id") REFERENCES "public"."supported_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_subdomain_idx" ON "org_domains" USING btree ("subdomain");--> statement-breakpoint
CREATE INDEX "users_activation_token_idx" ON "users" USING btree ("activation_token");--> statement-breakpoint
CREATE INDEX "users_password_reset_token_idx" ON "users" USING btree ("password_reset_token");--> statement-breakpoint
CREATE INDEX "vendor_sku_inventory_idx" ON "vendor_inventory" USING btree ("supported_vendor_id","vendor_sku");--> statement-breakpoint
CREATE INDEX "vendor_sku_idx" ON "vendor_product_mappings" USING btree ("supported_vendor_id","vendor_sku");--> statement-breakpoint
CREATE INDEX "company_vendor_idx" ON "vendor_product_mappings" USING btree ("company_id","supported_vendor_id");