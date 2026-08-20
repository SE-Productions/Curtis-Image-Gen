import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Composio } from "@composio/core";
import {
  CreateStudioSceneBody,
  CreateStudioSceneResponse,
  DeleteStudioSceneParams,
  GenerateStudioImageBody,
  GenerateStudioImageResponse,
  GenerateStudioPostCopyBody,
  GenerateStudioPostCopyResponse,
  GetStudioScenesResponseItem,
  GetStudioVideoParams,
  GetStudioVideoResponse,
  BeginInstagramConnectionResponse,
  GetStudioCapabilitiesResponse,
  GetInstagramPublishingStatusResponse,
  PublishStudioImageToInstagramBody,
  PublishStudioImageToInstagramResponse,
  StartStudioVideoBody,
  StartStudioVideoResponse,
} from "@workspace/api-zod";
import {
  contentItems,
  contentVariations,
  creatorProfiles,
  db,
  scenes,
} from "@workspace/db";
import {
  editImages,
  generateImageBuffer,
} from "@workspace/integrations-openai-ai-server/image";
import { openai } from "@workspace/integrations-openai-ai-server";
import { createCinematicScenePrompt } from "../services/nvidia-cinematic-prompt";
import {
  clearSessionCookie,
  hasValidSession,
  isAccessPasswordConfigured,
  requireStudioSession,
  setSessionCookie,
  studioAccessIsAvailable,
  verifyPassword,
} from "../services/studio-session";

const router: IRouter = Router();
const maxReferenceBytes = 10 * 1024 * 1024;
const composioUserId = "curtis-image-studio";
const hostedAssetTtlMs = 20 * 60 * 1000;
const maxStudioScenes = 50;
const maxStudioSceneImageDataUrlLength = 16_000_000;
const hostedAssets = new Map<
  string,
  { bytes: Buffer; contentType: "image/png" | "image/jpeg"; expiresAt: number }
>();
const videoTaskFormats = new Map<string, "reel" | "story">();

async function listInstagramConnections() {
  return getComposioClient().connectedAccounts.list({
    userIds: [composioUserId],
    toolkitSlugs: ["instagram"],
    orderBy: "updated_at",
    limit: 20,
  });
}

type InstagramConnectedAccount = Awaited<
  ReturnType<typeof listInstagramConnections>
>["items"][number];

function selectInstagramConnection(
  accounts: InstagramConnectedAccount[],
): InstagramConnectedAccount | undefined {
  return (
    accounts.find(
      (account) => account.status === "ACTIVE" && !account.isDisabled,
    ) ??
    accounts.find(
      (account) =>
        account.status === "INITIALIZING" || account.status === "INITIATED",
    ) ??
    accounts.find((account) =>
      ["FAILED", "EXPIRED", "INACTIVE", "REVOKED"].includes(account.status),
    )
  );
}

function safeInstagramAccountLabel(alias: string | null | undefined): string | null {
  const label = alias?.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return label ? label.slice(0, 100) : null;
}

function instagramConnectionStatus(
  configured: boolean,
  accounts: Awaited<ReturnType<typeof listInstagramConnections>>["items"] = [],
) {
  if (!configured) {
    return {
      available: false,
      configured: false,
      connected: false,
      connectionStatus: "not_configured" as const,
      accountLabel: null,
      accountType: "Instagram Business or Creator account",
      updatedAt: null,
    };
  }

  const current = selectInstagramConnection(accounts);
  const connected = current?.status === "ACTIVE" && !current.isDisabled;
  const connecting =
    current?.status === "INITIALIZING" || current?.status === "INITIATED";
  const attention =
    current != null &&
    ["FAILED", "EXPIRED", "INACTIVE", "REVOKED"].includes(current.status);

  return {
    available: connected,
    configured: true,
    connected,
    connectionStatus: connected
      ? ("connected" as const)
      : connecting
        ? ("connecting" as const)
        : attention
          ? ("attention" as const)
          : ("disconnected" as const),
    accountLabel: safeInstagramAccountLabel(current?.alias),
    accountType: "Instagram Business or Creator account",
    updatedAt: current?.updatedAt ?? null,
  };
}

function imageSizeFor(aspectRatio: "16:9" | "9:16" | "1:1") {
  if (aspectRatio === "9:16") return "1024x1536" as const;
  if (aspectRatio === "16:9") return "1536x1024" as const;
  return "1024x1024" as const;
}

