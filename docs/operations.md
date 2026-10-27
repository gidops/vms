# Operations

**Who this is for:** developers and operators who run, configure, deploy or
troubleshoot the VMS. **What you'll learn:** exact commands for local
development, full Docker, database tasks, one-off imports, AWS deployment and
common fixes. For the concepts behind these steps, read
[infrastructure.md](./infrastructure.md) first.

All commands run from the repository root unless stated otherwise.

## 1. Prerequisites

- Node 20.11.0 (`nvm use` reads `.nvmrc`), npm 10 or newer
- Docker (Docker Desktop on Windows/macOS)
- For AWS work: Terraform 1.9 or newer, AWS CLI v2

## 2. Local development

DB in Docker, apps on your machine with hot reload.

1. Install and build once:
   ```bash
   nvm use
   npm install                 # also runs prisma generate
   npx turbo run build         # builds @vms/contracts dist, needed by the backend
   ```
2. Create the env files (they are not in Git):
   ```bash
   cp apps/backend/.env.example apps/backend/.env
   cp apps/frontend/.env.example apps/frontend/.env
   ```
   Fill in at least `DATABASE_URL` and `JWT_SECRET` in the backend file, and
   `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` in the frontend file.
3. Start the database, the database browser and the log viewer:
   ```bash
   docker compose up -d postgres adminer seq
   ```
4. Apply migrations:
   ```bash
   cd apps/backend && npx prisma migrate deploy && cd ../..
   ```
5. Start the apps in two terminals:
   ```bash
   npm run start:dev -w @vms/backend    # http://localhost:4000
   npm run dev -w @vms/frontend         # http://localhost:3000
   ```
6. Open <http://localhost:3000/signup> and create the first System Admin. No user
   is seeded. Signup locks as soon as a user exists (later attempts get 403 and
   are audited as `auth.signup_blocked`). To reopen it locally, wipe the
   database.

Set `SEED_DEMO_DATA=true` in the backend `.env` to get demo visits and alerts.

### Local URLs

| Service        | URL                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| Frontend       | <http://localhost:3000/> (`/fr`, `/ar` for French and Arabic)                                         |
| Backend health | <http://localhost:4000/health>                                                                        |
| Adminer        | <http://localhost:8080>: System **PostgreSQL**, server **postgres**, user/password/db **vms/vms/vms** |
| Seq            | <http://localhost:8081> (ingestion on port 5341)                                                      |
| Storybook      | `npm run storybook -w @vms/ui` → <http://localhost:6006>                                              |

### Seq (log and audit search)

Seq is a searchable view of audit events. Postgres `AuditLog` stays the system
of record.

1. Start the backend with `SEQ_URL=http://localhost:5341` (in `.env` or inline).
2. Open <http://localhost:8081>, filter `audit = true` or
   `action = 'auth.login_failed'`.
3. Events written through the outbox (e.g. `auth.user_logged_in`) appear after
   the relay's next poll (default 2 s); direct security events (e.g.
   `auth.login_failed`) appear at once.

## 3. Full stack in Docker

1. In `apps/backend/.env`, set the database host to the service name:
   `DATABASE_URL="postgresql://vms:vms@postgres:5432/vms"`.
2. Run:
   ```bash
   docker compose up --build
   ```
   The backend container waits for the database, runs migrations, then starts.
3. Stop with `docker compose down` (add `-v` to delete the database volume).

## 4. Everyday commands

```bash
npx turbo run build                        # build everything
npx turbo run lint:check typecheck test    # the main CI checks
npm run format                             # prettier
npm run test -w @vms/backend               # backend unit tests + coverage
npm run test:e2e -w @vms/backend           # backend e2e (needs a test database)
npm run test -w @vms/frontend              # frontend unit tests (Vitest)
npm run storybook -w @vms/ui
```

Database (run inside `apps/backend`):

