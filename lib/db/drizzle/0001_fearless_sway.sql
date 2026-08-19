CREATE TABLE "content_items" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"plan_date" date NOT NULL,
	"title" text NOT NULL,
	"concept" text NOT NULL,
	"prompt" text NOT NULL,
	"caption" text NOT NULL,
	"format" text NOT NULL,
	"status" text DEFAULT 'idea' NOT NULL,
	"provider" text DEFAULT 'openai' NOT NULL,
	"selected_scene_id" text,
	"scheduled_for" timestamp with time zone,
	"published_at" timestamp with time zone,
	"instagram_post_id" text,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"week_start" date NOT NULL,
	"brief" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_variations" (
	"id" text PRIMARY KEY NOT NULL,
	"content_item_id" text NOT NULL,
	"scene_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"voice" text NOT NULL,
	"audience" text NOT NULL,
	"visual_style" text NOT NULL,
	"themes" jsonb NOT NULL,
	"offers" text NOT NULL,
	"goals" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_plan_id_content_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."content_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_selected_scene_id_studio_scenes_id_fk" FOREIGN KEY ("selected_scene_id") REFERENCES "public"."studio_scenes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_variations" ADD CONSTRAINT "content_variations_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_variations" ADD CONSTRAINT "content_variations_scene_id_studio_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."studio_scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_plans_week_start_unique" ON "content_plans" USING btree ("week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "content_variations_scene_unique" ON "content_variations" USING btree ("scene_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_variations_item_ordinal_unique" ON "content_variations" USING btree ("content_item_id","ordinal");