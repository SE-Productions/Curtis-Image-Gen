const GRAPH = "https://graph.facebook.com/v21.0";

export async function publishToInstagram(input: {
  igUserId: string;
  token: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  caption: string;
  format: string;
}): Promise<string> {
  const isReel = input.format === "reel" && Boolean(input.videoUrl);
  const mediaUrl = isReel ? input.videoUrl : input.imageUrl;
  if (!mediaUrl) throw new Error("No public media URL to publish");
  if (!mediaUrl.startsWith("https://")) {
    throw new Error("Instagram requires a public HTTPS media URL");
  }

  const createBody = new URLSearchParams({
    access_token: input.token,
    caption: input.caption.slice(0, 2200),
  });
  if (isReel) {
    createBody.set("media_type", "REELS");
    createBody.set("video_url", mediaUrl);
    createBody.set("share_to_feed", "true");
  } else {
    createBody.set("image_url", mediaUrl);
  }

  const createRes = await fetch(`${GRAPH}/${input.igUserId}/media`, {
    method: "POST",
    body: createBody,
    signal: AbortSignal.timeout(60_000),
  });
  const created = (await createRes.json()) as { id?: string; error?: { message?: string } };
  if (!createRes.ok || !created.id) {
    throw new Error(created.error?.message || `Instagram create failed (${createRes.status})`);
  }

  for (let i = 0; i < 20 && isReel; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetch(
      `${GRAPH}/${created.id}?fields=status_code&access_token=${encodeURIComponent(input.token)}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    const status = (await statusRes.json()) as { status_code?: string };
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR") throw new Error("Instagram rejected the reel");
  }

  const publishRes = await fetch(`${GRAPH}/${input.igUserId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({
      creation_id: created.id,
      access_token: input.token,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const published = (await publishRes.json()) as {
    id?: string;
    error?: { message?: string };
  };
  if (!publishRes.ok || !published.id) {
    throw new Error(published.error?.message || `Instagram publish failed (${publishRes.status})`);
  }
  return published.id;
}

export async function verifyInstagramToken(input: {
  igUserId: string;
  token: string;
}): Promise<{ username: string }> {
  const res = await fetch(
    `${GRAPH}/${input.igUserId}?fields=username,name&access_token=${encodeURIComponent(input.token)}`,
    { signal: AbortSignal.timeout(15_000) },
  );
  const body = (await res.json()) as {
    username?: string;
    error?: { message?: string };
  };
  if (!res.ok || !body.username) {
    throw new Error(body.error?.message || "Could not verify the Instagram account");
  }
  return { username: body.username };
}
