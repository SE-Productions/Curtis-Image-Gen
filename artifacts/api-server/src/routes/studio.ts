import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Router, type IRouter } from "express";
import { Composio } from "@composio/core";
import {
  GenerateStudioImageBody,
  GenerateStudioImageResponse,
  BeginInstagramConnectionResponse,
  GetStudioCapabilitiesResponse,
  GetInstagramPublishingStatusResponse,
  PublishStudioImageToInstagramBody,
  PublishStudioImageToInstagramResponse,
} from "@workspace/api-zod";
import {
  editImages,
  generateImageBuffer,
} from "@workspace/integrations-openai-ai-server/image";

const router: IRouter = Router();
const maxReferenceBytes = 10 * 1024 * 1024;
const composioUserId = "curtis-image-studio";
const hostedAssetTtlMs = 20 * 60 * 1000;
const hostedAssets = new Map<
  string,
  { bytes: Buffer; contentType: "image/png" | "image/jpeg"; expiresAt: number }
>();

function imageSizeFor(aspectRatio: "16:9" | "9:16" | "1:1") {
  if (aspectRatio === "9:16") return "1024x1536" as const;
  if (aspectRatio === "16:9") return "1536x1024" as const;
  return "1024x1024" as const;
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

function getPublicAppUrl(): string | null {
  const configuredUrl = process.env.PUBLIC_APP_URL?.trim();
  if (!configuredUrl) return null;

  try {
    const parsedUrl = new URL(configuredUrl);
    return parsedUrl.protocol === "https:" ? parsedUrl.origin : null;
  } catch {
    return null;
  }
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

router.get("/studio/capabilities", (_req, res): void => {
  res.json(
    GetStudioCapabilitiesResponse.parse({
      imageGeneration: true,
      referenceGuidance: true,
      provider: "OpenAI image generation",
    }),
  );
});

router.get("/studio/instagram/status", (_req, res): void => {
  res.json(
    GetInstagramPublishingStatusResponse.parse({
      available: Boolean(process.env.COMPOSIO_API_KEY),
      accountType: "Instagram Business or Creator account",
    }),
  );
});

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

router.post("/studio/instagram/connect", async (req, res): Promise<void> => {
  if (!process.env.COMPOSIO_API_KEY) {
    res.status(503).json({ error: "Instagram publishing is not configured." });
    return;
  }

  try {
    const connection = await getComposioClient().toolkits.authorize(
      composioUserId,
      "instagram",
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
});

router.post("/studio/instagram/publish", async (req, res): Promise<void> => {
  const parsed = PublishStudioImageToInstagramBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Add an image and a caption before publishing." });
    return;
  }

  const publicAppUrl = getPublicAppUrl();
  if (!publicAppUrl) {
    res.status(409).json({
      error:
        "Publish this app first, then configure its public HTTPS URL before posting to Instagram.",
    });
    return;
  }

  try {
    const assetId = createHostedAsset(parsed.data.imageDataUrl);
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

    res.json(
      PublishStudioImageToInstagramResponse.parse({
        postId,
        publicImageUrl,
        status: "published",
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Instagram publication failed");
    res.status(502).json({
      error:
        "Instagram could not publish this image. Confirm that the connected account is a Business or Creator account and try again.",
    });
  }
});

router.post("/studio/images", async (req, res): Promise<void> => {
  const parsed = GenerateStudioImageBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid studio image request");
    res.status(400).json({ error: "Add a scene description and choose an aspect ratio." });
    return;
  }

  const { prompt, aspectRatio, referenceImage } = parsed.data;
  let temporaryReference: string | null = null;

  try {
    let imageBuffer: Buffer;
    if (referenceImage) {
      temporaryReference = await writeReferenceFile(referenceImage);
      imageBuffer = await editImages(
        [temporaryReference],
        `${prompt}\n\nUse the uploaded image as the identity reference. Preserve the subject's face, age, skin tone, hair, and distinctive features while creating the requested scene.`,
      );
    } else {
      imageBuffer = await generateImageBuffer(prompt, imageSizeFor(aspectRatio));
    }

    if (!imageBuffer.length) {
      throw new Error("The image provider returned an empty image.");
    }

    res.json(
      GenerateStudioImageResponse.parse({
        imageDataUrl: `data:image/png;base64,${imageBuffer.toString("base64")}`,
        provider: "OpenAI image generation",
        referenceUsed: Boolean(referenceImage),
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