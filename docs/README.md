# VMS Documentation

Detailed documentation for the AATC Visitor Management System. For a quick
start, see the [root README](../README.md).

| Doc                                                                            | Contents                                                                                                                                        |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [architecture.md](./architecture.md)                                           | Monorepo layout, backend modular monolith & layering, event‑driven outbox, auth/RBAC, observability, data model, frontend layering              |
| [runbook.md](./runbook.md)                                                     | Running locally (dev & full Docker), environment variables, commands, migrations, deployment, troubleshooting                                   |
| [infrastructure.md](./infrastructure.md)                                       | Plain-language mental model: how containers, the DB, and env vars work locally vs AWS prod, how they communicate, and prod gotchas to watch for |
| [api.md](./api.md)                                                             | HTTP endpoints, auth flow, request/response shapes, errors, correlation IDs                                                                     |
| [api-inventory.md](./api-inventory.md)                                         | Complete Postman-ready endpoint catalogue (28 endpoints) + planned routes                                                                       |
| [system-inspection-report.md](./system-inspection-report.md)                   | Architecture audit — i18n, event-driven, microservice readiness, testing, risks                                                                 |
| [design-system.md](./design-system.md)                                         | Design tokens, component catalogue, Storybook, dark mode & RTL                                                                                  |
| [notifications.md](./notifications.md)                                         | Notification system (In-App/Email/SMS/WhatsApp), email templating, transports, backend localization                                             |
| [whatsapp-setup.md](./whatsapp-setup.md)                                       | WhatsApp channel setup & testing — Twilio sandbox / Meta Cloud API config, running, approved templates, troubleshooting                         |
| [client-presentation-canva-prompts.md](./client-presentation-canva-prompts.md) | Executive client deck — paste-ready Canva AI prompts, speaker notes, narrative flow                                                             |

Repo guide for AI assistants: [CLAUDE.md](../CLAUDE.md).
