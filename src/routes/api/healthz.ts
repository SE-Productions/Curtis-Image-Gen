import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/healthz")({
  server: {
    handlers: {
      GET: async () => {
        let database = null;
        let posts = 0;
        let faces = 0;
        try {
          const sql = await getSql();
          const db = await sql<{ current_database: string }>`select current_database()`;
          const postRows = await sql<{ n: number }>`select count(*)::int as n from studio_posts`;
          const faceRows = await sql<{ n: number }>`select count(*)::int as n from studio_faces`;
          database = db[0]?.current_database ?? null;
          posts = postRows[0]?.n ?? 0;
          faces = faceRows[0]?.n ?? 0;
        } catch (error) {
          return Response.json({
            ok: false,
            service: "curtis-image-studio",
            database,
            error: error instanceof Error ? error.message : "db",
          });
        }
        return Response.json({
          ok: true,
          service: "curtis-image-studio",
          database,
          posts,
          faces,
        });
      },
    },
  },
});
