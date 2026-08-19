import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  lt,
  ne,
} from "drizzle-orm";
import {
  AddContentVariationBody,
  AddContentVariationParams,
  ApproveContentItemBody,
  ApproveContentItemParams,
  GenerateContentPlanBody,
  GenerateContentPlanResponse,
  GetContentPlanQueryParams,
  GetContentPlanResponse,
  GetCreatorDnaResponse,
  RecordContentPublicationBody,
  RecordContentPublicationParams,
  ScheduleContentItemBody,
  ScheduleContentItemParams,
  UpdateContentItemParams,
  UpdateContentItemBody,
  UpdateContentItemResponse,
  UpdateCreatorDnaBody,
  UpdateCreatorDnaResponse,
} from "@workspace/api-zod";
import {
  contentItems,
  contentPlans,
  contentVariations,
  creatorProfiles,
  db,
  scenes,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireStudioSession } from "../services/studio-session";

const router: IRouter = Router();
const creatorProfileId = "curtis-default";

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

async function getContentItemResponse(contentItemId: string) {
  const [item] = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, contentItemId))
    .limit(1);
  if (!item) return null;

  const variations = await db
    .select({
      id: contentVariations.id,
      sceneId: contentVariations.sceneId,
      ordinal: contentVariations.ordinal,
      imageDataUrl: scenes.imageDataUrl,
      provider: scenes.provider,
      createdAt: contentVariations.createdAt,
    })
    .from(contentVariations)
    .innerJoin(scenes, eq(contentVariations.sceneId, scenes.id))
    .where(eq(contentVariations.contentItemId, item.id))
    .orderBy(asc(contentVariations.ordinal));

  return {
    id: item.id,
    planDate: item.planDate,
    title: item.title,
    concept: item.concept,
    prompt: item.prompt,
    caption: item.caption,
    format: item.format,
    status: item.status,
    provider: item.provider,
    selectedSceneId: item.selectedSceneId,
    scheduledFor: iso(item.scheduledFor),
    publishedAt: iso(item.publishedAt),
    instagramPostId: item.instagramPostId,
    failureReason: item.failureReason,
    variations: variations.map((variation) => ({
      ...variation,
      createdAt: variation.createdAt.toISOString(),
    })),
  };
}

async function getContentPlanResponse(planId: string) {
  const [plan] = await db
    .select()
    .from(contentPlans)
    .where(eq(contentPlans.id, planId))
    .limit(1);
  if (!plan) return null;

  const itemRows = await db
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(eq(contentItems.planId, plan.id))
    .orderBy(asc(contentItems.planDate));
  const items = (
    await Promise.all(itemRows.map(({ id }) => getContentItemResponse(id)))
  ).filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    id: plan.id,
    weekStart: plan.weekStart,
    brief: plan.brief,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    items,
  };
}

router.get(
  "/studio/creator-dna",
  requireStudioSession,
  async (_req, res): Promise<void> => {
    const [profile] = await db
      .select()
      .from(creatorProfiles)
      .where(eq(creatorProfiles.id, creatorProfileId))
      .limit(1);

    res.json(
      GetCreatorDnaResponse.parse(
        profile
          ? {
              ...profile,
              updatedAt: profile.updatedAt.toISOString(),
            }
          : {
              voice: "",
              audience: "",
              visualStyle: "",
              themes: [],
              offers: "",
              goals: "",
              updatedAt: null,
            },
      ),
    );
  },
);

router.put(
  "/studio/creator-dna",
  requireStudioSession,
  async (req, res): Promise<void> => {
    const parsed = UpdateCreatorDnaBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error:
          "Complete the voice, audience, visual style, themes, and goals before saving Creator DNA.",
      });
      return;
    }

    const [profile] = await db
      .insert(creatorProfiles)
      .values({
        id: creatorProfileId,
        ...parsed.data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: creatorProfiles.id,
        set: {
          ...parsed.data,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(
      UpdateCreatorDnaResponse.parse({
        ...profile,
        updatedAt: profile.updatedAt.toISOString(),
      }),
    );
  },
);

router.get(
  "/studio/content-plan",
  requireStudioSession,
  async (req, res): Promise<void> => {
    const parsed = GetContentPlanQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Choose a valid week start date." });
      return;
    }

    const [plan] = await db
      .select({ id: contentPlans.id })
      .from(contentPlans)
      .where(eq(contentPlans.weekStart, parsed.data.weekStart))
      .limit(1);

    res.json(
      GetContentPlanResponse.parse({
        plan: plan ? await getContentPlanResponse(plan.id) : null,
      }),
    );
  },
);