async function generateGrokImage(
  prompt: string,
  aspectRatio: "16:9" | "9:16" | "1:1",
): Promise<Buffer> {
  if (!process.env.XAI_API_KEY) {
    throw new Error("Grok image generation is not configured.");
  }

  const response = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-imagine-image-2.0",
      prompt,
      aspect_ratio: aspectRatio,
      response_format: "b64_json",
      n: 1,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`Grok image generation failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };
  const base64 = payload.data?.[0]?.b64_json;
  if (!base64) {
    throw new Error("Grok image generation returned no image.");
  }
  return Buffer.from(base64, "base64");
}

async function writeReferenceFile(dataUrl: string): Promise<string> {
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=\s]+)$/.exec(
    dataUrl,
  );
  if (!match) {
    throw new Error("The reference image must be a PNG or JPEG file.");
  }

  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!bytes.length || bytes.length > maxReferenceBytes) {
    throw new Error("The reference image must be 10 MB or smaller.");
  }

  const extension = match[1] === "image/png" ? "png" : "jpg";
  const filePath = path.join(
    os.tmpdir(),
    `curtis-reference-${randomUUID()}.${extension}`,
  );
  await writeFile(filePath, bytes);
  return filePath;
}

function parseImageDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=\s]+)$/.exec(
    dataUrl,
  );
  if (!match) {
    throw new Error("The image must be a PNG or JPEG file.");
  }

  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!bytes.length || bytes.length > maxReferenceBytes) {
    throw new Error("The image must be 10 MB or smaller.");
  }

  return {
    bytes,
    contentType: match[1] as "image/png" | "image/jpeg",
  };
}

function pruneHostedAssets(): void {
  const now = Date.now();
  for (const [assetId, asset] of hostedAssets) {
    if (asset.expiresAt <= now) hostedAssets.delete(assetId);
  }
}

function createHostedAsset(dataUrl: string): string {
  const image = parseImageDataUrl(dataUrl);
  pruneHostedAssets();
  const assetId = randomUUID();
  hostedAssets.set(assetId, {
    ...image,
    expiresAt: Date.now() + hostedAssetTtlMs,
  });
  return assetId;
}

function getPublicAppUrl(req?: Request): string | null {
  const configuredUrl = process.env.PUBLIC_APP_URL?.trim();
  if (configuredUrl) {
    try {
      const parsedUrl = new URL(configuredUrl);
      if (parsedUrl.protocol === "https:") return parsedUrl.origin;
    } catch {
      // Fall through to the proxy headers below.
    }
  }

  const forwardedProtocol = req?.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = req?.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedProtocol === "https" && forwardedHost) {
    return `https://${forwardedHost}`;
  }

  return null;
}

function getTrustedAppOrigin(): string | null {
  const candidates = [
    process.env.PUBLIC_APP_URL?.trim(),
    process.env.REPLIT_DOMAINS?.split(",")[0]?.trim(),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsedUrl = new URL(
        candidate.includes("://") ? candidate : `https://${candidate}`,
      );
      if (
        parsedUrl.protocol === "https:" &&
        !parsedUrl.username &&
        !parsedUrl.password
      ) {
        return parsedUrl.origin;
      }
    } catch {
      // Try the next server-controlled origin.
    }
  }

  return null;
}

function getComposioClient(): Composio {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    throw new Error("Instagram publishing is not configured.");
  }
  return new Composio({ apiKey });
}

function findPublicationId(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const record = result as Record<string, unknown>;
  for (const key of ["id", "media_id", "creation_id"]) {
    if (typeof record[key] === "string") return record[key];
  }
  return findPublicationId(record.data);
}

function findNestedString(
  value: unknown,
  keys: readonly string[],
  depth = 0,
): string | null {
  if (!value || typeof value !== "object" || depth > 6) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNestedString(item, keys, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key].trim()) {
      return record[key].trim();
    }
  }
  for (const nested of Object.values(record)) {
    const found = findNestedString(nested, keys, depth + 1);
    if (found) return found;
  }
  return null;
}

function normalizeVideoStatus(value: string | null): "queued" | "processing" | "completed" | "failed" {
  const status = value?.toLowerCase() ?? "";
  if (/(fail|error|cancel|reject)/.test(status)) return "failed";
  if (/(complete|success|finish|done)/.test(status)) return "completed";
  if (/(process|running|render|generat)/.test(status)) return "processing";
  return "queued";
}

