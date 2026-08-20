#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * Runs during `npm run build` — on every Vercel deploy — applying pending files
 * in ../migrations to DATABASE_URL. Each file is applied in one transaction and
 * recorded in a `_migrations` table, so it runs once and is safe to re-run.
 *
 * No DATABASE_URL (local / preview builds) -> skip; the PGLite fallback applies
 * the same files at startup instead (see src/lib/db.ts).
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;

function databaseConnectionString(value) {
  if (/localhost|127\.0\.0\.1/.test(value)) return value;
  const parsed = new URL(value);
  parsed.searchParams.set("sslmode", "no-verify");
  return parsed.toString();
}
if (!databaseUrl) {
  console.log(
    "[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).",
  );
  process.exit(0);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

function sslFor(url) {
  if (/localhost|127\.0\.0\.1/.test(url)) return undefined;
  return { rejectUnauthorized: false };
}

async function main() {
  const pool = new pg.Pool({
    connectionString: databaseConnectionString(databaseUrl),
    max: 1,
    ssl: sslFor(databaseUrl),
  });
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const applied = new Set(
      (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name),
    );

    let files;
    try {
      files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
    } catch {
      console.log("[migrate] no migrations/ directory — nothing to do.");
      return;
    }

    let count = 0;
    for (const name of files) {
      if (applied.has(name)) continue;
      const text = await readFile(join(migrationsDir, name), "utf8");
      try {
        await client.query("BEGIN");
        // pg's simple-query protocol runs a whole multi-statement file at once.
        await client.query(text);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (err) {
        console.error(`[migrate] error applying ${name}`);
        try {
          await client.query("ROLLBACK");
        } catch {
          // ROLLBACK fails when the connection died — keep the original error.
        }
        throw err;
      }
      console.log(`[migrate] applied ${name}`);
      count += 1;
    }
    console.log(count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.");

    const studioUser = process.env.STUDIO_USER_ID?.trim() || "tTGXM74ypX1QqgNwARk8xXvancm5hove";
    await client.query(`update studio_posts set user_id = $1 where user_id <> $1`, [studioUser]);
    await client.query(`update studio_faces set user_id = $1 where user_id <> $1`, [studioUser]);
    await client.query(`update studio_settings set user_id = $1 where user_id <> $1`, [studioUser]);
    console.log("[migrate] remapped studio rows to the single operator id");

    const parsed = new URL(databaseUrl);
    const currentDb = decodeURIComponent(parsed.pathname.replace(/^\//, "")).split("?")[0];
    if (currentDb === "novaluis") {
      const sourceUrl = new URL(databaseUrl);
      sourceUrl.pathname = "/defaultdb";
      const source = new pg.Client({
        connectionString: databaseConnectionString(sourceUrl.toString()),
        ssl: sslFor(sourceUrl.toString()),
      });
      try {
        await source.connect();
        const [{ rows: destCount }] = await Promise.all([
          client.query("select count(*)::int as n from studio_posts"),
        ]);
        if ((destCount[0]?.n ?? 0) === 0) {
          const posts = await source.query("select * from studio_posts");
          const faces = await source.query("select * from studio_faces");
          const settings = await source.query("select * from studio_settings");
          for (const row of faces.rows) {
            await client.query(
              `insert into studio_faces (id, user_id, data_url, created_at)
               values ($1,$2,$3,$4) on conflict (id) do nothing`,
              [row.id, studioUser, row.data_url, row.created_at],
            );
          }
          for (const row of posts.rows) {
            await client.query(
              `insert into studio_posts (
                 id, user_id, plan_date, title, topic, concept, prompt, caption,
                 format, status, aspect_ratio, director, media_url, media_data, video_url,
                 scheduled_for, published_at, instagram_post_id, failure_reason, created_at, updated_at
               ) values (
                 $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,now()
               ) on conflict (id) do nothing`,
              [
                row.id,
                studioUser,
                row.plan_date,
                row.title,
                row.topic,
                row.concept,
                row.prompt,
                row.caption,
                row.format,
                row.status,
                row.aspect_ratio,
                row.director,
                row.media_url,
                row.media_data,
                row.video_url,
                row.scheduled_for,
                row.published_at,
                row.instagram_post_id,
                row.failure_reason,
                row.created_at,
              ],
            );
          }
          for (const row of settings.rows) {
            await client.query(
              `insert into studio_settings (user_id) values ($1) on conflict (user_id) do nothing`,
              [studioUser],
            );
          }
          console.log(
            `[migrate] copied ${posts.rows.length} posts and ${faces.rows.length} faces from defaultdb`,
          );
        }
      } catch (err) {
        console.error("[migrate] defaultdb copy skipped:", err?.message || err);
      } finally {
        try {
          await source.end();
        } catch {
          /* ignore */
        }
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err?.message || err);
  // pg errors carry the context needed to debug a bad SQL file.
  for (const key of ["code", "detail", "hint", "position", "where"]) {
    if (err?.[key] != null) console.error(`[migrate]   ${key}: ${err[key]}`);
  }
  process.exit(1);
});
