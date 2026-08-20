import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  capabilities,
  persistMediaAsDataUrl,
  renderFaceLockedStill,
  renderFaceLockedVideo,
  writeCalendarPlan,
} from "@/lib/ai";
import { asDay, dateRange, todayInZone, zonedDateTime } from "@/lib/dates";
import { verifyInstagramToken } from "@/lib/instagram";
import { publishViaComposio } from "@/lib/composio";
import { loadVaultKeys } from "@/lib/vault";
import { setRuntimeXaiKey } from "@/lib/ai";
import type { PostFormat, PostStatus, StudioPost, StudioSettings } from "@/lib/types";

type PostRow = {
  id: string;
  plan_date: string;
  title: string;
  topic: string;
  concept: string;
  prompt: string;
  caption: string;
  format: string;
  status: string;
  aspect_ratio: string;
  director: string;
  media_url: string | null;
  media_data: string | null;
  has_media?: boolean | number | null;
  video_url: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  instagram_post_id: string | null;
  failure_reason: string | null;
  created_at: string;
};

function mapPost(row: PostRow): StudioPost {
  return {
    id: row.id,
    planDate: asDay(row.plan_date),
    title: row.title,
    topic: row.topic,
    concept: row.concept,
    prompt: row.prompt,
    caption: row.caption,
    format: row.format as PostFormat,
    status: row.status as PostStatus,
    aspectRatio: row.aspect_ratio,
    director: row.director,
    mediaUrl: row.media_url,
    hasMedia: Boolean(row.media_data || row.media_url || row.has_media),
    videoUrl: row.video_url,
    scheduledFor: row.scheduled_for,
    publishedAt: row.published_at,
    instagramPostId: row.instagram_post_id,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
  };
}

const defaultSettings: StudioSettings = {
  instagramUserId: "",
  instagramUsername: "",
  hasToken: false,
  hasNvidiaKey: false,
  hasXaiKey: false,
  hasComposioKey: false,
  composioAccountId: "",
  autoPublish: true,
  postHour: 10,
  postMinute: 0,
  timezone: "America/New_York",
  format: "feed",
  days: 7,
};

async function loadSettings(userId: string): Promise<StudioSettings> {
  const sql = await getSql();
  const rows = await sql<{
    instagram_user_id: string | null;
    instagram_token: string | null;
    instagram_username: string | null;
    nvidia_api_key: string | null;
    xai_api_key: string | null;
    composio_api_key: string | null;
    composio_account_id: string | null;
    auto_publish: boolean;
    post_hour: number;
    post_minute: number;
    timezone: string;
    format: string;
    days: number;
  }>`select instagram_user_id, instagram_token, instagram_username, nvidia_api_key, xai_api_key, composio_api_key, composio_account_id, auto_publish, post_hour, post_minute, timezone, format, days from studio_settings where user_id = ${userId}`;
  const row = rows[0];
  if (!row) return defaultSettings;
  return {
    instagramUserId: row.instagram_user_id ?? "",
    instagramUsername: row.instagram_username ?? "",
    hasToken: Boolean(row.instagram_token),
    hasNvidiaKey: Boolean(row.nvidia_api_key || process.env.NVIDIA_API_KEY),
    hasXaiKey: Boolean(row.xai_api_key || process.env.XAI_API_KEY),
    hasComposioKey: Boolean(row.composio_api_key || process.env.COMPOSIO_API_KEY),
    composioAccountId: row.composio_account_id ?? "",
    autoPublish: Boolean(row.auto_publish),
    postHour: Number(row.post_hour),
    postMinute: Number(row.post_minute),
    timezone: row.timezone || "America/New_York",
    format: (row.format as PostFormat) || "feed",
    days: Number(row.days) || 7,
  };
}

async function ensureSettings(userId: string) {
  const sql = await getSql();
  await sql`insert into studio_settings (user_id) values (${userId}) on conflict (user_id) do nothing`;
}

async function resolveNvidiaKey(userId: string): Promise<string | undefined> {
  if (process.env.NVIDIA_API_KEY) return process.env.NVIDIA_API_KEY;
  const sql = await getSql();
  const rows = await sql<{ nvidia_api_key: string | null }>`
    select nvidia_api_key from studio_settings where user_id = ${userId}`;
  return rows[0]?.nvidia_api_key || undefined;
}

export const getCapabilities = createServerFn({ method: "GET" }).handler(
  async () => capabilities(),
);

