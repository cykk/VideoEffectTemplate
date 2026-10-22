CREATE TABLE "user_attributions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"first_source_host" text,
	"first_referrer_host" text,
	"first_landing_path" text,
	"first_utm_source" text,
	"first_utm_medium" text,
	"first_utm_campaign" text,
	"first_utm_term" text,
	"first_utm_content" text,
	"country_code" text,
	"captured_at" timestamp with time zone,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_attributions" ADD CONSTRAINT "user_attributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_attributions_country" ON "user_attributions" USING btree ("country_code");