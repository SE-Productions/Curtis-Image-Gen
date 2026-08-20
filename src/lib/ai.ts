import type { PostFormat } from "./types";

const NVIDIA_BASE =
  process.env.NVIDIA_API_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL =
  process.env.NVIDIA_PROMPT_MODEL ?? "meta/llama-3.1-70b-instruct";

export function directorName(nvidiaKey?: string | null): "nvidia" | "grok" | "none" {
  if (process.env.NVIDIA_API_KEY || nvidiaKey) return "nvidia";
  if (process.env.XAI_API_KEY) return "grok";
  return "none";
}

export function capabilities(nvidiaKey?: string | null) {
  return {
    nvidia: Boolean(process.env.NVIDIA_API_KEY || nvidiaKey),
    grok: Boolean(process.env.XAI_API_KEY),
    imagine: Boolean(process.env.XAI_API_KEY),
    director: directorName(nvidiaKey),
  } as const;
}

type PlanItem = {
  title: string;
  concept: string;
  prompt: string;
  caption: string;
  format: PostFormat;
};

const PLAN_SYSTEM = [
  "You are the cinematic prompt director for Curtis Image Studio.",
  "Convert a topic plus a locked identity into a multi-day Instagram plan.",
  "Return strict JSON with one key, items, an array of objects.",
  "Each object must have title, concept, prompt, caption, format.",
  "format must be feed, story, or reel as requested.",
  "Each prompt is a standalone ultra-realistic image/video generation prompt.",
  "Specify subject action, environment, composition, camera and lens, depth of field, lighting, texture, color grade, and atmosphere.",
  "Treat the uploaded photo as an identity lock. Preserve the exact same person: facial structure, skin tone, age, hairstyle, proportions, and defining features. Never substitute, stylize away, or blend the face.",
  "Do not mention that a reference image exists. Describe the desired final scene.",
  "Never add text, logos, watermarks, extra people, or unrelated objects.",
  "Captions must be natural, under 400 characters, at most five hashtags.",
  "Make every day visually distinct while staying on the same topic and the same person.",
].join(" ");

