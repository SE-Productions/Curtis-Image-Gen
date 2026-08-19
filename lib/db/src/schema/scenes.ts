import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scenes = pgTable("studio_scenes", {
  id: text("id").primaryKey(),
  prompt: text("prompt").notNull(),
  aspectRatio: text("aspect_ratio").notNull(),
  fidelity: text("fidelity").notNull(),
  referenceUsed: boolean("reference_used").notNull(),
  imageDataUrl: text("image_data_url").notNull(),
  provider: text("provider").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSceneSchema = createInsertSchema(scenes).omit({
  createdAt: true,
});

export type Scene = typeof scenes.$inferSelect;
export type InsertScene = z.infer<typeof insertSceneSchema>;