export const getStudioState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const settings = await loadSettings(context.userId);
    const vault = await loadVaultKeys(context.userId);
    setRuntimeXaiKey(vault.xai);
    const faces = await sql<{ id: string; created_at: string }>`
      select id, created_at from studio_faces
      where user_id = ${context.userId}
      order by created_at desc
      limit 1`;
    const posts = await sql<PostRow>`
      select id, plan_date, title, topic, concept, prompt, caption, format, status,
             aspect_ratio, director, media_url, (media_data is not null) as has_media, null as media_data, video_url,
             scheduled_for, published_at, instagram_post_id, failure_reason, created_at
      from studio_posts
      where user_id = ${context.userId}
      order by plan_date asc`;
    return {
      settings,
      face: faces[0] ? { id: faces[0].id, createdAt: faces[0].created_at } : null,
      posts: posts.map(mapPost),
      capabilities: capabilities(vault.nvidia || undefined, vault.xai || undefined),
    };
  });

export const saveFace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { dataUrl: string }) => {
    if (!input.dataUrl.startsWith("data:image/")) {
      throw new Error("Choose a JPEG or PNG face photo");
    }
    if (input.dataUrl.length > 8_000_000) {
      throw new Error("Face photo must be under 6 MB");
    }
    return input;
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from studio_faces where user_id = ${context.userId}`;
    const id = crypto.randomUUID();
    await sql`insert into studio_faces (id, user_id, data_url) values (${id}, ${context.userId}, ${data.dataUrl})`;
    return { id };
  });

export const clearFace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`delete from studio_faces where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const getFaceData = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ data_url: string }>`
      select data_url from studio_faces
      where user_id = ${context.userId}
      order by created_at desc limit 1`;
    return { dataUrl: rows[0]?.data_url ?? null };
  });

export const fillCalendar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { topic: string; days: number; format: PostFormat }) => {
    const topic = input.topic.trim();
    if (topic.length < 2) throw new Error("Add a topic");
    const days = Math.min(14, Math.max(3, Math.round(input.days) || 7));
    const format: PostFormat = ["feed", "story", "reel"].includes(input.format)
      ? input.format
      : "feed";
    return { topic, days, format };
  })
  .handler(async ({ context, data }) => {
    const nvidiaKey = await resolveNvidiaKey(context.userId);
    const vault = await loadVaultKeys(context.userId);
    setRuntimeXaiKey(vault.xai);
    if (capabilities(nvidiaKey, vault.xai).director === "none") {
      throw new Error("AI is not available in this environment");
    }
    const sql = await getSql();
    const face = await sql<{ id: string }>`
      select id from studio_faces where user_id = ${context.userId} limit 1`;
    if (!face[0]) throw new Error("Upload a face photo first");

    await ensureSettings(context.userId);
    const settings = await loadSettings(context.userId);
    const plan = await writeCalendarPlan({ ...data, nvidiaKey });
    const start = todayInZone(settings.timezone);
    const dates = dateRange(start, data.days);

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const item = plan.items[i];
      const scheduled = zonedDateTime(
        date,
        settings.postHour,
        settings.postMinute,
        settings.timezone,
      );
      const existing = await sql<{ id: string; status: string }>`
        select id, status from studio_posts
        where user_id = ${context.userId} and plan_date = ${date}`;
      if (existing[0] && ["published", "publishing"].includes(existing[0].status)) {
        continue;
      }
      const id = existing[0]?.id ?? crypto.randomUUID();
      if (existing[0]) {
        await sql`
          update studio_posts set
            title = ${item.title},
            topic = ${data.topic},
            concept = ${item.concept},
            prompt = ${item.prompt},
            caption = ${item.caption},
            format = ${item.format},
            status = 'idea',
            director = ${plan.director},
            media_url = null,
            media_data = null,
            video_url = null,
            scheduled_for = ${scheduled.toISOString()},
            failure_reason = null,
            updated_at = now()
          where id = ${id} and user_id = ${context.userId}`;
      } else {
        await sql`
          insert into studio_posts (
            id, user_id, plan_date, title, topic, concept, prompt, caption,
            format, status, aspect_ratio, director, scheduled_for
          ) values (
            ${id}, ${context.userId}, ${date}, ${item.title}, ${data.topic},
            ${item.concept}, ${item.prompt}, ${item.caption}, ${item.format},
            'idea', ${item.format === "feed" ? "3:4" : "9:16"}, ${plan.director},
            ${scheduled.toISOString()}
          )`;
      }
    }

    await sql`
      update studio_settings set format = ${data.format}, days = ${data.days}, updated_at = now()
      where user_id = ${context.userId}`;

    const posts = await sql<PostRow>`
      select id, plan_date, title, topic, concept, prompt, caption, format, status,
             aspect_ratio, director, media_url, (media_data is not null) as has_media, null as media_data, video_url,
             scheduled_for, published_at, instagram_post_id, failure_reason, created_at
      from studio_posts
      where user_id = ${context.userId}
      order by plan_date asc`;
    return { director: plan.director, posts: posts.map(mapPost) };
  });

