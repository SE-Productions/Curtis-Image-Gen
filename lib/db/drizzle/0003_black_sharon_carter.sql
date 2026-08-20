ALTER TABLE "content_variations" DROP CONSTRAINT "content_variations_scene_id_studio_scenes_id_fk";
--> statement-breakpoint
ALTER TABLE "content_variations" ADD CONSTRAINT "content_variations_scene_id_studio_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."studio_scenes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_items_plan_date_unique" ON "content_items" USING btree ("plan_id","plan_date");