router.post(
  "/studio/content-plan/generate",
  requireStudioSession,
  async (req, res): Promise<void> => {
    const parsed = GenerateContentPlanBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Add a weekly brief and choose a valid Monday before planning.",
      });
      return;
    }

    const [profile] = await db
      .select()
      .from(creatorProfiles)
      .where(eq(creatorProfiles.id, creatorProfileId))
      .limit(1);
    if (!profile) {
      res.status(400).json({
        error: "Save Creator DNA before generating a weekly plan.",
      });
      return;
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.75,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You are a senior Instagram content strategist. Return strict JSON with one key, "items", containing exactly seven objects. Each object must have title, concept, prompt, caption, and format. format must be feed, story, or reel. Make each day distinct, visually specific, authentic to the creator, and practical to generate as a single image. Captions must be editable, natural, under 500 characters, and contain at most five hashtags.',
          },
          {
            role: "user",
            content: [
              `Week starts: ${parsed.data.weekStart}`,
              `Weekly direction: ${parsed.data.brief}`,
              `Voice: ${profile.voice}`,
              `Audience: ${profile.audience}`,
              `Visual style: ${profile.visualStyle}`,
              `Themes: ${profile.themes.join(", ")}`,
              `Offers: ${profile.offers || "None specified"}`,
              `Goals: ${profile.goals}`,
            ].join("\n"),
          },
        ],
      });
      const raw = completion.choices[0]?.message.content;
      if (!raw) throw new Error("The planning provider returned no content.");

      const generated = JSON.parse(raw) as {
        items?: Array<Record<string, unknown>>;
      };
      if (!Array.isArray(generated.items) || generated.items.length !== 7) {
        throw new Error("The planning provider did not return seven items.");
      }

      const normalized = generated.items.map((item, index) => {
        const format = item.format;
        if (
          typeof item.title !== "string" ||
          typeof item.concept !== "string" ||
          typeof item.prompt !== "string" ||
          typeof item.caption !== "string" ||
          !["feed", "story", "reel"].includes(String(format))
        ) {
          throw new Error(`The planning provider returned an invalid day ${index + 1}.`);
        }
        const planDate = new Date(`${parsed.data.weekStart}T12:00:00Z`);
        planDate.setUTCDate(planDate.getUTCDate() + index);
        return {
          id: randomUUID(),
          planDate: planDate.toISOString().slice(0, 10),
          title: item.title.trim().slice(0, 160),
          concept: item.concept.trim().slice(0, 2000),
          prompt: item.prompt.trim().slice(0, 6000),
          caption: item.caption.trim().slice(0, 2200),
          format: String(format),
          status: "idea",
          provider: "openai",
        };
      });

      const planId = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: contentPlans.id })
          .from(contentPlans)
          .where(eq(contentPlans.weekStart, parsed.data.weekStart))
          .limit(1);
        const id = existing?.id ?? randomUUID();
        if (existing) {
          await tx
            .update(contentPlans)
            .set({ brief: parsed.data.brief, updatedAt: new Date() })
            .where(eq(contentPlans.id, id));
          await tx.delete(contentItems).where(eq(contentItems.planId, id));
        } else {
          await tx.insert(contentPlans).values({
            id,
            weekStart: parsed.data.weekStart,
            brief: parsed.data.brief,
          });
        }
        await tx
          .insert(contentItems)
          .values(normalized.map((item) => ({ ...item, planId: id })));
        return id;
      });

      const result = await getContentPlanResponse(planId);
      if (!result) throw new Error("The generated plan could not be loaded.");
      res.json(GenerateContentPlanResponse.parse(result));
    } catch (error) {
      req.log.error({ err: error }, "Weekly content plan generation failed");
      res.status(502).json({
        error: "The planning provider could not create this week. Please try again.",
      });
    }
  },
);

router.patch(
  "/studio/content-items/:contentItemId",
  requireStudioSession,
  async (req, res): Promise<void> => {
    const params = UpdateContentItemParams.safeParse(req.params);
    const body = UpdateContentItemBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Add valid content updates." });
      return;
    }
    if (body.data.provider === "grok" && !process.env.XAI_API_KEY) {
      res.status(409).json({
        error: "Grok image generation is not configured on the server.",
      });
      return;
    }

    const [updated] = await db
      .update(contentItems)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(contentItems.id, params.data.contentItemId))
      .returning({ id: contentItems.id });
    if (!updated) {
      res.status(404).json({ error: "Content item not found." });
      return;
    }

    const response = await getContentItemResponse(updated.id);
    res.json(UpdateContentItemResponse.parse(response));
  },
);

router.delete(
  "/studio/content-items/:contentItemId",
  requireStudioSession,
  async (req, res): Promise<void> => {
    const params = UpdateContentItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid content item." });
      return;
    }
    const deleted = await db
      .delete(contentItems)
      .where(eq(contentItems.id, params.data.contentItemId))
      .returning({ id: contentItems.id });
    if (!deleted.length) {
      res.status(404).json({ error: "Content item not found." });
      return;
    }
    res.sendStatus(204);
  },
);

