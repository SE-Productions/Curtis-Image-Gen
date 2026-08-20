import { createFileRoute } from "@tanstack/react-router";
import { executeComposioTool } from "@/lib/composio";
import { getSql } from "@/lib/db";
import { requireUserId } from "@/lib/auth/verify.server";

export const Route = createFileRoute("/api/composio/debug")({
  server: {
    handlers: {
      GET: async () => {
        const sql = await getSql();
        const userId = await requireUserId();
        const rows = await sql`select composio_account_id from studio_settings where user_id = ${userId}`;
        const accountId = rows[0]?.composio_account_id || "NOT SET";

        const results: Record<string, unknown> = {};
        const testUserIds = ["nova-luis", "curtis-image-studio", "default", userId];
        for (const uid of testUserIds) {
          try {
            const r = await executeComposioTool("INSTAGRAM_GET_USER_INFO", accountId, {}, uid);
            results[uid] = { ok: true, username: (r as Record<string,unknown>).username };
          } catch (err) {
            results[uid] = { ok: false, error: err instanceof Error ? err.message : String(err) };
          }
        }

        return Response.json({
          userId,
          studioComposioAccountId: accountId,
          tests: results,
        }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
