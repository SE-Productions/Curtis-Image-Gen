import { createFileRoute } from "@tanstack/react-router";
import { cronPublishAll } from "@/lib/functions";

export const Route = createFileRoute("/api/cron/publish")({
  server: {
    handlers: {
      GET: async () => {
        const result = await cronPublishAll();
        return Response.json(result);
      },
      POST: async () => {
        const result = await cronPublishAll();
        return Response.json(result);
      },
    },
  },
});
