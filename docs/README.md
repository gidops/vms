# VMS documentation

To run the system, follow the [root README](../README.md).

## For everyone

| Doc                           | Covers                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| [User guide](./user-guide.md) | Roles, the life of a visit, every screen, alerts, evacuation roll, consent, Insights |

## For managers and operators

| Doc                                   | Covers                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------- |
| [Infrastructure](./infrastructure.md) | How the system runs locally and on AWS, explained simply, with a glossary |
| [Operations](./operations.md)         | Running in Docker, one-off imports, deploying to AWS, troubleshooting     |

## For developers

| Doc                                 | Covers                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| [Developer guide](./development.md) | Stack, layout, rules every change follows, commands, unfinished work. **Start here.**      |
| [Architecture](./architecture.md)   | How a request flows, backend modules, outbox events, auth and permissions, audit, frontend |
| [API](./api.md)                     | Every endpoint and the permission it needs                                                 |
| [CI and quality](./ci-quality.md)   | GitHub Actions checks, coverage gates, SonarQube, Jenkins deploys                          |
| [Notifications](./notifications.md) | Email, SMS, WhatsApp and in-app messages, templates, translations, WhatsApp setup          |
| [Design system](./design-system.md) | Design tokens, the component library, Storybook, dark mode and right-to-left               |

Reading order for a new developer: root README → user guide → developer guide →
architecture → API.
