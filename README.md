# Curtis Image Studio

Face-locked Instagram studio. Upload one identity photo, add a topic, let NVIDIA write ultra-realistic scene prompts, fill a calendar, and auto-post **1× per day**.

Workflow:

1. **Add a picture** — identity lock. Every still and reel keeps that face.
2. **Add a topic** — plus days and format (feed / story / reel).
3. **NVIDIA director** writes cinematic descriptions with true face fidelity (Grok fallback if no NVIDIA key).
4. **Fill the calendar** — one planned post per day.
5. **Instagram** publishes the due post once daily via Graph API.

## Stack

- TanStack Start + React 19 + Tailwind v4
- Better Auth (Google / X)
- PGLite locally, Postgres (`DATABASE_URL`) in production
- NVIDIA NIM (`meta/llama-3.1-70b-instruct`) for prompt direction
- xAI Imagine for face-locked stills and reel video
- Instagram Graph API v21.0 (`media` container → `media_publish`)

## Local

```bash
cp .env.example .env
npm install
npm run dev
```

App listens on `0.0.0.0:8080`.

| Env | Purpose |
| --- | --- |
| `NVIDIA_API_KEY` | Director for ultra-realistic prompts (also settable in Settings) |
| `XAI_API_KEY` | Face-locked image + video generation |
| `DATABASE_URL` | Postgres URL; omit for embedded PGLite |
| `BETTER_AUTH_URL` | Public HTTPS origin (required for Instagram media URLs) |

## Instagram daily drop

Settings → Instagram Graph API:

- Instagram professional account user id
- Long-lived Graph token
- Daily drop time

Cron hits `GET` or `POST` `/api/cron/publish`. The calendar also publishes the due post when you open the app. Constraint: **one post per user per date**.

Instagram needs a **public HTTPS** media URL, so deploy with a real origin in `BETTER_AUTH_URL`.

## Deploy

DigitalOcean App Platform: [`do-app.yaml`](do-app.yaml)

```bash
npm ci && npm run build
npx vite preview --host 0.0.0.0 --port 8080
```

Render: [`render.yaml`](render.yaml)

## Scripts

```bash
npm run typecheck
npm run build
npm run start
```

## License

MIT