async function chatComplete(
  system: string,
  user: string,
  json: boolean,
  nvidiaKey?: string | null,
) {
  const key = process.env.NVIDIA_API_KEY || nvidiaKey || "";
  if (key) {
    try {
      const res = await fetch(`${NVIDIA_BASE.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: NVIDIA_MODEL,
          temperature: 0.55,
          top_p: 0.9,
          max_tokens: 3500,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (res.ok) {
        const payload = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = payload.choices?.[0]?.message?.content?.trim();
        if (text) return { text, director: "nvidia" as const };
      }
    } catch (error) {
      console.warn("NVIDIA director unavailable", error);
    }
  }

  const xaiKey = process.env.XAI_API_KEY;
  if (!xaiKey) throw new Error("AI is not available in this environment");

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${xaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.55,
      max_tokens: 3500,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Director error ${res.status}`);
  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Director returned an empty response");
  return { text, director: "grok" as const };
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Director did not return JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function writeCalendarPlan(input: {
  topic: string;
  days: number;
  format: PostFormat;
  nvidiaKey?: string | null;
}): Promise<{ items: PlanItem[]; director: "nvidia" | "grok" }> {
  const { text, director } = await chatComplete(
    PLAN_SYSTEM,
    [
      `Topic: ${input.topic}`,
      `Days: ${input.days}`,
      `Preferred format for every item: ${input.format}`,
      `Return exactly ${input.days} items.`,
      "Each prompt must be ultra-realistic cinematic photography or live-action footage of the locked identity.",
    ].join("\n"),
    true,
    input.nvidiaKey,
  );

  const parsed = extractJson(text) as { items?: Array<Record<string, unknown>> };
  if (!Array.isArray(parsed.items) || parsed.items.length < 1) {
    throw new Error("Director did not return a calendar");
  }

  const allowed: PostFormat[] = ["feed", "story", "reel"];
  const items = parsed.items.slice(0, input.days).map((item, index) => {
    const format = allowed.includes(item.format as PostFormat)
      ? (item.format as PostFormat)
      : input.format;
    if (
      typeof item.title !== "string" ||
      typeof item.concept !== "string" ||
      typeof item.prompt !== "string" ||
      typeof item.caption !== "string"
    ) {
      throw new Error(`Director returned an invalid day ${index + 1}`);
    }
    return {
      title: item.title.trim().slice(0, 160),
      concept: item.concept.trim().slice(0, 2000),
      prompt: item.prompt.trim().slice(0, 6000),
      caption: item.caption.trim().slice(0, 2200),
      format,
    };
  });

  if (items.length !== input.days) {
    throw new Error(`Director returned ${items.length} days, expected ${input.days}`);
  }
  return { items, director };
}

function aspectFor(format: PostFormat): "1:1" | "3:4" | "9:16" {
  if (format === "feed") return "3:4";
  return "9:16";
}

async function xaiImage(body: Record<string, unknown>): Promise<string> {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("AI is not available in this environment");
  const res = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Image generation failed (${res.status})`);
  const payload = (await res.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>;
  };
  const first = payload.data?.[0];
  if (first?.b64_json) return `data:image/jpeg;base64,${first.b64_json}`;
  if (first?.url) return first.url;
  throw new Error("Image generation returned no image");
}

async function xaiEdit(prompt: string, referenceDataUrl: string, aspect: string) {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("AI is not available in this environment");
  const res = await fetch("https://api.x.ai/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-imagine-image-2.0",
      prompt,
      image: { url: referenceDataUrl, type: "image_url" },
      aspect_ratio: aspect,
      resolution: "1k",
      n: 1,
      response_format: "b64_json",
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Face-locked render failed (${res.status})`);
  const payload = (await res.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>;
  };
  const first = payload.data?.[0];
  if (first?.b64_json) return `data:image/jpeg;base64,${first.b64_json}`;
  if (first?.url) return first.url;
  throw new Error("Face-locked render returned no image");
}

export async function renderFaceLockedStill(input: {
  prompt: string;
  format: PostFormat;
  referenceDataUrl: string;
}): Promise<{ media: string; aspectRatio: string }> {
  const aspect = aspectFor(input.format);
  const lockedPrompt = [
    input.prompt,
    "Ultra-realistic cinematic photography.",
    "Preserve the exact identity, facial structure, skin tone, age, hairstyle, proportions, and defining features of the supplied reference subject. True fidelity. Never substitute another face.",
  ].join(" ");

  try {
    const media = await xaiEdit(lockedPrompt, input.referenceDataUrl, aspect);
    return { media, aspectRatio: aspect };
  } catch (error) {
    console.warn("Image edit failed, falling back to generation", error);
    const media = await xaiImage({
      model: "grok-imagine-image-2.0",
      prompt: lockedPrompt,
      aspect_ratio: aspect,
      resolution: "1k",
      n: 1,
      response_format: "b64_json",
    });
    return { media, aspectRatio: aspect };
  }
}

export async function renderFaceLockedVideo(input: {
  prompt: string;
  imageUrl: string;
}): Promise<string> {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("AI is not available in this environment");

  const start = await fetch("https://api.x.ai/v1/videos/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-imagine-video-1.5",
      prompt: `${input.prompt} Ultra-realistic live action. Keep the exact same face and identity throughout.`,
      image: { url: input.imageUrl },
      duration: 6,
      aspect_ratio: "9:16",
      resolution: "720p",
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!start.ok) throw new Error(`Video start failed (${start.status})`);
  const started = (await start.json()) as { request_id?: string; id?: string };
  const requestId = started.request_id ?? started.id;
  if (!requestId) throw new Error("Video start returned no request id");

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!poll.ok) continue;
    const body = (await poll.json()) as {
      status?: string;
      video?: { url?: string };
      url?: string;
    };
    const status = (body.status ?? "").toLowerCase();
    if (status === "done" || status === "completed" || status === "succeeded") {
      const url = body.video?.url ?? body.url;
      if (url) return url;
    }
    if (status.includes("fail") || status.includes("error")) {
      throw new Error("Video generation failed");
    }
  }
  throw new Error("Video generation timed out");
}

export async function persistMediaAsDataUrl(media: string): Promise<string> {
  if (media.startsWith("data:")) return media;
  const res = await fetch(media, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return media;
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") || "image/jpeg";
  if (buf.length > 6_000_000) return media;
  return `data:${mime};base64,${buf.toString("base64")}`;
}
