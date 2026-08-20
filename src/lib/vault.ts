import { getSql } from "@/lib/db";

export const STUDIO_OWNER_ID =
  process.env.STUDIO_USER_ID?.trim() || "tTGXM74ypX1QqgNwARk8xXvancm5hove";

export type VaultKeys = {
  nvidia: string;
  xai: string;
  composio: string;
  composioAccountId: string;
};

export async function loadVaultKeys(userId = STUDIO_OWNER_ID): Promise<VaultKeys> {
  const sql = await getSql();
  try {
    const rows = await sql<{
      nvidia_api_key: string | null;
      xai_api_key: string | null;
      composio_api_key: string | null;
      composio_account_id: string | null;
    }>`
      select nvidia_api_key, xai_api_key, composio_api_key, composio_account_id
      from studio_settings
      where user_id = ${userId}`;
    const row = rows[0];
    return {
      nvidia: (row?.nvidia_api_key || process.env.NVIDIA_API_KEY || "").trim(),
      xai: (row?.xai_api_key || process.env.XAI_API_KEY || "").trim(),
      composio: (row?.composio_api_key || process.env.COMPOSIO_API_KEY || "").trim(),
      composioAccountId: (row?.composio_account_id || "").trim(),
    };
  } catch {
    return {
      nvidia: (process.env.NVIDIA_API_KEY || "").trim(),
      xai: (process.env.XAI_API_KEY || "").trim(),
      composio: (process.env.COMPOSIO_API_KEY || "").trim(),
      composioAccountId: "",
    };
  }
}
