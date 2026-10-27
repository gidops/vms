# VMS documentation

**Who this is for:** anyone looking for the right document. **What you'll
learn:** what each doc covers and who it is written for. For setup, start with
the [root README](../README.md).

| Doc                                          | For                                              | Covers                                                                                           |
| -------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [user-guide.md](./user-guide.md)             | Everyone, including non-technical users          | Roles, the life of a visit, every screen, alerts, evacuation roll, consent, Insights, Operations |
| [architecture.md](./architecture.md)         | Developers                                       | Code layout, how a request flows, backend modules, outbox, auth and RBAC, audit, frontend layers |
| [api.md](./api.md)                           | Developers, testers                              | API conventions, auth flow, every endpoint with its required permission                          |
| [infrastructure.md](./infrastructure.md)     | Developers, operators, managers                  | How the system runs locally and on AWS, explained simply, with a glossary and known risks        |
| [operations.md](./operations.md)             | Developers, operators                            | Commands: local setup, Docker, database, one-off imports, AWS deploy, troubleshooting            |
| [ci-quality.md](./ci-quality.md)             | Developers, maintainers                          | GitHub Actions checks, coverage gates, SonarQube, Jenkins deploys                                |
| [notifications.md](./notifications.md)       | Backend developers, whoever configures messaging | Email, SMS, WhatsApp and in-app messages, templates, translations, WhatsApp setup                |
| [design-system.md](./design-system.md)       | Frontend developers, designers                   | Design tokens, the component library, Storybook, dark mode and right-to-left                     |
| [admin-console-v2.md](./admin-console-v2.md) | Frontend developers                              | Why `/admin` and `/admin/v2` coexist, what v2 contains, and the cutover steps                    |

Suggested reading order for a new developer: root README → user guide →
architecture → operations → api.
