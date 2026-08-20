import { createFileRoute } from "@tanstack/react-router";
import { deleteComposioAccount, getComposioStatus, removeBusinessInstagramAccount } from "@/lib/composio";

export const Route = createFileRoute("/api/composio/accounts")({
  server: {
    handlers: {
      DELETE: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id")?.trim() ?? "";
        const business = url.searchParams.get("business") === "1";
        if (business && !id) {
          const result = await removeBusinessInstagramAccount();
          return Response.json(result, { status: result.ok ? 200 : 409 });
        }
        if (!id) {
          return Response.json({ ok: false, error: "Missing account id" }, { status: 400 });
        }
        const deleted = await deleteComposioAccount(id);
        const after = await getComposioStatus();
        return Response.json(
          { ...deleted, remaining: after.accounts },
          { status: deleted.ok ? 200 : 400 },
        );
      },
    },
  },
});
