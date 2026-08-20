import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/healthz")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, service: "curtis-image-studio" }),
    },
  },
});
