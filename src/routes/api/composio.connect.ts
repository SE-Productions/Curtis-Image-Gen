import { createFileRoute } from "@tanstack/react-router";
import { createInstagramConnectLink } from "@/lib/composio";

export const Route = createFileRoute("/api/composio/connect")({
  server: {
    handlers: {
      POST: async () => {
        const result = await createInstagramConnectLink();
        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
    },
  },
});
