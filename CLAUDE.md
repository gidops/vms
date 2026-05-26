# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AATC Visitor Management System (VMS) — tracks visitors at AATC.

## Stack

- **Frontend:** Next.js (TypeScript, App Router, Tailwind CSS)
- **Backend:** NestJS (TypeScript, REST API)
- **Database:** PostgreSQL

## Structure

```
vms/
├── frontend/   # Next.js app (App Router, Tailwind, @/* alias, npm)
└── backend/    # NestJS app (REST API, npm)
```

Each app has its own `package.json`, `tsconfig.json`, and `node_modules`. Run all npm commands from inside the respective folder.

## Commands

### Frontend (`cd frontend`)

| Task        | Command         |
| ----------- | --------------- |
| Dev server  | `npm run dev`   |
| Build       | `npm run build` |
| Start prod  | `npm start`     |
| Lint        | `npm run lint`  |

Dev server runs on `http://localhost:3000` by default. Turbopack is intentionally disabled.

### Backend (`cd backend`)

| Task               | Command                |
| ------------------ | ---------------------- |
| Dev server (watch) | `npm run start:dev`    |
| Start              | `npm start`            |
| Start prod         | `npm run start:prod`   |
| Build              | `npm run build`        |
| Lint (auto-fix)    | `npm run lint`         |
| Unit tests         | `npm test`             |
| Single test file   | `npm test -- path/to/file.spec.ts` |
| E2E tests          | `npm run test:e2e`     |
| Coverage           | `npm run test:cov`     |

Nest dev server runs on `http://localhost:3000` by default — change the port in `backend/src/main.ts` or via `PORT` env var to avoid clashing with the frontend in local dev.