export const renderPost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    setRuntimeXaiKey((await loadVaultKeys(context.userId)).xai);
    const sql = await getSql();
    const posts = await sql<PostRow>`
      select id, plan_date, title, topic, concept, prompt, caption, format, status,
             aspect_ratio, director, media_url, media_data, video_url,
             scheduled_for, published_at, instagram_post_id, failure_reason, created_at
      from studio_posts where id = ${data.id} and user_id = ${context.userId}`;
    const post = posts[0];
    if (!post) throw new Error("Post not found");
    if (["published", "publishing"].includes(post.status)) {
      throw new Error("Published posts cannot be re-rendered");
    }
    const faces = await sql<{ data_url: string }>`
      select data_url from studio_faces where user_id = ${context.userId} limit 1`;
    if (!faces[0]) throw new Error("Upload a face photo first");

    try {
      const rendered = await renderFaceLockedStill({
        prompt: post.prompt,
        format: post.format as PostFormat,
        referenceDataUrl: faces[0].data_url,
      });
      const stored = await persistMediaAsDataUrl(rendered.media);
      const remote = stored.startsWith("data:") ? post.media_url : stored;
      const dataUrl = stored.startsWith("data:") ? stored : null;

      await sql`
        update studio_posts set
          status = 'scheduled',
          aspect_ratio = ${rendered.aspectRatio},
          media_data = ${dataUrl},
          media_url = ${remote},
          failure_reason = null,
          updated_at = now()
        where id = ${post.id} and user_id = ${context.userId}`;

      return { id: post.id, hasMedia: true, status: "scheduled" as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Render failed";
      await sql`
        update studio_posts set status = 'failed', failure_reason = ${message}, updated_at = now()
        where id = ${post.id} and user_id = ${context.userId}`;
      throw error;
    }
  });

export const renderPostVideo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; publicOrigin: string }) => input)
  .handler(async ({ context, data }) => {
    setRuntimeXaiKey((await loadVaultKeys(context.userId)).xai);
    const sql = await getSql();
    const posts = await sql<PostRow>`
      select id, plan_date, title, topic, concept, prompt, caption, format, status,
             aspect_ratio, director, media_url, media_data, video_url,
             scheduled_for, published_at, instagram_post_id, failure_reason, created_at
      from studio_posts where id = ${data.id} and user_id = ${context.userId}`;
    const post = posts[0];
    if (!post) throw new Error("Post not found");
    if (!post.media_data && !post.media_url) {
      throw new Error("Render the still first");
    }
    const imageUrl = post.media_url?.startsWith("https://")
      ? post.media_url
      : `${data.publicOrigin.replace(/\/$/, "")}/api/media/${post.id}`;
    const videoUrl = await renderFaceLockedVideo({
      prompt: post.prompt,
      imageUrl,
    });
    await sql`
      update studio_posts set video_url = ${videoUrl}, format = 'reel', updated_at = now()
      where id = ${post.id} and user_id = ${context.userId}`;
    return { id: post.id, videoUrl };
  });