```bash
npx prisma migrate dev --name <name>   # create and apply a migration (dev)
npx prisma migrate deploy              # apply pending migrations
npx prisma studio                      # browse data
npx prisma generate                    # regenerate the client after schema edits
```

Code quality scans (SonarQube, coverage) are in [ci-quality.md](./ci-quality.md).

## 5. Environment variables

The backend validates its env at boot and refuses to start on a missing or
invalid value. The full list with comments is in `apps/backend/.env.example`;
an overview is in [infrastructure.md](./infrastructure.md#5-environment-variables).
Messaging variables are in [notifications.md](./notifications.md#configuration).

## 6. Walk-in QR: importing the old (v1) QR

The old system's QR poster may already be printed at the desk. To keep it
working, import its token into v2:

```bash
npm run desk-qr:import-v1 -w @vms/backend -- "https://aatcabuja.com.ng/qr.php?i=<32 hex>" desk-inbox@example.org
```

In a built image: `node dist/scripts/import-v1-desk-qr.js <link> <email>`.

- Once the domain serves v2, `/qr.php?i=<hex>` redirects to the v2 form.
- Re-running is safe. Pressing **New QR** later replaces the imported token.
- The 6-digit code is emailed to the desk inbox, so email must be enabled. With
  `EMAIL_ENABLED=false` visitors are told to register at the desk.

**Rate limits** for the public form are counted in memory per backend process
(per phone IP and per QR). Behind a proxy, set `TRUST_PROXY_HOPS` to the number
of proxies in front of the backend (`1` behind the AWS load balancer; Terraform
already sets this). Never set Express `trust proxy` to `true`: clients could
then fake `X-Forwarded-For` and bypass the per-IP limits.

## 7. Legacy data migration (one-off)

`apps/backend/scripts/migrate-legacy.ts` imports the old VMS database dump
(MariaDB/phpMyAdmin SQL) into Postgres. It is idempotent (safe to re-run), marks
imported visits with source `LEGACY_IMPORT`, and gives every imported staff user
an unusable random password (they log in after a password reset).

From `apps/backend`, with `DATABASE_URL` pointing at the target database:

```bash
npx ts-node --transpile-only scripts/migrate-legacy.ts --dump <file.sql>          # dry run (default)
npx ts-node --transpile-only scripts/migrate-legacy.ts --dump <file.sql> --apply  # write
```

## 8. Deploying to AWS

The app runs as prebuilt Docker images pulled from ECR onto **one EC2 server**
(`aws_instance.app`) behind an HTTPS load balancer. Terraform state lives in S3
(`terraform/provider.tf`), so everyone shares one state.

### 8.1 One-time setup

1. **State bucket.** If the S3 state bucket does not exist yet, apply
   `bootstrap/` once:
   ```bash
   terraform -chdir=bootstrap init
   terraform -chdir=bootstrap apply -var="state_bucket_name=<globally-unique-name>"
   ```
   Then make sure the bucket name in each stack's `backend "s3"` block matches.
2. **DNS.** The Route 53 hosted zone for the domain (default `aatcvms.online`)
   must exist and the registrar's nameservers must point at it, or certificate
   validation hangs.
3. **Variables.** Copy `terraform/terraform.tfvars.example` to
   `terraform/terraform.tfvars` (not in Git) and fill in email (and optional
   WhatsApp) settings. Without email credentials the backend only logs emails.

### 8.2 Before each deploy (on the machine you deploy from)

1. Docker running, with enough memory to build the frontend image.
2. AWS access: the scripts use the SSO profile `platta-nonprod` by default
   (override with `AWS_PROFILE`). Log in with
   `aws sso login --profile platta-nonprod` and check with
   `aws sts get-caller-identity`.
3. You are at the repo root on the commit you want to ship. Uncommitted changes
   produce a `-dirty` image tag that cannot be rebuilt later; the script warns.

### 8.3 Run the deploy

`vms-deploy.sh` has exactly two modes:

| Command                                              | Use when                                                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `./vms-deploy.sh --deploy [backend\|frontend\|both]` | Ship new code. Default target is `both`. Works on a brand-new stack too (then the target must be `both`). |
| `./vms-deploy.sh --redeploy`                         | The server is broken but the images are fine. Replaces the server with the same image tags, no rebuild.   |

What `--deploy` does:

1. `terraform init` against the S3 state.
2. Tags images with the current Git commit (`git describe --always --dirty`).
3. On a fresh stack, first creates only the ECR repositories and the load
   balancer (so images can be pushed and the API address is known).
4. Logs in to ECR, builds and pushes the chosen image(s). The frontend is built
   with `NEXT_PUBLIC_API_BASE_URL=https://api.<domain>` and the script checks the
   address is inside the bundle.
5. Runs `terraform plan`, pauses for you to review, then `terraform apply`. The
   app you did not rebuild keeps its current tag.

**Review the plan.** It should only create or replace `aws_instance.app` and its
two target group attachments. Stop (Ctrl-C) if it shows `aws_db_instance.main`:
that would destroy the database.

Set `VMS_AUTO_APPROVE=1` to skip the pause and Terraform's own prompt (Jenkins
does this after its manual approval step). `VMS_API_BASE_URL` overrides the
baked-in API address for one-off builds.

From Jenkins: see [ci-quality.md](./ci-quality.md#deploying-with-jenkins).

### 8.4 Check the deploy

Wait 2–3 minutes after apply; the server finishes booting after Terraform
returns.

1. Open `https://api.<domain>/health`. Expect `"database": "connected"`.
2. Open `https://<domain>/` and sign in.
3. If something is wrong, open a shell on the server (no SSH; use Session
   Manager with the `app_instance_id` output):
   ```bash
   aws ssm start-session --target "$(terraform -chdir=terraform output -raw app_instance_id)"
   sudo docker ps                        # vms-backend and vms-frontend should be Up
   sudo docker logs vms-backend          # migrations applied, Nest started
   sudo cat /var/log/user-data.log       # the boot script's output
   ```
   (`aws ssm start-session` needs the Session Manager plugin for the AWS CLI.)

Useful outputs: `terraform -chdir=terraform output` lists `app_url`,
`api_base_url`, `alb_dns_name`, `rds_endpoint`, `app_instance_id` and the
deployed image tags.

### 8.5 Tear down

```bash
terraform -chdir=terraform destroy -var="backend_image_tag=x" -var="frontend_image_tag=x"
```

The two tag variables have no default, so pass any value. This deletes the
database with **no final snapshot** in the dev environment. The state bucket,
governance and Jenkins stacks are separate and are not affected.

## 9. Troubleshooting

| Symptom                                                          | Fix                                                                                                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Backend `database: "disconnected"` or 500s                       | Postgres not running or wrong `DATABASE_URL` host (`localhost` vs `postgres`). Check `docker compose ps`.                               |
| Backend exits with "Invalid environment variables"               | A required env value is missing or malformed; the message names it.                                                                     |
| `@vms/contracts` not found, or stale types                       | Run `npx turbo run build`.                                                                                                              |
| Every nested route 404s in `next dev`                            | Stale dev cache: `rm -rf apps/frontend/.next` and restart.                                                                              |
| Can't log in on a new database                                   | No user exists yet: create one at `/signup`.                                                                                            |
| Port already in use                                              | Something else uses 3000/4000; stop it or change `PORT`.                                                                                |
| Deploy: `docker login` fails with "stub received bad data" (WSL) | The script removes the broken `credsStore` entry automatically; if `python3` is missing, delete that line from `~/.docker/config.json`. |
| Deploy: frontend calls the wrong API                             | The API address is baked at build time. Rebuild with `./vms-deploy.sh --deploy frontend`.                                               |
| Deploy: AWS "token expired"                                      | `aws sso login --profile platta-nonprod`.                                                                                               |
