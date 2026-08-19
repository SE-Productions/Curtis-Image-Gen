import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Router, type IRouter } from "express";
import {
  GenerateStudioImageBody,
  GenerateStudioImageResponse,
  GetStudioCapabilitiesResponse,
} from "@workspace/api-zod";
import {
  editImages,
  generateImageBuffer,
} from "@workspace/integrations-openai-ai-server/image";

const router: IRouter = Router();
const maxReferenceBytes = 10 * 1024 * 1024;

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
    throw new Error("The reference image must be a PNG, JPEG, or WebP file.");
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

router.get("/studio/capabilities", (_req, res): void => {
  res.json(
    GetStudioCapabilitiesResponse.parse({
      imageGeneration: true,
      referenceGuidance: true,
      provider: "OpenAI image generation",
    }),
  );
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