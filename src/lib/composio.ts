const COMPOSIO_BASE = "https://backend.composio.dev";

export type ComposioAccount = {
  id: string;
  status: string;
  toolkit: string;
  userId: string | null;
  username: string | null;
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

async function composioGet(path: string): Promise<{ status: number; body: unknown }> {
  const key = apiKey();
  if (!key) return { status: 0, body: { error: "COMPOSIO_API_KEY is not set" } };
  const res = await fetch(`${COMPOSIO_BASE}${path}`, {
    headers: { "x-api-key": key, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = { error: `Composio returned ${res.status}` };
  }
  return { status: res.status, body };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pickUsername(item: Record<string, unknown>): string | null {
  const data = asRecord(item.data);
  for (const key of ["username", "ig_username", "name", "user_name", "handle"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const state = asRecord(item.state);
  const val = asRecord(state.val);
  for (const key of ["username", "user_name", "name"]) {
    const value = val[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
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
    disabled: Boolean(item.is_disabled),
  };
}

function isInstagram(account: ComposioAccount): boolean {
  return account.toolkit.toLowerCase().includes("instagram");
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
    "/api/v3/connectedAccounts?toolkitSlugs=instagram",
  ];

  let lastError = "Could not reach Composio";
  for (const path of attempts) {
    const { status, body } = await composioGet(path);
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
        : Array.isArray(rec.data)
          ? rec.data
          : [];
    const accounts = list.map(mapAccount).filter((a): a is ComposioAccount => Boolean(a)).filter(isInstagram);
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
