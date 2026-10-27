# AATC Visitor Management System (VMS)

**Who this is for:** anyone opening this repository for the first time. **What
you'll learn:** what the system does, how to run it, how the repo is laid out,
and where the detailed docs are.

The VMS manages visitors to the Afreximbank African Trade Centre (AATC) in
Abuja. Staff invite guests, the Security Manager approves or flags each visit,
and reception checks visitors in and out with a badge. Every step is recorded,
and visitors who need help in an emergency appear on a live evacuation roll.

It is a web app in English, French and Arabic. The backend is NestJS
(TypeScript) with PostgreSQL; the frontend is Next.js. They share request and
response definitions and a component library. Infrastructure runs on AWS,
described with Terraform.

## Tech stack

Next.js 16 · NestJS 11 · Prisma 6 + PostgreSQL 16 · Tailwind CSS v4 · Radix UI /
React Aria · Storybook 9 · zod · TanStack Query · Turborepo + npm workspaces ·
Docker · Terraform (AWS) · GitHub Actions · Jenkins.

## Quick start

You need **Node 20.11.0** (via `nvm`), npm 10 or newer, and **Docker**.

1. Clone and install:
   ```bash
   git clone https://github.com/gidops/vms.git
   cd vms
   nvm use
   npm install
   ```
2. Build the shared packages once (the backend needs the built contracts):
   ```bash
   npx turbo run build
   ```
3. Create your env files from the examples (`.env` files are not in Git):
   ```bash
   cp apps/backend/.env.example apps/backend/.env
   cp apps/frontend/.env.example apps/frontend/.env
   ```
   Fill in at least `DATABASE_URL` and `JWT_SECRET` (backend) and
   `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` (frontend). Each example
   file explains its variables.
4. Start the database, a database browser (Adminer) and the log viewer (Seq):
   ```bash
   docker compose up -d postgres adminer seq
   ```
5. Create the database tables:
   ```bash
   cd apps/backend && npx prisma migrate deploy && cd ../..
   ```
6. Run the apps, each in its own terminal:
   ```bash
   npm run start:dev -w @vms/backend    # http://localhost:4000
   npm run dev -w @vms/frontend         # http://localhost:3000
   ```
7. Open <http://localhost:3000/signup> and create the first admin account. No
   user is seeded; signup closes once one user exists.

| Service        | URL                                                                             |
| -------------- | ------------------------------------------------------------------------------- |
| App            | <http://localhost:3000/> (`/fr`, `/ar` for French and Arabic)                   |
| Backend health | <http://localhost:4000/health>                                                  |
| Adminer        | <http://localhost:8080> (server `postgres`, user/password/db `vms`/`vms`/`vms`) |
| Seq            | <http://localhost:8081>                                                         |
| Storybook      | `npm run storybook -w @vms/ui` → <http://localhost:6006>                        |

Running everything in Docker, database commands and troubleshooting:
[docs/operations.md](./docs/operations.md).

## Common commands

```bash
npx turbo run build                        # build everything
npx turbo run lint:check typecheck test    # main CI checks
npm run format                             # format code
npm run <script> -w @vms/backend           # run a script in one workspace
```

## Repository layout

```
apps/
  backend/      NestJS API: feature modules, Prisma schema and migrations
  frontend/     Next.js web app: screens, data layer, translations
packages/
  contracts/    @vms/contracts: shared request/response schemas, roles, permissions
  ui/           @vms/ui: component library + Storybook
  tokens/       @vms/tokens: design tokens (colours, type, spacing)
  config/       @vms/config: shared ESLint and TypeScript settings
docs/           documentation (see below)
terraform/      the app's AWS environment: network, load balancer, one EC2 server, RDS database
bootstrap/      one-time AWS setup: S3 bucket for Terraform state + DynamoDB lock table
governance/     AWS account guardrails: CloudTrail audit trail, GuardDuty, cost budgets
jenkins/        the Jenkins server and its IAM role (deploy permissions)
scripts/        helper scripts: GitHub check gate for Jenkins, local SonarQube scan
vms-deploy.sh   builds images and deploys to AWS
Jenkinsfile     deploy pipeline (manual, main/staging only)
.github/        GitHub Actions CI workflow
```

## Documentation

| Doc                                            | What it covers                                                 |
| ---------------------------------------------- | -------------------------------------------------------------- |
| [User guide](./docs/user-guide.md)             | Roles, the visit lifecycle and every screen, in plain language |
| [Architecture](./docs/architecture.md)         | How the code is organised and how a request flows              |
| [API](./docs/api.md)                           | Every endpoint and the permission it needs                     |
| [Infrastructure](./docs/infrastructure.md)     | How it runs locally and on AWS, explained simply               |
| [Operations](./docs/operations.md)             | Commands for running, deploying and troubleshooting            |
| [CI and quality](./docs/ci-quality.md)         | Automated checks, coverage, SonarQube, Jenkins deploys         |
| [Notifications](./docs/notifications.md)       | Email, SMS, WhatsApp and in-app messages                       |
| [Design system](./docs/design-system.md)       | Tokens, components, Storybook                                  |
| [Admin console v2](./docs/admin-console-v2.md) | The two admin consoles and the cutover plan                    |

Full index: [docs/README.md](./docs/README.md).

## Branches

`main` (production) · `staging` (pre-production) · `develop` (active
development). GitHub Actions runs on pushes and pull requests to all three;
`main` and `staging` require it to pass. Deploys run from Jenkins on `main` or
`staging` only.