router.post(
  "/studio/content-items/:contentItemId/variations",
  requireStudioSession,
  async (req, res): Promise<void> => {
    const params = AddContentVariationParams.safeParse(req.params);
    const body = AddContentVariationBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Choose a valid generated scene." });
      return;
    }

    const [item, scene] = await Promise.all([
      db
        .select({ id: contentItems.id })
        .from(contentItems)
        .where(eq(contentItems.id, params.data.contentItemId))
        .limit(1),
      db
        .select({ id: scenes.id })
        .from(scenes)
        .where(eq(scenes.id, body.data.sceneId))
        .limit(1),
    ]);
    if (!item[0] || !scene[0]) {
      res.status(404).json({ error: "Content item or scene not found." });
      return;
    }

    const existing = await db
      .select({ id: contentVariations.id })
      .from(contentVariations)
      .where(eq(contentVariations.sceneId, body.data.sceneId))
      .limit(1);
    if (!existing.length) {
      const current = await db
        .select({ id: contentVariations.id })
        .from(contentVariations)
        .where(eq(contentVariations.contentItemId, params.data.contentItemId));
      await db.transaction(async (tx) => {
        await tx.insert(contentVariations).values({
          id: randomUUID(),
          contentItemId: params.data.contentItemId,
          sceneId: body.data.sceneId,
          ordinal: current.length + 1,
        });
        await tx
          .update(contentItems)
          .set({ status: "generated", updatedAt: new Date() })
          .where(eq(contentItems.id, params.data.contentItemId));
      });
    }
    res.sendStatus(204);
  },
);

router.post(
  "/studio/content-items/:contentItemId/approve",
  requireStudioSession,
  async (req, res): Promise<void> => {
    const params = ApproveContentItemParams.safeParse(req.params);
    const body = ApproveContentItemBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Choose a valid variation." });
      return;
    }
    const variation = await db
      .select({ id: contentVariations.id })
      .from(contentVariations)
      .where(
        and(
          eq(contentVariations.contentItemId, params.data.contentItemId),
          eq(contentVariations.sceneId, body.data.sceneId),
        ),
      )
      .limit(1);
    if (!variation.length) {
      res.status(409).json({
        error: "That scene is not a variation of this content item.",
      });
      return;
    }
    await db
      .update(contentItems)
      .set({
        selectedSceneId: body.data.sceneId,
        status: "approved",
        scheduledFor: null,
        failureReason: null,
        updatedAt: new Date(),
      })
      .where(eq(contentItems.id, params.data.contentItemId));
    res.sendStatus(204);
  },
);

router.post(
  "/studio/content-items/:contentItemId/schedule",
  requireStudioSession,
  async (req, res): Promise<void> => {
    const params = ScheduleContentItemParams.safeParse(req.params);
    const body = ScheduleContentItemBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Choose a valid publication time." });
      return;
    }
    const scheduledFor = new Date(body.data.scheduledFor);
    const day = scheduledFor.toISOString().slice(0, 10);
    const dayStart = new Date(`${day}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const [item] = await db
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, params.data.contentItemId))
      .limit(1);
    if (!item?.selectedSceneId || !["approved", "scheduled"].includes(item.status)) {
      res.status(409).json({
        error: "Approve one generated variation before scheduling it.",
      });
      return;
    }
    const conflict = await db
      .select({ id: contentItems.id })
      .from(contentItems)
      .where(
        and(
          ne(contentItems.id, item.id),
          inArray(contentItems.status, ["scheduled", "published"]),
          gte(contentItems.scheduledFor, dayStart),
          lt(contentItems.scheduledFor, dayEnd),
        ),
      )
      .limit(1);
    if (conflict.length) {
      res.status(409).json({
        error: "Another item already occupies that calendar day.",
      });
      return;
    }
    await db
      .update(contentItems)
      .set({ scheduledFor, status: "scheduled", updatedAt: new Date() })
      .where(eq(contentItems.id, item.id));
    res.sendStatus(204);
  },
);

router.delete(
  "/studio/content-items/:contentItemId/schedule",
  requireStudioSession,
  async (req, res): Promise<void> => {
    const params = ScheduleContentItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid content item." });
      return;
    }
    await db
      .update(contentItems)
      .set({ scheduledFor: null, status: "approved", updatedAt: new Date() })
      .where(eq(contentItems.id, params.data.contentItemId));
    res.sendStatus(204);
  },
);

router.post(
  "/studio/content-items/:contentItemId/publication",
  requireStudioSession,
  async (req, res): Promise<void> => {
    const params = RecordContentPublicationParams.safeParse(req.params);
    const body = RecordContentPublicationBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Add a valid publication result." });
      return;
    }
    if (body.data.status === "published" && !body.data.postId) {
      res.status(400).json({ error: "A published post id is required." });
      return;
    }
    await db
      .update(contentItems)
      .set({
        status: body.data.status,
        instagramPostId:
          body.data.status === "published" ? body.data.postId : null,
        publishedAt: body.data.status === "published" ? new Date() : null,
        failureReason:
          body.data.status === "failed"
            ? body.data.failureReason || "Instagram publication failed."
            : null,
        updatedAt: new Date(),
      })
      .where(eq(contentItems.id, params.data.contentItemId));
    res.sendStatus(204);
  },
);

export default router;