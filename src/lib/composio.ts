const COMPOSIO_BASE = "https://backend.composio.dev";

export type ComposioAccount = {
  id: string;
  status: string;
  toolkit: string;
  userId: string | null;
  username: string | null;
  name: string | null;
  accountType: string | null;
  disabled: boolean;
};

export type ComposioStatus = {
  keyPresent: boolean;
  ok: boolean;
  error: string | null;
  accountCount: number;
  accounts: ComposioAccount[];
};

async function apiKey(): Promise<string> {
  try {
    const { loadVaultKeys } = await import("@/lib/vault");
    const vault = await loadVaultKeys();
    return vault.composio;
  } catch {
    return process.env.COMPOSIO_API_KEY?.trim() ?? "";
  }
}

function composioUserIds(): string[] {
  const primary = process.env.COMPOSIO_USER_ID?.trim() || "nova-luis";
  return [...new Set([primary, "nova-luis", "curtis-image-studio", "default"])];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

async function composioFetch(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const key = await apiKey();
  if (!key) return { status: 0, body: { error: "COMPOSIO_API_KEY is not set" } };
  const headers = new Headers(init.headers);
  headers.set("x-api-key", key);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${COMPOSIO_BASE}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(25_000),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = { error: `Composio returned ${res.status}` };
  }
  return { status: res.status, body };
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickUsername(item: Record<string, unknown>): string | null {
  return (
    pickString(asRecord(item.data), ["username", "ig_username", "name", "user_name", "handle"]) ||
    pickString(asRecord(asRecord(item.state).val), ["username", "user_name", "name"])
  );
}

function mapAccount(raw: unknown): ComposioAccount | null {
  const item = asRecord(raw);
  const id = typeof item.id === "string" ? item.id : typeof item.nanoid === "string" ? item.nanoid : "";
  if (!id) return null;
  const toolkitObj = asRecord(item.toolkit);
  const toolkit =
    (typeof toolkitObj.slug === "string" && toolkitObj.slug) ||
    (typeof item.toolkit === "string" && item.toolkit) ||
    "";
  return {
    id,
    status: typeof item.status === "string" ? item.status : "UNKNOWN",
    toolkit,
    userId: typeof item.user_id === "string" ? item.user_id : null,
    username: pickUsername(item),
    name: pickString(asRecord(item.data), ["name", "full_name"]),
    accountType: pickString(asRecord(item.data), ["account_type", "accountType", "type"]),
    disabled: Boolean(item.is_disabled),
  };
}

function isInstagram(account: ComposioAccount): boolean {
  return account.toolkit.toLowerCase().includes("instagram");
}

function unwrapData(body: unknown): Record<string, unknown> {
  const rec = asRecord(body);
  const data = asRecord(rec.data);
  const nested = asRecord(data.data);
  return Object.keys(nested).length ? { ...data, ...nested } : Object.keys(data).length ? data : rec;
}

async function inspectAccount(account: ComposioAccount): Promise<ComposioAccount> {
  if (account.status !== "ACTIVE") return account;
  const payload = {
    connected_account_id: account.id,
    user_id: account.userId || "default",
    arguments: {},
  };
  const attempts = [
    "/api/v3/tools/execute/INSTAGRAM_GET_USER_INFO",
    "/api/v3.1/tools/execute/INSTAGRAM_GET_USER_INFO",
    "/api/v2/actions/INSTAGRAM_GET_USER_INFO/execute",
  ];
  for (const path of attempts) {
    const { status, body } = await composioFetch(path, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (status < 200 || status >= 300) continue;
    const info = unwrapData(body);
    const username = pickString(info, ["username", "ig_username", "user_name", "handle"]);
    const name = pickString(info, ["name", "full_name", "name"]);
    const accountType = pickString(info, ["account_type", "accountType", "type"]);
    return {
      ...account,
      username: username ?? account.username,
      name: name ?? account.name,
      accountType: accountType ?? account.accountType,
    };
  }

  const { status, body } = await composioFetch(`/api/v3.1/connected_accounts/${account.id}`);
  if (status >= 200 && status < 300) {
    const detailed = mapAccount(body);
    if (detailed) {
      return {
        ...account,
        username: detailed.username ?? account.username,
        name: detailed.name ?? account.name,
        accountType: detailed.accountType ?? account.accountType,
        userId: detailed.userId ?? account.userId,
      };
    }
  }
  return account;
}

export async function getComposioStatus(): Promise<ComposioStatus> {
  if (!(await apiKey())) {
    return {
      keyPresent: false,
      ok: false,
      error: "COMPOSIO_API_KEY is not set",
      accountCount: 0,
      accounts: [],
    };
  }

  const users = composioUserIds().map((id) => encodeURIComponent(id)).join(",");
  const attempts = [
    `/api/v3.1/connected_accounts?toolkit_slugs=instagram&user_ids=${users}&limit=50`,
    `/api/v3.1/connected_accounts?user_ids=${users}&limit=50`,
    "/api/v3.1/connected_accounts?toolkit_slugs=instagram&limit=50",
    "/api/v3.1/connected_accounts?limit=50",
    "/api/v3/connected_accounts?toolkit_slugs=instagram&limit=50",
    "/api/v3/connected_accounts?limit=50",
  ];

  let lastError = "Could not reach Composio";
  for (const path of attempts) {
    const { status, body } = await composioFetch(path);
    if (status === 401 || status === 403) {
      return {
        keyPresent: true,
        ok: false,
        error: "Composio rejected the API key",
        accountCount: 0,
        accounts: [],
      };
    }
    if (status < 200 || status >= 300) {
      const rec = asRecord(body);
      lastError =
        (typeof rec.error === "string" && rec.error) ||
        (typeof rec.message === "string" && rec.message) ||
        `Composio ${status}`;
      continue;
    }
    const rec = asRecord(body);
    const list = Array.isArray(rec.items)
      ? rec.items
      : Array.isArray(rec.connected_accounts)
        ? rec.connected_accounts
        : [];
    const mapped = list
      .map(mapAccount)
      .filter((a): a is ComposioAccount => Boolean(a))
      .filter((account) => !account.toolkit || isInstagram(account));
    if (!mapped.length && path.includes("toolkit_slugs")) {
      continue;
    }
    const accounts = [];
    for (const account of mapped) {
      accounts.push(await inspectAccount(account));
    }
    return {
      keyPresent: true,
      ok: true,
      error: null,
      accountCount: accounts.length,
      accounts,
    };
  }

  return {
    keyPresent: true,
    ok: false,
    error: lastError,
    accountCount: 0,
    accounts: [],
  };
}

export function isBusinessAccount(account: ComposioAccount): boolean {
  const type = `${account.accountType ?? ""} ${account.name ?? ""} ${account.username ?? ""}`.toLowerCase();
  return (
    type.includes("business") ||
    type.includes("creator") ||
    account.accountType === "BUSINESS" ||
    account.accountType === "MEDIA_CREATOR"
  );
}

export async function deleteComposioAccount(id: string): Promise<{ ok: boolean; error: string | null }> {
  if (!(await apiKey())) return { ok: false, error: "COMPOSIO_API_KEY is not set" };
  if (!id.startsWith("ca_")) return { ok: false, error: "Invalid account id" };
  await composioFetch(`/api/v3.1/connected_accounts/${id}/revoke`, { method: "POST" });
  await composioFetch(`/api/v3/connected_accounts/${id}/revoke`, { method: "POST" });
  const attempts = [
    `/api/v3.1/connected_accounts/${id}`,
    `/api/v3/connected_accounts/${id}`,
  ];
  let lastError = "Could not delete Composio account";
  for (const path of attempts) {
    const { status, body } = await composioFetch(path, { method: "DELETE" });
    if (status === 200 || status === 204 || status === 404) {
      return { ok: true, error: null };
    }
    if (status === 401 || status === 403) {
      return { ok: false, error: "Composio rejected the API key" };
    }
    const rec = asRecord(body);
    lastError =
      (typeof rec.error === "string" && rec.error) ||
      (typeof rec.message === "string" && rec.message) ||
      `Composio ${status}`;
    if (status >= 200 && status < 300) return { ok: true, error: null };
  }
  return { ok: false, error: lastError };
}

export async function removeBusinessInstagramAccount(): Promise<{
  ok: boolean;
  removed: ComposioAccount | null;
  remaining: ComposioAccount[];
  error: string | null;
}> {
  const status = await getComposioStatus();
  if (!status.ok) {
    return { ok: false, removed: null, remaining: status.accounts, error: status.error };
  }
  const active = status.accounts.filter((account) => account.status === "ACTIVE" && !account.disabled);
  const business =
    active.find(isBusinessAccount) ??
    (active.length === 2 ? null : active.find(isBusinessAccount));
  if (!business) {
    return {
      ok: false,
      removed: null,
      remaining: status.accounts,
      error: "Could not tell which ACTIVE account is the business page",
    };
  }
  const deleted = await deleteComposioAccount(business.id);
  if (!deleted.ok) {
    return { ok: false, removed: business, remaining: status.accounts, error: deleted.error };
  }
  const after = await getComposioStatus();
  return {
    ok: true,
    removed: business,
    remaining: after.accounts,
    error: null,
  };
}


export async function listInstagramAuthConfigs(): Promise<Array<{ id: string; name: string }>> {
  const { status, body } = await composioFetch("/api/v3.1/auth_configs?toolkit_slug=instagram&limit=50");
  const rec = status >= 200 && status < 300 ? asRecord(body) : asRecord((await composioFetch("/api/v3/auth_configs?toolkit_slug=instagram&limit=50")).body);
  const items = Array.isArray(rec.items) ? rec.items : [];
  return items
    .map((item) => {
      const row = asRecord(item);
      return { id: String(row.id ?? ""), name: String(row.name ?? row.id ?? "") };
    })
    .filter((item) => item.id);
}

export async function createInstagramConnectLink(): Promise<{
  ok: boolean;
  url: string | null;
  error: string | null;
}> {
  const configs = await listInstagramAuthConfigs();
  const authConfigId = configs[0]?.id;
  if (!authConfigId) {
    return { ok: false, url: null, error: "No Instagram auth config on this Composio project" };
  }
  const payload = {
    auth_config_id: authConfigId,
    user_id: process.env.COMPOSIO_USER_ID?.trim() || "nova-luis",
    alias: "se-se",
    callback_url: "https://curtis-image-studio-6eadq.ondigitalocean.app/settings",
  };
  for (const path of ["/api/v3.1/connected_accounts/link", "/api/v3/connected_accounts/link"]) {
    const { status, body } = await composioFetch(path, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const rec = asRecord(body);
    const url =
      (typeof rec.redirect_url === "string" && rec.redirect_url) ||
      (typeof rec.redirectUrl === "string" && rec.redirectUrl) ||
      null;
    if (status >= 200 && status < 300 && url) {
      return { ok: true, url, error: null };
    }
  }
  return { ok: false, url: null, error: "Could not create Composio Instagram connect link" };
}

export async function executeComposioTool(
  slug: string,
  connectedAccountId: string,
  args: Record<string, unknown>,
  userId = "curtis-image-studio",
): Promise<Record<string, unknown>> {
  const payload = {
    connected_account_id: connectedAccountId,
    user_id: userId,
    arguments: args,
  };
  const attempts = [
    `/api/v3/tools/execute/${slug}`,
    `/api/v3.1/tools/execute/${slug}`,
  ];
  let lastError = `Could not execute ${slug}`;
  for (const path of attempts) {
    const { status, body } = await composioFetch(path, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const rec = asRecord(body);
    if (status >= 200 && status < 300) {
      return unwrapData(body);
    }
    lastError =
      (typeof rec.error === "string" && rec.error) ||
      (typeof rec.message === "string" && rec.message) ||
      lastError;
  }
  throw new Error(lastError);
}

function pickId(data: Record<string, unknown>): string | null {
  return pickString(data, ["id", "creation_id", "ig_id", "user_id", "instagram_id", "media_id"]);
}

export async function publishViaComposio(input: {
  connectedAccountId: string;
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

  const profile = await executeComposioTool("INSTAGRAM_GET_USER_INFO", input.connectedAccountId, {});
  const igUserId = pickId(profile);
  if (!igUserId) throw new Error("Composio Instagram account has no user id");

  const containerArgs: Record<string, unknown> = {
    ig_user_id: igUserId,
    caption: input.caption.slice(0, 2200),
  };
  if (isReel) {
    containerArgs.video_url = mediaUrl;
    containerArgs.media_type = "REELS";
  } else {
    containerArgs.image_url = mediaUrl;
  }

  let container: Record<string, unknown>;
  try {
    container = await executeComposioTool(
      "INSTAGRAM_POST_IG_USER_MEDIA",
      input.connectedAccountId,
      containerArgs,
    );
  } catch {
    container = await executeComposioTool(
      "INSTAGRAM_CREATE_MEDIA_CONTAINER",
      input.connectedAccountId,
      containerArgs,
    );
  }
  const creationId = pickId(container);
  if (!creationId) throw new Error("Composio did not return a media container id");

  let published: Record<string, unknown>;
  try {
    published = await executeComposioTool(
      "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
      input.connectedAccountId,
      { ig_user_id: igUserId, creation_id: creationId },
    );
  } catch {
    published = await executeComposioTool(
      "INSTAGRAM_CREATE_POST",
      input.connectedAccountId,
      { ig_user_id: igUserId, creation_id: creationId },
    );
  }
  return pickId(published) || creationId;
}