export const updatePostCaption = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; caption: string }) => ({
    id: input.id,
    caption: input.caption.trim().slice(0, 2200),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update studio_posts set caption = ${data.caption}, updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
        and status not in ('published', 'publishing')`;
    return { ok: true as const };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      delete from studio_posts
      where id = ${data.id} and user_id = ${context.userId}
        and status not in ('published', 'publishing')`;
    return { ok: true as const };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      instagramUserId?: string;
      instagramToken?: string;
      nvidiaApiKey?: string;
      xaiApiKey?: string;
      composioApiKey?: string;
      composioAccountId?: string;
      clearNvidia?: boolean;
      clearXai?: boolean;
      clearComposio?: boolean;
      clearInstagram?: boolean;
      autoPublish?: boolean;
      postHour?: number;
      postMinute?: number;
      timezone?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    await ensureSettings(context.userId);
    const sql = await getSql();
    const current = await sql<{
      instagram_user_id: string | null;
      instagram_token: string | null;
      instagram_username: string | null;
      nvidia_api_key: string | null;
      xai_api_key: string | null;
      composio_api_key: string | null;
      composio_account_id: string | null;
      auto_publish: boolean;
      post_hour: number;
      post_minute: number;
      timezone: string;
    }>`select instagram_user_id, instagram_token, instagram_username, nvidia_api_key, xai_api_key, composio_api_key, composio_account_id, auto_publish, post_hour, post_minute, timezone from studio_settings where user_id = ${context.userId}`;
    const row = current[0];
    let userId = data.instagramUserId?.trim() ?? row?.instagram_user_id ?? "";
    let token = data.instagramToken?.trim()
      ? data.instagramToken.trim()
      : (row?.instagram_token ?? "");
    let username = row?.instagram_username ?? "";
    if (data.clearInstagram) {
      userId = "";
      token = "";
      username = "";
    }
    const nvidiaKey = data.clearNvidia
      ? ""
      : data.nvidiaApiKey?.trim()
        ? data.nvidiaApiKey.trim()
        : (row?.nvidia_api_key ?? "");
    const xaiKey = data.clearXai
      ? ""
      : data.xaiApiKey?.trim()
        ? data.xaiApiKey.trim()
        : (row?.xai_api_key ?? "");
    const composioKey = data.clearComposio
      ? ""
      : data.composioApiKey?.trim()
        ? data.composioApiKey.trim()
        : (row?.composio_api_key ?? "");
    const composioAccountId = data.composioAccountId?.trim()
      ? data.composioAccountId.trim()
      : (row?.composio_account_id ?? "");

    if (userId && token && data.instagramToken?.trim()) {
      const verified = await verifyInstagramToken({ igUserId: userId, token });
      username = verified.username;
    }

    const hour = Math.min(23, Math.max(0, data.postHour ?? row?.post_hour ?? 10));
    const minute = Math.min(59, Math.max(0, data.postMinute ?? row?.post_minute ?? 0));
    const timezone = data.timezone?.trim() || row?.timezone || "America/New_York";
    const auto =
      data.autoPublish ??
      (row ? Boolean(row.auto_publish) : true);

    await sql`
      update studio_settings set
        instagram_user_id = ${userId || null},
        instagram_token = ${token || null},
        instagram_username = ${username || null},
        nvidia_api_key = ${nvidiaKey || null},
        xai_api_key = ${xaiKey || null},
        composio_api_key = ${composioKey || null},
        composio_account_id = ${composioAccountId || null},
        auto_publish = ${auto},
        post_hour = ${hour},
        post_minute = ${minute},
        timezone = ${timezone},
        updated_at = now()
      where user_id = ${context.userId}`;

    const today = todayInZone(timezone);
    const upcoming = await sql<{ id: string; plan_date: string }>`
      select id, plan_date from studio_posts
      where user_id = ${context.userId}
        and status in ('idea', 'generated', 'scheduled')
        and plan_date >= ${today}`;
    for (const post of upcoming) {
      const when = zonedDateTime(String(post.plan_date).slice(0, 10), hour, minute, timezone);
      await sql`update studio_posts set scheduled_for = ${when.toISOString()} where id = ${post.id}`;
    }

    return loadSettings(context.userId);
  });

export const disconnectInstagram = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`
      update studio_settings set
        instagram_user_id = null,
        instagram_token = null,
        instagram_username = null,
        updated_at = now()
      where user_id = ${context.userId}`;
    return loadSettings(context.userId);
  });

async function publicMediaUrl(post: PostRow, origin: string | null) {
  if (post.media_url?.startsWith("https://")) return post.media_url;
  if (origin?.startsWith("https://") && (post.media_data || post.media_url)) {
    return `${origin.replace(/\/$/, "")}/api/media/${post.id}`;
  }
  return null;
}

