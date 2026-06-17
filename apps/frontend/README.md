# @vms/frontend

Next.js (App Router) frontend for the AATC Visitor Management System.

This app is part of a Turborepo monorepo — **do not run commands from this folder
in isolation**. See the [root README](../../README.md) for setup, how to run the
stack, environment variables, i18n, and architecture.

Quick reference (from the repo root):

```bash
npm run dev   -w @vms/frontend         # dev server (http://localhost:3000)
npm run build -w @vms/frontend
```

Key areas: `app/[locale]/` (login `/` + dashboard, locale routing), `data/`
(HTTP client + API modules), `shared/` (auth context, providers, route guard),
`i18n/` + `messages/` (en/fr/ar). UI comes from `@vms/ui`; design tokens from
`@vms/tokens`.
