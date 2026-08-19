import {
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { scenes } from "./scenes";

export const creatorProfiles = pgTable("creator_profiles", {
  id: text("id").primaryKey(),
  voice: text("voice").notNull(),
  audience: text("audience").notNull(),
  visualStyle: text("visual_style").notNull(),
  themes: jsonb("themes").$type<string[]>().notNull(),
  offers: text("offers").notNull(),
  goals: text("goals").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const contentPlans = pgTable(
  "content_plans",
  {
    id: text("id").primaryKey(),
    weekStart: date("week_start").notNull(),
    brief: text("brief").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("content_plans_week_start_unique").on(table.weekStart)],
);

export const contentItems = pgTable("content_items", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => contentPlans.id, { onDelete: "cascade" }),
  planDate: date("plan_date").notNull(),
  title: text("title").notNull(),
  concept: text("concept").notNull(),
  prompt: text("prompt").notNull(),
  caption: text("caption").notNull(),
  format: text("format").notNull(),
  status: text("status").notNull().default("idea"),
  provider: text("provider").notNull().default("openai"),
  selectedSceneId: text("selected_scene_id").references(() => scenes.id, {
    onDelete: "set null",
  }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  instagramPostId: text("instagram_post_id"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const contentVariations = pgTable(
  "content_variations",
  {
    id: text("id").primaryKey(),
    contentItemId: text("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    sceneId: text("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("content_variations_scene_unique").on(table.sceneId),
    uniqueIndex("content_variations_item_ordinal_unique").on(
      table.contentItemId,
      table.ordinal,
    ),
  ],
);

export const insertCreatorProfileSchema = createInsertSchema(creatorProfiles);
export const insertContentPlanSchema = createInsertSchema(contentPlans);
export const insertContentItemSchema = createInsertSchema(contentItems);
export const insertContentVariationSchema = createInsertSchema(contentVariations);

export type CreatorProfile = typeof creatorProfiles.$inferSelect;
export type ContentPlan = typeof contentPlans.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;
export type ContentVariation = typeof contentVariations.$inferSelect;
export type InsertCreatorProfile = z.infer<typeof insertCreatorProfileSchema>;
export type InsertContentPlan = z.infer<typeof insertContentPlanSchema>;
export type InsertContentItem = z.infer<typeof insertContentItemSchema>;
export type InsertContentVariation = z.infer<
  typeof insertContentVariationSchema
>;