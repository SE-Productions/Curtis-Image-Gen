import { createFileRoute } from "@tanstack/react-router";
import { getComposioStatus } from "@/lib/composio";

export const Route = createFileRoute("/api/composio/status")({
  server: {
    handlers: {
      GET: async () => {
        const status = await getComposioStatus();
        return Response.json({
          ok: status.ok,
          service: "composio",
          keyPresent: status.keyPresent,
          connected: status.ok && status.accountCount > 0,
          accountCount: status.accountCount,
          accounts: status.accounts.map((account) => ({
            id: account.id,
            status: account.status,
            toolkit: account.toolkit,
            username: account.username,
            disabled: account.disabled,
          })),
          error: status.error,
        });
      },
    },
  },
});
