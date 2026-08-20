import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/media/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const sql = await getSql();
        const rows = await sql<{
          media_data: string | null;
          media_url: string | null;
        }>`select media_data, media_url from studio_posts where id = ${params.id}`;
        const row = rows[0];
        if (!row) return new Response("Not found", { status: 404 });

        if (row.media_data?.startsWith("data:")) {
          const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(
            row.media_data,
          );
          if (!match) return new Response("Invalid media", { status: 415 });
          const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
          return new Response(bytes, {
            headers: {
              "Content-Type": match[1],
              "Cache-Control": "public, max-age=86400",
            },
          });
        }

        if (row.media_url) {
          return Response.redirect(row.media_url, 302);
        }
        return new Response("Not found", { status: 404 });
      },
    },
  },
});