async function requestA2e(pathname: string, init?: RequestInit): Promise<unknown> {
  const apiKey = process.env.A2E_API_KEY;
  if (!apiKey) throw new Error("Video rendering is not configured.");

  const response = await fetch(`https://video.a2e.ai${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload
        ? findNestedString(payload, ["message", "msg", "error"])
        : null;
    throw new Error(detail || `A2E returned ${response.status}.`);
  }
  return payload;
}

function a2eTaskResponse(
  payload: unknown,
  taskId: string,
  format: "reel" | "story",
) {
  const status = normalizeVideoStatus(
    findNestedString(payload, ["status", "state", "task_status"]),
  );
  const videoUrl = findNestedString(payload, [
    "video_url",
    "videoUrl",
    "result_url",
    "resultUrl",
    "download_url",
    "downloadUrl",
    "url",
  ]);
  const error =
    status === "failed"
      ? findNestedString(payload, ["error", "message", "msg"])
      : null;

  return {
    taskId,
    status,
    format,
    videoUrl: status === "completed" ? videoUrl : null,
    error,
  };
}

router.get("/studio/capabilities", (_req, res): void => {
  res.json(
    GetStudioCapabilitiesResponse.parse({
      imageGeneration: true,
      referenceGuidance: true,
      provider: process.env.NVIDIA_API_KEY
        ? "OpenAI image generation + NVIDIA cinematic direction"
        : "OpenAI image generation + cinematic direction",
      openaiConfigured: Boolean(
        process.env.AI_INTEGRATIONS_OPENAI_API_KEY &&
          process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      ),
      grokConfigured: Boolean(process.env.XAI_API_KEY),
    }),
  );
});

router.get("/studio/session", (req, res): void => {
  res.json({
    unlocked:
      studioAccessIsAvailable() &&
      (!isAccessPasswordConfigured() || hasValidSession(req)),
    required: isAccessPasswordConfigured() || !studioAccessIsAvailable(),
  });
});

router.post("/studio/session", (req, res): void => {
  if (!isAccessPasswordConfigured()) {
    if (!studioAccessIsAvailable()) {
      res.status(503).json({
        error: "Studio access protection is not configured.",
      });
      return;
    }
    // Open mode: no password configured, so the studio is always unlocked.
    res.json({ unlocked: true, required: false });
    return;
  }

  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!verifyPassword(password)) {
    res.status(401).json({ error: "Incorrect access password." });
    return;
  }

  setSessionCookie(res);
  res.json({ unlocked: true, required: true });
});

router.delete("/studio/session", (_req, res): void => {
  clearSessionCookie(res);
  res.sendStatus(204);
});

router.get("/studio/scenes", requireStudioSession, async (_req, res): Promise<void> => {
  const storedScenes = await db
    .select()
    .from(scenes)
    .orderBy(desc(scenes.createdAt))
    .limit(maxStudioScenes);

  res.json(storedScenes.map((scene) => GetStudioScenesResponseItem.parse(scene)));
});

router.post("/studio/scenes", requireStudioSession, async (req, res): Promise<void> => {
  // Check this before Zod validation so every over-limit image (including the
  // 16–22 MB range accepted by the transport) receives the documented 413.
  if (
    typeof req.body?.imageDataUrl === "string" &&
    req.body.imageDataUrl.length > maxStudioSceneImageDataUrlLength
  ) {
    res.status(413).json({ error: "The generated scene image is too large to save." });
    return;
  }

  const parsed = CreateStudioSceneBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid studio scene request");
    res.status(400).json({ error: "Add a valid generated scene before saving." });
    return;
  }

  const { imageDataUrl } = parsed.data;
  const savedScene = await db.transaction(async (tx) => {
    const [scene] = await tx
      .insert(scenes)
      .values({
        id: randomUUID(),
        prompt: parsed.data.prompt,
        aspectRatio: parsed.data.aspectRatio,
        fidelity: parsed.data.fidelity,
        referenceUsed: parsed.data.referenceUsed,
        imageDataUrl: parsed.data.imageDataUrl,
        provider: parsed.data.provider,
      })
      .returning();

    const [allScenes, referencedScenes] = await Promise.all([
      tx
        .select({ id: scenes.id })
        .from(scenes)
        .orderBy(desc(scenes.createdAt)),
      tx
        .select({ sceneId: contentVariations.sceneId })
        .from(contentVariations),
    ]);
    const referencedSceneIds = new Set(
      referencedScenes.map(({ sceneId }) => sceneId),
    );
    const excessScenes = allScenes
      .slice(maxStudioScenes)
      .filter(({ id }) => !referencedSceneIds.has(id));

    if (excessScenes.length > 0) {
      await tx
        .delete(scenes)
        .where(inArray(scenes.id, excessScenes.map(({ id }) => id)));
    }

    return scene;
  });

  res.status(201).json(CreateStudioSceneResponse.parse(savedScene));
});

router.delete("/studio/scenes", requireStudioSession, async (_req, res): Promise<void> => {
  const [reference] = await db
    .select({ id: contentVariations.id })
    .from(contentVariations)
    .limit(1);
  if (reference) {
    res.status(409).json({
      error:
        "Planned content is using one or more scenes. Delete those content items before clearing the library.",
    });
    return;
  }
  await db.delete(scenes);
  res.sendStatus(204);
});

router.delete("/studio/scenes/:sceneId", requireStudioSession, async (req, res): Promise<void> => {
  const params = DeleteStudioSceneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid scene id." });
    return;
  }

  const [reference] = await db
    .select({ id: contentVariations.id })
    .from(contentVariations)
    .where(eq(contentVariations.sceneId, params.data.sceneId))
    .limit(1);
  if (reference) {
    res.status(409).json({
      error:
        "This scene is attached to planned content and cannot be deleted.",
    });
    return;
  }

  const deleted = await db
    .delete(scenes)
    .where(eq(scenes.id, params.data.sceneId))
    .returning({ id: scenes.id });

  if (deleted.length === 0) {
    res.status(404).json({ error: "Generated scene not found." });
    return;
  }

  res.sendStatus(204);
});

async function recordPublicationFailure(
  contentItemId: string | undefined,
  failureReason: string,
): Promise<void> {
  if (!contentItemId) return;
  await db
    .update(contentItems)
    .set({
      status: "failed",
      failureReason,
      publishedAt: null,
      instagramPostId: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(contentItems.id, contentItemId),
        inArray(contentItems.status, ["approved", "scheduled"]),
      ),
    );
}

router.get(
  "/studio/instagram/status",
  requireStudioSession,
  async (req, res): Promise<void> => {
    const configured = Boolean(process.env.COMPOSIO_API_KEY);
    if (!configured) {
      res.json(
        GetInstagramPublishingStatusResponse.parse(
          instagramConnectionStatus(false),
        ),
      );
      return;
    }

    try {
      const connections = await listInstagramConnections();
      res.json(
        GetInstagramPublishingStatusResponse.parse(
          instagramConnectionStatus(true, connections.items),
        ),
      );
    } catch (error) {
      req.log.error({ err: error }, "Instagram connection status fetch failed");
      res.status(502).json({
        error: "Could not retrieve the Instagram connection status.",
      });
    }
  },
);

router.get("/studio/assets/:assetId", (req, res): void => {
  pruneHostedAssets();
  const asset = hostedAssets.get(req.params.assetId);
  if (!asset) {
    res.status(404).end();
    return;
  }

  res.setHeader("Cache-Control", "public, max-age=900");
  res.type(asset.contentType).send(asset.bytes);
});

router.post("/studio/post-copy", requireStudioSession, async (req, res): Promise<void> => {
  const parsed = GenerateStudioPostCopyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Add a scene prompt before generating post copy." });
    return;
  }

  const formatLabel =
    parsed.data.format === "reel"
      ? "Instagram Reel"
      : parsed.data.format === "story"
        ? "Instagram Story"
        : "Instagram feed post";
  const [creatorDna] = await db
    .select()
    .from(creatorProfiles)
    .where(eq(creatorProfiles.id, "curtis-default"))
    .limit(1);

  let publishedPostId: string | null = null;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 420,
      messages: [
        {
          role: "system",
          content:
            "You write concise, original Instagram captions. Return only the caption—no title, no markdown, no quoted text. Use a strong first line, natural conversational copy, a gentle call to action when it fits, and at most five relevant hashtags. Keep it under 2,200 characters.",
        },
        {
          role: "user",
          content: [
            `Format: ${formatLabel}`,
            parsed.data.title ? `Scene title: ${parsed.data.title}` : "",
            parsed.data.visualDescription
              ? `Visual direction: ${parsed.data.visualDescription}`
              : "",
            `Generation prompt: ${parsed.data.prompt}`,
            creatorDna
              ? [
                  `Creator voice: ${creatorDna.voice}`,
                  `Audience: ${creatorDna.audience}`,
                  `Core themes: ${creatorDna.themes.join(", ")}`,
                  `Offers: ${creatorDna.offers || "None specified"}`,
                  `Goals: ${creatorDna.goals}`,
                ].join("\n")
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });
    const caption = completion.choices[0]?.message.content?.trim() ?? "";
    if (!caption) throw new Error("The copy provider returned an empty caption.");

    res.json(
      GenerateStudioPostCopyResponse.parse({
        caption: caption.slice(0, 2200),
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Studio post-copy generation failed");
    res.status(502).json({
      error: "The copy provider could not write this caption. Please try again.",
    });
  }
});

router.post("/studio/videos", requireStudioSession, async (req, res): Promise<void> => {
  const parsed = StartStudioVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Add a source image, a motion prompt, and a Reel or Story format.",
    });
    return;
  }

  const publicAppUrl = getPublicAppUrl(req);
  if (!publicAppUrl) {
    res.status(409).json({
      error:
        "Video rendering requires a public HTTPS deployment so the animation provider can securely fetch the source image.",
    });
    return;
  }

  if (!process.env.A2E_API_KEY) {
    res.status(503).json({ error: "Video rendering is not configured." });
    return;
  }

  try {
    const assetId = createHostedAsset(parsed.data.imageDataUrl);
    const sourceImageUrl = `${publicAppUrl}/api/studio/assets/${assetId}`;
    const displayFormat = parsed.data.format === "reel" ? "Reel" : "Story";
    const payload = await requestA2e("/api/v1/userImage2Video/start", {
      method: "POST",
      body: JSON.stringify({
        name: `Curtis ${displayFormat} render`,
        image_url: sourceImageUrl,
        prompt: [
          `Create a natural, cinematic 9:16 Instagram ${displayFormat} from this exact source image.`,
          "Keep the person's face, skin tone, age, hairstyle, proportions, and defining features consistent with the source.",
          "Use subtle, realistic motion with stable facial details and no identity changes.",
          parsed.data.prompt,
        ].join(" "),
        negative_prompt:
          "identity change, different person, face distortion, warped features, flicker, blur, duplicate limbs, text, watermark",
        model_type: "GENERAL",
        model_version: "a2e",
        extend_prompt: true,
        number_of_images: 1,
        video_time: parsed.data.durationSeconds,
        skip_face_enhance: false,
      }),
    });
    const taskId = findNestedString(payload, ["_id", "id", "task_id", "taskId"]);
    if (!taskId) throw new Error("A2E did not return a video task identifier.");
    videoTaskFormats.set(taskId, parsed.data.format);

    res.json(
      StartStudioVideoResponse.parse(
        a2eTaskResponse(payload, taskId, parsed.data.format),
      ),
    );
  } catch (error) {
    req.log.error({ err: error }, "Studio video render start failed");
    res.status(502).json({
      error:
        "The video provider could not start this render. Confirm the uploaded face image is suitable and try again.",
    });
  }
});

router.get("/studio/videos/:taskId", requireStudioSession, async (req, res): Promise<void> => {
  const parsed = GetStudioVideoParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(404).json({ error: "Video task not found." });
    return;
  }
  if (!process.env.A2E_API_KEY) {
    res.status(503).json({ error: "Video rendering is not configured." });
    return;
  }

  try {
    const payload = await requestA2e(
      `/api/v1/userImage2Video/${encodeURIComponent(parsed.data.taskId)}`,
    );
    const format = videoTaskFormats.get(parsed.data.taskId) ?? "reel";
    res.json(
      GetStudioVideoResponse.parse(
        a2eTaskResponse(payload, parsed.data.taskId, format),
      ),
    );
  } catch (error) {
    req.log.error({ err: error, taskId: parsed.data.taskId }, "Studio video status fetch failed");
    res.status(502).json({
      error: "The video provider could not retrieve this render.",
    });
  }
});

router.post(
  "/studio/instagram/connect",
  requireStudioSession,
  async (req, res): Promise<void> => {
  if (!process.env.COMPOSIO_API_KEY) {
    res.status(503).json({ error: "Instagram publishing is not configured." });
    return;
  }

  try {
    const trustedAppOrigin = getTrustedAppOrigin();
    if (!trustedAppOrigin) {
      res.status(503).json({
        error:
          "Instagram authorization requires a trusted public application URL.",
      });
      return;
    }

    const composio = getComposioClient();
    const authConfigs = await composio.authConfigs.list({
      toolkit: "instagram",
      limit: 20,
    });
    const authConfig =
      authConfigs.items[0] ??
      (await composio.authConfigs.create("instagram", {
        type: "use_composio_managed_auth",
        name: "Curtis Instagram",
      }));
    const callbackUrl = new URL(
      "/settings?instagram=connected",
      trustedAppOrigin,
    ).toString();
    const connection = await composio.connectedAccounts.link(
      composioUserId,
      authConfig.id,
      {
        callbackUrl,
      },
    );
    if (!connection.redirectUrl) {
      throw new Error("Composio did not return an Instagram authorization link.");
    }

    res.json(
      BeginInstagramConnectionResponse.parse({
        authorizationUrl: connection.redirectUrl,
        expiresAt: null,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Instagram connection initiation failed");
    res.status(502).json({ error: "Could not start the Instagram connection." });
  }
  },
);

router.delete(
  "/studio/instagram/connect",
  requireStudioSession,
  async (req, res): Promise<void> => {
    if (!process.env.COMPOSIO_API_KEY) {
      res.status(503).json({ error: "Instagram publishing is not configured." });
      return;
    }

    try {
      const { items } = await listInstagramConnections();
      const selectedAccount = selectInstagramConnection(items);
      if (selectedAccount) {
        await getComposioClient().connectedAccounts.delete(selectedAccount.id);
      }
      res.sendStatus(204);
    } catch (error) {
      req.log.error({ err: error }, "Instagram account disconnect failed");
      res.status(502).json({
        error: "Could not disconnect the Instagram account. Please try again.",
      });
    }
  },
);

router.post(
  "/studio/instagram/publish",
  requireStudioSession,
  async (req, res): Promise<void> => {
  const parsed = PublishStudioImageToInstagramBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Add an image and a caption before publishing." });
    return;
  }

  let imageDataUrl = parsed.data.imageDataUrl;
  if (parsed.data.contentItemId) {
    const [workflowItem] = await db
      .select({
        id: contentItems.id,
        status: contentItems.status,
        selectedSceneId: contentItems.selectedSceneId,
        imageDataUrl: scenes.imageDataUrl,
      })
      .from(contentItems)
      .leftJoin(scenes, eq(contentItems.selectedSceneId, scenes.id))
      .where(eq(contentItems.id, parsed.data.contentItemId))
      .limit(1);
    if (!workflowItem) {
      res.status(404).json({ error: "Planned content item not found." });
      return;
    }
    if (
      !workflowItem.selectedSceneId ||
      !workflowItem.imageDataUrl ||
      !["approved", "scheduled"].includes(workflowItem.status)
    ) {
      res.status(409).json({
        error: "Approve a saved scene before publishing this content item.",
      });
      return;
    }
    imageDataUrl = workflowItem.imageDataUrl;
  }

  const publicAppUrl = getPublicAppUrl(req);
  if (!publicAppUrl) {
    res.status(409).json({
      error:
        "Publish this app first, then configure its public HTTPS URL before posting to Instagram.",
    });
    return;
  }

  let publishedPostId: string | null = null;
  try {
    const assetId = createHostedAsset(imageDataUrl);
    const publicImageUrl = `${publicAppUrl}/api/studio/assets/${assetId}`;
    const composio = getComposioClient();
    const mediaContainer = await composio.tools.execute(
      "INSTAGRAM_POST_IG_USER_MEDIA",
      {
        userId: composioUserId,
        arguments: {
          image_url: publicImageUrl,
          caption: parsed.data.caption,
        },
      },
    );
    const containerId = findPublicationId(mediaContainer);
    if (!containerId) {
      throw new Error("Instagram did not return a media container.");
    }

    const publication = await composio.tools.execute(
      "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
      {
        userId: composioUserId,
        arguments: { creation_id: containerId },
      },
    );
    const postId = findPublicationId(publication);
    if (!postId) {
      throw new Error("Instagram did not return a published post.");
    }
    publishedPostId = postId;

    if (parsed.data.contentItemId) {
      const [recorded] = await db
        .update(contentItems)
        .set({
          status: "published",
          instagramPostId: postId,
          publishedAt: new Date(),
          failureReason: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(contentItems.id, parsed.data.contentItemId),
            inArray(contentItems.status, ["approved", "scheduled"]),
          ),
        )
        .returning({ id: contentItems.id });
      if (!recorded) {
        throw new Error(
          "Instagram published the post, but the local workflow result could not be recorded.",
        );
      }
    }

    res.json(
      PublishStudioImageToInstagramResponse.parse({
        postId,
        publicImageUrl,
        status: "published",
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Instagram publication failed");
    if (!publishedPostId) {
      await recordPublicationFailure(
        parsed.data.contentItemId,
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "Instagram publication failed.",
      ).catch((recordError) => {
        req.log.error(
          { err: recordError },
          "Instagram publication failure could not be recorded",
        );
      });
    }
    res.status(502).json({
      error: publishedPostId
        ? `Instagram published post ${publishedPostId}, but the local workflow could not record it. Use the publication record recovery endpoint before retrying.`
        : "Instagram could not publish this image. Confirm that the connected account is a Business or Creator account and try again.",
    });
  }
  },
);

router.post("/studio/images", requireStudioSession, async (req, res): Promise<void> => {
  const parsed = GenerateStudioImageBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid studio image request");
    res.status(400).json({ error: "Add a scene description and choose an aspect ratio." });
    return;
  }

  const {
    prompt,
    aspectRatio,
    referenceImage,
    fidelity,
    provider = "openai",
  } = parsed.data;
  if (provider === "grok" && !process.env.XAI_API_KEY) {
    res.status(503).json({ error: "Grok image generation is not configured." });
    return;
  }
  if (provider === "grok" && referenceImage) {
    res.status(409).json({
      error:
        "Use OpenAI for identity-preserving reference images. Grok is currently available for text-to-image scenes only.",
    });
    return;
  }
  let temporaryReference: string | null = null;

  try {
    const cinematicPrompt = await createCinematicScenePrompt(
      prompt,
      Boolean(referenceImage),
      fidelity,
    );
    let imageBuffer: Buffer;
    if (provider === "grok") {
      imageBuffer = await generateGrokImage(cinematicPrompt, aspectRatio);
    } else if (referenceImage) {
      temporaryReference = await writeReferenceFile(referenceImage);
      const fidelityInstruction =
        fidelity === "high"
          ? "Treat the uploaded image as an identity lock. Preserve the exact same person: face shape, eyes, nose, mouth, skin tone, apparent age, hairstyle, hairline, distinctive features, and body proportions. Keep the requested scene, wardrobe, pose, lighting, and composition changes outside the subject's identity. Do not substitute, stylize away, or blend the person with anyone else."
          : "Use the uploaded image as the primary identity reference. Preserve the subject's face, skin tone, hairstyle, and distinctive features while allowing moderate creative interpretation.";
      imageBuffer = await editImages(
        [temporaryReference],
        `${cinematicPrompt}\n\n${fidelityInstruction}`,
      );
    } else {
      imageBuffer = await generateImageBuffer(
        cinematicPrompt,
        imageSizeFor(aspectRatio),
      );
    }

    if (!imageBuffer.length) {
      throw new Error("The image provider returned an empty image.");
    }

    res.json(
      GenerateStudioImageResponse.parse({
        imageDataUrl: `data:image/png;base64,${imageBuffer.toString("base64")}`,
        provider:
          provider === "grok"
            ? "Grok Imagine image generation"
            : "OpenAI image generation",
        referenceUsed: Boolean(referenceImage),
        fidelity,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Studio image generation failed");
    const message =
      error instanceof Error && error.message.includes("reference image")
        ? error.message
        : "The image provider could not finish this scene. Please try again.";
    res.status(502).json({ error: message });
  } finally {
    if (temporaryReference) {
      await unlink(temporaryReference).catch(() => undefined);
    }
  }
});

export default router;