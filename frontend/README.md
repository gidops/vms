# VMS Frontend

The Next.js frontend for the [AATC Visitor Management System](../README.md).
Built with TypeScript, the App Router, and Tailwind CSS, it talks to the NestJS
backend over HTTP.

> **npm only.** Use npm for every command — not yarn, pnpm, or bun.

## Prerequisites

- Node `20.11.0` (run `nvm use` from the repo root to pick it up from `.nvmrc`)
- The backend running and reachable (see [`../backend/README.md`](../backend/README.md)),
  or the whole stack via Docker Compose from the repo root.

## Local development

```bash
cp .env.example .env     # then edit values as needed
npm install
npm run dev              # http://localhost:3000
```

The dev server runs on <http://localhost:3000>. Edit `app/page.tsx` (and other
files under `app/`) and the page hot-reloads.

## Commands

| Task        | Command         |
| ----------- | --------------- |
| Dev server  | `npm run dev`   |
| Build       | `npm run build` |
| Start prod  | `npm start`     |
| Lint        | `npm run lint`  |

The build uses Next.js standalone output (`output: "standalone"` in
`next.config.ts`), which is what the Docker image and the Terraform EC2
frontend run in production.

## Environment variables

`.env` is gitignored; only `.env.example` is checked in. Copy it before running:

```bash
cp .env.example .env
```

Both variables use the `NEXT_PUBLIC_` prefix, so they are inlined into the
client bundle at build time (do not put secrets here):

- `NEXT_PUBLIC_APP_URL` — public URL of the frontend.
- `NEXT_PUBLIC_API_BASE_URL` — public URL of the backend (e.g.
  `http://localhost:4000`).

## Health check

`GET /api/health` → `{ status: "ok", timestamp: <ISO> }`
(`app/api/health/route.ts`). It is marked `dynamic = "force-dynamic"` so the
timestamp isn't statically cached.

## How it fits with the backend

The frontend calls the NestJS backend at `NEXT_PUBLIC_API_BASE_URL`. The runtime
request flow is:

```
Browser → Next.js (3000) → NestJS (4000) → Postgres (5432)
```

For the full stack in one command (Postgres + backend + frontend + Adminer), use
Docker Compose from the repo root — see the [root README](../README.md).