async function publishOne(
  userId: string,
  postId: string,
  origin: string | null,
) {
  const sql = await getSql();
  const posts = await sql<PostRow>`
    select id, plan_date, title, topic, concept, prompt, caption, format, status,
           aspect_ratio, director, media_url, media_data, video_url,
           scheduled_for, published_at, instagram_post_id, failure_reason, created_at
    from studio_posts where id = ${postId} and user_id = ${userId}`;
  const post = posts[0];
  if (!post) throw new Error("Post not found");
  if (post.status === "published") return mapPost(post);

  const settingsRows = await sql<{
    composio_account_id: string | null;
    timezone: string;
  }>`select composio_account_id, timezone from studio_settings where user_id = ${userId}`;
  const settings = settingsRows[0];
  let connectedAccountId = settings?.composio_account_id?.trim() || "";
  if (!connectedAccountId) {
    throw new Error("Connect Instagram through Composio in Settings before publishing");
  }

  const today = todayInZone(settings.timezone || "America/New_York");
  const already = await sql<{ id: string }>`
    select id from studio_posts
    where user_id = ${userId} and status = 'published'
      and (published_at::date = ${today} or plan_date = ${today})
      and id <> ${post.id}`;
  if (already[0]) {
    throw new Error("Already posted once today");
  }

  if (!post.media_data && !post.media_url) {
    throw new Error("Render the still before publishing");
  }

  await sql`update studio_posts set status = 'publishing', updated_at = now() where id = ${post.id}`;

  try {
    let videoUrl = post.video_url;
    if (post.format === "reel" && !videoUrl) {
      const imageUrl = await publicMediaUrl(post, origin);
      if (!imageUrl) throw new Error("Need a public HTTPS URL to render video");
      videoUrl = await renderFaceLockedVideo({ prompt: post.prompt, imageUrl });
      await sql`update studio_posts set video_url = ${videoUrl} where id = ${post.id}`;
    }
    const imageUrl = await publicMediaUrl(post, origin);
    const igId = await publishViaComposio({
      connectedAccountId,
      imageUrl,
      videoUrl,
      caption: post.caption,
      format: post.format,
    });
    await sql`
      update studio_posts set
        status = 'published',
        published_at = now(),
        instagram_post_id = ${igId},
        failure_reason = null,
        updated_at = now()
      where id = ${post.id}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    await sql`
      update studio_posts set status = 'failed', failure_reason = ${message}, updated_at = now()
      where id = ${post.id}`;
    throw error;
  }

  const fresh = await sql<PostRow>`
    select id, plan_date, title, topic, concept, prompt, caption, format, status,
           aspect_ratio, director, media_url, (media_data is not null) as has_media, null as media_data, video_url,
           scheduled_for, published_at, instagram_post_id, failure_reason, created_at
    from studio_posts where id = ${post.id}`;
  return mapPost(fresh[0]);
}

export const publishNow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; publicOrigin: string }) => input)
  .handler(async ({ context, data }) => {
    return publishOne(context.userId, data.id, data.publicOrigin);
  });

export const runDuePublishes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { publicOrigin: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const settings = await loadSettings(context.userId);
    if (!settings.autoPublish || !settings.composioAccountId) {
      return { published: 0 };
    }
    const today = todayInZone(settings.timezone);
    const already = await sql<{ id: string }>`
      select id from studio_posts
      where user_id = ${context.userId} and status = 'published'
        and (published_at::date = ${today} or plan_date = ${today})`;
    if (already[0]) return { published: 0 };

    const due = await sql<{ id: string }>`
      select id from studio_posts
      where user_id = ${context.userId}
        and status = 'scheduled'
        and scheduled_for <= now()
        and plan_date <= ${today}
      order by scheduled_for asc
      limit 1`;
    if (!due[0]) return { published: 0 };
    await publishOne(context.userId, due[0].id, data.publicOrigin);
    return { published: 1 };
  });

export const cronPublishAll = createServerFn({ method: "POST" }).handler(
  async () => {
    const sql = await getSql();
    const users = await sql<{ user_id: string; timezone: string; auto_publish: boolean; instagram_token: string | null }>`
      select user_id, timezone, auto_publish, instagram_token from studio_settings
      where auto_publish = true and instagram_token is not null`;
    let published = 0;
    for (const user of users) {
      const today = todayInZone(user.timezone || "America/New_York");
      const already = await sql<{ id: string }>`
        select id from studio_posts
        where user_id = ${user.user_id} and status = 'published'
          and (published_at::date = ${today} or plan_date = ${today})`;
      if (already[0]) continue;
      const due = await sql<{ id: string }>`
        select id from studio_posts
        where user_id = ${user.user_id}
          and status = 'scheduled'
          and scheduled_for <= now()
          and plan_date <= ${today}
        order by scheduled_for asc
        limit 1`;
      if (!due[0]) continue;
      try {
        await publishOne(user.user_id, due[0].id, process.env.BETTER_AUTH_URL ?? null);
        published += 1;
      } catch (error) {
        console.warn("cron publish failed", error);
      }
    }
    return { published };
  },
);

export const getMedia = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{ media_data: string | null; media_url: string | null }>`
      select media_data, media_url from studio_posts where id = ${data.id}`;
    return rows[0] ?? null;
  });
