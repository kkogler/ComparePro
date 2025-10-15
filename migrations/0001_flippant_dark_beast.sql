ALTER TABLE "plan_settings" ADD COLUMN "max_users" integer;--> statement-breakpoint
ALTER TABLE "supported_vendors" ADD COLUMN "vendor_slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "supported_vendors" ADD COLUMN "image_quality" text DEFAULT 'high';--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "vendor_slug" text;--> statement-breakpoint
ALTER TABLE "supported_vendors" ADD CONSTRAINT "supported_vendors_vendor_slug_unique" UNIQUE("vendor_slug");