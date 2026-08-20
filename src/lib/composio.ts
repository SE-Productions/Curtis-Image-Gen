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

function apiKey(): string {
  return process.env.COMPOSIO_API_KEY?.trim() ?? "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

async function composioFetch(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const key = apiKey();
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
  if (!apiKey()) {
    return {
      keyPresent: false,
      ok: false,
      error: "COMPOSIO_API_KEY is not set",
      accountCount: 0,
      accounts: [],
    };
  }

  const attempts = [
    "/api/v3.1/connected_accounts?toolkit_slugs=instagram&limit=50",
    "/api/v3/connected_accounts?toolkit_slugs=instagram&limit=50",
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
    const mapped = list.map(mapAccount).filter((a): a is ComposioAccount => Boolean(a)).filter(isInstagram);
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
  if (!apiKey()) return { ok: false, error: "COMPOSIO_API_KEY is not set" };
  if (!id.startsWith("ca_")) return { ok: false, error: "Invalid account id" };
  const attempts = [
    `/api/v3.1/connected_accounts/${id}`,
    `/api/v3/connected_accounts/${id}`,
  ];
  for (const path of attempts) {
    const { status, body } = await composioFetch(path, { method: "DELETE" });
    if (status === 200 || status === 204 || status === 404) {
      return { ok: true, error: null };
    }
    if (status === 401 || status === 403) {
      return { ok: false, error: "Composio rejected the API key" };
    }
    const rec = asRecord(body);
    const error =
      (typeof rec.error === "string" && rec.error) ||
      (typeof rec.message === "string" && rec.message) ||
      `Composio ${status}`;
    if (status >= 200 && status < 300) return { ok: true, error: null };
    if (status !== 404) {
      last: {
        return { ok: false, error };
      }
    }
  }
  return { ok: false, error: "Could not delete Composio account" };
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
