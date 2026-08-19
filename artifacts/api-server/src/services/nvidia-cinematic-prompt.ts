const nvidiaPromptModel =
  process.env.NVIDIA_PROMPT_MODEL ?? "meta/llama-3.1-70b-instruct";
const nvidiaApiBaseUrl =
  process.env.NVIDIA_API_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const promptTimeoutMs = 20_000;
const maxPromptLength = 6_000;

const cinematicStyleFallback = [
  "Ultra-realistic cinematic photography.",
  "Natural skin and material textures, physically plausible lighting, intentional composition,",
  "professional lens rendering, rich but grounded color grade, and fine detail without an artificial or plastic look.",
].join(" ");

function fallbackPrompt(prompt: string, referenceUsed: boolean): string {
  const referenceInstruction = referenceUsed
    ? "Preserve the exact identity, facial structure, skin tone, age, hairstyle, proportions, and defining features of the supplied reference subject."
    : "";
  return `${prompt}\n\n${cinematicStyleFallback} ${referenceInstruction}`.trim();
}

export async function createCinematicScenePrompt(
  prompt: string,
  referenceUsed: boolean,
  fidelity: "high" | "balanced",
): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return fallbackPrompt(prompt, referenceUsed);

  const identityRule = referenceUsed
    ? fidelity === "high"
      ? "Treat the reference as an identity lock. Preserve the exact same person and never substitute, stylize away, or blend their face."
      : "Preserve the reference subject's recognizable identity, facial features, skin tone, hairstyle, and proportions."
    : "Do not invent a recognizable real person unless the brief explicitly asks for one.";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), promptTimeoutMs);

  try {
    const response = await fetch(`${nvidiaApiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: nvidiaPromptModel,
        temperature: 0.55,
        top_p: 0.9,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content: [
              "You are the cinematic prompt director for a premium image studio.",
              "Convert the user's scene brief into one standalone prompt for an image generation model.",
              "Return only the finished prompt. Do not use markdown, headings, explanations, or quotation marks.",
              "Make it ultra-realistic and cinematic: specify the subject action, environment, composition, camera and lens language, depth of field, lighting, texture, color grade, and atmosphere only when useful.",
              "Keep the user's original subject, intent, wardrobe, pose, and requested composition. Never add text, logos, watermarks, extra people, or unrelated objects.",
              identityRule,
              "Do not describe the reference image as an image to copy; describe the desired final scene.",
            ].join(" "),
          },
          {
            role: "user",
            content: `<SCENE_BRIEF>\n${prompt}\n</SCENE_BRIEF>`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`NVIDIA prompt service returned ${response.status}.`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const generatedPrompt = payload.choices?.[0]?.message?.content;
    if (typeof generatedPrompt !== "string" || !generatedPrompt.trim()) {
      throw new Error("NVIDIA prompt service returned an empty prompt.");
    }

    return generatedPrompt.trim().slice(0, maxPromptLength);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("NVIDIA prompt service timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}